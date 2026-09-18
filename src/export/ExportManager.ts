/**
 * src/export/ExportManager.ts
 *
 * Central Export Coordinator for VoiceWave Studio.
 * Manages engine registration, format normalization, AbortController lifecycle,
 * and unified export telemetry.
 * Conforms to PROJECT.md §Multi-Engine Export Pipeline.
 */

import type {
  ExportEngine,
  ExportFormat,
  ExportOptions,
  ExportProgress,
  ExportResult,
} from "./types";
import { WebMAlphaExporter } from "./engines/WebMAlphaExporter";
import { ProRes4444Exporter } from "./engines/ProRes4444Exporter";
import { PNGSequenceExporter } from "./engines/PNGSequenceExporter";
import { ChromaMp4Exporter } from "./engines/ChromaMp4Exporter";

export class ExportManager {
  private engines = new Map<ExportFormat, ExportEngine>();
  private activeAbortController: AbortController | null = null;
  private activeProgress: ExportProgress | null = null;
  private isBusy = false;

  constructor() {
    this.registerDefaultEngines();
  }

  private registerDefaultEngines(): void {
    this.registerEngine(new ProRes4444Exporter());
    this.registerEngine(new WebMAlphaExporter());
    this.registerEngine(new PNGSequenceExporter());
    this.registerEngine(new ChromaMp4Exporter());
  }

  public registerEngine(engine: ExportEngine): void {
    this.engines.set(engine.id, engine);
  }

  public getEngine(format: ExportFormat): ExportEngine | undefined {
    return this.engines.get(format);
  }

  public isExporting(): boolean {
    return this.isBusy;
  }

  public getProgress(): ExportProgress | null {
    return this.activeProgress;
  }

  /**
   * Normalizes incoming format strings into canonical ExportFormat keys.
   */
  public normalizeFormat(format: string): ExportFormat {
    const f = (format || "").toLowerCase().trim();
    if (f === "prores" || f === "prores-4444" || f === "prores4444" || f === "mov") {
      return "prores";
    }
    if (f === "webm" || f === "webm-alpha" || f === "alpha-webm" || f === "turbo-screen") {
      return "webm";
    }
    if (f === "png" || f === "png-zip" || f === "png-sequence" || f === "zip") {
      return "png-zip";
    }
    if (
      f === "chroma-mp4" ||
      f === "chroma-green" ||
      f === "chroma-blue" ||
      f === "greenscreen" ||
      f === "bluescreen" ||
      f === "mp4"
    ) {
      return "chroma-mp4";
    }
    return "webm";
  }

  /**
   * Unified export entry point.
   * Dispatches to the appropriate engine, coordinates AbortController lifecycle,
   * updates sliding-window telemetry, and returns the finished video/zip Blob.
   */
  public async exportVideo(options: ExportOptions): Promise<Blob> {
    if (this.isBusy) {
      throw new Error("Another export is already in progress. Please wait or cancel.");
    }

    const canonicalFormat = this.normalizeFormat(options.format);
    const engine = this.engines.get(canonicalFormat);

    if (!engine) {
      throw new Error(`No exporter engine registered for format '${canonicalFormat}'.`);
    }

    this.isBusy = true;
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    // Link external abort signal if provided
    if (options.signal) {
      if (options.signal.aborted) {
        this.abort("External signal already aborted");
      } else {
        options.signal.addEventListener("abort", () => {
          this.abort("External signal aborted");
        });
      }
    }

    const startTime = performance.now();
    const fps = options.fps ?? 60;
    const duration = Math.min(
      options.duration ?? options.audioBuffer.duration,
      options.audioBuffer.duration
    );
    const totalFrames = Math.max(1, Math.round(duration * fps));

    const updateProgress = (progress: ExportProgress) => {
      this.activeProgress = progress;
      options.onProgress?.(progress);
    };

    // Initial Progress state
    updateProgress({
      stage: "analyzing",
      currentFrame: 0,
      totalFrames,
      percent: 0,
      fps: 0,
      speed: "1.0x",
      timeRemainingSec: Math.ceil(totalFrames / fps),
      stageMessage: "Initializing Export Pipeline...",
    });

    try {
      const result: ExportResult = await engine.export(
        { ...options, format: canonicalFormat, fps, duration },
        (p) => updateProgress(p),
        abortController.signal
      );

      const elapsedSec = Math.max(0.001, (performance.now() - startTime) / 1000);
      const averageFps = Math.round(totalFrames / elapsedSec);
      const speedMultiplier = (averageFps / fps).toFixed(1);

      updateProgress({
        stage: "complete",
        currentFrame: totalFrames,
        totalFrames,
        percent: 100,
        fps: averageFps,
        speed: `${speedMultiplier}x`,
        timeRemainingSec: 0,
        stageMessage: "Export Complete!",
      });

      return result.blob;
    } catch (err: any) {
      const isAbort =
        err.name === "AbortError" ||
        err.message?.toLowerCase().includes("cancel") ||
        abortController.signal.aborted;

      if (isAbort) {
        updateProgress({
          stage: "cancelled",
          currentFrame: this.activeProgress?.currentFrame ?? 0,
          totalFrames,
          percent: this.activeProgress?.percent ?? 0,
          fps: 0,
          speed: "0x",
          timeRemainingSec: 0,
          stageMessage: "Export Cancelled by User",
        });
      } else {
        updateProgress({
          stage: "error",
          currentFrame: this.activeProgress?.currentFrame ?? 0,
          totalFrames,
          percent: this.activeProgress?.percent ?? 0,
          fps: 0,
          speed: "0x",
          timeRemainingSec: 0,
          error: err.message || "Unknown export failure",
          stageMessage: "Export Failed",
        });
      }
      throw err;
    } finally {
      this.isBusy = false;
      this.activeAbortController = null;
    }
  }

  /**
   * Instantly cancels any active export and triggers resource cleanup.
   */
  public abort(reason = "Export cancelled"): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort(reason);
      this.activeAbortController = null;
    }
    this.isBusy = false;
  }
}

export const exportManager = new ExportManager();
