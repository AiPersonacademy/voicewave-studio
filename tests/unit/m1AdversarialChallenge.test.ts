/**
 * .agents/explorer_m1_fix_3/proposed_m1AdversarialChallenge.test.ts
 *
 * Harmonized Adversarial Challenge Suite for Milestone 1 Audio Subsystem:
 * Strictly verifies post-remediation behavior:
 * 1. Attack rise time (<10ms for vocal plosive detection across all followers including low band)
 * 2. Smooth decay without derivative jerk ($C^1$ velocity continuity)
 * 3. Numerical stability under denormal floats, extreme amplitudes, NaNs, infinite inputs
 * 4. Zero reactivity collapse when NaN audio samples are encountered
 * 5. Bit-exact deterministic parity across multiple runs and conditions
 */

import { describe, it, expect } from "vitest";
import { BiquadFilter } from "@/audio/BiquadFilterBank";
import {
  DualPoleFollower,
  MultiBandFollowerBank,
} from "@/audio/DualPoleFollower";
import { OfflineDSP, AudioBufferLike } from "@/audio/OfflineDSP";
import { SyntheticVoiceGenerator } from "@/data/sampleVoices";

function makeAudioBuffer(
  pcm: Float32Array,
  sampleRate = 48000,
  channels = 1
): AudioBufferLike {
  return {
    numberOfChannels: channels,
    sampleRate,
    length: pcm.length,
    duration: pcm.length / sampleRate,
    getChannelData: (_channel: number) => pcm,
  };
}

describe("Adversarial Challenge 1: Attack Rise Time (<10ms)", () => {
  it("evaluates rise time to 80% and 90% steady state for DualPoleFollower default", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.13,
      decayTime2: 0.07,
    });

    const dt = 0.0005; // 0.5ms resolution
    let timeTo80 = -1;
    let timeTo90 = -1;
    let timeTo10 = -1;

    for (let step = 1; step <= 100; step++) {
      const t = step * dt;
      const val = follower.step(1.0, dt);
      if (val >= 0.1 && timeTo10 === -1) timeTo10 = t;
      if (val >= 0.8 && timeTo80 === -1) timeTo80 = t;
      if (val >= 0.9 && timeTo90 === -1) timeTo90 = t;
    }

    console.log(`[Metric] DualPoleFollower default: 10%=${(timeTo10*1000).toFixed(1)}ms, 80%=${(timeTo80*1000).toFixed(1)}ms, 90%=${(timeTo90*1000).toFixed(1)}ms, 10%-90% rise time=${((timeTo90 - timeTo10)*1000).toFixed(1)}ms`);

    // 10%-90% rise time is within 10ms (9.5ms)
    expect(timeTo90 - timeTo10).toBeLessThanOrEqual(0.01);
    // Absolute time to reach 80% is within 10ms (8.5ms)
    expect(timeTo80).toBeLessThanOrEqual(0.01);
  });

  it("evaluates rise time across all bands in MultiBandFollowerBank", () => {
    const bank = new MultiBandFollowerBank();
    const dt = 0.0005; // 0.5ms

    const followers = [
      { name: "low", f: bank.lowFollower },
      { name: "mid", f: bank.midFollower },
      { name: "high", f: bank.highFollower },
      { name: "amp", f: bank.ampFollower },
    ];

    const metrics: Record<string, { valAt10ms: number; timeTo80: number; timeTo90: number }> = {};

    for (const item of followers) {
      item.f.reset();
      let timeTo80 = -1;
      let timeTo90 = -1;
      let valAt10ms = 0;

      for (let step = 1; step <= 100; step++) {
        const t = step * dt;
        const val = item.f.step(1.0, dt);
        if (val >= 0.8 && timeTo80 === -1) timeTo80 = t;
        if (val >= 0.9 && timeTo90 === -1) timeTo90 = t;
        if (Math.abs(t - 0.01) < 1e-5) valAt10ms = val;
      }

      metrics[item.name] = { valAt10ms, timeTo80, timeTo90 };
      console.log(`[Metric] Band '${item.name}': valAt10ms=${(valAt10ms * 100).toFixed(1)}%, timeTo80=${timeTo80 >= 0 ? (timeTo80 * 1000).toFixed(1) + 'ms' : '>50ms'}, timeTo90=${timeTo90 >= 0 ? (timeTo90 * 1000).toFixed(1) + 'ms' : '>50ms'}`);
    }

    // ALL bands (including Low band plosives) must satisfy <10ms attack to 80% steady state
    expect(metrics.low.timeTo80).toBeLessThanOrEqual(0.010);
    expect(metrics.low.valAt10ms).toBeGreaterThanOrEqual(0.80);
    expect(metrics.mid.timeTo80).toBeLessThanOrEqual(0.010);
    expect(metrics.high.timeTo80).toBeLessThanOrEqual(0.010);
    expect(metrics.amp.timeTo80).toBeLessThanOrEqual(0.010);
  });

  it("checks plosive burst response: 5ms rectangular pulse detection", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.13,
      decayTime2: 0.07,
    });

    const dt = 0.0005; // 0.5ms
    let maxVal = 0;

    // 5ms pulse: 10 steps of 1.0, followed by silence
    for (let step = 0; step < 50; step++) {
      const input = step < 10 ? 1.0 : 0.0;
      const val = follower.step(input, dt);
      if (val > maxVal) maxVal = val;
    }

    console.log(`[Metric] 5ms plosive burst peak detection: ${(maxVal * 100).toFixed(1)}%`);
    expect(maxVal).toBeGreaterThan(0.6);
  });

  it("checks attack performance when smoothness slider is at maximum (1.0)", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.13,
      decayTime2: 0.07,
    });
    follower.updateParams({ smoothness: 1.0, resetSpeed: 0.7 });

    const dt = 0.001; // 1ms
    let valAt10ms = 0;
    for (let step = 1; step <= 10; step++) {
      valAt10ms = follower.step(1.0, dt);
    }

    console.log(`[Metric] Value at 10ms with smoothness=1.0: ${(valAt10ms * 100).toFixed(1)}%`);
    expect(valAt10ms).toBeGreaterThan(0.75);
  });
});

