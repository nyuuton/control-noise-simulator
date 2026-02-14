
import { AppState, ComponentConfig, WindowFunction, WaveformShape } from '../types';
import { boxMullerTransform, PinkNoiseGenerator } from './noise';

const SAMPLE_RATE = 4000; // Scaled down for visualization
export const BUFFER_SIZE = 1024;

// Persistent state for noise
const pinkNoise = new PinkNoiseGenerator();

export interface SimulationResult {
  idealBuffer: Float32Array;
  noisyBuffer: Float32Array;
  maxAmplitude: number;
  estimatedT2: number;
}

// Simple Filter State Class
class FilterState {
  x1 = 0; x2 = 0;
  y1 = 0; y2 = 0;
}

// Map component IDs to filter states to persist memory
const filterStates = new Map<string, FilterState>();

function getFilterState(id: string) {
  if (!filterStates.has(id)) filterStates.set(id, new FilterState());
  return filterStates.get(id)!;
}

function processChain(signal: number, components: ComponentConfig[]): number {
  let s = signal;
  for (const comp of components) {
    if (comp.type === 'attenuator') {
      s *= Math.pow(10, -comp.value / 20);
    } else if (comp.type === 'amplifier') {
      s *= Math.pow(10, comp.value / 20);
      s += (Math.random() - 0.5) * 0.01 * (comp.value / 10); 
    } else {
      // Filters
      const state = getFilterState(comp.id);
      const alpha = comp.value; // 0.01 to 0.99
      
      if (comp.type === 'lowpass') {
        state.y1 = state.y1 + alpha * (s - state.y1);
        s = state.y1;
      } else if (comp.type === 'highpass') {
        const hpAlpha = 1 - alpha;
        const y = hpAlpha * (state.y1 + s - state.x1);
        state.x1 = s;
        state.y1 = y;
        s = y;
      } else if (comp.type === 'notch') {
        const avg = (s + state.x1)/2;
        s = (1-alpha)*s + alpha*(s - avg); // Simple Bandstop approx
        state.x1 = s;
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

export function simulateFrame(
  params: AppState, 
  timeOffset: number, 
  activeStage: string
): SimulationResult {
  
  const idealBuffer = new Float32Array(BUFFER_SIZE);
  const noisyBuffer = new Float32Array(BUFFER_SIZE);

  // Frequency Planning
  const loFreqViz = 20 + (params.mixer.loFreq - 4) * 20; 
  const ncoFreqViz = params.awg.ncoFreq * 20; 
  const carrierFreq = loFreqViz + ncoFreqViz; // The actual freq out of mixer

  // Pulse Parameters from Source Layer
  const period = BUFFER_SIZE / 2;
  const pulseWidthSamples = (params.source.pulseWidth / 100) * BUFFER_SIZE; 
  const riseTimeSamples = (params.source.riseTime / 100) * BUFFER_SIZE;

  // Ideal Gain Calculation
  let idealMult = 1.0;
  if (['cable_room', 'cable_cryo', 'qubit'].includes(activeStage)) {
    idealMult *= getChainGain(params.cable_room.components);
  }
  if (['cable_cryo', 'qubit'].includes(activeStage)) {
    idealMult *= getChainGain(params.cable_cryo.components);
  }
  if (activeStage === 'qubit') {
    idealMult *= params.qubit.coupling;
  }

  // Noise accumulator for T2 calc
  let totalNoisePower = 0;

  for (let i = 0; i < BUFFER_SIZE; i++) {
    const t = (timeOffset + i) / SAMPLE_RATE;
    const relPos = i % period; // 0 to period

    // --- SOURCE LAYER: Envelope Generation ---
    let envelope = 1.0;
    
    // Waveform Shape
    if (params.source.waveformShape === 'gaussian') {
      const center = period / 2;
      const sigma = pulseWidthSamples / 6; 
      const x = relPos - center;
      envelope = Math.exp(-(x * x) / (2 * sigma * sigma));
    } else if (params.source.waveformShape === 'square') {
      const center = period / 2;
      const halfWidth = pulseWidthSamples / 2;
      const dist = Math.abs(relPos - center);
      const flatHalf = halfWidth - riseTimeSamples;
      
      if (dist <= flatHalf) {
          envelope = 1.0;
      } else if (dist <= halfWidth) {
          // Ramp region
          if (riseTimeSamples > 0) {
             const distFromEdge = halfWidth - dist;
             // Cosine squared ramp (Tukey window style)
             // 0 at edge, 1 at flat start
             envelope = 0.5 * (1 - Math.cos((distFromEdge / riseTimeSamples) * Math.PI));
          } else {
             envelope = 1.0;
          }
      } else {
          envelope = 0.0;
      }
    }
    
    // Windowing (Apply to envelope)
    // Simplified: modulation of the envelope
    if (params.source.windowFunction !== 'none') {
       const winPos = relPos / period;
       let winVal = 1.0;
       if (params.source.windowFunction === 'hanning') {
         winVal = 0.5 - 0.5 * Math.cos(2 * Math.PI * winPos);
       } else if (params.source.windowFunction === 'hamming') {
         winVal = 0.54 - 0.46 * Math.cos(2 * Math.PI * winPos);
       } else if (params.source.windowFunction === 'blackman') {
         winVal = 0.42 - 0.5 * Math.cos(2 * Math.PI * winPos) + 0.08 * Math.cos(4 * Math.PI * winPos);
       }
       envelope *= winVal;
    }

    // --- STAGE 0: Source (Ideal Pulse) ---
    // If visualizing Source, we just show the baseband envelope or a carrier at target freq?
    // Let's show "Target Freq" representation for Source visualization
    const targetFreqViz = 20 + (params.source.targetFreq - 4) * 20;
    const idealSource = params.awg.amp * envelope * Math.cos(2 * Math.PI * targetFreqViz * t + params.awg.phase);

    // Ideal Calculation (Final Reference)
    idealBuffer[i] = (params.awg.amp * idealMult * envelope) * Math.cos(2 * Math.PI * carrierFreq * t + params.awg.phase);
    
    let signal = idealSource; // Default to source for first step

    // --- STAGE 1: AWG (Implementation) ---
    // Here we use NCO freq, usually Baseband + NCO, effectively IF.
    // The AWG outputs the NCO signal modulated by the pulse.
    const phaseJitter = (Math.random() - 0.5) * params.awg.phaseNoise * 5; 
    let I_nco = params.awg.amp * envelope * Math.cos(2 * Math.PI * ncoFreqViz * t + params.awg.phase + phaseJitter);
    let Q_nco = params.awg.amp * envelope * Math.sin(2 * Math.PI * ncoFreqViz * t + params.awg.phase + phaseJitter);
    
    if (stageIndex(activeStage) >= 1) {
       // If viewing AWG or later, we start with the NCO signal
       signal = I_nco; 
    } else {
       // If viewing Source (Stage 0), we show the ideal target
       signal = idealSource;
    }

    // --- STAGE 2: DAC ---
    if (stageIndex(activeStage) >= 2) {
      const levels = Math.pow(2, params.dac.resolution);
      I_nco = Math.round(I_nco * levels) / levels;
      Q_nco = Math.round(Q_nco * levels) / levels;
      signal = I_nco; // Visualizing DAC output I channel
    }

    // --- STAGE 3: Mixer (Upconversion) ---
    // RF = I*cos(w_lo) - Q*sin(w_lo)
    if (stageIndex(activeStage) >= 3) {
      const loTermI = Math.cos(2 * Math.PI * loFreqViz * t);
      const loTermQ = Math.sin(2 * Math.PI * loFreqViz * t + params.mixer.iqPhaseImbalance);
      const leakage = params.mixer.loLeakage * loTermI;
      
      const iImbal = I_nco * params.mixer.iqAmpImbalance;
      const qImbal = Q_nco;

      signal = (iImbal * loTermI) - (qImbal * loTermQ) + leakage;
    }

    // --- STAGE 4: Room Temp ---
    if (stageIndex(activeStage) >= 4) {
       signal = processChain(signal, params.cable_room.components);
       const thermal = Math.sqrt(params.cable_room.temp) * 0.002 * boxMullerTransform();
       signal += thermal;
    }

    // --- STAGE 5: Cryo ---
    if (stageIndex(activeStage) >= 5) {
       signal = processChain(signal, params.cable_cryo.components);
       const thermal = Math.sqrt(params.cable_cryo.temp) * 0.002 * boxMullerTransform();
       const flicker = pinkNoise.next() * params.cable_cryo.flickerNoise! * 0.02;
       signal += thermal + flicker;
    }

    // --- STAGE 6: Qubit ---
    if (stageIndex(activeStage) >= 6) {
       signal *= params.qubit.coupling;
       
       const idealAtQubit = idealBuffer[i]; 
       const noise = signal - idealAtQubit;
       totalNoisePower += noise * noise;
    }

    noisyBuffer[i] = signal;
  }

  // --- T2 Estimation ---
  const noiseRMS = Math.sqrt(totalNoisePower / BUFFER_SIZE);
  const dephasingRate = noiseRMS * 2.0; 
  const t1_rate = 1 / (2 * params.qubit.t1_us);
  const total_decay_rate = t1_rate + dephasingRate;
  const estimatedT2 = total_decay_rate > 0 ? 1 / total_decay_rate : 0;

  // Scale Max Amp for Viz
  let maxAmp = params.awg.amp * 1.5;
  if (stageIndex(activeStage) >= 4) maxAmp *= getChainGain(params.cable_room.components);
  if (stageIndex(activeStage) >= 5) maxAmp *= getChainGain(params.cable_cryo.components);
  maxAmp = Math.max(maxAmp, 0.05);

  return { idealBuffer, noisyBuffer, maxAmplitude: maxAmp, estimatedT2 };
}

function stageIndex(id: string): number {
  const order = ['source', 'awg', 'dac', 'mixer', 'cable_room', 'cable_cryo', 'qubit'];
  return order.indexOf(id);
}
