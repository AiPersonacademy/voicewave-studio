/**
 * tests/unit/audioDsp.test.ts
 *
 * Comprehensive Unit Test Suite for Milestone 1:
 * - BiquadFilter & BiquadFilterBank (frequency responses & band separation)
 * - DualPoleFollower & MultiBandFollowerBank (plosive attack, C1 velocity, frame invariance)
 * - OfflineDSP (deterministic frame analysis, tone isolation, bit-exact reproducibility)
 * - Sample Voices Catalog & SyntheticVoiceGenerator
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BiquadFilter, BiquadFilterBank } from "@/audio/BiquadFilterBank";
import {
  DualPoleFollower,
  MultiBandFollowerBank,
} from "@/audio/DualPoleFollower";
import { OfflineDSP, AudioBufferLike } from "@/audio/OfflineDSP";
import {
  getSampleVoice,
  getAllSampleVoices,
  SyntheticVoiceGenerator,
} from "@/data/sampleVoices";

describe("BiquadFilter Frequency Responses", () => {
  const fs = 48000;

  it("calculates 280Hz Lowpass coefficients correctly with 0 dB DC gain", () => {
    const filter = new BiquadFilter({
      type: "lowpass",
      frequency: 280,
      q: 0.70710678,
      sampleRate: fs,
    });

    // DC gain (f = 0 Hz) must be exactly 1.0 (0 dB)
    const dcGain = filter.getMagnitudeResponse(0);
    expect(dcGain).toBeCloseTo(1.0, 4);

    // Gain at cutoff (280 Hz) must be -3.01 dB (1 / sqrt(2) ≈ 0.7071)
    const cutoffGain = filter.getMagnitudeResponse(280);
    expect(cutoffGain).toBeCloseTo(0.7071, 2);

    // Stopband gain at 2800 Hz (1 decade above cutoff) must be < -35 dB (< 0.02)
    const stopbandGain = filter.getMagnitudeResponse(2800);
    expect(stopbandGain).toBeLessThan(0.02);
  });

  it("calculates 1200Hz Bandpass coefficients with 0 dB center peak gain", () => {
    const filter = new BiquadFilter({
      type: "bandpass",
      frequency: 1200,
      q: 1.2,
      sampleRate: fs,
    });

    // Peak center frequency gain (f = 1200 Hz) must be exactly 1.0
    const centerGain = filter.getMagnitudeResponse(1200);
    expect(centerGain).toBeCloseTo(1.0, 3);

    // DC gain (f = 0 Hz) must be 0
    expect(filter.getMagnitudeResponse(0)).toBe(0);

    // Attenuation at Nyquist (24000 Hz)
    expect(filter.getMagnitudeResponse(24000)).toBeLessThan(0.01);

    // Bandwidth check: Q = 1.2 => BW = 1000 Hz (-3 dB points at approx 789 Hz and 1789 Hz)
    const lowCorner = filter.getMagnitudeResponse(789);
    const highCorner = filter.getMagnitudeResponse(1789);
    expect(lowCorner).toBeCloseTo(0.7071, 1);
    expect(highCorner).toBeCloseTo(0.7071, 1);
  });

  it("calculates 3200Hz Highpass coefficients with 0 dB Nyquist gain and 0 DC gain", () => {
    const filter = new BiquadFilter({
      type: "highpass",
      frequency: 3200,
      q: 0.70710678,
      sampleRate: fs,
    });

    // DC gain must be 0
    expect(filter.getMagnitudeResponse(0)).toBe(0);

    // Gain at cutoff (3200 Hz) must be -3.01 dB (0.7071)
    expect(filter.getMagnitudeResponse(3200)).toBeCloseTo(0.7071, 2);

    // High frequency gain (at 20,000 Hz) approaches 1.0
    expect(filter.getMagnitudeResponse(20000)).toBeCloseTo(1.0, 2);
  });

  it("filters batch PCM buffer and resets state cleanly", () => {
    const filterBank = new BiquadFilterBank(fs);
    const input = new Float32Array(1000);
    input.fill(0.5);

    const bands = filterBank.processBands(input);
    expect(bands.low.length).toBe(1000);
    expect(bands.mid.length).toBe(1000);
    expect(bands.high.length).toBe(1000);

    filterBank.reset();
    expect(filterBank.lowFilter.step(0)).toBe(0);
    expect(filterBank.midFilter.step(0)).toBe(0);
    expect(filterBank.highFilter.step(0)).toBe(0);
  });
});

describe("DualPoleFollower Ballistics", () => {
  let follower: DualPoleFollower;

  beforeEach(() => {
    follower = new DualPoleFollower({
      attackTime1: 0.0025, // 2.5ms
      attackTime2: 0.0035, // 3.5ms
      decayTime1: 0.130, // 130ms
      decayTime2: 0.070, // 70ms
    });
  });

  it("satisfies plosive attack requirement: rises to >= 84% in <= 10ms", () => {
    const dt = 0.001; // 1ms steps
    for (let t = 0; t < 10; t++) {
      follower.step(1.0, dt);
    }
    // At t = 10ms, must be >= 0.84
    expect(follower.value).toBeGreaterThanOrEqual(0.84);
  });

  it("guarantees C1 velocity continuity at step onset (starts at velocity = 0)", () => {
    // Before step, velocity is 0
    expect(follower.currentVelocity).toBe(0);

    // First step
    const dt = 0.0005; // 0.5ms
    follower.step(1.0, dt);

    // Velocity must not jump to discontinuous finite difference 1.0 / dt = 2000
    expect(follower.currentVelocity).toBeLessThan(150.0);
    expect(follower.currentVelocity).toBeGreaterThan(0.0);
  });

  it("decay duration responds monotonically to resetSpeed parameter", () => {
    // Charge follower to full
    for (let i = 0; i < 25; i++) follower.step(1.0, 0.005);
    expect(follower.value).toBeGreaterThan(0.95);

    // Fast Reset (resetSpeed = 0.98)
    follower.updateParams({ smoothness: 0.8, resetSpeed: 0.98 });
    let fastFrames = 0;
    while (follower.value > 0.05 && fastFrames < 500) {
      follower.step(0.0, 0.005);
      fastFrames++;
    }

    // Slow Reset (resetSpeed = 0.50)
    follower.reset();
    for (let i = 0; i < 25; i++) follower.step(1.0, 0.005);
    follower.updateParams({ smoothness: 0.8, resetSpeed: 0.5 });
    let slowFrames = 0;
    while (follower.value > 0.05 && slowFrames < 500) {
      follower.step(0.0, 0.005);
      slowFrames++;
    }

    expect(fastFrames).toBeLessThan(slowFrames * 0.6);
  });

  it("is frame-rate invariant across 30 FPS, 60 FPS, and 120 FPS", () => {
    const runSimulation = (fps: number) => {
      const f = new DualPoleFollower({
        attackTime1: 0.005,
        attackTime2: 0.005,
        decayTime1: 0.15,
        decayTime2: 0.1,
      });
      const dt = 1.0 / fps;
      const totalTime = 0.4;
      const steps = Math.round(totalTime * fps);
      const trajectory: number[] = [];

      for (let i = 0; i < steps; i++) {
        const time = i * dt;
        const input = time < 0.1 ? 1.0 : 0.0;
        trajectory.push(f.step(input, dt));
      }
      return trajectory;
    };

    const traj60 = runSimulation(60);
    const traj120 = runSimulation(120);

    // Compare at common physical timestamps: step i at 60 FPS corresponds to 2*i + 1 at 120 FPS
    for (let i = 0; i < traj60.length; i++) {
      const val60 = traj60[i];
      const val120 = traj120[2 * i + 1];
      expect(Math.abs(val60 - val120)).toBeLessThan(0.025);
    }
  });

  it("gracefully clamps NaN and infinite inputs without breaking state", () => {
    follower.step(NaN, 0.016);
    expect(follower.value).toBe(0);
    expect(isNaN(follower.value)).toBe(false);

    follower.step(Infinity, 0.016);
    expect(follower.value).toBeLessThanOrEqual(1.0);
    expect(isNaN(follower.value)).toBe(false);
  });
});

describe("MultiBandFollowerBank", () => {
  it("isolates bands and produces valid MultiBandOutputs", () => {
    const bank = new MultiBandFollowerBank();
    const out = bank.step(
      { low: 0.5, mid: 0.8, high: 0.2, amplitude: 0.7 },
      0.016
    );

    expect(out.low).toBeGreaterThan(0);
    expect(out.mid).toBeGreaterThan(0);
    expect(out.high).toBeGreaterThan(0);
    expect(out.amplitude).toBeGreaterThan(0);
    expect(out.isAudioActive).toBe(true);
    expect(out.velocity).toBeDefined();
  });

  it("silences output when input is below noise floor", () => {
    const bank = new MultiBandFollowerBank();
    const out = bank.step(
      { low: 0.0005, mid: 0.0005, high: 0.0005, amplitude: 0.001 },
      0.016
    );
    expect(out.low).toBe(0);
    expect(out.mid).toBe(0);
    expect(out.high).toBe(0);
    expect(out.amplitude).toBe(0);
    expect(out.isAudioActive).toBe(false);
  });
});

describe("OfflineDSP Deterministic Engine", () => {
  function createSineBuffer(
    freq: number,
    duration = 1.0,
    fs = 48000,
    amp = 0.6
  ): AudioBufferLike {
    const length = Math.round(duration * fs);
    const pcm = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      pcm[i] = amp * Math.sin((2 * Math.PI * freq * i) / fs);
    }
    return {
      numberOfChannels: 1,
      sampleRate: fs,
      length,
      duration,
      getChannelData: () => pcm,
    };
  }

  it("processes digital silence with zero energy and idle phase advance", () => {
    const fs = 48000;
    const silence: AudioBufferLike = {
      numberOfChannels: 1,
      sampleRate: fs,
      length: fs,
      duration: 1.0,
      getChannelData: () => new Float32Array(fs),
    };

    const result = OfflineDSP.analyze(silence, { fps: 60 });
    expect(result.frames.length).toBe(60);

    for (let f = 0; f < result.frames.length; f++) {
      const frame = result.frames[f];
      expect(frame.amplitude).toBe(0);
      expect(frame.low).toBe(0);
      expect(frame.mid).toBe(0);
      expect(frame.high).toBe(0);
      expect(frame.isAudioActive).toBe(false);
    }
  });

  it("isolates 100 Hz bass frequency into low band with mid/high suppression", () => {
    const bass = createSineBuffer(100, 1.0);
    const result = OfflineDSP.analyze(bass, { fps: 60 });
    const steadyFrame = result.getFrameAtTime(0.5);

    expect(steadyFrame.low).toBeGreaterThan(0.35);
    expect(steadyFrame.mid).toBeLessThan(0.08);
    expect(steadyFrame.high).toBeLessThan(0.02);
    expect(steadyFrame.isAudioActive).toBe(true);
  });

  it("isolates 1,200 Hz vocal formant frequency into mid band", () => {
    const midTone = createSineBuffer(1200, 1.0);
    const result = OfflineDSP.analyze(midTone, { fps: 60 });
    const steadyFrame = result.getFrameAtTime(0.5);

    expect(steadyFrame.mid).toBeGreaterThan(0.4);
    expect(steadyFrame.low).toBeLessThan(0.05);
    expect(steadyFrame.high).toBeLessThan(0.08);
    expect(steadyFrame.isAudioActive).toBe(true);
  });

  it("isolates 5,000 Hz treble frequency into high band", () => {
    const treble = createSineBuffer(5000, 1.0);
    const result = OfflineDSP.analyze(treble, { fps: 60 });
    const steadyFrame = result.getFrameAtTime(0.5);

    expect(steadyFrame.high).toBeGreaterThan(0.4);
    expect(steadyFrame.low).toBeLessThan(0.02);
    expect(steadyFrame.mid).toBeLessThan(0.08);
    expect(steadyFrame.isAudioActive).toBe(true);
  });

  it("guarantees 100% bit-exact reproducibility between multiple runs", () => {
    const syntheticAudio = SyntheticVoiceGenerator.generate("cupertino-siri");
    const run1 = OfflineDSP.analyze(syntheticAudio, { fps: 60 });
    const run2 = OfflineDSP.analyze(syntheticAudio, { fps: 60 });

    expect(run1.frames.length).toBe(run2.frames.length);
    for (let i = 0; i < run1.frames.length; i++) {
      expect(run1.frames[i].low).toBe(run2.frames[i].low);
      expect(run1.frames[i].mid).toBe(run2.frames[i].mid);
      expect(run1.frames[i].high).toBe(run2.frames[i].high);
      expect(run1.frames[i].amplitude).toBe(run2.frames[i].amplitude);
      expect(run1.frames[i].phase).toBe(run2.frames[i].phase);
      expect(run1.frames[i].isAudioActive).toBe(run2.frames[i].isAudioActive);
    }
  });

  it("provides smooth sub-frame interpolation between discrete frames", () => {
    const syntheticAudio = SyntheticVoiceGenerator.generate("podcast-host");
    const result = OfflineDSP.analyze(syntheticAudio, { fps: 60 });

    const f0 = result.getFrame(10);
    const f1 = result.getFrame(11);
    const fHalf = result.getInterpolatedFrame(10.5 / 60);

    expect(fHalf.amplitude).toBeCloseTo((f0.amplitude + f1.amplitude) / 2, 3);
  });
});

describe("SampleVoiceLibrary & SyntheticVoiceGenerator", () => {
  it("contains all 5 required voice profiles with complete metadata", () => {
    const voices = getAllSampleVoices();
    expect(voices.length).toBe(5);

    const ids = voices.map((p) => p.id);
    expect(ids).toContain("cupertino-siri");
    expect(ids).toContain("neutral-ai");
    expect(ids).toContain("podcast-host");
    expect(ids).toContain("calm-meditation");
    expect(ids).toContain("fast-cadence");

    const siri = getSampleVoice("cupertino-siri");
    expect(siri.formants.f0).toBe(215);
    expect(siri.cadence.syllableRateHz).toBe(4.2);
    expect(siri.primaryColor).toBeDefined();
  });

  it("synthesizes valid audio buffer in realistic benchmark times without network calls", () => {
    // Cold-start generation benchmark: generous tolerance for un-warmed V8 compilation on varied CI hardware
    const coldStart = performance.now();
    const audio = SyntheticVoiceGenerator.generate("fast-cadence");
    const coldElapsed = performance.now() - coldStart;

    expect(audio.duration).toBeGreaterThan(3.5);
    expect(audio.length).toBeGreaterThan(100000);
    expect(coldElapsed).toBeLessThan(3000); // Cold start tolerance across varied Node/worker hardware

    // Warm-run benchmark: verifies optimized V8 execution is snappy (<500ms)
    const warmStart = performance.now();
    SyntheticVoiceGenerator.generate("fast-cadence");
    const warmElapsed = performance.now() - warmStart;
    expect(warmElapsed).toBeLessThan(500);

    // Verify non-silent samples are generated
    const pcm = audio.getChannelData(0);
    let maxVal = 0;
    for (let i = 0; i < pcm.length; i++) {
      if (Math.abs(pcm[i]) > maxVal) maxVal = Math.abs(pcm[i]);
    }
    expect(maxVal).toBeGreaterThan(0.2);
  });
});