describe("Adversarial Challenge 2: Decay Smoothness & C1 Continuity", () => {
  it("verifies velocity continuity across attack-to-decay transition", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.13,
      decayTime2: 0.07,
    });

    const dt = 0.001; // 1ms
    // Charge follower to steady state
    for (let i = 0; i < 50; i++) follower.step(1.0, dt);

    const steadyVal = follower.value;
    expect(steadyVal).toBeGreaterThan(0.99);

    // Abruptly cut input to 0 and track velocity across release onset
    const velocities: number[] = [];
    const values: number[] = [steadyVal];

    for (let i = 0; i < 30; i++) {
      const val = follower.step(0.0, dt);
      values.push(val);
      velocities.push(follower.currentVelocity);
    }

    // Check that analytical velocity and numerical difference (finite diff) are consistent
    for (let i = 1; i < velocities.length; i++) {
      const finiteDiffVelocity = (values[i + 1] - values[i]) / dt;
      expect(velocities[i]).toBeLessThanOrEqual(0.01);
      expect(Math.abs(velocities[i] - finiteDiffVelocity)).toBeLessThan(5.0);
    }

    // Check acceleration (finite difference of velocity) - no unbounded jerk spikes
    for (let i = 1; i < velocities.length - 1; i++) {
      const accel = (velocities[i + 1] - velocities[i]) / dt;
      expect(Math.abs(accel)).toBeLessThan(5000);
    }
  });

  it("checks decay tail continuity: anti-denormal clamping behavior", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.05,
      decayTime2: 0.03,
    });

    const dt = 0.005; // 5ms
    follower.step(1.0, dt);
    follower.step(1.0, dt);

    let prevVal = follower.value;
    let clampedJump = 0;

    for (let step = 0; step < 500; step++) {
      const curVal = follower.step(0.0, dt);
      if (prevVal > 0 && curVal === 0) {
        clampedJump = prevVal;
        break;
      }
      prevVal = curVal;
    }

    console.log(`[Metric] Anti-denormal cutoff jump at decay tail: ${clampedJump.toExponential(4)}`);
    expect(clampedJump).toBeLessThan(1e-4);
  });
});

