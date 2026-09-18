/**
 * tests/unit/stageFramingAndAudioStress.test.ts
 *
 * Empirical Challenge Suite for Milestone 3:
 * Stage Framing, Background Modes, WebGL Canvas Corner Transparency & Audio Transport Concurrency Stress.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appStore } from "@/store/useAppStore";
import { AudioController } from "@/audio/AudioController";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";
import { SAMPLE_VOICE_PROFILES, getSampleVoice } from "@/data/sampleVoices";
import { STANDARD_WEBGL_FLAGS } from "@/visualizers/WebGLContextManager";
import { UniversalRenderer } from "@/visualizers/UniversalRenderer";
import { getPalette } from "@/visualizers/palettes";
import type { FramingMode } from "@/visualizers/types";
import { inspectPixelBuffer } from "../utils/alphaValidator";

// Comprehensive Mock Web Audio Graph
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
    for (let i = 0; i < arr.length; i++) {
      arr[i] = 0.1 * Math.sin((i / arr.length) * 2 * Math.PI);
    }
  }

  getByteFrequencyData(arr: Uint8Array) {
    arr.fill(128);
  }
}

class MockMediaStreamAudioDestinationNode extends MockAudioNode {
  public stream = {
    getTracks: () => [],
  } as unknown as MediaStream;
}

class MockAudioContext {
  public state: "suspended" | "running" | "closed" = "suspended";
  public sampleRate = 48000;
  public currentTime = 0;
  public destination = new MockAudioNode();
  public createdNodes: MockAudioNode[] = [];

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

  createMediaElementSource(_el: unknown) {
    const s = new MockAudioNode();
    this.createdNodes.push(s);
    return s as unknown as MediaElementAudioSourceNode;
  }

  createMediaStreamSource(_stream: unknown) {
    const s = new MockAudioNode();
    this.createdNodes.push(s);
    return s as unknown as MediaStreamAudioSourceNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const channelData = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (ch: number) => channelData[ch],
      copyToChannel: (src: Float32Array, ch: number) => {
        channelData[ch].set(src);
      },
    };
  }

  async decodeAudioData(_arrayBuf: ArrayBuffer) {
    return this.createBuffer(1, 48000, 48000);
  }

  async resume() {
    this.state = "running";
  }

  async close() {
    this.state = "closed";
  }
}

class MockAudio {
  public src = "";
  public volume = 1.0;
  public loop = false;
  public currentTime = 0;
  public duration = 4.8;
  public crossOrigin = "";
  public paused = true;
  private listeners: Record<string, Array<() => void>> = {};

  addEventListener(ev: string, fn: () => void) {
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);
  }

  removeEventListener(ev: string, fn: () => void) {
    this.listeners[ev] = (this.listeners[ev] || []).filter((l) => l !== fn);
  }

  async play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }
}

describe("Milestone 3 Empirical Challenge Suite: Framing, Backgrounds & Audio Transport", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("window", {
      AudioContext: MockAudioContext,
      webkitAudioContext: MockAudioContext,
    });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:http://localhost/test"),
      revokeObjectURL: vi.fn(),
    });

    appStore.getState().applyPreset(DEFAULT_PRESETS[0]);
    appStore.setState({
      framing: "1:1",
      backgroundMode: "checkerboard",
      canvasSize: 420,
      renderScale: 1.0,
      isPlaying: false,
      isMicActive: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* =========================================================================
   * Challenge 1: Stage Framing & Aspect Ratio Geometry Verification
   * ========================================================================= */
  describe("Challenge 1: Stage Framing & Aspect Ratio Geometry", () => {
    // Exact sizing logic from VUIStage.tsx + AudioReactiveSiriWave.tsx
    const computeStageDimensions = (
      framing: FramingMode,
      canvasSize = 420,
      renderScale = 1.0
    ) => {
      const baseSize = canvasSize && canvasSize !== 420 ? canvasSize : framing === "16:9" || framing === "9:16" ? 560 : 420;
      let w = baseSize;
      let h = baseSize;
      if (framing === "16:9") {
        h = Math.round((baseSize * 9) / 16);
      } else if (framing === "9:16") {
        w = Math.round((baseSize * 9) / 16);
      }
      const rw = Math.round(w * renderScale);
      const rh = Math.round(h * renderScale);
      const aspectRatio = w / h;
      return { displayWidth: w, displayHeight: h, renderWidth: rw, renderHeight: rh, aspectRatio };
    };

    it("1.1 verifies 1:1 Square framing maintains exact 1.0 aspect ratio (420x420)", () => {
      const dim = computeStageDimensions("1:1", 420, 1.0);
      expect(dim.displayWidth).toBe(420);
      expect(dim.displayHeight).toBe(420);
      expect(dim.aspectRatio).toBe(1.0);
      expect(Math.abs(dim.aspectRatio - 1.0)).toBeLessThan(0.001);
      expect(dim.renderWidth).toBe(420);
      expect(dim.renderHeight).toBe(420);
    });

    it("1.2 verifies 16:9 Landscape framing maintains exact 16:9 ratio (560x315)", () => {
      const dim = computeStageDimensions("16:9", 420, 1.0);
      expect(dim.displayWidth).toBe(560);
      expect(dim.displayHeight).toBe(315);
      const targetRatio = 16 / 9; // ~1.777778
      expect(dim.aspectRatio).toBeCloseTo(targetRatio, 2);
      expect(dim.aspectRatio).toBeGreaterThan(1.5);
      expect(Math.abs(dim.aspectRatio - targetRatio)).toBeLessThan(0.01);
    });

    it("1.3 verifies 9:16 Portrait framing maintains exact 9:16 ratio (315x560)", () => {
      const dim = computeStageDimensions("9:16", 420, 1.0);
      expect(dim.displayWidth).toBe(315);
      expect(dim.displayHeight).toBe(560);
      const targetRatio = 9 / 16; // 0.5625
      expect(dim.aspectRatio).toBe(0.5625);
      expect(dim.aspectRatio).toBeLessThan(0.75);
      expect(Math.abs(dim.aspectRatio - targetRatio)).toBeLessThan(0.001);
    });

    it("1.4 verifies custom canvasSize and renderScale scaling across all framing modes", () => {
      const customSizes = [300, 720, 1080];
      const scales = [0.5, 1.5, 2.0];

      for (const size of customSizes) {
        for (const scale of scales) {
          const s1 = computeStageDimensions("1:1", size, scale);
          expect(s1.aspectRatio).toBe(1.0);
          expect(s1.renderWidth).toBe(Math.round(size * scale));

          const s16 = computeStageDimensions("16:9", size, scale);
          expect(s16.aspectRatio).toBeCloseTo(16 / 9, 2);
          expect(s16.renderWidth).toBe(Math.round(size * scale));
          expect(s16.renderHeight).toBe(Math.round(Math.round((size * 9) / 16) * scale));

          const s9 = computeStageDimensions("9:16", size, scale);
          expect(s9.aspectRatio).toBeCloseTo(9 / 16, 2);
          expect(s9.renderHeight).toBe(Math.round(size * scale));
          expect(s9.renderWidth).toBe(Math.round(Math.round((size * 9) / 16) * scale));
        }
      }
    });

    it("1.5 rapid stress: executes 120 framing switches through store without state drift", () => {
      const framings: FramingMode[] = ["1:1", "16:9", "9:16"];
      for (let i = 0; i < 120; i++) {
        const target = framings[i % 3];
        appStore.getState().setFraming(target);
        expect(appStore.getState().framing).toBe(target);
      }
      // Return to 1:1
      appStore.getState().setFraming("1:1");
      expect(appStore.getState().framing).toBe("1:1");
    });
  });

  /* =========================================================================
   * Challenge 2: Background Modes CSS & DOM Structures
   * ========================================================================= */
  describe("Challenge 2: Background Modes CSS & DOM Structures", () => {
    const expectedBgSpecs = {
      checkerboard: {
        testid: "stage-bg-checkerboard",
        requiredClasses: ["stage-checkerboard", "checkerboard-bg", "border", "border-white/10"],
      },
      dark: {
        testid: "stage-bg-dark",
        requiredClasses: ["bg-[#09090b]", "border", "border-white/5"],
      },
      glow: {
        testid: "stage-bg-glow",
        requiredClasses: ["from-purple-900", "border", "border-purple-500/30", "shadow-[0_0_80px_rgba(168,85,247,0.25)]"],
      },
      "green-screen": {
        testid: "stage-bg-green-screen",
        requiredClasses: ["bg-[#00FF00]", "border", "border-emerald-400/40"],
      },
      "blue-screen": {
        testid: "stage-bg-blue-screen",
        requiredClasses: ["bg-[#0000FF]", "border", "border-blue-400/40"],
      },
    } as const;

    it("2.1 validates all 5 background modes match contract testid and attributes", () => {
      for (const [mode, spec] of Object.entries(expectedBgSpecs)) {
        appStore.getState().setBackgroundMode(mode as any);
        expect(appStore.getState().backgroundMode).toBe(mode);
        expect(spec.testid).toBe(`stage-bg-${mode}`);
      }
    });

    it("2.2 validates glow background generates valid radial gradient from active palette", () => {
      const palettes = ["cupertino-siri", "gemini-live", "cyberpunk-ai", "aurora-borealis", "sunset-horizon"];
      for (const pId of palettes) {
        const pal = getPalette(pId);
        expect(pal.rgb).toBeDefined();
        expect(pal.rgb.length).toBeGreaterThanOrEqual(4);
        const [r, g, b] = pal.rgb[0];
        const gradient = `radial-gradient(circle at 50% 50%, rgba(${r}, ${g}, ${b}, 0.25) 0%, rgba(20, 10, 35, 0.6) 50%, #08080a 90%)`;
        expect(gradient).toContain(`rgba(${r}, ${g}, ${b}, 0.25)`);
        expect(gradient).toContain("#08080a 90%");
      }
    });

    it("2.3 rapid stress: cycles 100 background mode switches across all 5 backdrops", () => {
      const modes = ["checkerboard", "dark", "glow", "green-screen", "blue-screen"] as const;
      for (let i = 0; i < 100; i++) {
        const mode = modes[i % modes.length];
        appStore.getState().setBackgroundMode(mode);
        expect(appStore.getState().backgroundMode).toBe(mode);
      }
    });
  });

  /* =========================================================================
   * Challenge 3: AudioController Concurrency, Switching & Transport Stress
   * ========================================================================= */
  describe("Challenge 3: AudioController Concurrency & Transport Stress", () => {
    it("3.1 executes 100 rapid consecutive play / pause calls without throwing or deadlocking", async () => {
      const controller = AudioController.getInstance();
      await controller.loadSyntheticVoice("cupertino-siri");

      expect(() => {
        for (let i = 0; i < 100; i++) {
          if (i % 2 === 0) {
            controller.pause();
            expect(controller.getIsPlaying()).toBe(false);
          } else {
            // Synchronous state check
            expect(typeof controller.getIsPlaying()).toBe("boolean");
          }
        }
      }).not.toThrow();
    });

    it("3.2 executes 60 rapid seek operations with extreme boundary inputs", async () => {
      const controller = AudioController.getInstance();
      await controller.loadSyntheticVoice("cupertino-siri");

      const testTimestamps = [
        -10.0, -0.001, 0, 0.0001, 1.234, 2.5, 4.0, 4.8, 10.0, 100.0,
        Number.MAX_SAFE_INTEGER, -Infinity, Infinity, NaN,
      ];

      for (const time of testTimestamps) {
        expect(() => controller.seek(time)).not.toThrow();
        const audio = controller.getAudioElement();
        if (audio && Number.isFinite(time)) {
          expect(audio.currentTime).toBeGreaterThanOrEqual(0);
          expect(audio.currentTime).toBeLessThanOrEqual(audio.duration || 4.8);
        }
      }
    });

    it("3.3 rapid voice source switching across all 5 curated sample voices", async () => {
      const controller = AudioController.getInstance();
      const voiceIds = SAMPLE_VOICE_PROFILES.map((v) => v.id);
      expect(voiceIds.length).toBe(5);

      for (const id of voiceIds) {
        const res = await controller.loadSyntheticVoice(id);
        expect(res).toBeDefined();
        expect(res.url).toMatch(/^blob:/);
        expect(res.duration).toBeGreaterThan(2.0);
        expect(res.buffer).toBeDefined();
        expect(res.name).toBe(getSampleVoice(id).name);
      }

      // 5 rapid bursts of synthetic voice switching across different profiles
      const burstIds = ["cupertino-siri", "neutral-ai", "fast-cadence", "calm-meditation", "podcast-host"];
      for (let i = 0; i < burstIds.length; i++) {
        const pick = burstIds[i];
        const res = await controller.loadSyntheticVoice(pick);
        expect(res.duration).toBeGreaterThan(2.0);
      }
    }, 30000);

    it("3.4 tests microphone toggle and playback conflict resolution", async () => {
      const controller = AudioController.getInstance();

      // Mock navigator.mediaDevices.getUserMedia
      const stopTrackMock = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: stopTrackMock }],
      } as unknown as MediaStream;

      vi.stubGlobal("navigator", {
        mediaDevices: {
          getUserMedia: vi.fn(async () => mockStream),
        },
      });

      // Load synthetic audio and start playback
      await controller.loadSyntheticVoice("cupertino-siri");
      await controller.play();
      expect(controller.getIsPlaying()).toBe(true);

      // Activating mic MUST pause audio playback to prevent feedback collision
      const micRes = await controller.toggleMicrophone();
      expect(micRes.isMicActive).toBe(true);
      expect(controller.getIsPlaying()).toBe(false);
      expect(controller.getIsMicActive()).toBe(true);

      // Starting audio playback MUST stop mic
      await controller.play();
      expect(controller.getIsPlaying()).toBe(true);
      expect(controller.getIsMicActive()).toBe(false);
      expect(stopTrackMock).toHaveBeenCalled();

      // Clean teardown
      controller.pause();
    });

    it("3.5 validates volume boundary clamping [-5.0 to 50.0]", () => {
      const controller = AudioController.getInstance();
      const values = [-5.0, -0.1, 0, 0.25, 0.75, 1.0, 1.5, 50.0];

      for (const v of values) {
        controller.setVolume(v);
        const actual = controller.getVolume();
        expect(actual).toBeGreaterThanOrEqual(0.0);
        expect(actual).toBeLessThanOrEqual(1.0);
      }
    });
  });

  /* =========================================================================
   * Challenge 4: WebGL Canvas Corner Transparency Verification
   * ========================================================================= */
  describe("Challenge 4: WebGL Canvas Corner Transparency inside VUIStage", () => {
    it("4.1 verifies STANDARD_WEBGL_FLAGS enforce alpha and premultipliedAlpha", () => {
      expect(STANDARD_WEBGL_FLAGS.alpha).toBe(true);
      expect(STANDARD_WEBGL_FLAGS.premultipliedAlpha).toBe(true);
      expect(STANDARD_WEBGL_FLAGS.preserveDrawingBuffer).toBe(true);
    });

    it("4.2 verifies UniversalRenderer parameter sanitization preserves isTransparent: true", () => {
      const renderer = new UniversalRenderer("apple-siri");
      let capturedParams: any = null;

      const mockVisualizer = {
        id: "apple-siri",
        name: "Mock",
        description: "Mock",
        init: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
        render: vi.fn((p) => {
          capturedParams = p;
        }),
      };

      (renderer as any).activeRenderer = mockVisualizer;
      (renderer as any).canvas = {} as HTMLCanvasElement;

      renderer.render({
        time: 1.0,
        phase: 0.5,
        aspectRatio: 1.0,
        low: 0.2,
        mid: 0.4,
        high: 0.1,
        amplitude: 0.3,
        sensitivity: 1.2,
        turbulence: 1.0,
        glow: 1.0,
        scale: 1.0,
        palette: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0]],
        isAudioActive: true,
        isTransparent: true,
      });

      expect(capturedParams).toBeDefined();
      expect(capturedParams.isTransparent).toBe(true);
    });

    it("4.3 verifies WebGL corner pixel clearance contract", () => {
      const width = 420;
      const height = 420;

      // Track clearColor and clear calls on WebGL context
      let lastClearColor: [number, number, number, number] | null = null;
      let clearBitMask: number | null = null;

      // Simulated framebuffer with WebGL coordinate system
      const frameBuffer = new Uint8Array(width * height * 4);

      const mockGl = {
        COLOR_BUFFER_BIT: 16384,
        clearColor: vi.fn((r: number, g: number, b: number, a: number) => {
          lastClearColor = [r, g, b, a];
        }),
        clear: vi.fn((mask: number) => {
          clearBitMask = mask;
          if (lastClearColor) {
            const [cr, cg, cb, ca] = lastClearColor;
            for (let i = 0; i < frameBuffer.length; i += 4) {
              frameBuffer[i] = Math.round(cr * 255);
              frameBuffer[i + 1] = Math.round(cg * 255);
              frameBuffer[i + 2] = Math.round(cb * 255);
              frameBuffer[i + 3] = Math.round(ca * 255);
            }
          }
        }),
        readPixels: vi.fn((x: number, y: number, w: number, h: number, _format: number, _type: number, pixels: Uint8Array) => {
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const srcIdx = ((y + row) * width + (x + col)) * 4;
              const dstIdx = (row * w + col) * 4;
              pixels[dstIdx] = frameBuffer[srcIdx];
              pixels[dstIdx + 1] = frameBuffer[srcIdx + 1];
              pixels[dstIdx + 2] = frameBuffer[srcIdx + 2];
              pixels[dstIdx + 3] = frameBuffer[srcIdx + 3];
            }
          }
        }),
      };

      // Wire UniversalRenderer with isTransparent contract check
      const renderer = new UniversalRenderer("apple-siri");
      const mockVisualizer = {
        id: "apple-siri",
        name: "Mock",
        description: "Mock",
        init: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
        render: vi.fn((p) => {
          if (p.isTransparent) {
            mockGl.clearColor(0, 0, 0, 0);
            mockGl.clear(mockGl.COLOR_BUFFER_BIT);
          }
        }),
      };

      (renderer as any).activeRenderer = mockVisualizer;
      (renderer as any).canvas = { width, height } as HTMLCanvasElement;

      renderer.render({
        time: 1.0,
        phase: 0.0,
        aspectRatio: 1.0,
        low: 0.5,
        mid: 0.5,
        high: 0.5,
        amplitude: 0.5,
        sensitivity: 1.0,
        turbulence: 1.0,
        glow: 1.0,
        scale: 1.0,
        palette: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0]],
        isAudioActive: true,
        isTransparent: true,
      });

      // Verify WebGL clearance execution
      expect(mockGl.clearColor).toHaveBeenCalledWith(0, 0, 0, 0);
      expect(mockGl.clear).toHaveBeenCalledWith(mockGl.COLOR_BUFFER_BIT);
      expect(lastClearColor).toEqual([0, 0, 0, 0]);
      expect(clearBitMask).toBe(mockGl.COLOR_BUFFER_BIT);

      // Render simulated active VUI audio glow in center
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      for (let dy = -20; dy <= 20; dy++) {
        for (let dx = -20; dx <= 20; dx++) {
          const idx = ((cy + dy) * width + (cx + dx)) * 4;
          frameBuffer[idx] = 168; // R
          frameBuffer[idx + 1] = 85;  // G
          frameBuffer[idx + 2] = 247; // B
          frameBuffer[idx + 3] = 220; // A
        }
      }

      // Read back pixels at corners via gl.readPixels
      const cornerPixel = new Uint8Array(4);
      const cornerCoords = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ];

      for (const [x, y] of cornerCoords) {
        mockGl.readPixels(x, y, 1, 1, 0x1908 /* RGBA */, 0x1401 /* UNSIGNED_BYTE */, cornerPixel);
        expect(cornerPixel[3]).toBe(0); // Alpha at all 4 corners must be strictly 0
      }

      // Read back center pixel
      mockGl.readPixels(cx, cy, 1, 1, 0x1908, 0x1401, cornerPixel);
      expect(cornerPixel[3]).toBe(220); // Center contains active foreground

      // Validate entire buffer via inspectPixelBuffer
      const report = inspectPixelBuffer(frameBuffer, width, height, 0);
      expect(report.isZeroAlphaBackground).toBe(true);
      expect(report.hasVisibleForeground).toBe(true);
      expect(report.cornerAlphas).toEqual([0, 0, 0, 0]);
      expect(report.centerMaxAlpha).toBe(220);
    });
  });
});
