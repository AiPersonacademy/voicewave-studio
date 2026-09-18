/**
 * src/export/engines/ProRes4444Exporter.ts
 *
 * Apple ProRes 4444 MOV Exporter with 12-bit alpha (yuva444p10le).
 * Transcodes client-side WebM VP9 Alpha through local FFmpeg service
 * with robust pre-flight health checks and graceful WebM Alpha fallback.
 * Conforms to PROJECT.md §Multi-Engine Export Pipeline.
 */

import { exportWebMAlpha } from "./WebMAlphaExporter";
import type {
  ExportEngine,
  ExportOptions,
  ExportProgress,
  ExportResult,
} from "../types";

export interface ProResHealthStatus {
  isAvailable: boolean;
  endpoint: string;
  ffmpegVersion?: string;
  error?: string;
}

/**
 * Pre-flight probe to check whether the local FFmpeg ProRes converter service is online.
 * Checks primary Vite middleware (/api/convert-prores) and standalone microservice (:5175/health).
 */
export async function checkProResServerHealth(): Promise<ProResHealthStatus> {
  // 1. Check primary Vite dev/preview middleware endpoint
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch("/api/convert-prores", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return { isAvailable: true, endpoint: "/api/convert-prores" };
    }
  } catch {
    // Vite middleware probe timed out or failed, try standalone
  }

  // 2. Check fallback standalone microservice port 5175
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch("http://localhost:5175/health", {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return { isAvailable: true, endpoint: "http://localhost:5175/api/convert-prores" };
    }
  } catch {
    // Both endpoints unavailable
  }

  return {
    isAvailable: false,
    endpoint: "/api/convert-prores",
    error: "Local FFmpeg ProRes converter service is offline",
  };
}

export class ProRes4444Exporter implements ExportEngine {
  public readonly id = "prores" as const;
  public readonly name = "Apple ProRes 4444";
  public readonly mimeType = "video/quicktime";
  public readonly fileExtension = ".mov";

  public async export(
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void,
    signal: AbortSignal
  ): Promise<ExportResult> {
    const startTime = performance.now();
    const fps = options.fps ?? 60;
    const durationSec = Math.min(options.duration, options.audioBuffer.duration);
    const totalFrames = Math.max(1, Math.round(durationSec * fps));

    const result = await exportProRes4444(options, onProgress, signal);
    const elapsedMs = Math.round(performance.now() - startTime);

    const baseName = options.filename || `voicewave-${result.isFallback ? "alpha" : "prores4444"}-${Date.now()}`;
    const filename = `${baseName}.${result.filenameExt}`;

    return {
      blob: result.blob,
      filename,
      mimeType: result.isFallback ? "video/webm" : this.mimeType,
      durationSec,
      totalFrames,
      elapsedMs,
      format: "prores",
      isFallback: result.isFallback,
    };
  }
}

/**
 * Executes Apple ProRes 4444 MOV export with graceful fallback to WebM VP9 Alpha.
 */
export async function exportProRes4444(
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; isFallback: boolean; filenameExt: string }> {
  const fps = options.fps ?? 60;
  const duration = options.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  // 1. Pre-flight health probe
  onProgress?.({
    stage: "analyzing",
    currentFrame: 0,
    totalFrames,
    percent: 1,
    fps: 0,
    speed: "1.0x",
    timeRemainingSec: Math.ceil(totalFrames / fps),
    stageMessage: "Probing local FFmpeg ProRes conversion service...",
  });

  const health = await checkProResServerHealth();

  // 2. Generate transparent WebM VP9 Alpha stream (Phase 1)
  const webmBlob = await exportWebMAlpha(
    options,
    (p) => {
      // Map WebM render progress to 0% - 80% of ProRes workflow
      const scaledPercent = Math.round((p.percent / 100) * 80);
      onProgress?.({
        ...p,
        percent: scaledPercent,
        stageMessage: p.stage === "rendering"
          ? `Rendering WebGL frames for ProRes (${p.currentFrame}/${p.totalFrames})`
          : p.stageMessage,
      });
    },
    signal
  );

  if (signal?.aborted) {
    throw new DOMException("Export cancelled by user", "AbortError");
  }

  // If server is offline or fallback requested, return WebM Alpha directly
  if (!health.isAvailable && options.fallbackToWebMOnProResFail !== false) {
    console.warn("[ProRes4444Exporter] Server offline, returning transparent WebM Alpha as fallback.");
    return { blob: webmBlob, isFallback: true, filenameExt: "webm" };
  }

  // 3. Post to conversion endpoint (Phase 2: 80% - 100%)
  onProgress?.({
    stage: "converting",
    currentFrame: totalFrames,
    totalFrames,
    percent: 85,
    fps: 0,
    speed: "1.0x",
    timeRemainingSec: 2,
    stageMessage: "Transcoding to Apple ProRes 4444 (profile 4, yuva444p10le)...",
  });

  try {
    const response = await fetch(health.endpoint, {
      method: "POST",
      headers: { "Content-Type": "video/webm" },
      body: webmBlob,
      signal,
    });

    if (!response.ok) {
      throw new Error(`FFmpeg server returned HTTP ${response.status}: ${await response.text()}`);
    }

    onProgress?.({
      stage: "converting",
      currentFrame: totalFrames,
      totalFrames,
      percent: 97,
      fps: 0,
      speed: "1.0x",
      timeRemainingSec: 1,
      stageMessage: "Receiving ProRes 4444 MOV stream...",
    });

    const movBlob = await response.blob();
    return { blob: movBlob, isFallback: false, filenameExt: "mov" };
  } catch (err: any) {
    if (signal?.aborted || err.name === "AbortError") {
      throw new DOMException("Export cancelled by user", "AbortError");
    }

    if (options.fallbackToWebMOnProResFail !== false) {
      console.warn("[ProRes4444Exporter] Transcode failed, falling back to WebM Alpha:", err);
      return { blob: webmBlob, isFallback: true, filenameExt: "webm" };
    }

    throw err;
  }
}
