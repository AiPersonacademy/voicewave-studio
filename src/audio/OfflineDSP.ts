/**
 * src/audio/OfflineDSP.ts
 *
 * Precision Deterministic Offline Audio DSP Engine for VoiceWave Studio.
 * Conforms to PROJECT.md §7.2 FrameData contract.
 *
 * Features:
 * - Decoupled AudioBufferLike interface for main thread, Web Worker, and headless execution.
 * - Universal stereo/multi-channel downmix to mono.
 * - 3-band Biquad IIR filtering (280Hz Lowpass, 1200Hz Bandpass, 3200Hz Highpass).
 * - O(1) prefix sum-of-squares moving RMS window in Float64Array.
 * - Acoustic cross-talk isolation matrix for pristine band separation.
 * - Calibrated vocal acoustic curves and 2-pole liquid ballistics.
 * - Continuous sub-frame interpolation for live audio-visual synchronization.
 */

import { BiquadFilter } from "./BiquadFilterBank";
import { DualPoleFollower } from "./DualPoleFollower";
import type { FrameData, AudioBufferLike } from "./types";

export type { FrameData, AudioBufferLike };

export interface OfflineDSPOptions {
  fps?: number; // Frame rate for video export (default: 60)
  targetDuration?: number; // Clamped export duration in seconds (default: full)
  sensitivity?: number; // Reactivity multiplier (default: 1.0, range: 0.2 - 3.0)
  smoothness?: number; // Liquid follower smoothing (default: 0.75, range: 0.0 - 1.0)
  resetSpeed?: number; // Ballistic release speed (default: 0.70, range: 0.0 - 1.0)
  windowDurationMs?: number; // RMS analysis window in ms (default: 38.0)
  lowCutoff?: number; // Lowpass frequency in Hz (default: 280.0)
  midCutoff?: number; // Bandpass frequency in Hz (default: 1200.0)
  midQ?: number; // Bandpass Q factor (default: 1.2)
  highCutoff?: number; // Highpass frequency in Hz (default: 3200.0)
}

/**
 * Result container returned by OfflineDSP.analyze()
 */
export class OfflineDSPResult {
  constructor(
    public readonly frames: FrameData[],
    public readonly fps: number,
    public readonly duration: number,
    public readonly sampleRate: number,
    public readonly analysisTimeMs: number
  ) {}

  public get length(): number {
    return this.frames.length;
  }

  public getFrame(index: number): FrameData {
    if (this.frames.length === 0) return this.createEmptyFrame(0, 0);
    const clampedIndex = Math.max(0, Math.min(this.frames.length - 1, index));
    return this.frames[clampedIndex];
  }

  public getFrameAtTime(timestamp: number): FrameData {
    if (this.frames.length === 0) return this.createEmptyFrame(0, 0);
    const frameIndex = Math.round(timestamp * this.fps);
    return this.getFrame(frameIndex);
  }

  /**
   * Continuous sub-frame linear interpolation for jitter-free live playback sync
   */
  public getInterpolatedFrame(timestamp: number): FrameData {
    if (this.frames.length === 0) return this.createEmptyFrame(0, 0);
    const exactIndex = timestamp * this.fps;
    const i0 = Math.floor(exactIndex);
    const i1 = i0 + 1;
    const fract = Math.max(0, Math.min(1, exactIndex - i0));

    const f0 = this.getFrame(i0);
    if (fract <= 1e-4 || i1 >= this.frames.length) return f0;
    const f1 = this.getFrame(i1);

    // Unwrapped phase interpolation across 20π boundary
    let p1 = f1.phase;
    if (p1 < f0.phase) p1 += 20 * Math.PI;
    const interpPhase = (f0.phase + (p1 - f0.phase) * fract) % (20 * Math.PI);

    return {
      frameIndex: i0,
      timestamp,
      low: f0.low + (f1.low - f0.low) * fract,
      mid: f0.mid + (f1.mid - f0.mid) * fract,
      high: f0.high + (f1.high - f0.high) * fract,
      amplitude: f0.amplitude + (f1.amplitude - f0.amplitude) * fract,
      phase: interpPhase,
      isAudioActive: fract < 0.5 ? f0.isAudioActive : f1.isAudioActive,
    };
  }

