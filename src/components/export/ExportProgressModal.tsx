/**
 * src/components/export/ExportProgressModal.tsx
 *
 * visionOS Frosted Glass Real-Time Export Progress Modal.
 * Conforms to PROJECT.md §Multi-Engine Export Pipeline & visionOS Design Guidelines.
 */

import React, { useEffect, useRef } from "react";
import {
  X,
  Download,
  AlertCircle,
  CheckCircle2,
  Zap,
  Clock,
  Film,
} from "lucide-react";
import type { ExportProgress, ExportFormat } from "@/export/types";
import { cn } from "@/lib/utils";

interface ExportProgressModalProps {
  isOpen: boolean;
  progress: ExportProgress | null;
  format: ExportFormat | string;
  filename?: string;
  resultBlob?: Blob | null;
  onCancel: () => void;
  onClose: () => void;
  onDownload?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  analyzing: "Analyzing Audio DSP & Ballistics...",
  rendering: "Rendering WebGL 60 FPS Frames...",
  encoding: "Encoding Streams with WebCodecs...",
  packaging: "Packaging Lossless ZIP Archive...",
  converting: "Transcoding Apple ProRes 4444 (yuva444p10le)...",
  complete: "Export Completed Successfully!",
  cancelled: "Export Cancelled",
  error: "Export Failed",
};

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  progress,
  format,
  filename,
  resultBlob,
  onCancel,
  onClose,
  onDownload,
}) => {
  const hasAutoDownloadedRef = useRef(false);

  // Reset auto-download flag when opening modal or before completion
  useEffect(() => {
    if (isOpen && progress?.stage !== "complete") {
      hasAutoDownloadedRef.current = false;
    }
  }, [isOpen, progress?.stage]);

  // Trigger automatic download when stage reaches "complete"
  useEffect(() => {
    if (progress?.stage === "complete" && resultBlob && !hasAutoDownloadedRef.current) {
      hasAutoDownloadedRef.current = true;
      const url = URL.createObjectURL(resultBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `voicewave-${format}-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }, [progress?.stage, resultBlob, filename, format]);

  if (!isOpen) return null;

  const stage = progress?.stage ?? "analyzing";
  const percent = progress?.percent ?? 0;
  const currentFrame = progress?.currentFrame ?? 0;
  const totalFrames = progress?.totalFrames ?? 1;
  const speed = progress?.speed ?? "1.0x";
  const fps = progress?.fps ?? 60;
  const timeRemainingSec = progress?.timeRemainingSec ?? 0;

  const isFinished = stage === "complete";
  const isError = stage === "error";
  const isCancelled = stage === "cancelled";
  const isProcessing = !isFinished && !isError && !isCancelled;

  const formatEta = (secs: number) => {
    if (secs <= 0 || !Number.isFinite(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formattedFileSize = resultBlob
    ? (resultBlob.size / (1024 * 1024)).toFixed(1) + " MB"
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-progress-title"
      data-testid="export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl p-4 animate-fade-in"
    >
      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-[#09090b]/85 p-6 backdrop-blur-3xl shadow-2xl ring-1 ring-white/10 space-y-6 text-zinc-100">
        {/* visionOS Specular Top Highlight */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-gradient-to-b from-purple-500/20 via-cyan-500/10 to-transparent blur-2xl" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl border p-0.5 shadow-lg",
                isFinished
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : isError
                  ? "border-red-500/40 bg-red-500/20 text-red-300"
                  : isCancelled
                  ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                  : "border-purple-500/40 bg-purple-500/20 text-purple-300 shadow-purple-900/40"
              )}
            >
              {isFinished ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : isError ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <Film className="h-6 w-6 animate-pulse" />
              )}
            </div>
            <div>
              <h3 id="export-progress-title" className="text-base font-semibold tracking-tight text-white">
                {isFinished
                  ? "Export Completed"
                  : isError
                  ? "Export Encountered an Error"
                  : isCancelled
                  ? "Export Cancelled"
                  : "Exporting Broadcast Animation"}
              </h3>
              <p className="text-xs text-zinc-400">
                Format:{" "}
                <span className="font-mono text-purple-300 uppercase font-semibold">
                  {format}
                </span>{" "}
                • {fps} FPS
              </p>
            </div>
          </div>

          {(isFinished || isError || isCancelled) && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Stage Status Indicator */}
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-300 flex items-center gap-2">
              {isProcessing && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
              )}
              {progress?.stageMessage || STAGE_LABELS[stage] || "Processing..."}
            </span>
            <span className="font-mono font-bold text-white text-sm">
              {percent}%
            </span>
          </div>

          {/* Dynamic Frosted Glowing Progress Bar */}
          <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/40 p-0.5 shadow-inner">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-150 ease-out",
                isFinished
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  : isError
                  ? "bg-gradient-to-r from-red-500 to-rose-400"
                  : isCancelled
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                  : "bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 shadow-[0_0_16px_rgba(168,85,247,0.5)]"
              )}
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 text-center relative z-10">
          {/* Frame Counter */}
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              Frame Counter
            </span>
            <p className="font-mono text-xs font-semibold text-zinc-100 truncate">
              Frame {currentFrame} / {totalFrames}
            </p>
          </div>

          {/* Speed Multiplier */}
          <div className="space-y-0.5 border-x border-white/5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium flex items-center justify-center gap-1">
              <Zap className="h-3 w-3 text-cyan-400" />
              Speed
            </span>
            <p className="font-mono text-xs font-semibold text-cyan-300" data-testid="speed-multiplier">
              {speed}
            </p>
          </div>

          {/* Time Remaining */}
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium flex items-center justify-center gap-1">
              <Clock className="h-3 w-3 text-purple-400" />
              ETA
            </span>
            <p className="font-mono text-xs font-semibold text-purple-300" data-testid="time-remaining">
              ETA: {formatEta(timeRemainingSec)}
            </p>
          </div>
        </div>

        {/* Telemetry Hardware Badges */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 relative z-10">
          <div className="flex items-center gap-2">
            <span
              data-testid="fps-badge"
              className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300"
            >
              {fps} FPS
            </span>
            {formattedFileSize && (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                {formattedFileSize}
              </span>
            )}
          </div>

          <span className="text-[10px] text-zinc-500">
            {stage === "converting"
              ? "Apple ProRes KS 4444 yuva444p10le"
              : "GPU Hardware Accelerated"}
          </span>
        </div>

        {/* Error Feedback Message if applicable */}
        {isError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Export process interrupted
            </p>
            <p className="font-mono text-[11px] text-red-400/90">
              {progress?.error || "Unknown encoding error occurred."}
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 relative z-10">
          {/* Instant Cancel Button */}
          {isProcessing && (
            <button
              type="button"
              data-testid="export-cancel-btn"
              data-cancel-alias="cancel-export-btn"
              onClick={onCancel}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:border-red-500/40 active:scale-95 transition-all cursor-pointer"
            >
              Cancel Export
            </button>
          )}

          {/* Completed Actions: Download Trigger & Close */}
          {isFinished && (
            <>
              <button
                type="button"
                data-testid="export-download-btn"
                onClick={() => {
                  if (onDownload) {
                    onDownload();
                  } else if (resultBlob) {
                    const url = URL.createObjectURL(resultBlob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename || `voicewave-${format}-${Date.now()}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  }
                }}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Video</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                Done
              </button>
            </>
          )}

          {/* Cancelled / Error Dismiss Button */}
          {(isCancelled || isError) && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportProgressModal;
