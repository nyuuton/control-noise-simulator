
import { AppState, ComponentConfig } from '../types';
import { boxMullerTransform, PinkNoiseGenerator } from './noise';

const SAMPLE_RATE = 4000; // Scaled down for visualization
export const BUFFER_SIZE = 1024;

// PHYSICS CONSTANTS
const IMPEDANCE = 50;
const DEPHASING_SCALE = 1500.0; 

// Persistent state for noise
const pinkNoise = new PinkNoiseGenerator();

// --- MEMORY POOLING (Zero-Allocation) ---
const idealBuffer = new Float32Array(BUFFER_SIZE);
const noisyBuffer = new Float32Array(BUFFER_SIZE);
let smoothedT2 = 0; // For moving average

export interface SimulationResult {
  idealBuffer: Float32Array;
  noisyBuffer: Float32Array;
  maxAmplitude: number;
  estimatedT2: number;
  signalPowerdBm: number;
  effectiveNoiseTemp: number;
}

// Biquad Filter State
class BiquadState {
  x1 = 0; x2 = 0;
  y1 = 0; y2 = 0;
}

// Map component IDs to filter states to persist memory
const filterStates = new Map<string, BiquadState>();

function getBiquadState(id: string) {
  if (!filterStates.has(id)) filterStates.set(id, new BiquadState());
  return filterStates.get(id)!;
}