  private createEmptyFrame(index: number, timestamp: number): FrameData {
    return {
      frameIndex: index,
      timestamp,
      low: 0,
      mid: 0,
      high: 0,
      amplitude: 0,
      phase: 0,
      isAudioActive: false,
    };
  }
}

/**
 * Deterministic Offline DSP Precomputation Engine
 */
export class OfflineDSP {
  /**
   * Precomputes sample-accurate animation frames from an audio buffer.
   * Guaranteed 100% bit-exact across multiple runs and environments.
   */
  public static analyze(
    audio: AudioBufferLike,
    options: OfflineDSPOptions = {}
  ): OfflineDSPResult {
    const startTime = performance.now();
    const fs = audio.sampleRate;
    const totalSamples = audio.length;
    const numChannels = audio.numberOfChannels;

    const fps = options.fps ?? 60;
    const dt = 1.0 / fps;
    const targetDuration = Math.min(
      options.targetDuration ?? audio.duration,
      audio.duration
    );
    const totalFrames = Math.max(1, Math.round(targetDuration * fps));

    const sensitivity = options.sensitivity ?? 1.0;
    const smoothness = options.smoothness ?? 0.75;
    const resetSpeed = options.resetSpeed ?? 0.70;
    const windowDurationMs = options.windowDurationMs ?? 38.0;

    const lowFc = options.lowCutoff ?? 280.0;
    const midFc = options.midCutoff ?? 1200.0;
    const midQ = options.midQ ?? 1.2;
    const highFc = options.highCutoff ?? 3200.0;

    // 1. Universal Mono Downmixing with Defensive NaN/Infinity Sanitization
    const mono = new Float32Array(totalSamples);
    if (numChannels === 1) {
      const ch0 = audio.getChannelData(0);
      for (let i = 0; i < totalSamples; i++) {
        const sample = ch0[i];
        mono[i] = Number.isFinite(sample) ? sample : 0.0;
      }
    } else {
      const scale = 1.0 / numChannels;
      for (let c = 0; c < numChannels; c++) {
        const ch = audio.getChannelData(c);
        for (let i = 0; i < totalSamples; i++) {
          const sample = ch[i];
          if (Number.isFinite(sample)) {
            mono[i] += sample * scale;
          }
        }
      }
    }

    // 2. 3-Band Biquad IIR Filtering
    const lowSig = new Float32Array(totalSamples);
    const midSig = new Float32Array(totalSamples);
    const highSig = new Float32Array(totalSamples);

    const lpFilter = new BiquadFilter({
      type: "lowpass",
      frequency: lowFc,
      q: 0.70710678,
      sampleRate: fs,
    });
    const bpFilter = new BiquadFilter({
      type: "bandpass",
      frequency: midFc,
      q: midQ,
      sampleRate: fs,
    });
    const hpFilter = new BiquadFilter({
      type: "highpass",
      frequency: highFc,
      q: 0.70710678,
      sampleRate: fs,
    });

    for (let i = 0; i < totalSamples; i++) {
      const s = mono[i];
      lowSig[i] = lpFilter.step(s);
      midSig[i] = bpFilter.step(s);
      highSig[i] = hpFilter.step(s);
    }

    // 3. O(1) Prefix Sum-of-Squares in Float64Array (prevents numeric loss of significance)
    // Table length is totalSamples + 1. cum[i + 1] = sum_{k=0}^i x[k]^2
    const cumMono = new Float64Array(totalSamples + 1);
    const cumLow = new Float64Array(totalSamples + 1);
    const cumMid = new Float64Array(totalSamples + 1);
    const cumHigh = new Float64Array(totalSamples + 1);

    for (let i = 0; i < totalSamples; i++) {
      const m = mono[i];
      const l = lowSig[i];
      const mi = midSig[i];
      const h = highSig[i];

      cumMono[i + 1] = cumMono[i] + m * m;
      cumLow[i + 1] = cumLow[i] + l * l;
      cumMid[i + 1] = cumMid[i] + mi * mi;
      cumHigh[i + 1] = cumHigh[i] + h * h;
    }

    // 4. Initialize 2-Pole Cascaded Ballistics Followers
    const lowFollower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.220,
      decayTime2: 0.120,
      threshold: 0.0,
      gain: 1.0,
    });
    const midFollower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.130,
      decayTime2: 0.070,
      threshold: 0.0,
      gain: 1.0,
    });
    const highFollower = new DualPoleFollower({
      attackTime1: 0.0015,
      attackTime2: 0.0020,
      decayTime1: 0.070,
      decayTime2: 0.040,
      threshold: 0.0,
      gain: 1.0,
    });
    const ampFollower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0040,
      decayTime1: 0.160,
      decayTime2: 0.080,
      threshold: 0.0,
      gain: 1.0,
    });
    const actFollower = new DualPoleFollower({
      attackTime1: 0.004,
      attackTime2: 0.008,
      decayTime1: 0.180,
      decayTime2: 0.100,
      threshold: 0.0,
      gain: 1.0,
    });

    const userDynamics = { smoothness, resetSpeed };
    lowFollower.updateParams(userDynamics);
    midFollower.updateParams(userDynamics);
    highFollower.updateParams(userDynamics);
    ampFollower.updateParams(userDynamics);
    actFollower.updateParams(userDynamics);

    const windowSize = Math.max(1, Math.round(fs * (windowDurationMs / 1000.0)));
    const halfWindow = Math.floor(windowSize / 2);

    let phase = 0;
    const frames: FrameData[] = new Array(totalFrames);

    // 5. Deterministic Frame Precomputation Loop
    for (let f = 0; f < totalFrames; f++) {
      const t = f * dt;
      const center = Math.round(t * fs);
      const start = Math.max(0, center - halfWindow);
      const end = Math.min(totalSamples, start + windowSize);
      const count = end - start;

      let rmsMono = 0;
      let rmsLow = 0;
      let rmsMid = 0;
      let rmsHigh = 0;

      if (count > 0) {
        const dMono = (cumMono[end] - cumMono[start]) / count;
        const dLow = (cumLow[end] - cumLow[start]) / count;
        const dMid = (cumMid[end] - cumMid[start]) / count;
        const dHigh = (cumHigh[end] - cumHigh[start]) / count;

        rmsMono = dMono > 0 ? Math.sqrt(dMono) : 0.0;
        rmsLow = dLow > 0 ? Math.sqrt(dLow) : 0.0;
        rmsMid = dMid > 0 ? Math.sqrt(dMid) : 0.0;
        rmsHigh = dHigh > 0 ? Math.sqrt(dHigh) : 0.0;
      }

      // Cross-talk matrix decimation for pristine frequency band separation
      const isoLow = Math.max(0, rmsLow - 0.05 * rmsMid);
      const isoMid = Math.max(0, rmsMid - 0.08 * rmsLow - 0.20 * rmsHigh);
      const isoHigh = Math.max(0, rmsHigh - 0.15 * rmsMid);

      // Calibrated Vocal Acoustic Curves & Noise Gates
      const inAmp = Math.min(1.0, Math.max(0, (rmsMono - 0.005) * 4.8 * sensitivity));
      const inLow = Math.min(1.0, Math.max(0, (isoLow - 0.003) * 4.5 * sensitivity));
      const inMid = Math.min(1.0, Math.max(0, (isoMid - 0.003) * 5.2 * sensitivity));
      const inHigh = Math.min(1.0, Math.max(0, (isoHigh - 0.002) * 6.0 * sensitivity));
      const inActive = inAmp > 0.015;

      const targetAmp = inActive ? inAmp : 0;
      const targetActive = inActive ? 1.0 : 0.0;

      const lowVal = lowFollower.step(inLow, dt);
      const midVal = midFollower.step(inMid, dt);
      const highVal = highFollower.step(inHigh, dt);
      const ampVal = ampFollower.step(targetAmp, dt);
      const actVal = actFollower.step(targetActive, dt);

      // Phase integration modulated by vocal energy
      const currentSpeed = 0.85 + actVal * (0.75 * ampVal * sensitivity);
      phase = (phase + currentSpeed * dt) % (20.0 * Math.PI);

      frames[f] = {
        frameIndex: f,
        timestamp: t,
        low: lowVal,
        mid: midVal,
        high: highVal,
        amplitude: ampVal,
        phase,
        isAudioActive: actVal > 0.08,
      };
    }

    const analysisTimeMs = performance.now() - startTime;
    return new OfflineDSPResult(frames, fps, targetDuration, fs, analysisTimeMs);
  }
}
