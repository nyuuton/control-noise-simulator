
export interface SimulationState {
  time: number;
}

export type WaveformShape = 'sine' | 'gaussian' | 'square';
export type WindowFunction = 'none' | 'hanning' | 'hamming' | 'blackman';

export interface SourceParams {
  // Planning / Ideal Definition
  targetFreq: number; // GHz
  waveformShape: WaveformShape;
  pulseWidth: number; // ns (Total Duration)
  riseTime: number;   // ns (Ramp duration for Square/Trapezoid)
  windowFunction: WindowFunction;
}

export interface AWGParams {
  // Hardware Implementation
  ncoFreq: number;    // GHz (Digital IF Offset)
  amp: number;        // Volts
  phase: number;      // Radians
  phaseNoise: number; // Jitter magnitude
}

export interface DACParams {
  resolution: number; // Bits
  sampleJitter: number; // Timing error
}

export interface MixerParams {
  loFreq: number;         // GHz (Local Oscillator)
  loLeakage: number;      // Voltage offset
  iqAmpImbalance: number; // Ratio
  iqPhaseImbalance: number; // Radians
}

export type ComponentType = 'attenuator' | 'amplifier' | 'lowpass' | 'highpass' | 'notch';

export interface ComponentConfig {
  id: string;
  type: ComponentType;
  value: number; // dB for Att/Amp, Cutoff/Center (0-1) for Filters
}

export interface CableParams {
  temp: number;        // Kelvin
  flickerNoise?: number; // 1/f magnitude (only for Cryo)
  components: ComponentConfig[];
}

export interface QubitParams {
  coupling: number;    // Coupling strength 0-1
  t1_us: number;       // T1 Relaxation time (microseconds)
}

export interface AppState {
  source: SourceParams;
  awg: AWGParams;
  dac: DACParams;
  mixer: MixerParams;
  cable_room: CableParams;
  cable_cryo: CableParams;
  qubit: QubitParams;
}

export interface StageDefinition {
  id: keyof AppState;
  name: string;
  description: string;
  componentType: 'Logic' | 'Analog' | 'Quantum';
}