describe("Adversarial Challenge 3: Numerical Stability Under Hostile Inputs", () => {
  it("BiquadFilter: verifies NaN input sanitization and state recovery", () => {
    const filter = new BiquadFilter({
      type: "lowpass",
      frequency: 280,
      q: 0.70710678,
      sampleRate: 48000,
    });

    // Step with normal samples
    expect(Number.isFinite(filter.step(0.5))).toBe(true);

    // Feed a single NaN sample: filter must safely sanitize and output a finite number
    const nanOut = filter.step(NaN);
    expect(Number.isFinite(nanOut)).toBe(true);

    // Resume valid inputs: filter must immediately self-recover without manual reset
    let recovered = false;
    for (let i = 0; i < 100; i++) {
      const out = filter.step(0.5);
      if (Number.isFinite(out)) {
        recovered = true;
        break;
      }
    }

    console.log(`[Verification] BiquadFilter self-recovery from single NaN: ${recovered ? 'YES' : 'NO'}`);
    expect(recovered).toBe(true);
    expect(Number.isFinite(filter.step(0.5))).toBe(true);

    // Reset recovers the filter cleanly
    filter.reset();
    expect(Number.isFinite(filter.step(0.5))).toBe(true);
  });

  it("BiquadFilter: tests behavior under +Infinity, -Infinity, and extreme amplitudes", () => {
    const filter = new BiquadFilter({
      type: "bandpass",
      frequency: 1200,
      q: 1.2,
      sampleRate: 48000,
    });

    filter.step(Infinity);
    filter.step(-Infinity);
    filter.step(1e35);
    filter.step(-1e35);

    // After extreme inputs, filter self-recovers or reset restores clean operation
    const cleanOut = filter.step(0.5);
    expect(Number.isFinite(cleanOut)).toBe(true);
  });

  it("BiquadFilter: tests denormal and subnormal float stability without stalling", () => {
    const filter = new BiquadFilter({
      type: "highpass",
      frequency: 3200,
      q: 0.70710678,
      sampleRate: 48000,
    });

    const subnormals = [
      Number.MIN_VALUE,
      1e-315,
      1e-300,
      1e-50,
      -Number.MIN_VALUE,
    ];

    for (const sub of subnormals) {
      const out = filter.step(sub);
      expect(Number.isFinite(out)).toBe(true);
    }

    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      filter.step(Number.MIN_VALUE);
    }
    const elapsed = performance.now() - t0;
    // Denormal stall prevention: Without anti-denormal clamping, 10,000 subnormal operations
    // cause floating-point microcode exception traps taking >1000ms.
    expect(elapsed).toBeLessThan(400);
  });

  it("DualPoleFollower: handles hostile inputs without throwing or poisoning state", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.13,
      decayTime2: 0.07,
    });

    const hostileInputs = [
      NaN,
      Infinity,
      -Infinity,
      1e300,
      -1e300,
      Number.MIN_VALUE,
      -0,
      0,
    ];

    for (const input of hostileInputs) {
      const out = follower.step(input, 0.016);
      expect(Number.isFinite(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(0.0);
      expect(out).toBeLessThanOrEqual(1.0);
    }

    const validOut = follower.step(0.5, 0.016);
    expect(Number.isFinite(validOut)).toBe(true);
    expect(validOut).toBeGreaterThan(0.0);
  });

  it("DualPoleFollower: handles abnormal dt values (zero, negative, NaN, massive)", () => {
    const follower = new DualPoleFollower({
      attackTime1: 0.0025,
      attackTime2: 0.0035,
      decayTime1: 0.13,
      decayTime2: 0.07,
    });

    follower.step(0.8, 0.016);
    const prevVal = follower.value;

    expect(follower.step(0.8, 0)).toBe(prevVal);
    expect(follower.step(0.8, -0.01)).toBe(prevVal);
    expect(follower.step(0.8, NaN)).toBe(prevVal);
    expect(follower.step(0.8, -Infinity)).toBe(prevVal);

    const cappedStep = follower.step(0.8, 100.0);
    expect(Number.isFinite(cappedStep)).toBe(true);
    expect(cappedStep).toBeLessThanOrEqual(1.0);
  });

  it("OfflineDSP: verifies NaN input sanitization prevents reactivity collapse", () => {
    const sampleRate = 48000;
    const duration = 1.0;
    const totalSamples = sampleRate * duration;

    // Create 400Hz pure tone audio buffer
    const cleanPcm = new Float32Array(totalSamples);
    const glitchedPcm = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const val = 0.5 * Math.sin((2 * Math.PI * 400 * i) / sampleRate);
      cleanPcm[i] = val;
      glitchedPcm[i] = val;
    }

    // Inject a single NaN sample at t = 0.1s (sample 4800)
    glitchedPcm[4800] = NaN;

    const cleanResult = OfflineDSP.analyze(makeAudioBuffer(cleanPcm, sampleRate), { fps: 60 });
    const glitchedResult = OfflineDSP.analyze(makeAudioBuffer(glitchedPcm, sampleRate), { fps: 60 });

    // At frame 30 (t = 0.5s), cleanResult has strong reactivity
    const cleanMid = cleanResult.getFrame(30).mid;
    const glitchedMid = glitchedResult.getFrame(30).mid;

    console.log(`[Verification] Mid energy at t=0.5s: Clean=${cleanMid.toFixed(4)}, GlitchedWithNaN=${glitchedMid.toFixed(4)}`);

    expect(cleanMid).toBeGreaterThan(0.2);
    // Glitched buffer must NOT collapse reactivity — isolated NaN is sanitized, preserving downstream dynamics
    expect(glitchedMid).toBeGreaterThan(0.2);
    expect(Math.abs(glitchedMid - cleanMid)).toBeLessThan(0.05);
  });

  it("OfflineDSP: handles edge case zero-length and 1-sample audio buffers safely", () => {
    const audio0 = makeAudioBuffer(new Float32Array(0), 48000);
    const res0 = OfflineDSP.analyze(audio0, { fps: 60 });
    expect(res0.frames.length).toBeGreaterThanOrEqual(1);
    expect(res0.getFrame(0).amplitude).toBe(0);

    const audio1 = makeAudioBuffer(new Float32Array([0.5]), 48000);
    const res1 = OfflineDSP.analyze(audio1, { fps: 60 });
    expect(res1.frames.length).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(res1.getFrame(0).amplitude)).toBe(true);
  });

  it("OfflineDSP: handles unusual sample rates (8000 Hz, 96000 Hz)", () => {
    for (const fs of [8000, 16000, 44100, 96000]) {
      const pcm = new Float32Array(fs);
      for (let i = 0; i < fs; i++) pcm[i] = 0.5 * Math.sin((2 * Math.PI * 400 * i) / fs);
      const audio = makeAudioBuffer(pcm, fs);
      const result = OfflineDSP.analyze(audio, { fps: 60 });
      expect(result.frames.length).toBe(60);
      expect(Number.isFinite(result.getFrame(30).mid)).toBe(true);
    }
  });
});

