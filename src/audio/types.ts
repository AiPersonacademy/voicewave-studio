/**
 * src/audio/types.ts
 *
 * Core audio DSP type definitions, interfaces, and contracts for VoiceWave Studio.
 * Conforms to PROJECT.md §7.2 specifications.
 */

export type BiquadType = "lowpass" | "bandpass" | "highpass";

export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface BiquadFilterConfig {
  type: BiquadType;
  frequency: number;
  q: number;
  sampleRate: number;
}

export interface RawBandRMS {
  rawBroadband: number;
  rawLow: number;
  rawMid: number;
  rawHigh: number;
}

export interface CalibratedBandEnergy {
  /** Bass energy (< 280 Hz), normalized [0.0, 1.0] */
  low: number;
  /** Vocal mid formant energy (~1200 Hz), normalized [0.0, 1.0] */
  mid: number;
  /** Treble / sibilance energy (> 3200 Hz), normalized [0.0, 1.0] */
  high: number;
  /** Broadband RMS volume, normalized [0.0, 1.0] */
  amplitude: number;
  /** Voice activity gating flag */
  isActive: boolean;
}

export interface LiveAudioFrame extends CalibratedBandEnergy {
  timestamp: number;
  previewBars: Float32Array; // 16 downsampled preview bars for UI
}

/**
 * Standardized FrameData contract matching PROJECT.md §7.2
 */
export interface FrameData {
  frameIndex: number;
  timestamp: number;
  low: number;
  mid: number;
  high: number;
  amplitude: number;
  phase: number;
  isAudioActive: boolean;
}

export interface AudioBandMetrics {
  low: number;
  mid: number;
  high: number;
  amplitude: number;
  isAudioActive: boolean;
  velocity?: number;
}

export interface AudioBufferLike {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  duration: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioEngineConfig {
  sampleRate?: number;
  fftSize?: number; // Defaults to 512
}

export type AudioEngineOptions = AudioEngineConfig;

export interface DualPoleConfig {
  /** Attack time constant for stage 1 in seconds */
  attackTime1: number;
  /** Attack time constant for stage 2 in seconds */
  attackTime2: number;
  /** Base decay time constant for stage 1 in seconds */
  decayTime1: number;
  /** Base decay time constant for stage 2 in seconds */
  decayTime2: number;
  /** Minimum input noise floor threshold (values below are zeroed) */
  threshold?: number;
  /** Gain multiplier applied to input before ballistics */
  gain?: number;
}

export interface UserDynamicsParams {
  /** Fluidity / Viscosity slider [0.65, 0.98] or [0.0, 1.0] */
  smoothness: number;
  /** Clean reset speed slider [0.50, 0.98] or [0.0, 1.0] */
  resetSpeed: number;
  /** Reactivity sensitivity multiplier [0.2, 3.0] */
  sensitivity?: number;
}

export interface FollowerState {
  /** Current smoothed envelope output [0.0, 1.0] */
  value: number;
  /** Primary detector state */
  s1: number;
  /** Secondary liquid state */
  s2: number;
  /** Continuous first derivative (dy/dt) in units/sec */
  velocity: number;
}

export interface MultiBandInputs {
  low: number;
  mid: number;
  high: number;
  amplitude: number;
}

export interface MultiBandOutputs {
  low: number;
  mid: number;
  high: number;
  amplitude: number;
  isAudioActive: boolean;
  /** Master velocity for shader momentum / turbulence drive */
  velocity: number;
}

export interface SampleVoice {
  id: string;
  name: string;
  category: "assistant" | "ai" | "broadcast" | "wellness" | "keynote";
  speaker: string;
  description: string;
  transcript: string;
  duration: number; // Approximate seconds
  primaryColor: string; // visionOS accent color
  tags: string[];
  formants: {
    f0: number; // Fundamental frequency / pitch (Hz)
    f1: number; // First formant (vowel body) (Hz)
    f2: number; // Second formant (tongue position) (Hz)
    f3: number; // Third formant (clarity/timbre) (Hz)
  };
  cadence: {
    syllableRateHz: number; // Syllable pacing rate (Hz)
    pauseRatio: number; // Ratio of pauses to speech
  };
  audioUrl: string;
}

export type VoiceProfile = SampleVoice;
