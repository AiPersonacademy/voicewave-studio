/**
 * src/export/engines/WebMAlphaExporter.ts
 *
 * WebM VP9 Alpha Exporter utilizing WebCodecs VideoEncoder (alpha: "keep"),
 * AudioEncoder (Opus 48kHz), and webm-muxer.
 * Conforms to PROJECT.md §Multi-Engine Export Pipeline.
 */

import { Muxer, ArrayBufferTarget } from "webm-muxer";
import { OfflineDSP } from "@/audio/OfflineDSP";
import { UniversalRenderer } from "@/visualizers/UniversalRenderer";
import { getPalette } from "@/visualizers/palettes";
import { resampleAudioBuffer } from "../utils/audioResampler";
import type {
  ExportEngine,
  ExportOptions,
  ExportProgress,
  ExportResult,
} from "../types";

export class WebMAlphaExporter implements ExportEngine {
  public readonly id = "webm" as const;
  public readonly name = "WebM VP9 Alpha";
  public readonly mimeType = "video/webm";
  public readonly fileExtension = ".webm";

  public async export(
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void,
    signal: AbortSignal
  ): Promise<ExportResult> {
    const startTime = performance.now();
    const blob = await exportWebMAlpha(options, onProgress, signal);
    const elapsedMs = Math.round(performance.now() - startTime);
    const fps = options.fps ?? 60;
    const durationSec = Math.min(options.duration, options.audioBuffer.duration);
    const totalFrames = Math.max(1, Math.round(durationSec * fps));
    const filename = (options.filename || `voicewave-alpha-${Date.now()}`) + this.fileExtension;

    return {
      blob,
      filename,
      mimeType: this.mimeType,
      durationSec,
      totalFrames,
      elapsedMs,
      format: "webm",
    };
  }
}

/**
 * Low-level function to export transparent WebM VP9 video with synchronized Opus audio.
 */
