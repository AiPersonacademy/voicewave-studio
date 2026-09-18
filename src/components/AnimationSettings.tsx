import React, { useState, useEffect } from "react"
import { Camera, Check, Zap, Film, FolderArchive, Layers, Sparkles } from "lucide-react"
import type { SiriWaveVariant } from "@/components/ui/siri-wave"
import { cn } from "@/lib/utils"
import { exportManager } from "@/export/ExportManager"
import type { ExportProgress } from "@/export/types"
import { SyntheticVoiceGenerator } from "@/data/sampleVoices"
import { audioController } from "@/audio/AudioController"

export type StageBackground = "checkerboard" | "dark" | "glow" | "solid-black" | "green-screen"

export type ExportFormat =
  | "prores"       // 🎬 Apple ProRes 4444 (.mov) with 12-bit alpha
  | "png-sequence" // 📁 Transparent PNG Sequence (.zip) + WAV audio
  | "webm-alpha"   // ✨ Transparent WebM (VP9 Yuva420p)
  | "chroma-green" // 🟩 Green Screen (Chroma Key #00FF00)
  | "turbo-screen" // ⚡ Screen Blend Mode (Turbo Fast WebM)

interface AnimationSettingsProps {
  variant: SiriWaveVariant
  onVariantChange: (v: SiriWaveVariant) => void
  backgroundMode: StageBackground
  onBackgroundModeChange: (bg: StageBackground) => void
  sensitivity: number
  onSensitivityChange: (s: number) => void
  smoothness: number
  onSmoothnessChange: (sm: number) => void
  size: number
  onSizeChange: (s: number) => void
  renderScale: number
  onRenderScaleChange: (r: number) => void
  resetSpeed?: number
  onResetSpeedChange?: (r: number) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  audioSrc: string | null
  audioDuration?: number
  audioCurrentTime?: number
  audioName?: string | null
  onPlayAudio?: () => Promise<void>
  onPauseAudio?: () => void
  onSeekAudio?: (time: number) => void
  getAudioStream?: () => MediaStream | null
  getAudioElement?: () => HTMLAudioElement | null
  getAudioBuffer?: () => Promise<AudioBuffer | null>
  onExportProgressModalOpen?: (open: boolean, format?: string, filename?: string) => void
  onExportProgressUpdate?: (p: ExportProgress | null) => void
  onExportResultReady?: (blob: Blob | null) => void
}

