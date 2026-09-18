import React from "react"
import { Play, Pause, Volume2, VolumeX, RotateCcw } from "lucide-react"

interface AudioPlayerControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  frequencyBars: number[]
  audioName: string | null
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onVolumeChange: (vol: number) => void
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`
}

export function AudioPlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  frequencyBars,
  audioName,
  onTogglePlay,
  onSeek,
  onVolumeChange,
}: AudioPlayerControlsProps) {
  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 backdrop-blur-md space-y-4">
      {/* Track Info & Equalizer */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            {isPlaying ? "Playing Voice Audio" : "Voice Track"}
          </p>
          <p className="truncate text-sm font-medium text-zinc-100">
            {audioName || "No audio loaded"}
          </p>
        </div>

        {/* Real-time 16-bar frequency visualizer */}
        <div className="flex h-8 items-end gap-1 px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800/60">
          {frequencyBars.map((bar, idx) => (
            <div
              key={idx}
              className="w-1 rounded-t transition-all duration-75"
              style={{
                height: `${Math.max(10, bar * 100)}%`,
                background:
                  idx < 4
                    ? "linear-gradient(to top, #3b82f6, #60a5fa)"
                    : idx < 10
                    ? "linear-gradient(to top, #8b5cf6, #c084fc)"
                    : "linear-gradient(to top, #ec4899, #f472b6)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress Timeline Scrubber */}
      <div className="space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            disabled={!duration}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-purple-500 hover:accent-purple-400 disabled:opacity-50"
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Play Controls & Volume */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!audioName}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => onSeek(0)}
            disabled={!audioName}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-30"
            title="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {volume === 0 ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-purple-500"
          />
        </div>
      </div>
    </div>
  )
}
