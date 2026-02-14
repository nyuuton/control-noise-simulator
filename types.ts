
export interface SimulationState {
  time: number;
}

export type EnvelopeType = 'cw' | 'rectangular' | 'gaussian' | 'library';
export type LibraryWindowType = 'hanning' | 'hamming' | 'blackman';
export type NoiseType = 'thermal' | 'interference';

export interface SourceParams {
  // Planning / Ideal Definition
  targetFreq: number; // GHz
  
  // Envelope Definition
  envelopeType: EnvelopeType;
  
  // Common Params
  pulseWidth: number; // ns (Total Duration)
  
  // Type-Specific Params
  riseTime: number;         // ns (For Rectangular: Ramp duration)
  sigma: number;            // ns (For Gaussian: Standard Deviation)
  libraryWindow: LibraryWindowType; // (For Library: Hanning, etc.)
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
  noiseType?: NoiseType; // For room temp: 'thermal' or 'interference'
  noiseIntensity?: number; // Scalar multiplier for the noise
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
