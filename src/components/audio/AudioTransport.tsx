/**
 * src/components/audio/AudioTransport.tsx
 *
 * visionOS Frosted Glass Audio Transport Bar.
 * Coordinates audio playback controls, scrubber, volume slider, looping toggle,
 * curated voice sample selector dropdown, drag-and-drop file upload, live microphone toggle,
 * and 16-bar real-time audio visualizer.
 */

import React, { useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Mic,
  MicOff,
  Upload,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export const AudioTransport: React.FC = () => {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const isMicActive = useAppStore((s) => s.isMicActive);
  const isLooping = useAppStore((s) => s.isLooping);
  const currentTime = useAppStore((s) => s.currentTime);
  const duration = useAppStore((s) => s.duration);
  const volume = useAppStore((s) => s.volume);
  const isMuted = useAppStore((s) => s.isMuted);
  const audioSource = useAppStore((s) => s.audioSource);
  const frequencyBars = useAppStore((s) => s.frequencyBars);
  const micError = useAppStore((s) => s.micError);

  const togglePlay = useAppStore((s) => s.togglePlay);
  const seek = useAppStore((s) => s.seek);
  const setVolume = useAppStore((s) => s.setVolume);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const toggleLooping = useAppStore((s) => s.toggleLooping);
  const loadSampleVoice = useAppStore((s) => s.loadSampleVoice);
  const loadAudioFile = useAppStore((s) => s.loadAudioFile);
  const toggleMic = useAppStore((s) => s.toggleMic);

  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds) || timeInSeconds < 0) return "00:00";
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadAudioFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      loadAudioFile(file);
    }
  };

  const sampleVoices = [
    { id: "cupertino-siri", label: "Soprano — Cupertino Siri (4.8s)" },
    { id: "neutral-ai", label: "Tenor — Neutral AI Assistant (5.2s)" },
    { id: "podcast-host", label: "Baritone — Deep Resonant Podcast (6.5s)" },
    { id: "fast-cadence", label: "Fast Speech — Rapid Articulate Keynote (4.2s)" },
    { id: "calm-meditation", label: "Emotional Speech — Soft Breath Guide (7.6s)" },
  ];

  return (
    <div className="relative w-full rounded-3xl border border-white/10 bg-[#08080a]/80 p-4 backdrop-blur-2xl shadow-2xl space-y-3 transition-all">
      {/* Mic Error Banner */}
      {micError && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{micError}</span>
        </div>
      )}

      {/* Top Row: Track Meta, 16-Bar Visualizer, Voice Library & Upload */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
        {/* Track Descriptor */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10">
            {isMicActive ? (
              <Mic className="h-4 w-4 text-rose-400 animate-pulse" />
            ) : isPlaying ? (
              <Play className="h-4 w-4 text-purple-400 fill-purple-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-zinc-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                {isMicActive ? "Live Microphone" : audioSource.name || "Sample Voice"}
              </span>
              <span className="rounded-full bg-white/[0.06] border border-white/5 px-2 py-0.5 text-[9px] font-mono text-zinc-400 uppercase">
                {audioSource.type}
              </span>
            </div>
            <p
              data-testid="audio-duration"
              className="text-[11px] font-mono text-zinc-400 tabular-nums"
            >
              sample-voice.wav • {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>

        {/* 16-Bar Real-Time Audio Level Visualizer */}
        <div
          className="flex items-end gap-1 h-7 px-3 py-1 rounded-xl border border-white/5 bg-white/[0.02]"
          title="16-Band Audio Level Meter"
        >
          {frequencyBars.slice(0, 16).map((val, i) => {
            const heightPercent = Math.max(12, Math.min(100, Math.round(val * 100)));
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-purple-600 via-indigo-500 to-cyan-400 transition-all duration-75"
                style={{ height: `${heightPercent}%` }}
              />
            );
          })}
        </div>

        {/* Input Source Buttons: Voice Library Dropdown, Upload Dropzone, Mic Toggle */}
        <div className="flex items-center gap-2">
          {/* Sample Voice Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              data-testid="load-sample-btn"
              onClick={() => {
                loadSampleVoice("cupertino-siri");
                setIsVoiceDropdownOpen(!isVoiceDropdownOpen);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
              title="Select a Curated Sample Voice Profile"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span>Load Voice Sample</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {isVoiceDropdownOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-64 rounded-2xl border border-white/15 bg-[#09090b]/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-zinc-400 border-b border-white/10">
                  Curated Voices (5)
                </div>
                <div className="space-y-0.5 mt-1">
                  {sampleVoices.map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => {
                        loadSampleVoice(voice.id);
                        setIsVoiceDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                        audioSource.voiceId === voice.id
                          ? "bg-purple-600/80 text-white"
                          : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      {voice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Button & Dropzone */}
          <div
            data-testid="voice-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex items-center rounded-xl border transition-all",
              isDragging ? "border-purple-500 bg-purple-500/20" : "border-white/10 bg-white/[0.05]"
            )}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer"
              title="Upload Audio File (WAV, MP3, M4A)"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-400" />
              <span>Upload Audio</span>
            </button>
            <input
              ref={fileInputRef}
              data-testid="audio-file-input"
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Live Microphone Toggle */}
          <button
            type="button"
            data-testid="mic-toggle-btn"
            onClick={() => toggleMic()}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              isMicActive
                ? "border-rose-500/80 bg-rose-500/20 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse"
                : "border-white/10 bg-white/[0.05] text-zinc-300 hover:text-white hover:bg-white/[0.08]"
            )}
            title={isMicActive ? "Stop Live Microphone" : "Start Live Microphone"}
          >
            {isMicActive ? (
              <>
                <Mic className="h-3.5 w-3.5 text-rose-400" />
                <span>Mic Active</span>
              </>
            ) : (
              <>
                <MicOff className="h-3.5 w-3.5 text-zinc-400" />
                <span>Live Mic</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Row: Scrubber Timeline & Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Playback Controls (Play/Pause, Loop) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="play-pause-btn"
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
            onClick={() => togglePlay()}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer",
              isPlaying
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            )}
          >
            {isPlaying ? (
              <Pause data-testid="pause-btn" className="h-4 w-4 fill-white" />
            ) : (
              <Play data-testid="play-btn" className="h-4 w-4 fill-white ml-0.5" />
            )}
          </button>

          {/* Loop Toggle Button */}
          <button
            type="button"
            data-testid="loop-toggle-btn"
            onClick={() => toggleLooping()}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer",
              isLooping
                ? "border-purple-500 bg-purple-500/20 text-purple-300 shadow-sm"
                : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]"
            )}
            title={isLooping ? "Looping Enabled" : "Looping Disabled"}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>

        {/* Seek Scrubber */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 100}
            step="0.01"
            value={currentTime}
            disabled={duration <= 0 || isMicActive}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none disabled:opacity-40"
          />
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-2 min-w-[130px]">
          <button
            type="button"
            onClick={() => toggleMute()}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4 text-zinc-500" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.02"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums w-7 text-right">
            {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioTransport;
