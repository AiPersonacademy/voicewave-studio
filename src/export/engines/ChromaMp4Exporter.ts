/**
 * src/export/engines/ChromaMp4Exporter.ts
 *
 * Chroma Key Green (#00FF00) and Blue (#0000FF) Screen MP4 Video Exporter.
 * Composites the transparent WebGL archetype over a solid chroma plate,
 * encodes offline frames, and converts to broadcast-standard H.264/AAC MP4
 * via the local FFmpeg converter service.
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

export class ChromaMp4Exporter implements ExportEngine {
  public readonly id = "chroma-mp4" as const;
  public readonly name = "Chroma Key MP4";
  public readonly mimeType = "video/mp4";
  public readonly fileExtension = ".mp4";

  public async export(
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void,
    signal: AbortSignal
  ): Promise<ExportResult> {
    const startTime = performance.now();
    const fps = options.fps ?? 60;
    const durationSec = Math.min(options.duration, options.audioBuffer.duration);
    const totalFrames = Math.max(1, Math.round(durationSec * fps));

    const blob = await exportChromaMp4(options, onProgress, signal);
    const elapsedMs = Math.round(performance.now() - startTime);
    const filename = (options.filename || `voicewave-chroma-${Date.now()}`) + this.fileExtension;

    return {
      blob,
      filename,
      mimeType: blob.type || this.mimeType,
      durationSec,
      totalFrames,
      elapsedMs,
      format: "chroma-mp4",
    };
  }
}

/**
 * Resolves the chroma screen background color.
 */
function getChromaColor(options: ExportOptions): { hex: string; name: "green" | "blue" } {
  if (options.chromaColor === "blue" || options.backgroundMode === "blue-screen") {
    return { hex: "#0000FF", name: "blue" };
  }
  return { hex: "#00FF00", name: "green" };
}

/**
 * Exports a broadcast-standard Chroma Key MP4 (or WebM fallback) video.
 */
export async function exportChromaMp4(
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
      "WebCodecs VideoEncoder / AudioEncoder is not supported in this environment."
    );
  }

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
  const chroma = getChromaColor(options);

  // 1. Offline Deterministic Audio Precomputation
  onProgress?.({
    stage: "analyzing",
    currentFrame: 0,
    totalFrames: totalExpectedFrames,
    percent: 0,
    fps: 0,
    speed: "0.0x",
    timeRemainingSec: Math.ceil(totalExpectedFrames / fps),
    stageMessage: `Precomputing deterministic acoustic ballistics for Chroma ${chroma.name}...`,
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

  // 2. Setup WebM Muxer
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "V_VP9",
      width: encWidth,
      height: encHeight,
      frameRate: fps,
    },
    audio: {
      codec: "A_OPUS",
      numberOfChannels: numChannels,
      sampleRate: 48000,
    },
    firstTimestampBehavior: "strict",
  });

  let encoderError: Error | null = null;

  // 3. Initialize VideoEncoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      console.error("[ChromaMp4Exporter] VideoEncoder error:", err);
      encoderError = err;
    },
  });

  videoEncoder.configure({
    codec: "vp09.00.10.08",
    width: encWidth,
    height: encHeight,
    bitrate: options.videoBitrate ?? 16_000_000,
    framerate: fps,
    latencyMode: "quality",
  });

  // 4. Initialize AudioEncoder
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => {
      console.error("[ChromaMp4Exporter] AudioEncoder error:", err);
      encoderError = err;
    },
  });

  audioEncoder.configure({
    codec: "opus",
    sampleRate: 48000,
    numberOfChannels: numChannels,
    bitrate: options.audioBitrate ?? 128_000,
  });

  // 5. Resample and Encode Audio
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

  // 6. Setup Rendering Canvases (Offscreen WebGL + 2D Chroma Composite Canvas)
  const webglCanvas = document.createElement("canvas");
  webglCanvas.width = encWidth;
  webglCanvas.height = encHeight;

  const renderer = new UniversalRenderer(archetype);
  renderer.init(webglCanvas);
  renderer.resize(encWidth, encHeight);

  const chromaCanvas = document.createElement("canvas");
  chromaCanvas.width = encWidth;
  chromaCanvas.height = encHeight;
  const ctx = chromaCanvas.getContext("2d", { alpha: false });

  const paletteDef = getPalette(palette);
  const paletteRgb = paletteDef.rgb;
  const renderStartTime = performance.now();

  try {
    // 7. Offline Frame Render & Encode Loop
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted || encoderError) {
        renderer.destroy();
        try { videoEncoder.close(); } catch {}
        try { audioEncoder.close(); } catch {}
        throw encoderError ?? new DOMException("Export cancelled by user", "AbortError");
      }

      const f = dspResult.getFrame(i);

      // Render archetype onto transparent WebGL canvas
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

      // Composite over solid Chroma background
      if (ctx) {
        ctx.fillStyle = chroma.hex;
        ctx.fillRect(0, 0, encWidth, encHeight);
        ctx.drawImage(webglCanvas, 0, 0);
      }

      const timestampUs = Math.round(f.timestamp * 1_000_000);
      const videoFrame = new VideoFrame(chromaCanvas, { timestamp: timestampUs });
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

      // Progress reporting
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
          percent: Math.min(85, Math.round(((i + 1) / totalFrames) * 85)),
          fps: currentFps,
          speed: `${speed}x`,
          timeRemainingSec: eta,
          stageMessage: `Rendering Chroma ${chroma.name} frame ${i + 1} / ${totalFrames}`,
        });

        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // 8. Flush and Finalize WebM
    onProgress?.({
      stage: "encoding",
      currentFrame: totalFrames,
      totalFrames,
      percent: 90,
      fps: 0,
      speed: "1.0x",
      timeRemainingSec: 1,
      stageMessage: "Encoding Chroma stream container...",
    });

    await videoEncoder.flush();
    await audioEncoder.flush();
    muxer.finalize();
    renderer.destroy();
    videoEncoder.close();
    audioEncoder.close();

    const intermediateBlob = new Blob([muxer.target.buffer], { type: "video/webm" });

    // 9. Convert to MP4 via local FFmpeg service if online
    onProgress?.({
      stage: "converting",
      currentFrame: totalFrames,
      totalFrames,
      percent: 94,
      fps: 0,
      speed: "1.0x",
      timeRemainingSec: 1,
      stageMessage: "Transcoding Chroma video to MP4 (H.264/AAC)...",
    });

    try {
      const response = await fetch("/api/convert-mp4", {
        method: "POST",
        headers: { "Content-Type": "video/webm" },
        body: intermediateBlob,
        signal,
      });

      if (response.ok) {
        const mp4Blob = await response.blob();
        return mp4Blob;
      }
    } catch {
      // Server offline or failed, return intermediate blob as fallback
    }

    return intermediateBlob;
  } catch (err) {
    renderer.destroy();
    try { videoEncoder.close(); } catch {}
    try { audioEncoder.close(); } catch {}
    throw err;
  }
}
