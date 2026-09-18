/**
 * tests/unit/m4AdversarialChallenge.test.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE — MILESTONE 4
 * Focus: WebM VP9 Alpha, ProRes 4444 Fallback, AbortController Lifecycle, Audio Resampler Stress.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExportManager } from "@/export/ExportManager";
import { WebMAlphaExporter } from "@/export/engines/WebMAlphaExporter";
import {
  checkProResServerHealth,
  exportProRes4444,
  ProRes4444Exporter,
} from "@/export/engines/ProRes4444Exporter";
import {
  resampleAudioBuffer,
  audioBufferToWav,
  resampleAudioToWav,
} from "@/export/utils/audioResampler";
import type { ExportOptions, ExportProgress } from "@/export/types";
import type { AudioBufferLike } from "@/audio/types";

function createSyntheticBuffer(
  durationSec: number,
  sampleRate = 44100,
  channels = 2,
  fillFn?: (ch: number, sampleIdx: number, totalSamples: number) => number
): AudioBufferLike {
  const length = Math.max(1, Math.round(durationSec * sampleRate));
  const channelData: Float32Array[] = [];

  for (let ch = 0; ch < channels; ch++) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      if (fillFn) {
        data[i] = fillFn(ch, i, length);
      } else {
        const freq = ch === 0 ? 440.0 : 880.0;
        data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.8;
      }
    }
    channelData.push(data);
  }

  return {
    length,
    numberOfChannels: channels,
    sampleRate,
    duration: durationSec,
    getChannelData: (ch: number) => channelData[ch] || channelData[0],
    copyFromChannel: (dest: Float32Array, ch: number) => dest.set(channelData[ch]),
    copyToChannel: (src: Float32Array, ch: number) => channelData[ch].set(src),
  };
}

function createMockCanvas() {
  const mockGl = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    DYNAMIC_DRAW: 35048,
    COLOR_BUFFER_BIT: 16384,
    FLOAT: 5126,
    TRIANGLES: 4,
    POINTS: 0,
    BLEND: 3042,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 771,
    isContextLost: () => false,
    createShader: vi.fn(() => ({ __id: 1 })),
    deleteShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    createProgram: vi.fn(() => ({ __id: 1 })),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => ({ __id: 1 })),
    deleteBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    bufferSubData: vi.fn(),
    useProgram: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    disableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_p, name) => ({ name })),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniform3fv: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    getExtension: vi.fn(() => null),
  };

  const canvas: any = {
    width: 1080,
    height: 1080,
    style: {},
    getContext: vi.fn((type: string) => {
      if (type === "webgl" || type === "webgl2") return mockGl;
      return null;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  return { canvas, mockGl };
}

class MockEncodedVideoChunk {
  public type: "key" | "delta";
  public timestamp: number;
  public duration: number;
  public byteLength: number;
  private data: Uint8Array;
  constructor(init: { type: "key" | "delta"; timestamp: number; duration?: number; data: Uint8Array }) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration ?? 16666;
    this.data = init.data;
    this.byteLength = init.data.byteLength;
  }
  public copyTo(dest: Uint8Array) {
    dest.set(this.data);
  }
}

class MockEncodedAudioChunk {
  public type: "key" | "delta";
  public timestamp: number;
  public duration: number;
  public byteLength: number;
  private data: Uint8Array;
  constructor(init: { type: "key" | "delta"; timestamp: number; duration?: number; data: Uint8Array }) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration ?? 40000;
    this.data = init.data;
    this.byteLength = init.data.byteLength;
  }
  public copyTo(dest: Uint8Array) {
    dest.set(this.data);
  }
}

describe("Milestone 4 Adversarial Challenge: WebM VP9 Alpha, ProRes & Cancellation", () => {
  let originalDocument: any;
  let originalVideoEncoder: any;
  let originalAudioEncoder: any;
  let originalVideoFrame: any;
  let originalAudioData: any;
  let originalEncodedVideoChunk: any;
  let originalEncodedAudioChunk: any;
  let originalFetch: any;

  let videoEncoderConfigs: any[] = [];
  let audioEncoderConfigs: any[] = [];
  let videoEncodersInstantiated = 0;
  let audioEncodersInstantiated = 0;
  let videoEncodersClosed = 0;
  let audioEncodersClosed = 0;
  let videoFramesEncoded = 0;
  let audioChunksEncoded = 0;
  let videoFramesCreated = 0;
  let videoFramesClosed = 0;
  let audioDataCreated = 0;
  let audioDataClosed = 0;

  beforeEach(() => {
    vi.restoreAllMocks();

    originalDocument = (globalThis as any).document;
    originalVideoEncoder = (globalThis as any).VideoEncoder;
    originalAudioEncoder = (globalThis as any).AudioEncoder;
    originalVideoFrame = (globalThis as any).VideoFrame;
    originalAudioData = (globalThis as any).AudioData;
    originalEncodedVideoChunk = (globalThis as any).EncodedVideoChunk;
    originalEncodedAudioChunk = (globalThis as any).EncodedAudioChunk;
    originalFetch = globalThis.fetch;

    videoEncoderConfigs = [];
    audioEncoderConfigs = [];
    videoEncodersInstantiated = 0;
    audioEncodersInstantiated = 0;
    videoEncodersClosed = 0;
    audioEncodersClosed = 0;
    videoFramesEncoded = 0;
    audioChunksEncoded = 0;
    videoFramesCreated = 0;
    videoFramesClosed = 0;
    audioDataCreated = 0;
    audioDataClosed = 0;

    (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;
    (globalThis as any).EncodedAudioChunk = MockEncodedAudioChunk;

    (globalThis as any).document = {
      createElement: vi.fn((tag: string) => {
        if (tag === "canvas") {
          return createMockCanvas().canvas;
        }
        return {};
      }),
    };

    (globalThis as any).VideoEncoder = class MockVideoEncoder {
      public encodeQueueSize = 0;
      public ondequeue: (() => void) | null = null;
      private outputCallback: (chunk: any, meta: any) => void;
      private errorCallback: (err: any) => void;
      public isClosed = false;

      constructor(init: { output: (chunk: any, meta: any) => void; error: (err: any) => void }) {
        videoEncodersInstantiated++;
        this.outputCallback = init.output;
        this.errorCallback = init.error;
      }

      public configure(config: any) {
        videoEncoderConfigs.push(config);
      }

      public encode(frame: any, meta?: any) {
        if (this.isClosed) throw new Error("VideoEncoder is closed");
        videoFramesEncoded++;
        const dummyData = new Uint8Array(32);
        const mockChunk = new MockEncodedVideoChunk({
          type: meta?.keyFrame ? "key" : "delta",
          timestamp: frame.timestamp,
          duration: 16666,
          data: dummyData,
        });
        this.outputCallback(mockChunk, {
          decoderConfig: {
            codec: "vp09.00.10.08",
            codedWidth: 1080,
            codedHeight: 1080,
          },
        });
      }

      public async flush() {
        return Promise.resolve();
      }

      public close() {
        if (!this.isClosed) {
          this.isClosed = true;
          videoEncodersClosed++;
        }
      }
    };

    (globalThis as any).AudioEncoder = class MockAudioEncoder {
      private outputCallback: (chunk: any, meta: any) => void;
      private errorCallback: (err: any) => void;
      public isClosed = false;

      constructor(init: { output: (chunk: any, meta: any) => void; error: (err: any) => void }) {
        audioEncodersInstantiated++;
        this.outputCallback = init.output;
        this.errorCallback = init.error;
      }

      public configure(config: any) {
        audioEncoderConfigs.push(config);
      }

      public encode(audioData: any) {
        if (this.isClosed) throw new Error("AudioEncoder is closed");
        audioChunksEncoded++;
        const dummyData = new Uint8Array(16);
        const mockChunk = new MockEncodedAudioChunk({
          type: "key",
          timestamp: audioData.timestamp,
          duration: 40000,
          data: dummyData,
        });
        this.outputCallback(mockChunk, {});
      }

      public async flush() {
        return Promise.resolve();
      }

      public close() {
        if (!this.isClosed) {
          this.isClosed = true;
          audioEncodersClosed++;
        }
      }
    };

    (globalThis as any).VideoFrame = class MockVideoFrame {
      public timestamp: number;
      public isClosed = false;
      constructor(_canvas: any, init: { timestamp: number }) {
        videoFramesCreated++;
        this.timestamp = init.timestamp;
      }
      public close() {
        if (!this.isClosed) {
          this.isClosed = true;
          videoFramesClosed++;
        }
      }
    };

    (globalThis as any).AudioData = class MockAudioData {
      public timestamp: number;
      public isClosed = false;
      constructor(init: { timestamp: number }) {
        audioDataCreated++;
        this.timestamp = init.timestamp;
      }
      public close() {
        if (!this.isClosed) {
          this.isClosed = true;
          audioDataClosed++;
        }
      }
    };
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).VideoEncoder = originalVideoEncoder;
    (globalThis as any).AudioEncoder = originalAudioEncoder;
    (globalThis as any).VideoFrame = originalVideoFrame;
    (globalThis as any).AudioData = originalAudioData;
    (globalThis as any).EncodedVideoChunk = originalEncodedVideoChunk;
    (globalThis as any).EncodedAudioChunk = originalEncodedAudioChunk;
    globalThis.fetch = originalFetch;
  });

  /* =========================================================================
   * CHALLENGE 1: VideoEncoder.configure, alpha === "keep" & Dimension Rounding
   * ========================================================================= */
  describe("Challenge 1: VideoEncoder.configure, alpha === 'keep' & Dimension Rounding", () => {
    it("strictly configures alpha === 'keep' for transparent VP9 WebCodecs encoding", async () => {
      const buffer = createSyntheticBuffer(0.2, 44100);
      const options: ExportOptions = {
        format: "webm",
        audioBuffer: buffer as any,
        duration: 0.2,
        fps: 30,
      };

      const exporter = new WebMAlphaExporter();
      await exporter.export(options, () => {}, new AbortController().signal);

      expect(videoEncoderConfigs.length).toBeGreaterThanOrEqual(1);
      const config = videoEncoderConfigs[0];

      expect(config.alpha).toBe("keep");
      expect(config.codec).toBe("vp09.00.10.08");
      expect(config.latencyMode).toBe("quality");
      expect(config.bitrate).toBe(18_000_000);
      expect(config.framerate).toBe(30);

      expect(audioEncoderConfigs.length).toBeGreaterThanOrEqual(1);
      const aConfig = audioEncoderConfigs[0];
      expect(aConfig.codec).toBe("opus");
      expect(aConfig.sampleRate).toBe(48000);
      expect(aConfig.bitrate).toBe(128_000);
    });

    it("auto-rounds hostile odd width and height dimensions to even numbers", async () => {
      const hostileOddResolutions = [
        { width: 1919, height: 1079, expectedW: 1918, expectedH: 1078 },
        { width: 1081, height: 1921, expectedW: 1080, expectedH: 1920 },
        { width: 853, height: 479, expectedW: 852, expectedH: 478 },
        { width: 1001, height: 1001, expectedW: 1000, expectedH: 1000 },
        { width: 333, height: 777, expectedW: 332, expectedH: 776 },
      ];

      for (const testCase of hostileOddResolutions) {
        videoEncoderConfigs = [];
        const buffer = createSyntheticBuffer(0.1, 44100);
        const options: ExportOptions = {
          format: "webm",
          audioBuffer: buffer as any,
          duration: 0.1,
          fps: 30,
          resolution: { width: testCase.width, height: testCase.height },
        };

        const exporter = new WebMAlphaExporter();
        await exporter.export(options, () => {}, new AbortController().signal);

        expect(videoEncoderConfigs.length).toBe(1);
        const cfg = videoEncoderConfigs[0];

        expect(cfg.width % 2).toBe(0);
        expect(cfg.height % 2).toBe(0);
        expect(cfg.width).toBe(testCase.expectedW);
        expect(cfg.height).toBe(testCase.expectedH);
      }
    });

    it("verifies framing presets (1:1, 16:9, 9:16) configure standard even dimensions", async () => {
      const presets = [
        { framing: "1:1" as const, expectedW: 1080, expectedH: 1080 },
        { framing: "16:9" as const, expectedW: 1920, expectedH: 1080 },
        { framing: "9:16" as const, expectedW: 1080, expectedH: 1920 },
      ];

      for (const p of presets) {
        videoEncoderConfigs = [];
        const buffer = createSyntheticBuffer(0.1, 44100);
        const options: ExportOptions = {
          format: "webm",
          audioBuffer: buffer as any,
          duration: 0.1,
          fps: 30,
          framing: p.framing,
        };

        const exporter = new WebMAlphaExporter();
        await exporter.export(options, () => {}, new AbortController().signal);

        expect(videoEncoderConfigs[0].width).toBe(p.expectedW);
        expect(videoEncoderConfigs[0].height).toBe(p.expectedH);
      }
    });

    it("ensures all VideoFrames and AudioData allocations are closed without leaks", async () => {
      const buffer = createSyntheticBuffer(0.2, 44100);
      const options: ExportOptions = {
        format: "webm",
        audioBuffer: buffer as any,
        duration: 0.2,
        fps: 30,
      };

      const exporter = new WebMAlphaExporter();
      await exporter.export(options, () => {}, new AbortController().signal);

      expect(videoFramesCreated).toBeGreaterThan(0);
      expect(videoFramesClosed).toBe(videoFramesCreated);
      expect(audioDataCreated).toBeGreaterThan(0);
      expect(audioDataClosed).toBe(audioDataCreated);
      expect(videoFramesEncoded).toBeGreaterThan(0);
      expect(audioChunksEncoded).toBeGreaterThan(0);
      expect(videoEncodersClosed).toBe(videoEncodersInstantiated);
      expect(audioEncodersClosed).toBe(audioEncodersInstantiated);
    });
  });

  /* =========================================================================
   * CHALLENGE 2: AbortController Cancellation Lifecycle & Resource Teardown
   * ========================================================================= */
  describe("Challenge 2: AbortController Cancellation Lifecycle & Resource Teardown", () => {
    it("immediately aborts before export starts when external signal is already aborted", async () => {
      const manager = new ExportManager();
      const buffer = createSyntheticBuffer(1.0, 44100);

      const abortController = new AbortController();
      abortController.abort("Pre-aborted signal");

      const progressEvents: ExportProgress[] = [];

      await expect(
        manager.exportVideo({
          format: "webm",
          audioBuffer: buffer as any,
          duration: 1.0,
          signal: abortController.signal,
          onProgress: (p) => progressEvents.push(p),
        })
      ).rejects.toThrow();

      expect(manager.isExporting()).toBe(false);
      const finalProgress = progressEvents[progressEvents.length - 1];
      expect(finalProgress.stage).toBe("cancelled");
      expect(videoEncodersClosed).toBe(videoEncodersInstantiated);
    });

    it("aborts active export immediately at 10% progress and closes encoders", async () => {
      const manager = new ExportManager();
      const buffer = createSyntheticBuffer(1.5, 44100);
      const abortController = new AbortController();

      let abortedAtFrame = -1;
      const progressList: ExportProgress[] = [];

      const exportPromise = manager.exportVideo({
        format: "webm",
        audioBuffer: buffer as any,
        duration: 1.5,
        fps: 60,
        signal: abortController.signal,
        onProgress: (p) => {
          progressList.push(p);
          if (p.stage === "rendering" && p.currentFrame >= 9 && abortedAtFrame === -1) {
            abortedAtFrame = p.currentFrame;
            abortController.abort("Aborted at 10%");
          }
        },
      });

      await expect(exportPromise).rejects.toThrow(/cancel|abort/i);

      expect(manager.isExporting()).toBe(false);
      expect(manager.getProgress()?.stage).toBe("cancelled");
      expect(abortedAtFrame).toBeGreaterThanOrEqual(9);

      expect(videoFramesEncoded).toBeLessThan(90);
      expect(videoEncodersClosed).toBe(videoEncodersInstantiated);
      expect(audioEncodersClosed).toBe(audioEncodersInstantiated);
    });

    it("aborts active export immediately at 50% progress and destroys renderer", async () => {
      const manager = new ExportManager();
      const buffer = createSyntheticBuffer(2.0, 44100);
      const abortController = new AbortController();

      let abortedAtFrame = -1;
      const exportPromise = manager.exportVideo({
        format: "webm",
        audioBuffer: buffer as any,
        duration: 2.0,
        fps: 60,
        signal: abortController.signal,
        onProgress: (p) => {
          if (p.stage === "rendering" && p.currentFrame >= 60 && abortedAtFrame === -1) {
            abortedAtFrame = p.currentFrame;
            abortController.abort("Aborted at 50%");
          }
        },
      });

      await expect(exportPromise).rejects.toThrow(/cancel|abort/i);

      expect(manager.isExporting()).toBe(false);
      expect(manager.getProgress()?.stage).toBe("cancelled");
      expect(videoFramesEncoded).toBeLessThan(120);

      expect(videoEncodersClosed).toBe(videoEncodersInstantiated);
      expect(audioEncodersClosed).toBe(audioEncodersInstantiated);
    });

    it("calling abort() after export completion does NOT corrupt completed blob or state", async () => {
      const manager = new ExportManager();
      const buffer = createSyntheticBuffer(0.2, 44100);

      const blob = await manager.exportVideo({
        format: "webm",
        audioBuffer: buffer as any,
        duration: 0.2,
        fps: 30,
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
      expect(manager.isExporting()).toBe(false);
      expect(manager.getProgress()?.stage).toBe("complete");

      expect(() => manager.abort("Post-completion abort")).not.toThrow();
      expect(manager.isExporting()).toBe(false);
      expect(manager.getProgress()?.stage).toBe("complete");
    });

    it("handles multiple rapid abort calls concurrently without unhandled rejections", async () => {
      const manager = new ExportManager();
      const buffer = createSyntheticBuffer(1.0, 44100);

      const promise = manager.exportVideo({
        format: "webm",
        audioBuffer: buffer as any,
        duration: 1.0,
        fps: 60,
      });

      manager.abort("rapid 1");
      manager.abort("rapid 2");
      manager.abort("rapid 3");
      manager.abort("rapid 4");
      manager.abort("rapid 5");

      await expect(promise).rejects.toThrow();
      expect(manager.isExporting()).toBe(false);
      expect(manager.getProgress()?.stage).toBe("cancelled");
    });
  });

  /* =========================================================================
   * CHALLENGE 3: checkProResServerHealth & Graceful ProRes Fallback
   * ========================================================================= */
  describe("Challenge 3: checkProResServerHealth & Graceful ProRes Fallback", () => {
    it("returns isAvailable: true when primary Vite middleware responds with HTTP 200", async () => {
      globalThis.fetch = vi.fn(async (url: any) => {
        if (String(url).includes("/api/convert-prores")) {
          return new Response(null, { status: 200, statusText: "OK" });
        }
        return new Response(null, { status: 404 });
      }) as any;

      const health = await checkProResServerHealth();
      expect(health.isAvailable).toBe(true);
      expect(health.endpoint).toBe("/api/convert-prores");
      expect(health.error).toBeUndefined();
    });

    it("falls back to secondary microservice :5175 when primary responds with 404", async () => {
      globalThis.fetch = vi.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("/api/convert-prores") && !urlStr.includes("5175")) {
          return new Response(null, { status: 404, statusText: "Not Found" });
        }
        if (urlStr.includes(":5175/health")) {
          return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }) as any;

      const health = await checkProResServerHealth();
      expect(health.isAvailable).toBe(true);
      expect(health.endpoint).toBe("http://localhost:5175/api/convert-prores");
    });

    it("reports offline when both primary and secondary return HTTP 404", async () => {
      globalThis.fetch = vi.fn(async () => {
        return new Response(null, { status: 404, statusText: "Not Found" });
      }) as any;

      const health = await checkProResServerHealth();
      expect(health.isAvailable).toBe(false);
      expect(health.error).toContain("offline");
    });

    it("reports offline when primary and secondary return HTTP 500 server error", async () => {
      globalThis.fetch = vi.fn(async () => {
        return new Response("Internal Server Error", { status: 500 });
      }) as any;

      const health = await checkProResServerHealth();
      expect(health.isAvailable).toBe(false);
      expect(health.error).toContain("offline");
    });

    it("reports offline when fetch throws network error (ECONNREFUSED)", async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new TypeError("Failed to fetch: Connection Refused");
      }) as any;

      const health = await checkProResServerHealth();
      expect(health.isAvailable).toBe(false);
      expect(health.error).toBeDefined();
    });

    it("reports offline when server probe times out (aborts)", async () => {
      globalThis.fetch = vi.fn(async (_url: any, init: any) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
      }) as any;

      const probePromise = checkProResServerHealth();
      const health = await probePromise;
      expect(health.isAvailable).toBe(false);
    });

    it("exportProRes4444 returns transparent WebM with isFallback: true when server is offline", async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error("Connection Refused");
      }) as any;

      const buffer = createSyntheticBuffer(0.2, 44100);
      const progressSteps: ExportProgress[] = [];

      const result = await exportProRes4444(
        {
          format: "prores",
          audioBuffer: buffer as any,
          duration: 0.2,
          fps: 30,
          fallbackToWebMOnProResFail: true,
        },
        (p) => progressSteps.push(p)
      );

      expect(result.isFallback).toBe(true);
      expect(result.filenameExt).toBe("webm");
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("video/webm");

      const exporter = new ProRes4444Exporter();
      const exportResult = await exporter.export(
        {
          format: "prores",
          audioBuffer: buffer as any,
          duration: 0.2,
          fps: 30,
          fallbackToWebMOnProResFail: true,
        },
        () => {},
        new AbortController().signal
      );

      expect(exportResult.isFallback).toBe(true);
      expect(exportResult.mimeType).toBe("video/webm");
      expect(exportResult.filename).toContain(".webm");
    });

    it("exportProRes4444 gracefully falls back to WebM if server health check passes but POST conversion fails", async () => {
      globalThis.fetch = vi.fn(async (url: any, init?: any) => {
        if (init?.method === "HEAD") {
          return new Response(null, { status: 200 });
        }
        if (init?.method === "POST") {
          return new Response("FFmpeg transcode crash: exit code 1", { status: 500 });
        }
        return new Response(null, { status: 404 });
      }) as any;

      const buffer = createSyntheticBuffer(0.2, 44100);
      const result = await exportProRes4444({
        format: "prores",
        audioBuffer: buffer as any,
        duration: 0.2,
        fps: 30,
        fallbackToWebMOnProResFail: true,
      });

      expect(result.isFallback).toBe(true);
      expect(result.filenameExt).toBe("webm");
    });

    it("exportProRes4444 throws error when server is offline and fallbackToWebMOnProResFail is false", async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error("Connection Refused");
      }) as any;

      const buffer = createSyntheticBuffer(0.2, 44100);

      await expect(
        exportProRes4444({
          format: "prores",
          audioBuffer: buffer as any,
          duration: 0.2,
          fps: 30,
          fallbackToWebMOnProResFail: false,
        })
      ).rejects.toThrow();
    });

    it("aborts ProRes export immediately without returning fallback when signal is aborted", async () => {
      globalThis.fetch = vi.fn(async () => {
        return new Response(null, { status: 200 });
      }) as any;

      const buffer = createSyntheticBuffer(0.5, 44100);
      const abortController = new AbortController();

      const exportPromise = exportProRes4444(
        {
          format: "prores",
          audioBuffer: buffer as any,
          duration: 0.5,
          fps: 30,
        },
        (p) => {
          if (p.stage === "rendering") {
            abortController.abort("Abort during ProRes rendering phase");
          }
        },
        abortController.signal
      );

      await expect(exportPromise).rejects.toThrow(/cancel|abort/i);
    });
  });

  /* =========================================================================
   * CHALLENGE 4: Audio Resampler & WAV Encoder Extreme Durations & Sample Rates
   * ========================================================================= */
  describe("Challenge 4: Audio Resampler & WAV Encoder Extreme Durations & Sample Rates", () => {
    it("resamples extreme short duration (0.1s / 100ms) with zero NaNs and exact sample count", async () => {
      const source = createSyntheticBuffer(0.1, 44100, 2);
      const resampled = await resampleAudioBuffer(source, 48000, 0.1);

      expect(resampled.sampleRate).toBe(48000);
      expect(resampled.numberOfChannels).toBe(2);
      expect(resampled.length).toBe(4800);

      const ch0 = resampled.getChannelData(0);
      const ch1 = resampled.getChannelData(1);
      for (let i = 0; i < 4800; i++) {
        expect(Number.isNaN(ch0[i])).toBe(false);
        expect(Number.isNaN(ch1[i])).toBe(false);
        expect(Number.isFinite(ch0[i])).toBe(true);
        expect(Number.isFinite(ch1[i])).toBe(true);
      }
    });

    it("resamples 60-second broadcast buffer (2,880,000 samples) without NaNs or buffer overflow", async () => {
      const source = createSyntheticBuffer(60.0, 44100, 2);
      const startResample = performance.now();
      const resampled = await resampleAudioBuffer(source, 48000, 60.0);
      const resampleDurationMs = performance.now() - startResample;

      expect(resampled.sampleRate).toBe(48000);
      expect(resampled.length).toBe(2_880_000);
      expect(resampleDurationMs).toBeLessThan(3000);

      const ch0 = resampled.getChannelData(0);
      const ch1 = resampled.getChannelData(1);

      const checkIndices = [0, 1, 100, 48000, 1_000_000, 2_000_000, 2_879_998, 2_879_999];
      for (const idx of checkIndices) {
        expect(Number.isNaN(ch0[idx])).toBe(false);
        expect(Number.isNaN(ch1[idx])).toBe(false);
        expect(Number.isFinite(ch0[idx])).toBe(true);
        expect(Number.isFinite(ch1[idx])).toBe(true);
      }
    });

    it("resamples non-standard and extreme sample rates: 22050, 44100, 96000, 8000, 192000", async () => {
      const testSampleRates = [
        { from: 22050, to: 48000, duration: 1.0, expectedLen: 48000 },
        { from: 44100, to: 48000, duration: 1.0, expectedLen: 48000 },
        { from: 96000, to: 48000, duration: 1.0, expectedLen: 48000 },
        { from: 8000, to: 44100, duration: 0.5, expectedLen: 22050 },
        { from: 48000, to: 22050, duration: 1.0, expectedLen: 22050 },
        { from: 48000, to: 96000, duration: 0.5, expectedLen: 48000 },
        { from: 192000, to: 48000, duration: 0.25, expectedLen: 12000 },
      ];

      for (const t of testSampleRates) {
        const src = createSyntheticBuffer(t.duration, t.from, 2);
        const out = await resampleAudioBuffer(src, t.to, t.duration);

        expect(out.sampleRate).toBe(t.to);
        expect(out.length).toBe(t.expectedLen);

        const data = out.getChannelData(0);
        expect(Number.isNaN(data[0])).toBe(false);
        expect(Number.isNaN(data[data.length - 1])).toBe(false);
      }
    });

    it("handles complete silence (all zeros) without producing NaNs, infinities, or crashes", async () => {
      const silentBuffer = createSyntheticBuffer(1.0, 44100, 2, () => 0.0);
      const resampled = await resampleAudioBuffer(silentBuffer, 48000, 1.0);

      const ch0 = resampled.getChannelData(0);
      const ch1 = resampled.getChannelData(1);

      for (let i = 0; i < resampled.length; i += 100) {
        expect(ch0[i]).toBe(0.0);
        expect(ch1[i]).toBe(0.0);
      }

      const wav = audioBufferToWav(resampled);
      expect(wav.length).toBe(44 + 48000 * 2 * 2);

      for (let i = 44; i < wav.length; i++) {
        expect(wav[i]).toBe(0);
      }
    });

    it("handles extreme clipping (+5.0, -5.0) by clamping to [-32768, 32767] with no int16 overflow wrap", () => {
      const clipped = createSyntheticBuffer(0.1, 44100, 1, (_ch, i) => {
        if (i % 4 === 0) return 5.0;
        if (i % 4 === 1) return -5.0;
        if (i % 4 === 2) return 1.0;
        return -1.0;
      });

      const wav = audioBufferToWav(clipped);
      const view = new DataView(wav.buffer);

      let offset = 44;
      for (let i = 0; i < clipped.length; i++) {
        const intSample = view.getInt16(offset, true);
        if (i % 4 === 0) {
          expect(intSample).toBe(32767);
        } else if (i % 4 === 1) {
          expect(intSample).toBe(-32768);
        } else if (i % 4 === 2) {
          expect(intSample).toBe(32767);
        } else {
          expect(intSample).toBe(-32768);
        }
        offset += 2;
      }
    });

    it("verifies byte-exact RIFF WAVE header schema across various durations and channels", async () => {
      const testConfigs = [
        { duration: 0.1, rate: 44100, channels: 1 },
        { duration: 0.5, rate: 48000, channels: 2 },
        { duration: 2.0, rate: 22050, channels: 2 },
      ];

      for (const cfg of testConfigs) {
        const buf = createSyntheticBuffer(cfg.duration, cfg.rate, cfg.channels);
        const wavBytes = audioBufferToWav(buf);
        const view = new DataView(wavBytes.buffer);

        const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        expect(riff).toBe("RIFF");

        const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
        expect(wave).toBe("WAVE");

        const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
        expect(fmt).toBe("fmt ");

        expect(view.getUint16(20, true)).toBe(1);
        expect(view.getUint16(22, true)).toBe(cfg.channels);
        expect(view.getUint32(24, true)).toBe(cfg.rate);
        expect(view.getUint16(34, true)).toBe(16);

        const data = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
        expect(data).toBe("data");

        const expectedDataSize = buf.length * cfg.channels * 2;
        expect(view.getUint32(40, true)).toBe(expectedDataSize);
        expect(wavBytes.length).toBe(44 + expectedDataSize);
      }
    });

    it("constrains multi-channel input (e.g. 6-channel 5.1 surround) to maximum 2 stereo channels safely", async () => {
      const surroundBuffer = createSyntheticBuffer(0.5, 48000, 6);
      const resampled = await resampleAudioBuffer(surroundBuffer, 44100, 0.5);

      expect(resampled.numberOfChannels).toBe(2);
      expect(resampled.getChannelData(0)).toBeDefined();
      expect(resampled.getChannelData(1)).toBeDefined();
    });

    it("resampleAudioToWav pipeline produces byte-exact 16-bit PCM WAV from arbitrary source", async () => {
      const source = createSyntheticBuffer(0.5, 48000, 2);
      const wav = await resampleAudioToWav(source, 44100, 0.5);

      expect(wav).toBeInstanceOf(Uint8Array);
      const view = new DataView(wav.buffer);
      expect(view.getUint32(24, true)).toBe(44100);
      expect(view.getUint16(34, true)).toBe(16);
      expect(wav.length).toBe(44 + Math.ceil(0.5 * 44100) * 2 * 2);
    });
  });
});