describe("Adversarial Challenge 4: Deterministic Parity", () => {
  it("guarantees 100% bit-exact frame output across 5 consecutive runs on pseudo-random audio", () => {
    const sampleRate = 48000;
    const duration = 2.0;
    const totalSamples = sampleRate * duration;
    const pcm = new Float32Array(totalSamples);

    let seed = 0xabcdef12;
    for (let i = 0; i < totalSamples; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = (seed / 0xffffffff) * 2 - 1;
      const t = i / sampleRate;
      const chirp = Math.sin(2 * Math.PI * (100 + 1000 * t) * t);
      const gate = (i % 12000) < 8000 ? 1.0 : 0.0;
      pcm[i] = (noise * 0.3 + chirp * 0.5) * gate;
    }

    const audio = makeAudioBuffer(pcm, sampleRate);

    const runs = [
      OfflineDSP.analyze(audio, { fps: 60 }),
      OfflineDSP.analyze(audio, { fps: 60 }),
      OfflineDSP.analyze(audio, { fps: 60 }),
      OfflineDSP.analyze(audio, { fps: 60 }),
      OfflineDSP.analyze(audio, { fps: 60 }),
    ];

    const baseline = runs[0];
    expect(baseline.frames.length).toBe(120);

    for (let r = 1; r < runs.length; r++) {
      const current = runs[r];
      expect(current.frames.length).toBe(baseline.frames.length);

      for (let f = 0; f < baseline.frames.length; f++) {
        const b = baseline.frames[f];
        const c = current.frames[f];

        expect(c.frameIndex).toBe(b.frameIndex);
        expect(c.timestamp).toBe(b.timestamp);
        expect(Object.is(c.low, b.low)).toBe(true);
        expect(Object.is(c.mid, b.mid)).toBe(true);
        expect(Object.is(c.high, b.high)).toBe(true);
        expect(Object.is(c.amplitude, b.amplitude)).toBe(true);
        expect(Object.is(c.phase, b.phase)).toBe(true);
        expect(c.isAudioActive).toBe(b.isAudioActive);
      }
    }
  });

  it("guarantees stereo downmix determinism matches identical mono calculation", () => {
    const fs = 48000;
    const len = fs;
    const left = new Float32Array(len);
    const right = new Float32Array(len);
    const mono = new Float32Array(len);

    for (let i = 0; i < len; i++) {
      left[i] = Math.sin((2 * Math.PI * 200 * i) / fs) * 0.5;
      right[i] = Math.sin((2 * Math.PI * 1000 * i) / fs) * 0.5;
      mono[i] = (left[i] + right[i]) * 0.5;
    }

    const stereoAudio: AudioBufferLike = {
      numberOfChannels: 2,
      sampleRate: fs,
      length: len,
      duration: 1.0,
      getChannelData: (c: number) => (c === 0 ? left : right),
    };

    const monoAudio: AudioBufferLike = {
      numberOfChannels: 1,
      sampleRate: fs,
      length: len,
      duration: 1.0,
      getChannelData: () => mono,
    };

    const stereoResult = OfflineDSP.analyze(stereoAudio, { fps: 60 });
    const monoResult = OfflineDSP.analyze(monoAudio, { fps: 60 });

    expect(stereoResult.frames.length).toBe(monoResult.frames.length);
    for (let f = 0; f < stereoResult.frames.length; f++) {
      const s = stereoResult.frames[f];
      const m = monoResult.frames[f];

      expect(s.low).toBeCloseTo(m.low, 5);
      expect(s.mid).toBeCloseTo(m.mid, 5);
      expect(s.high).toBeCloseTo(m.high, 5);
      expect(s.amplitude).toBeCloseTo(m.amplitude, 5);
      expect(s.phase).toBeCloseTo(m.phase, 5);
      expect(s.isAudioActive).toBe(m.isAudioActive);
    }
  });
});

describe("Adversarial Challenge 5: Performance & Synthetic Speech Benchmarking", () => {
  it("measures procedural speech generation runtime across voice profiles", () => {
    const profiles = ["cupertino-siri", "neutral-ai", "podcast-host", "calm-meditation", "fast-cadence"];
    const results: Record<string, number> = {};

    for (const p of profiles) {
      const t0 = performance.now();
      const buf = SyntheticVoiceGenerator.generate(p);
      const elapsed = performance.now() - t0;
      results[p] = elapsed;
      expect(buf.length).toBeGreaterThan(50000);
    }

    for (const [p, time] of Object.entries(results)) {
      console.log(`[Metric] SyntheticVoiceGenerator('${p}') synthesis time: ${time.toFixed(1)}ms`);
    }

    expect(results["fast-cadence"]).toBeGreaterThan(0);
  });
});
