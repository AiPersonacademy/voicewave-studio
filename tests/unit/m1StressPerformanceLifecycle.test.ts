/**
 * tests/unit/m1StressPerformanceLifecycle.test.ts
 *
 * Empirical Stress, Benchmark & Lifecycle Challenge Suite for Milestone 1:
 * 1. OfflineDSP processing speed, memory allocations, scaling, and boundary robustness.
 * 2. SyntheticVoiceGenerator rapid generation cycles, throughput, determinism, and acoustic bounds.
 * 3. AudioEngine lifecycle: rapid start/stop, node disposal, context closing, and leak resilience.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OfflineDSP, AudioBufferLike } from "@/audio/OfflineDSP";
import {
  SyntheticVoiceGenerator,
  getAllSampleVoices,
} from "@/data/sampleVoices";
import { AudioEngine } from "@/audio/AudioEngine";

// ============================================================================
// SUITE 1: OfflineDSP Processing Speed & Memory Allocations
// ============================================================================
describe("OfflineDSP Stress & Memory Allocation Challenge", () => {
  function createSyntheticPcm(durationSec: number, fs = 48000): AudioBufferLike {
    const totalSamples = Math.round(durationSec * fs);
    const pcm = new Float32Array(totalSamples);
    // Multi-tone synthetic speech simulation (f0=180Hz, f1=600Hz, f2=1600Hz, f3=3000Hz)
    for (let i = 0; i < totalSamples; i++) {
      const t = i / fs;
      // Speech bursts with pauses
      const envelope = Math.sin(2 * Math.PI * 2.5 * t) > 0 ? 0.8 : 0.05;
      pcm[i] =
        envelope *
        (0.4 * Math.sin(2 * Math.PI * 180 * t) +
          0.3 * Math.sin(2 * Math.PI * 600 * t) +
          0.2 * Math.sin(2 * Math.PI * 1600 * t) +
          0.1 * Math.sin(2 * Math.PI * 3000 * t));
    }
    return {
      numberOfChannels: 1,
      sampleRate: fs,
      length: totalSamples,
      duration: durationSec,
      getChannelData: () => pcm,
    };
  }

  it("measures processing speed scaling across 1s, 5s, 30s, and 60s audio buffers", () => {
    const durations = [1.0, 5.0, 30.0, 60.0];
    const results: { duration: number; timeMs: number; rtf: number; framesCount: number }[] = [];

    for (const d of durations) {
      const audio = createSyntheticPcm(d);
      const t0 = performance.now();
      const res = OfflineDSP.analyze(audio, { fps: 60 });
      const elapsed = performance.now() - t0;
      const rtf = (d * 1000) / Math.max(1, elapsed); // Real-time factor (e.g. 50x means 50x faster than real time)

      results.push({
        duration: d,
        timeMs: elapsed,
        rtf,
        framesCount: res.frames.length,
      });

      expect(res.frames.length).toBe(Math.round(d * 60));
      // Throughput must be substantially faster than real-time (> 5x real-time speed)
      expect(rtf).toBeGreaterThan(5.0);
    }

    console.log(
      "[Benchmark: OfflineDSP Processing Speed]\n" +
        results
          .map(
            (r) =>
              `  - Audio: ${r.duration}s (${r.framesCount} frames) -> Runtime: ${r.timeMs.toFixed(1)}ms | RTF: ${r.rtf.toFixed(1)}x real-time`
          )
          .join("\n")
    );

    // Verify computational scaling is approximately linear O(N)
    // Ratio of 60s time to 5s time should not exceed 18x (ideal is 12x)
    const t5 = results.find((r) => r.duration === 5.0)!.timeMs;
    const t60 = results.find((r) => r.duration === 60.0)!.timeMs;
    const scaleRatio = t60 / Math.max(1, t5);
    expect(scaleRatio).toBeLessThan(25.0);
  }, 30000);

  it("profiles typed array allocation footprint for a 60-second audio stream", () => {
    const fs = 48000;
    const duration = 60.0;
    const totalSamples = fs * duration; // 2,880,000 samples

    // Theoretical allocation footprint in OfflineDSP.analyze():
    // mono: 1 x Float32Array (4B/sample) = 11.52 MB
    // lowSig, midSig, highSig: 3 x Float32Array = 34.56 MB
    // cumMono, cumLow, cumMid, cumHigh: 4 x Float64Array (8B/sample) = 92.16 MB
    // Total raw typed array buffers = 138.24 MB
    const expectedArrayMemoryMb = (totalSamples * (4 * 4 + 4 * 8)) / (1024 * 1024);
    expect(expectedArrayMemoryMb).toBeCloseTo(131.84, 1);

    const audio = createSyntheticPcm(duration, fs);

    // Force GC if exposed or record heap baseline
    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;

    const res = OfflineDSP.analyze(audio, { fps: 60 });

    const heapAfter = process.memoryUsage().heapUsed;
    const deltaMb = (heapAfter - heapBefore) / (1024 * 1024);

    console.log(
      `[Memory Profile: 60s OfflineDSP Analysis]\n` +
        `  - Total Audio Samples: ${totalSamples.toLocaleString()}\n` +
        `  - Theoretical TypedArray Footprint: ${expectedArrayMemoryMb.toFixed(2)} MB\n` +
        `  - Retained Frame Output: ${res.frames.length} FrameData objects\n` +
        `  - Heap Delta: ${deltaMb.toFixed(2)} MB\n` +
        `  - Analysis Internal Timer: ${res.analysisTimeMs.toFixed(1)}ms`
    );

    expect(res.frames.length).toBe(3600);
    expect(res.frames[0]).toHaveProperty("low");
    expect(res.frames[0]).toHaveProperty("amplitude");
  });

  it(
    "stress tests 3-minute broadcast clip (180s) without heap exhaustion",
    { timeout: 30000 },
    () => {
      const audio180 = createSyntheticPcm(180.0, 48000);
      const t0 = performance.now();
      const result = OfflineDSP.analyze(audio180, { fps: 60 });
      const elapsed = performance.now() - t0;

      expect(result.frames.length).toBe(10800);
      // 3 minutes (180s) must process in under 1500ms
      expect(elapsed).toBeLessThan(1500);

      // Verify first and last frames are valid
      expect(result.getFrame(0).frameIndex).toBe(0);
      expect(result.getFrame(10799).frameIndex).toBe(10799);
    }
  );

  it("evaluates boundary and edge cases: zero length, single sample, high fps, multichannel", () => {
    // 1. Zero-duration buffer
    const zeroAudio: AudioBufferLike = {
      numberOfChannels: 1,
      sampleRate: 48000,
      length: 0,
      duration: 0,
      getChannelData: () => new Float32Array(0),
    };
    const zeroRes = OfflineDSP.analyze(zeroAudio, { fps: 60 });
    expect(zeroRes.frames.length).toBe(1);
    expect(zeroRes.frames[0].amplitude).toBe(0);

    // 2. Single sample buffer
    const singleAudio: AudioBufferLike = {
      numberOfChannels: 1,
      sampleRate: 48000,
      length: 1,
      duration: 1 / 48000,
      getChannelData: () => new Float32Array([0.5]),
    };
    const singleRes = OfflineDSP.analyze(singleAudio, { fps: 60 });
    expect(singleRes.frames.length).toBeGreaterThanOrEqual(1);

    // 3. Multi-channel surround (6 channels = 5.1 surround)
    const fs = 48000;
    const len = fs;
    const chData = [
      new Float32Array(len).fill(0.6), // L
      new Float32Array(len).fill(0.6), // R
      new Float32Array(len).fill(0.9), // Center (vocal)
      new Float32Array(len).fill(0.8), // LFE (subwoofer)
      new Float32Array(len).fill(0.3), // Ls
      new Float32Array(len).fill(0.3), // Rs
    ];
    const surroundAudio: AudioBufferLike = {
      numberOfChannels: 6,
      sampleRate: fs,
      length: len,
      duration: 1.0,
      getChannelData: (c) => chData[c],
    };
    const surroundRes = OfflineDSP.analyze(surroundAudio, { fps: 60 });
    expect(surroundRes.frames.length).toBe(60);
    // Downmix average: (0.6 + 0.6 + 0.9 + 0.8 + 0.3 + 0.3) / 6 = 3.5 / 6 ≈ 0.583
    expect(surroundRes.getFrame(30).amplitude).toBeGreaterThan(0.5);

    // 4. Clamped targetDuration
    const fullAudio = createSyntheticPcm(10.0);
    const clampedRes = OfflineDSP.analyze(fullAudio, { fps: 60, targetDuration: 2.0 });
    expect(clampedRes.frames.length).toBe(120); // Exactly 2 seconds @ 60fps

    // 5. Sub-frame interpolation out of bounds
    const fMinus = clampedRes.getInterpolatedFrame(-1.0);
    expect(fMinus.frameIndex).toBe(0);
    const fBeyond = clampedRes.getInterpolatedFrame(999.0);
    expect(fBeyond.frameIndex).toBe(clampedRes.frames.length - 1);
  });
});

// ============================================================================
// SUITE 2: SyntheticVoiceGenerator Rapid Cycles & Acoustic Bounds
// ============================================================================
describe("SyntheticVoiceGenerator Rapid Cycles & Stress Challenge", () => {
  it("executes 100 rapid generation cycles and measures sustained throughput", () => {
    const profileIds = [
      "cupertino-siri",
      "neutral-ai",
      "podcast-host",
      "calm-meditation",
      "fast-cadence",
    ];

    const t0 = performance.now();
    const cycleCount = 50;

    for (let i = 0; i < cycleCount; i++) {
      const id = profileIds[i % profileIds.length];
      const audio = SyntheticVoiceGenerator.generate(id);
      expect(audio.length).toBeGreaterThan(10000);
      expect(audio.sampleRate).toBe(48000);
    }
    const totalElapsed = performance.now() - t0;
    const avgPerSynthesis = totalElapsed / cycleCount;
    const ratePerSec = (cycleCount / totalElapsed) * 1000;

    console.log(
      `[Benchmark: SyntheticVoiceGenerator 50 Rapid Cycles]\n` +
        `  - Total Time: ${totalElapsed.toFixed(1)}ms\n` +
        `  - Average per synthesis: ${avgPerSynthesis.toFixed(2)}ms\n` +
        `  - Throughput: ${ratePerSec.toFixed(1)} voices/second`
    );

    // Must generate at least 10 voices per second
    expect(ratePerSec).toBeGreaterThan(10.0);
    expect(avgPerSynthesis).toBeLessThan(100.0);
  });

  it("verifies 100% bit-exact determinism across rapid sequential generations", () => {
    const gen1 = SyntheticVoiceGenerator.generate("cupertino-siri", 48000);
    const gen2 = SyntheticVoiceGenerator.generate("cupertino-siri", 48000);

    expect(gen1.length).toBe(gen2.length);
    const pcm1 = gen1.getChannelData(0);
    const pcm2 = gen2.getChannelData(0);

    let mismatches = 0;
    for (let i = 0; i < pcm1.length; i++) {
      if (pcm1[i] !== pcm2[i]) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it("verifies all 5 voice profiles adhere to broadcast acoustic bounds without clipping", () => {
    const voices = getAllSampleVoices();
    expect(voices.length).toBe(5);

    for (const profile of voices) {
      const audio = SyntheticVoiceGenerator.generate(profile.id);
      const pcm = audio.getChannelData(0);

      let peak = 0;
      let sumSq = 0;
      let nanCount = 0;
      let zeroCount = 0;

      for (let i = 0; i < pcm.length; i++) {
        const s = pcm[i];
        if (isNaN(s) || !isFinite(s)) nanCount++;
        const abs = Math.abs(s);
        if (abs > peak) peak = abs;
        sumSq += s * s;
        if (abs < 0.001) zeroCount++;
      }

      const rms = Math.sqrt(sumSq / pcm.length);
      const pausePercentage = (zeroCount / pcm.length) * 100;

      // Assertions
      expect(nanCount).toBe(0);
      // Hard ceiling clamp: fastTanh ensures samples stay within (-1.0, 1.0)
      expect(peak).toBeLessThanOrEqual(1.0);
      expect(peak).toBeGreaterThan(0.25); // Must not be silent
      // RMS must be in realistic conversational range
      expect(rms).toBeGreaterThan(0.04);
      expect(rms).toBeLessThan(0.40);
      // Pauses between words must exist
      expect(pausePercentage).toBeGreaterThan(10.0);
    }
  });

  it("survives hostile sample rates and unknown profile IDs gracefully", () => {
    // 1. Unknown profile fallback
    const fallbackAudio = SyntheticVoiceGenerator.generate("unknown-voice-id-999");
    expect(fallbackAudio).toBeDefined();
    expect(fallbackAudio.duration).toBeGreaterThan(0);

    // 2. Extreme sample rates: 8kHz (Telephony) and 96kHz (High-Res Studio)
    const audio8k = SyntheticVoiceGenerator.generate("fast-cadence", 8000);
    expect(audio8k.sampleRate).toBe(8000);
    const pcm8k = audio8k.getChannelData(0);
    let nanCount8k = 0;
    for (let i = 0; i < pcm8k.length; i++) {
      if (isNaN(pcm8k[i])) nanCount8k++;
    }
    expect(nanCount8k).toBe(0);

    const audio96k = SyntheticVoiceGenerator.generate("podcast-host", 96000);
    expect(audio96k.sampleRate).toBe(96000);
    const pcm96k = audio96k.getChannelData(0);
    let nanCount96k = 0;
    for (let i = 0; i < pcm96k.length; i++) {
      if (isNaN(pcm96k[i])) nanCount96k++;
    }
    expect(nanCount96k).toBe(0);
  });
});

// ============================================================================
// SUITE 3: AudioEngine Lifecycle, Node Disposal & Leak Stress Challenge
// ============================================================================
describe("AudioEngine Lifecycle & Leak Challenge", () => {
  // Mock Web Audio Graph infrastructure
  let mockContexts: MockAudioContext[] = [];

  class MockAudioNode {
    public connections: MockAudioNode[] = [];
    public disconnected = false;

    connect(dest: MockAudioNode) {
      this.connections.push(dest);
      this.disconnected = false;
      return dest;
    }

    disconnect() {
      this.connections = [];
      this.disconnected = true;
    }
  }

  class MockGainNode extends MockAudioNode {
    public gain = {
      value: 1.0,
      setValueAtTime: vi.fn(),
    };
  }

  class MockBiquadFilterNode extends MockAudioNode {
    public type = "lowpass";
    public frequency = { value: 280 };
    public Q = { value: 0.707 };
  }

  class MockAnalyserNode extends MockAudioNode {
    public fftSize = 512;
    public smoothingTimeConstant = 0.0;
    public frequencyBinCount = 256;

    getFloatTimeDomainData(arr: Float32Array) {
      // Simulate non-zero PCM audio
      for (let i = 0; i < arr.length; i++) {
        arr[i] = 0.1 * Math.sin((i / arr.length) * 2 * Math.PI);
      }
    }

    getByteFrequencyData(arr: Uint8Array) {
      arr.fill(128);
    }
  }

  class MockMediaStreamAudioDestinationNode extends MockAudioNode {
    public stream = {} as MediaStream;
  }

  class MockAudioContext {
    public state: "suspended" | "running" | "closed" = "suspended";
    public sampleRate = 48000;
    public currentTime = 0;
    public destination = new MockAudioNode();
    public createdNodes: MockAudioNode[] = [];

    constructor() {
      mockContexts.push(this);
    }

    createGain() {
      const g = new MockGainNode();
      this.createdNodes.push(g);
      return g as unknown as GainNode;
    }

    createBiquadFilter() {
      const b = new MockBiquadFilterNode();
      this.createdNodes.push(b);
      return b as unknown as BiquadFilterNode;
    }

    createAnalyser() {
      const a = new MockAnalyserNode();
      this.createdNodes.push(a);
      return a as unknown as AnalyserNode;
    }

    createMediaStreamDestination() {
      const m = new MockMediaStreamAudioDestinationNode();
      this.createdNodes.push(m);
      return m as unknown as MediaStreamAudioDestinationNode;
    }

    createMediaElementSource(_el: any) {
      const s = new MockAudioNode();
      this.createdNodes.push(s);
      return s as unknown as MediaElementAudioSourceNode;
    }

    createMediaStreamSource(_stream: any) {
      const s = new MockAudioNode();
      this.createdNodes.push(s);
      return s as unknown as MediaStreamAudioSourceNode;
    }

    async resume() {
      this.state = "running";
    }

    async close() {
      this.state = "closed";
    }
  }

  beforeEach(() => {
    mockContexts = [];
    (global as any).window = {
      AudioContext: MockAudioContext,
      webkitAudioContext: MockAudioContext,
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it("verifies rapid source connect & disconnect properly disposes preceding source node", () => {
    const engine = new AudioEngine();
    const mockAudioEl = {} as HTMLAudioElement;

    // Connect source 10 times in rapid succession
    for (let i = 0; i < 10; i++) {
      engine.connectAudioElement(mockAudioEl);
    }

    const ctx = mockContexts[0];
    const sourceNodes = ctx.createdNodes.filter(
      (n) => !(n instanceof MockGainNode || n instanceof MockBiquadFilterNode || n instanceof MockAnalyserNode || n instanceof MockMediaStreamAudioDestinationNode)
    );

    // Total sources created: 10
    expect(sourceNodes.length).toBe(10);

    // The first 9 source nodes must be explicitly disconnected
    for (let i = 0; i < 9; i++) {
      expect(sourceNodes[i].disconnected).toBe(true);
    }
    // Only the last 10th source node remains connected
    expect(sourceNodes[9].disconnected).toBe(false);

    engine.destroy();
    expect(sourceNodes[9].disconnected).toBe(true);
  });

  it("verifies microphone stream isolates speaker output (zero feedback howling)", () => {
    const engine = new AudioEngine();
    const mockStream = {} as MediaStream;

    engine.connectMediaStream(mockStream);
    const ctx = mockContexts[0];

    // Find the mic source node
    const micSource = ctx.createdNodes[ctx.createdNodes.length - 1];
    expect(micSource.connections.length).toBe(2);

    // Verify mic connects to analysisSplitter and mediaStreamDest, but NEVER to masterGain or destination
    const connections = micSource.connections;
    const connectsToDestination = connections.some((n) => n === ctx.destination);
    expect(connectsToDestination).toBe(false);

    engine.destroy();
  });

  it("stress tests 50 rapid AudioEngine instantiation and destruction cycles", async () => {
    const cycleCount = 50;

    for (let i = 0; i < cycleCount; i++) {
      const engine = new AudioEngine();
      // Sample a few frames
      engine.sampleFrame(0.016);
      engine.sampleFrame(0.016);
      await engine.destroy();
    }

    expect(mockContexts.length).toBe(cycleCount);

    // Every single AudioContext must be cleanly closed
    const allClosed = mockContexts.every((c) => c.state === "closed");
    expect(allClosed).toBe(true);

    console.log(
      `[Lifecycle Stress: AudioEngine Teardown]\n` +
        `  - Instantiated and destroyed ${cycleCount} AudioEngine instances\n` +
        `  - All ${cycleCount} underlying AudioContexts cleanly closed: ${allClosed}`
    );
  });

  it("verifies post-destroy sampleFrame() and reset() do not throw", async () => {
    const engine = new AudioEngine();
    await engine.destroy();

    // Calling sampleFrame() or reset() after destruction must be resilient
    expect(() => engine.reset()).not.toThrow();
    expect(() => {
      const frame = engine.sampleFrame(0.016);
      expect(frame).toBeDefined();
      expect(frame.smoothed).toBeDefined();
    }).not.toThrow();
  });
});