export function AnimationSettings({
  variant,
  onVariantChange: _onVariantChange,
  backgroundMode,
  onBackgroundModeChange,
  sensitivity,
  onSensitivityChange,
  smoothness,
  onSmoothnessChange,
  resetSpeed = 0.88,
  onResetSpeedChange,
  size: _size,
  onSizeChange: _onSizeChange,
  renderScale,
  onRenderScaleChange,
  canvasRef,
  audioSrc,
  audioDuration = 0,
  audioName,
  getAudioBuffer,
  onExportProgressModalOpen,
  onExportProgressUpdate,
  onExportResultReady,
}: AnimationSettingsProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("prores")
  const [exportFps] = useState<60 | 30>(60)
  const [exportMode, setExportMode] = useState<"full" | "5s" | "10s">("5s")
  const [isRecording, setIsRecording] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [turboSpeed, setTurboSpeed] = useState<string | null>(null)
  const [turboFps, setTurboFps] = useState<number | null>(null)
  const [recordingProgress, setRecordingProgress] = useState<{ current: number; total: number; percent: number } | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)
  const [isConverterOnline, setIsConverterOnline] = useState<boolean>(true)

  const isCancelledRef = React.useRef(false)

  // Probe ProRes local converter health
  useEffect(() => {
    let mounted = true
    const checkConverter = async () => {
      try {
        const res = await fetch("/api/convert-prores", { method: "HEAD" })
        if (mounted) setIsConverterOnline(res.ok)
      } catch {
        try {
          const res = await fetch("http://localhost:5175/health", { method: "GET" })
          if (mounted) setIsConverterOnline(res.ok)
        } catch {
          if (mounted) setIsConverterOnline(false)
        }
      }
    }
    checkConverter()
    const interval = setInterval(checkConverter, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return "0:00"
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const hasAudio = Boolean(audioSrc && audioDuration && audioDuration > 0)

  // Export Transparent PNG Snapshot
  const handleExportPNG = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const dataUrl = canvas.toDataURL("image/png")
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `voice-animation-${variant}-${Date.now()}.png`
      a.click()

      setDownloadSuccess("Snapshot PNG Saved!")
      setTimeout(() => setDownloadSuccess(null), 2500)
    } catch (err) {
      console.error("Export PNG error:", err)
    }
  }

  // Unified Multi-Format Backgroundless Exporter via Central ExportManager
  const handleExport = async () => {
    if (isRecording) return

    const targetDuration = (hasAudio && exportMode === "full")
      ? audioDuration
      : exportMode === "10s" ? 10 : 5

    const cleanName = (audioName || "voice-animation")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
    const tag = (hasAudio && exportMode === "full") ? "full" : `${Math.round(targetDuration)}s`
    const baseFilename = `${cleanName}-${variant}-${tag}`

    try {
      setIsRecording(true)
      setIsConverting(false)
      isCancelledRef.current = false
      setTurboSpeed(null)
      setTurboFps(null)
      setRecordingProgress({ current: 0, total: Math.round(targetDuration * 60), percent: 0 })

      onExportProgressModalOpen?.(true, exportFormat, baseFilename)

      let audioBuffer: AudioBuffer | import("@/audio/types").AudioBufferLike | null = null
      if (getAudioBuffer) {
        audioBuffer = await getAudioBuffer()
      }
      if (!audioBuffer) {
        audioBuffer = audioController.getAudioBuffer()
      }
      if (!audioBuffer) {
        audioBuffer = SyntheticVoiceGenerator.generate("cupertino-siri", 48000)
      }

      const effectiveBuffer = audioBuffer || SyntheticVoiceGenerator.generate("cupertino-siri", 48000)

      const blob = await exportManager.exportVideo({
        format: exportFormat,
        audioBuffer: effectiveBuffer,
        duration: targetDuration,
        fps: exportFps,
        params: {
          sensitivity,
          smoothness,
          resetSpeed,
        },
        filename: baseFilename,
        onProgress: (p) => {
          setRecordingProgress({
            current: p.currentFrame,
            total: p.totalFrames,
            percent: p.percent,
          })
          setTurboFps(p.fps)
          setTurboSpeed(p.speed)
          if (p.stage === "converting") {
            setIsConverting(true)
          }
          onExportProgressUpdate?.(p)
        },
      })

      onExportResultReady?.(blob)

      // Automatic browser download
      const ext = exportFormat === "prores"
        ? (blob.type === "video/quicktime" ? "mov" : "webm")
        : exportFormat === "png-sequence"
        ? "zip"
        : exportFormat === "chroma-green"
        ? (blob.type === "video/mp4" ? "mp4" : "webm")
        : "webm"

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${baseFilename}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5000)

      setDownloadSuccess(`Exported ${exportFormat.toUpperCase()} successfully!`)
      setTimeout(() => setDownloadSuccess(null), 4000)
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.toLowerCase().includes("cancel")) {
        console.log("[AnimationSettings] Export cancelled by user")
      } else {
        console.error("[AnimationSettings] Export error:", err)
      }
    } finally {
      setIsRecording(false)
      setIsConverting(false)
      setRecordingProgress(null)
    }
  }

  const handleCancelExport = () => {
    isCancelledRef.current = true
    exportManager.abort("User cancelled export")
    setIsRecording(false)
    setIsConverting(false)
    setRecordingProgress(null)
    onExportProgressModalOpen?.(false)
  }

  return (
    <div className="space-y-4">
      {/* Background Mode Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300">Stage Background</label>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            data-testid="bg-checkerboard"
            data-bg="checkerboard"
            onClick={() => onBackgroundModeChange("checkerboard")}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2 text-left font-medium transition-all",
              backgroundMode === "checkerboard"
                ? "border-purple-500 bg-purple-500/20 text-purple-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div className="h-4 w-4 rounded border border-zinc-600 checkerboard-bg shrink-0" />
            <span className="truncate">Transparent Checkerboard</span>
          </button>

          <button
            type="button"
            data-testid="bg-dark"
            data-bg="dark"
            onClick={() => onBackgroundModeChange("dark")}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2 text-left font-medium transition-all",
              backgroundMode === "dark"
                ? "border-purple-500 bg-purple-500/20 text-purple-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div className="h-4 w-4 rounded bg-[#09090b] border border-zinc-700 shrink-0" />
            <span className="truncate">Clean Dark Stage</span>
          </button>

          <button
            type="button"
            data-testid="bg-glow"
            data-bg="glow"
            onClick={() => onBackgroundModeChange("glow")}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2 text-left font-medium transition-all",
              backgroundMode === "glow"
                ? "border-purple-500 bg-purple-500/20 text-purple-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div className="h-4 w-4 rounded bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-700 shrink-0" />
            <span className="truncate">Neon Ambient Glow</span>
          </button>

          <button
            type="button"
            data-testid="bg-green-screen"
            data-bg="green-screen"
            onClick={() => onBackgroundModeChange("green-screen")}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2 text-left font-medium transition-all",
              backgroundMode === "green-screen"
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div className="h-4 w-4 rounded bg-[#00FF00] border border-emerald-400 shrink-0" />
            <span className="truncate">Green Screen (#00FF00)</span>
          </button>

          <button
            type="button"
            data-testid="bg-blue-screen"
            data-bg="blue-screen"
            onClick={() => onBackgroundModeChange("blue-screen" as any)}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2 text-left font-medium transition-all",
              (backgroundMode as string) === "blue-screen"
                ? "border-blue-500 bg-blue-500/20 text-blue-200"
                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div className="h-4 w-4 rounded bg-[#0000FF] border border-blue-400 shrink-0" />
            <span className="truncate">Blue Screen (#0000FF)</span>
          </button>
        </div>
      </div>

      {/* Sliders: Sensitivity, Smoothness, Reset Speed */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/60">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Voice Reactivity Sensitivity</span>
            <span className="font-mono text-purple-400">{sensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={3.0}
            step={0.1}
            value={sensitivity}
            onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-purple-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Siri Fluidity / Ballistics</span>
            <span className="font-mono text-purple-400">
              {smoothness >= 0.92 ? "Ultra Silky (Siri)" : smoothness >= 0.85 ? "Fluid" : "Responsive"} ({Math.round(smoothness * 100)}%)
            </span>
          </div>
          <input
            type="range"
            min={0.65}
            max={0.98}
            step={0.01}
            value={smoothness}
            onChange={(e) => onSmoothnessChange(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-purple-500"
          />
        </div>

        {onResetSpeedChange && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Fast Clean Reset Speed</span>
              <span className="font-mono text-purple-400">{resetSpeed.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.98}
              step={0.02}
              value={resetSpeed}
              onChange={(e) => onResetSpeedChange(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-purple-500"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Display Render Scale</span>
            <span className="font-mono text-purple-400">{renderScale}x</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 1.5, 2, 3].map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => onRenderScaleChange(scale)}
                className={cn(
                  "rounded-md border py-1 text-xs font-mono transition-all",
                  renderScale === scale
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
                )}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPORT BACKGROUNDLESS ANIMATION SECTION */}
      {/* ========================================================================= */}
      <div className="pt-3 border-t border-zinc-800/80 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-xs font-semibold text-zinc-100">Export Backgroundless Animation</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="fps-badge"
              className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full"
            >
              60 FPS
            </span>
            {hasAudio && (
              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/70 border border-purple-800/60 px-2 py-0.5 rounded-full">
                Full Audio: {formatTime(audioDuration)}
              </span>
            )}
          </div>
        </div>

        {/* Format Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-zinc-400">Select Export Format</label>
          
          {/* Primary Transparent Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Apple ProRes 4444 */}
            <button
              type="button"
              data-format="prores"
              disabled={isRecording}
              onClick={() => setExportFormat("prores")}
              className={cn(
                "relative flex flex-col p-2.5 rounded-xl border text-left transition-all",
                exportFormat === "prores"
                  ? "border-purple-500 bg-purple-500/20 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-400"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-purple-200">
                  <Film className="h-3.5 w-3.5 text-purple-400" />
                  <span>Apple ProRes 4444 (.mov)</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/40">
                  Recommended
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                True 12-bit alpha channel. Drop directly into Premiere, DaVinci Resolve, CapCut Desktop, or FCP.
              </p>
              {isConverterOnline ? (
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>FFmpeg ProRes engine ready</span>
                </div>
              ) : (
                <div className="mt-1.5 text-[9px] text-zinc-500">
                  <span>Runs via local FFmpeg converter</span>
                </div>
              )}
            </button>

            {/* PNG Sequence (.zip) */}
            <button
              type="button"
              data-format="png"
              disabled={isRecording}
              onClick={() => setExportFormat("png-sequence")}
              className={cn(
                "relative flex flex-col p-2.5 rounded-xl border text-left transition-all",
                exportFormat === "png-sequence"
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-cyan-200">
                  <FolderArchive className="h-3.5 w-3.5 text-cyan-400" />
                  <span>PNG Sequence (.zip)</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-400/40">
                  100% Universal
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Lossless 32-bit RGBA frames + audio.wav. Guaranteed transparent in every editor on Earth.
              </p>
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-cyan-400">
                <Zap className="h-2.5 w-2.5 text-cyan-400" />
                <span>Fast GPU export (~180 FPS)</span>
              </div>
            </button>
          </div>

          {/* Secondary Options */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {/* WebM VP9 Alpha */}
            <button
              type="button"
              data-format="webm"
              disabled={isRecording}
              onClick={() => setExportFormat("webm-alpha")}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all",
                exportFormat === "webm-alpha"
                  ? "border-purple-500 bg-purple-500/25 text-purple-200 ring-1 ring-purple-400"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="font-semibold text-[11px] flex items-center gap-1">
                <Film className="h-3 w-3 text-purple-400" />
                WebM Alpha
              </span>
              <span className="text-[9px] text-zinc-400">Yuva420p (OBS/Web)</span>
            </button>

            {/* Green Screen */}
            <button
              type="button"
              data-format="chroma-mp4"
              disabled={isRecording}
              onClick={() => setExportFormat("chroma-green")}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all",
                exportFormat === "chroma-green"
                  ? "border-emerald-500 bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="font-semibold text-[11px] flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded bg-[#00FF00]" />
                Chroma Key
              </span>
              <span className="text-[9px] text-zinc-400">Mobile MP4 Screen</span>
            </button>

            {/* Screen Blend Mode */}
            <button
              type="button"
              disabled={isRecording}
              onClick={() => setExportFormat("turbo-screen")}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all",
                exportFormat === "turbo-screen"
                  ? "border-amber-500 bg-amber-500/25 text-amber-200 ring-1 ring-amber-400"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="font-semibold text-[11px] flex items-center gap-1">
                <Layers className="h-3 w-3 text-amber-400" />
                Screen Blend
              </span>
              <span className="text-[9px] text-zinc-400">Fast WebM</span>
            </button>
          </div>
        </div>

        {/* Duration Mode Switcher */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Export Duration</span>
            <span className="text-purple-400 font-mono">
              {exportMode === "full" ? (hasAudio ? `Full Audio (${formatTime(audioDuration)})` : "Full Audio") : `${exportMode} clip`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs">
            <button
              type="button"
              disabled={isRecording}
              onClick={() => setExportMode("full")}
              className={cn(
                "py-1.5 px-2 rounded-md font-medium transition-all text-center truncate",
                exportMode === "full"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Full Voice Track
            </button>
            <button
              type="button"
              data-duration="5s"
              disabled={isRecording}
              onClick={() => setExportMode("5s")}
              className={cn(
                "py-1.5 px-2 rounded-md font-medium transition-all text-center",
                exportMode === "5s"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              5s Clip
            </button>
            <button
              type="button"
              data-duration="10s"
              disabled={isRecording}
              onClick={() => setExportMode("10s")}
              className={cn(
                "py-1.5 px-2 rounded-md font-medium transition-all text-center",
                exportMode === "10s"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              10s Clip
            </button>
          </div>
        </div>

        {/* Live Recording / Progress Card */}
        {isRecording && recordingProgress && (
          <div className="rounded-xl border border-purple-500/50 bg-gradient-to-b from-purple-950/40 to-zinc-950/80 p-3.5 space-y-2.5 shadow-lg shadow-purple-950/50">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium">
                {isConverting ? (
                  <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                    <Film className="h-3.5 w-3.5 text-purple-400 animate-spin" />
                    <span>Transcoding Apple ProRes 4444 MOV...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                    <Zap className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400 animate-pulse" />
                    <span>Rendering Offline Frames ({exportFps} FPS)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {turboFps && (
                  <span className="rounded bg-cyan-400/15 border border-cyan-400/30 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 shadow-sm">
                    ⚡ {turboFps} FPS {turboSpeed ? `(${turboSpeed})` : ""}
                  </span>
                )}
                <span className="font-mono text-purple-300 font-semibold">
                  {recordingProgress.current} / {recordingProgress.total} ({recordingProgress.percent}%)
                </span>
              </div>
            </div>

            {/* Glowing animated progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
              <div
                className={cn(
                  "h-full transition-all duration-100 ease-out",
                  isConverting
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-400 animate-pulse"
                    : "bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400"
                )}
                style={{ width: `${recordingProgress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-400">
                {isConverting
                  ? "Transcoding 12-bit alpha ProRes container via FFmpeg..."
                  : "Rendering 60 FPS offline frames with sample-accurate DSP..."}
              </span>
              <button
                type="button"
                data-testid="cancel-export-btn"
                onClick={handleCancelExport}
                className="rounded px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/30 transition-all cursor-pointer"
              >
                Cancel Export
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isRecording}
            className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 text-cyan-400" />
            Snapshot PNG
          </button>

          <button
            type="button"
            data-testid="start-export-btn"
            onClick={handleExport}
            disabled={isRecording}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer",
              isRecording
                ? "border-purple-500/50 bg-purple-500/20 text-purple-300 cursor-not-allowed animate-pulse"
                : exportFormat === "prores"
                ? "border-purple-500/80 bg-purple-600/30 text-purple-100 hover:bg-purple-600/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                : exportFormat === "png-sequence"
                ? "border-cyan-500/80 bg-cyan-600/30 text-cyan-100 hover:bg-cyan-600/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : exportFormat === "chroma-green"
                ? "border-emerald-500/80 bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "border-zinc-700 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
            )}
          >
            {isRecording ? (
              isConverting ? (
                <>
                  <Film className="h-3.5 w-3.5 text-purple-300 animate-spin" />
                  <span>Converting MOV...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 text-cyan-400 animate-bounce" />
                  <span>Rendering...</span>
                </>
              )
            ) : exportFormat === "prores" ? (
              <>
                <Film className="h-3.5 w-3.5 text-purple-300" />
                <span className="truncate">Export ProRes 4444 {exportMode}</span>
              </>
            ) : exportFormat === "png-sequence" ? (
              <>
                <FolderArchive className="h-3.5 w-3.5 text-cyan-300" />
                <span className="truncate">Export PNG Zip {exportMode}</span>
              </>
            ) : exportFormat === "chroma-green" ? (
              <>
                <div className="h-2 w-2 rounded bg-[#00FF00]" />
                <span className="truncate">Export Chroma {exportMode}</span>
              </>
            ) : (
              <>
                <Film className="h-3.5 w-3.5 text-purple-400" />
                <span className="truncate">Export WebM Alpha {exportMode}</span>
              </>
            )}
          </button>
        </div>

        {downloadSuccess && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300 font-medium py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 animate-fade-in">
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{downloadSuccess}</span>
          </div>
        )}
      </div>
    </div>
  )
}
