import React, { useRef, useState } from "react"
import { Upload, Mic, MicOff, Volume2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceUploaderProps {
  onAudioUpload: (file: File) => void
  onLoadSample: () => void
  onToggleMic: () => void
  isMicActive: boolean
  audioName: string | null
  isPlaying: boolean
}

export function VoiceUploader({
  onAudioUpload,
  onLoadSample,
  onToggleMic,
  isMicActive,
  audioName,
  isPlaying,
}: VoiceUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith("audio/")) {
        onAudioUpload(file)
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAudioUpload(e.target.files[0])
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* Drag & Drop Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 transition-all duration-200",
          isDragging
            ? "border-purple-500 bg-purple-500/10 scale-[1.01]"
            : "border-zinc-700/80 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/40"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*"
          className="hidden"
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-transform group-hover:scale-110 group-hover:bg-purple-600/30 group-hover:text-purple-300">
          <Upload className="h-5 w-5" />
        </div>

        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-zinc-200">
            Click to upload or drag & drop voice audio
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Supports MP3, WAV, M4A, OGG, AAC, FLAC
          </p>
        </div>

        {audioName && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-300 font-medium">
            <Volume2 className={cn("h-3.5 w-3.5", isPlaying && "animate-pulse text-purple-400")} />
            <span className="max-w-[200px] truncate">{audioName}</span>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleMic}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all",
            isMicActive
              ? "border-red-500/40 bg-red-500/20 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-pulse"
              : "border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
          )}
        >
          {isMicActive ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-purple-400" />}
          {isMicActive ? "Stop Live Mic" : "Use Live Mic"}
        </button>

        <button
          type="button"
          onClick={onLoadSample}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-all group"
        >
          <Sparkles className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform" />
          Load Voice Sample
        </button>
      </div>
    </div>
  )
}