// Coefficients cache
interface BiquadCoeffs {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

function calculateCoeffs(type: string, freqGHz: number, Q: number = 0.707): BiquadCoeffs {
  const f_viz = Math.max(1, 20 + (freqGHz - 4) * 20);
  
  const omega = 2 * Math.PI * f_viz / SAMPLE_RATE;
  const alpha = Math.sin(omega) / (2 * Q);
  const cosw = Math.cos(omega);

  let b0=0, b1=0, b2=0, a0=1, a1=0, a2=0;

  if (type === 'lowpass') {
    b0 = (1 - cosw) / 2;
    b1 = 1 - cosw;
    b2 = (1 - cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw) / 2;
    b1 = -(1 + cosw);
    b2 = (1 + cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === 'notch') {
    b0 = 1;
    b1 = -2 * cosw;
    b2 = 1;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  }

  // Normalize
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0
  };
}

function processChain(signal: number, components: ComponentConfig[], coeffsMap: Map<string, BiquadCoeffs>): number {
  let s = signal;
  for (const comp of components) {
    if (comp.type === 'attenuator') {
      s *= Math.pow(10, -comp.value / 20);
    } else if (comp.type === 'amplifier') {
      s *= Math.pow(10, comp.value / 20);
      s += (Math.random() - 0.5) * 0.01 * (comp.value / 10); 
    } else {
      // Biquad Filters
      const state = getBiquadState(comp.id);
      const coeffs = coeffsMap.get(comp.id);
      
      if (coeffs) {
        const x = s;
        const y = coeffs.b0 * x + coeffs.b1 * state.x1 + coeffs.b2 * state.x2
                  - coeffs.a1 * state.y1 - coeffs.a2 * state.y2;
        state.x2 = state.x1; state.x1 = x;
        state.y2 = state.y1; state.y1 = y;
        s = y;
      }
    }
  }
  return s;
}

function getChainGain(components: ComponentConfig[]): number {
  let gaindB = 0;
  for (const comp of components) {
    if (comp.type === 'attenuator') gaindB -= comp.value;
    if (comp.type === 'amplifier') gaindB += comp.value;
  }
  return Math.pow(10, gaindB / 20);
}

// Convert voltage amplitude to dBm (assuming 50 Ohm)
function voltsToBm(vPeak: number): number {
  if (vPeak < 1e-9) return -140; // Floor
  const vRMS = vPeak / Math.sqrt(2);
  const powerWatts = (vRMS * vRMS) / IMPEDANCE;
  return 10 * Math.log10(powerWatts) + 30;
}

export function simulateFrame(
  params: AppState, 
  timeOffset: number, 
  activeStage: string
): SimulationResult {
  
  // --- 1. PREPARATION ---
  const coeffsMap = new Map<string, BiquadCoeffs>();
  const prepareCoeffs = (comps: ComponentConfig[]) => {
    for (const c of comps) {
      if (['lowpass', 'highpass', 'notch'].includes(c.type)) {
        coeffsMap.set(c.id, calculateCoeffs(c.type, c.value));
      }
    }
  };
  prepareCoeffs(params.cable_room.components);
  prepareCoeffs(params.cable_cryo.components);

  // Frequency & Pulse Constants
  const loFreqViz = 20 + (params.mixer.loFreq - 4) * 20; 
  const ncoFreqViz = params.awg.ncoFreq * 20; 
  const carrierFreq = loFreqViz + ncoFreqViz; 
  const period = BUFFER_SIZE / 2;
  const pulseWidthSamples = (params.source.pulseWidth / 100) * BUFFER_SIZE; 
  const riseTimeSamples = (params.source.riseTime / 100) * BUFFER_SIZE;
  const sigmaSamples = (params.source.sigma / 100) * BUFFER_SIZE;

  // Ideal Mult for Reference Buffer
  let idealMult = 1.0;
  if (stageIndex(activeStage) >= 4) idealMult *= getChainGain(params.cable_room.components);
  if (stageIndex(activeStage) >= 5) idealMult *= getChainGain(params.cable_cryo.components);
  if (stageIndex(activeStage) >= 6) idealMult *= params.qubit.coupling;


  // --- 2. ENGINEERING METRICS (Power & Noise Temp) ---
  
  // Calculate Signal Power (Approximate Peak Voltage through chain)
  let signalV = params.awg.amp;
  if (stageIndex(activeStage) >= 4) signalV *= getChainGain(params.cable_room.components);
  if (stageIndex(activeStage) >= 5) signalV *= getChainGain(params.cable_cryo.components);
  if (stageIndex(activeStage) >= 6) signalV *= params.qubit.coupling;
  const signalPowerdBm = voltsToBm(signalV);

  // Calculate Cascaded Noise Temperature
  let Teff = 0;
  const roomGain = getChainGain(params.cable_room.components);
  const cryoGain = getChainGain(params.cable_cryo.components);
  const roomNoiseAtQubit = params.cable_room.temp * roomGain * cryoGain;
  const cryoNoiseAtQubit = params.cable_cryo.temp * (1 - cryoGain); 
  
  if (activeStage === 'cable_room') {
      Teff = params.cable_room.temp; 
  } else if (['cable_cryo', 'qubit'].includes(activeStage)) {
      Teff = roomNoiseAtQubit + cryoNoiseAtQubit;
  } else {
      Teff = 0; 
  }


  // --- 3. T2 ESTIMATION (Variance Tracking) ---
  let accumulatedNoiseVar = 0;

  // A. AWG Phase Noise
  const jitterScaling = 5.0; 
  const jitterVar = (1/12) * Math.pow(params.awg.phaseNoise * jitterScaling, 2);
  if (stageIndex(activeStage) >= 1) {
      accumulatedNoiseVar += 0.5 * Math.pow(params.awg.amp, 2) * jitterVar;
  }

  // B. DAC Quantization
  if (stageIndex(activeStage) >= 2) {
      const step = 1 / Math.pow(2, params.dac.resolution);
      const quantVar = (step * step) / 12;
      accumulatedNoiseVar += quantVar;
  }

  // C. Room Temp Noise
  if (stageIndex(activeStage) >= 4) {
      accumulatedNoiseVar *= (roomGain * roomGain);
      const thermalStd = Math.sqrt(params.cable_room.temp) * 0.002;
      let roomNoiseVar = thermalStd * thermalStd;
      if (params.cable_room.noiseType === 'interference') roomNoiseVar += 0.0001;
      const intensity = params.cable_room.noiseIntensity ?? 1.0;
      accumulatedNoiseVar += roomNoiseVar * (intensity * intensity);
  }

  // D. Cryo Noise
  if (stageIndex(activeStage) >= 5) {
      accumulatedNoiseVar *= (cryoGain * cryoGain);
      const cryoThermalStd = Math.sqrt(params.cable_cryo.temp) * 0.002;
      const flickerAmp = (params.cable_cryo.flickerNoise || 0) * 0.01;
      accumulatedNoiseVar += cryoThermalStd * cryoThermalStd;
      accumulatedNoiseVar += flickerAmp * flickerAmp;
  }

  // E. Qubit Coupling
  if (stageIndex(activeStage) >= 6) {
      accumulatedNoiseVar *= (params.qubit.coupling * params.qubit.coupling);
  }

  const totalNoisePower = accumulatedNoiseVar;
  const dephasingRate = totalNoisePower * DEPHASING_SCALE; 
  const t1_rate = 1 / (2 * params.qubit.t1_us);
  const total_decay_rate = t1_rate + dephasingRate;
  
  const t2Limit = 2 * params.qubit.t1_us;
  const currentT2 = total_decay_rate > 1e-6 ? 1 / total_decay_rate : t2Limit;
  const clampedT2 = Math.min(t2Limit, currentT2);
  
  if (smoothedT2 === 0) smoothedT2 = clampedT2;
  smoothedT2 = smoothedT2 * 0.95 + clampedT2 * 0.05;


  // --- 4. WAVEFORM GENERATION ---
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const t = (timeOffset + i) / SAMPLE_RATE;
    const relPos = i % period; 
    const center = period / 2;
    const dist = Math.abs(relPos - center);

    // Envelope Gen (Rewritten for explicit types)
    let envelope = 1.0;
    const envType = params.source.envelopeType;

    if (envType === 'cw') {
       envelope = 1.0;
    } 
    else if (envType === 'rectangular') {
        const halfWidth = pulseWidthSamples / 2;
        const flatHalf = halfWidth - riseTimeSamples;
        
        if (dist <= flatHalf) {
            envelope = 1.0;
        } else if (dist <= halfWidth) {
            // Ramp region
            if (riseTimeSamples > 0) {
               const distFromEdge = halfWidth - dist;
               // Cosine ramp for smoother transitions than linear
               envelope = 0.5 * (1 - Math.cos((distFromEdge / riseTimeSamples) * Math.PI));
            } else {
               envelope = 1.0;
            }
        } else {
            envelope = 0.0;
        }
    } 
    else if (envType === 'gaussian') {
        // Truncate at pulseWidth boundaries? Usually Gaussian is defined by sigma
        // But for visual clarity, we'll center it and clamp if needed, or just let it decay naturally
        // If we want it to fit *within* pulseWidth, that's one way.
        // Standard approach: pulseWidth is the window size.
        const halfWidth = pulseWidthSamples / 2;
        if (dist <= halfWidth) {
            const x = relPos - center;
            envelope = Math.exp(-(x * x) / (2 * sigmaSamples * sigmaSamples));
        } else {
            envelope = 0.0;
        }
    } 
    else if (envType === 'library') {
        const halfWidth = pulseWidthSamples / 2;
        if (dist <= halfWidth) {
           const winPos = (relPos - (center - halfWidth)) / pulseWidthSamples; // 0 to 1
           const type = params.source.libraryWindow;
           
           if (type === 'hanning') envelope = 0.5 - 0.5 * Math.cos(2 * Math.PI * winPos);
           else if (type === 'hamming') envelope = 0.54 - 0.46 * Math.cos(2 * Math.PI * winPos);
           else if (type === 'blackman') envelope = 0.42 - 0.5 * Math.cos(2 * Math.PI * winPos) + 0.08 * Math.cos(4 * Math.PI * winPos);
        } else {
           envelope = 0.0;
        }
    }

    // Ideal Source
    const idealSource = params.awg.amp * envelope * Math.cos(2 * Math.PI * (20 + (params.source.targetFreq - 4) * 20) * t + params.awg.phase);
    idealBuffer[i] = (params.awg.amp * idealMult * envelope) * Math.cos(2 * Math.PI * carrierFreq * t + params.awg.phase);
    
    let signal = idealSource; 

    // STAGE 1: AWG
    const phaseJitter = (Math.random() - 0.5) * params.awg.phaseNoise * 5; 
    let I_nco = params.awg.amp * envelope * Math.cos(2 * Math.PI * ncoFreqViz * t + params.awg.phase + phaseJitter);
    let Q_nco = params.awg.amp * envelope * Math.sin(2 * Math.PI * ncoFreqViz * t + params.awg.phase + phaseJitter);
    
    if (stageIndex(activeStage) >= 1) signal = I_nco; else signal = idealSource;

    // STAGE 2: DAC
    if (stageIndex(activeStage) >= 2) {
      const levels = Math.pow(2, params.dac.resolution);
      I_nco = Math.round(I_nco * levels) / levels;
      Q_nco = Math.round(Q_nco * levels) / levels;
      signal = I_nco; 
    }

    // STAGE 3: Mixer
    if (stageIndex(activeStage) >= 3) {
      const loTermI = Math.cos(2 * Math.PI * loFreqViz * t);
      const loTermQ = Math.sin(2 * Math.PI * loFreqViz * t + params.mixer.iqPhaseImbalance);
      const leakage = params.mixer.loLeakage * loTermI;
      signal = (I_nco * params.mixer.iqAmpImbalance * loTermI) - (Q_nco * loTermQ) + leakage;
    }

    // STAGE 4: Room Temp
    if (stageIndex(activeStage) >= 4) {
       signal = processChain(signal, params.cable_room.components, coeffsMap);
       const temp = params.cable_room.temp;
       const intensity = params.cable_room.noiseIntensity ?? 1.0;
       let noiseVal = Math.sqrt(temp) * 0.002 * boxMullerTransform();
       if (params.cable_room.noiseType === 'interference') {
          const hum = 0.05 * Math.sin(2 * Math.PI * 0.5 * t); 
          const spike = Math.random() > 0.995 ? (Math.random()-0.5) * 0.5 : 0;
          noiseVal += hum + spike;
       }
       signal += noiseVal * intensity;
    }

    // STAGE 5: Cryo
    if (stageIndex(activeStage) >= 5) {
       signal = processChain(signal, params.cable_cryo.components, coeffsMap);
       const thermal = Math.sqrt(params.cable_cryo.temp) * 0.002 * boxMullerTransform();
       const flicker = pinkNoise.next() * params.cable_cryo.flickerNoise! * 0.02;
       signal += thermal + flicker;
    }

    // STAGE 6: Qubit
    if (stageIndex(activeStage) >= 6) {
       signal *= params.qubit.coupling;
    }

    noisyBuffer[i] = signal;
  }

  // Calc Max Amp for Graph Scaling
  let maxAmp = params.awg.amp * 1.5;
  if (stageIndex(activeStage) >= 4) maxAmp *= getChainGain(params.cable_room.components);
  if (stageIndex(activeStage) >= 5) maxAmp *= getChainGain(params.cable_cryo.components);
  maxAmp = Math.max(maxAmp, 0.05);

  return { 
    idealBuffer, 
    noisyBuffer, 
    maxAmplitude: maxAmp, 
    estimatedT2: smoothedT2,
    signalPowerdBm,
    effectiveNoiseTemp: Teff
  };
}

function stageIndex(id: string): number {
  const order = ['source', 'awg', 'dac', 'mixer', 'cable_room', 'cable_cryo', 'qubit'];
  return order.indexOf(id);
}
