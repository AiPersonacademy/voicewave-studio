/**
 * src/export/types.ts
 *
 * Unified Type Contracts for VoiceWave Studio Multi-Engine Export Pipeline.
 * Conforms to PROJECT.md §Visualizers ↔ Export Pipeline & Milestone 4 specifications.
 */

import type { AudioBufferLike } from "@/audio/types";

export type ExportFormat =
  | "prores"
  | "webm"
  | "png-zip"
  | "chroma-mp4"
  | "webm-alpha"
  | "png-sequence"
  | "chroma-green";

export type ExportStage =
  | "idle"
  | "analyzing"
  | "rendering"
  | "encoding"
  | "converting"
  | "packaging"
  | "complete"
  | "cancelled"
  | "error";

export interface ExportProgress {
  stage: ExportStage;
  currentFrame: number;
  totalFrames: number;
  percent: number;
  fps: number;
  speed: string;
  timeRemainingSec: number;
  stageMessage?: string;
  error?: string;
}

export interface ExportResolution {
  width: number;
  height: number;
}

export interface ExportOptions {
  format: ExportFormat | string;
  audioBuffer: AudioBuffer | AudioBufferLike;
  archetype?: string;
  palette?: string;
  framing?: "1:1" | "16:9" | "9:16";
  backgroundMode?: "checkerboard" | "dark" | "glow" | "green-screen" | "blue-screen";
  duration: number;
  fps?: number;
  params?: {
    sensitivity?: number;
    smoothness?: number;
    resetSpeed?: number;
    turbulence?: number;
    glowIntensity?: number;
    scale?: number;
  };
  resolution?: ExportResolution;
  filename?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
  fallbackToWebMOnProResFail?: boolean;
  includeWav?: boolean;
  targetSampleRate?: number;
  chromaColor?: "green" | "blue" | string;
  videoBitrate?: number;
  audioBitrate?: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  durationSec: number;
  totalFrames: number;
  elapsedMs: number;
  format: ExportFormat;
  isFallback?: boolean;
}

export interface ExportEngine {
  readonly id: ExportFormat;
  readonly name: string;
  readonly mimeType: string;
  readonly fileExtension: string;
  export(
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void,
    signal: AbortSignal
  ): Promise<ExportResult>;
}