export async function exportWebMAlpha(
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const {
    audioBuffer,
    archetype = "apple-siri",
    palette = "cupertino-siri",
    framing = "1:1",
    duration,
    fps = 60,
    params = {},
    resolution,
  } = options;

  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
    throw new Error(
      "WebCodecs VideoEncoder / AudioEncoder is not supported in this environment. Please use PNG Sequence export."
    );
  }

  // 1. Calculate and enforce even dimensions
  let rawWidth = 1080;
  let rawHeight = 1080;

  if (resolution) {
    rawWidth = resolution.width;
    rawHeight = resolution.height;
  } else if (framing === "16:9") {
    rawWidth = 1920;
    rawHeight = 1080;
  } else if (framing === "9:16") {
    rawWidth = 1080;
    rawHeight = 1920;
  }

  const encWidth = rawWidth & ~1;
  const encHeight = rawHeight & ~1;
  const aspectRatio = encWidth / encHeight;
  const targetDuration = Math.min(duration, audioBuffer.duration);
  const totalExpectedFrames = Math.max(1, Math.round(targetDuration * fps));

  // 2. Offline Deterministic Audio Precomputation
  onProgress?.({
    stage: "analyzing",
    currentFrame: 0,
    totalFrames: totalExpectedFrames,
    percent: 0,
    fps: 0,
    speed: "0.0x",
    timeRemainingSec: Math.ceil(totalExpectedFrames / fps),
    stageMessage: "Precomputing deterministic acoustic ballistics...",
  });

  const dspResult = OfflineDSP.analyze(audioBuffer, {
    fps,
    targetDuration,
    sensitivity: params.sensitivity ?? 1.0,
    smoothness: params.smoothness ?? 0.75,
    resetSpeed: params.resetSpeed ?? 0.70,
  });

  const totalFrames = dspResult.length;
  const numChannels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));

  // 3. Setup WebM Muxer with alpha container metadata
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "V_VP9",
      width: encWidth,
      height: encHeight,
      frameRate: fps,
      alpha: true, // Crucial: sets Matroska BlockAdditional alpha container metadata
    },
    audio: {
      codec: "A_OPUS",
      numberOfChannels: numChannels,
      sampleRate: 48000,
    },
    firstTimestampBehavior: "strict",
  });

  let encoderError: Error | null = null;

  // 4. Initialize WebCodecs VideoEncoder with alpha: "keep"
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      console.error("[WebMAlphaExporter] VideoEncoder error:", err);
      encoderError = err;
    },
  });

  videoEncoder.configure({
    codec: "vp09.00.10.08", // Profile 0, 8-bit, 4:2:0 with alpha
    width: encWidth,
    height: encHeight,
    bitrate: 18_000_000,
    framerate: fps,
    alpha: "keep", // CRITICAL: Preserves 8-bit alpha channel without black matte
    latencyMode: "quality",
  });

  // 5. Initialize WebCodecs AudioEncoder with 48kHz Opus
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => {
      console.error("[WebMAlphaExporter] AudioEncoder error:", err);
      encoderError = err;
    },
  });

  audioEncoder.configure({
    codec: "opus",
    sampleRate: 48000,
    numberOfChannels: numChannels,
    bitrate: 128_000,
  });

  // 6. Resample Audio to 48kHz and Encode in 40ms blocks
  const resampledBuffer = await resampleAudioBuffer(audioBuffer, 48000, targetDuration);
  const totalAudioSamples = Math.min(
    resampledBuffer.length,
    Math.round(targetDuration * 48000)
  );
  const chunkSize = 1920; // 40ms at 48kHz

  for (let offset = 0; offset < totalAudioSamples; offset += chunkSize) {
    if (signal?.aborted) {
      videoEncoder.close();
      audioEncoder.close();
      throw new DOMException("Export cancelled by user", "AbortError");
    }
    if (encoderError) throw encoderError;

    const framesThisChunk = Math.min(chunkSize, totalAudioSamples - offset);
    const planarData = new Float32Array(framesThisChunk * numChannels);

    for (let ch = 0; ch < numChannels; ch++) {
      const channel = resampledBuffer.getChannelData(ch);
      const chOffset = ch * framesThisChunk;
      for (let s = 0; s < framesThisChunk; s++) {
        planarData[chOffset + s] = channel[offset + s] ?? 0;
      }
    }

    const timestampUs = Math.round((offset / 48000) * 1_000_000);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: 48000,
      numberOfFrames: framesThisChunk,
      numberOfChannels: numChannels,
      timestamp: timestampUs,
      data: planarData,
    });

    audioEncoder.encode(audioData);
    audioData.close();
  }

  // 7. Initialize Offscreen Renderer using UniversalRenderer
  const canvas = document.createElement("canvas");
  canvas.width = encWidth;
  canvas.height = encHeight;

  const renderer = new UniversalRenderer(archetype);
  renderer.init(canvas);
  renderer.resize(encWidth, encHeight);

  const paletteDef = getPalette(palette);
  const paletteRgb = paletteDef.rgb;
  const renderStartTime = performance.now();

  try {
    // 8. Offline Frame-by-Frame Rendering Loop
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted || encoderError) {
        renderer.destroy();
        try { videoEncoder.close(); } catch {}
        try { audioEncoder.close(); } catch {}
        throw encoderError ?? new DOMException("Export cancelled by user", "AbortError");
      }

      const f = dspResult.getFrame(i);

      // Render frame with 100% sample-accurate DSP parameters
      renderer.render({
        time: f.timestamp,
        phase: f.phase,
        aspectRatio,
        low: f.low,
        mid: f.mid,
        high: f.high,
        amplitude: f.amplitude,
        sensitivity: params.sensitivity ?? 1.0,
        turbulence: params.turbulence ?? 1.0,
        glow: params.glowIntensity ?? 1.0,
        scale: params.scale ?? 1.0,
        palette: paletteRgb,
        isAudioActive: f.isAudioActive,
        isTransparent: true,
      });

      const timestampUs = Math.round(f.timestamp * 1_000_000);
      const videoFrame = new VideoFrame(canvas, { timestamp: timestampUs });
      videoEncoder.encode(videoFrame, { keyFrame: i % (fps * 2) === 0 });
      videoFrame.close();

      // Backpressure queue control
      if (videoEncoder.encodeQueueSize > 6) {
        await new Promise<void>((resolve) => {
          videoEncoder.ondequeue = () => {
            if (videoEncoder.encodeQueueSize <= 2) {
              videoEncoder.ondequeue = null;
              resolve();
            }
          };
        });
      }

      // UI Progress update and event loop yield
      if (i % 15 === 0 || i === totalFrames - 1) {
        const elapsedSec = (performance.now() - renderStartTime) / 1000;
        const currentFps = elapsedSec > 0 ? Math.round((i + 1) / elapsedSec) : fps;
        const speed = elapsedSec > 0 ? ((i + 1) / (fps * elapsedSec)).toFixed(1) : "1.0";
        const remainingFrames = totalFrames - (i + 1);
        const eta = currentFps > 0 ? Math.ceil(remainingFrames / currentFps) : 0;

        onProgress?.({
          stage: "rendering",
          currentFrame: i + 1,
          totalFrames,
          percent: Math.min(95, Math.round(((i + 1) / totalFrames) * 95)),
          fps: currentFps,
          speed: `${speed}x`,
          timeRemainingSec: eta,
          stageMessage: `Rendering WebGL frame ${i + 1} / ${totalFrames}`,
        });

        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // 9. Flush and finalize
    onProgress?.({
      stage: "encoding",
      currentFrame: totalFrames,
      totalFrames,
      percent: 98,
      fps: 0,
      speed: "1.0x",
      timeRemainingSec: 0,
      stageMessage: "Finalizing WebM VP9 container...",
    });

    await videoEncoder.flush();
    await audioEncoder.flush();
    muxer.finalize();
    renderer.destroy();
    videoEncoder.close();
    audioEncoder.close();

    const blob = new Blob([muxer.target.buffer], { type: "video/webm" });
    return blob;
  } catch (err) {
    renderer.destroy();
    try { videoEncoder.close(); } catch {}
    try { audioEncoder.close(); } catch {}
    throw err;
  }
}
