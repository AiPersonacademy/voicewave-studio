/**
 * src/App.tsx
 *
 * visionOS VoiceWave Studio Main Application Shell.
 * Integrates frosted glass Header, VUIStage with exact framing & background modes,
 * UnifiedInspector with full physics & optics controls, PresetManagerModal with LocalStorage/JSON sync,
 * ExportProgressModal for real-time video export telemetry, and AudioTransport.
 */

import React, { useState, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { VUIStage } from "@/components/stage/VUIStage";
import { UnifiedInspector } from "@/components/inspector/UnifiedInspector";
import { PresetManagerModal } from "@/components/inspector/PresetManagerModal";
import { ExportProgressModal } from "@/components/export/ExportProgressModal";
import { AudioTransport } from "@/components/audio/AudioTransport";
import { AnimationSettings } from "@/components/AnimationSettings";
import SiriWaveDemo from "@/components/ui/demo";
import { useAppStore } from "@/store/useAppStore";
import { audioController } from "@/audio/AudioController";
import { exportManager } from "@/export/ExportManager";
import type { ExportProgress } from "@/export/types";
import { Radio, Layers, Film, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function App() {
  const [activeTab, setActiveTab] = useState<"animator" | "demo">("animator");
  const [isExportSectionOpen, setIsExportSectionOpen] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResultBlob, setExportResultBlob] = useState<Blob | null>(null);
  const [activeExportFormat, setActiveExportFormat] = useState<string>("prores");
  const [activeExportFilename, setActiveExportFilename] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exportSectionRef = useRef<HTMLDivElement>(null);

  // Central Store State
  const archetype = useAppStore((s) => s.archetype);
  const setArchetype = useAppStore((s) => s.setArchetype);
  const backgroundMode = useAppStore((s) => s.backgroundMode);
  const setBackgroundMode = useAppStore((s) => s.setBackgroundMode);
  const params = useAppStore((s) => s.params);
  const updateParams = useAppStore((s) => s.updateParams);
  const canvasSize = useAppStore((s) => s.canvasSize);
  const setCanvasSize = useAppStore((s) => s.setCanvasSize);
  const renderScale = useAppStore((s) => s.renderScale);
  const setRenderScale = useAppStore((s) => s.setRenderScale);
  const isPresetModalOpen = useAppStore((s) => s.isPresetModalOpen);
  const setIsPresetModalOpen = useAppStore((s) => s.setIsPresetModalOpen);
  const audioSource = useAppStore((s) => s.audioSource);
  const duration = useAppStore((s) => s.duration);
  const currentTime = useAppStore((s) => s.currentTime);

  const handleQuickExport = () => {
    setIsExportSectionOpen(true);
    exportSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const currentVariant = archetype === "gemini-metaballs" ? "fluid-dots" : "wave";

  return (
    <div className="min-h-screen w-full bg-[#070709] text-zinc-100 flex flex-col antialiased selection:bg-purple-500 selection:text-white">
      {/* Top visionOS Frosted Glass Navigation Bar */}
      <Header onQuickExport={handleQuickExport} />

      {/* Secondary Navigation View Switcher (Voice Animator vs Original SiriWave Demo) */}
      <div className="border-b border-white/5 bg-[#08080a]/60 px-6 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("animator")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "animator"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Voice Animator Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("demo")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer",
                activeTab === "demo"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Original SiriWave Demo</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-500 font-mono">
            <span>Framing: {useAppStore.getState().framing}</span>
            <span>•</span>
            <span>Background: {backgroundMode}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1">
        {activeTab === "demo" ? (
          <div className="relative">
            <div className="absolute top-4 left-6 z-10 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur">
              Rendering untouched <code className="text-purple-400 font-mono">@/components/ui/siri-wave.tsx</code> inside demo container
            </div>
            <SiriWaveDemo />
          </div>
        ) : (
          <div className="mx-auto max-w-7xl p-6 lg:p-8 space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Left Column: VUI Stage Viewport & Audio Transport */}
              <div className="lg:col-span-7 flex flex-col items-center gap-6">
                {/* VUI Stage Viewport */}
                <VUIStage canvasRef={canvasRef} liveAudioRef={audioController.liveAudioDataRef} />

                {/* Audio Transport Toolbar */}
                <AudioTransport />
              </div>

              {/* Right Column: Unified Inspector & Export Suite */}
              <div className="lg:col-span-5 space-y-6">
                {/* visionOS Unified Inspector */}
                <UnifiedInspector />

                {/* Broadcast Multi-Engine Export Suite Card */}
                <div
                  ref={exportSectionRef}
                  className="rounded-3xl border border-white/10 bg-[#09090b]/60 backdrop-blur-2xl shadow-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-white">Broadcast Video Exporter</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsExportSectionOpen(!isExportSectionOpen)}
                      className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                    >
                      {isExportSectionOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {isExportSectionOpen && (
                    <AnimationSettings
                      variant={currentVariant}
                      onVariantChange={(v) =>
                        setArchetype(v === "fluid-dots" ? "gemini-metaballs" : "apple-siri")
                      }
                      backgroundMode={
                        backgroundMode === "green-screen"
                          ? "green-screen"
                          : backgroundMode === "dark"
                          ? "dark"
                          : backgroundMode === "glow"
                          ? "glow"
                          : "checkerboard"
                      }
                      onBackgroundModeChange={(bg) => setBackgroundMode(bg as any)}
                      sensitivity={params.sensitivity}
                      onSensitivityChange={(s) => updateParams({ sensitivity: s })}
                      smoothness={params.smoothness}
                      onSmoothnessChange={(sm) => updateParams({ smoothness: sm })}
                      resetSpeed={params.resetSpeed}
                      onResetSpeedChange={(rs) => updateParams({ resetSpeed: rs })}
                      size={canvasSize}
                      onSizeChange={setCanvasSize}
                      renderScale={renderScale}
                      onRenderScaleChange={setRenderScale}
                      canvasRef={canvasRef}
                      audioSrc={audioSource.url}
                      audioDuration={duration}
                      audioCurrentTime={currentTime}
                      audioName={audioSource.name}
                      onPlayAudio={() => audioController.play()}
                      onPauseAudio={() => audioController.pause()}
                      onSeekAudio={(t) => audioController.seek(t)}
                      getAudioStream={() => audioController.getAudioStream()}
                      getAudioElement={() => audioController.getAudioElement()}
                      getAudioBuffer={async () => audioController.getAudioBuffer()}
                      onExportProgressModalOpen={(open, format, filename) => {
                        setIsExportModalOpen(open);
                        if (format) setActiveExportFormat(format);
                        if (filename) setActiveExportFilename(filename);
                      }}
                      onExportProgressUpdate={(p) => setExportProgress(p)}
                      onExportResultReady={(blob) => setExportResultBlob(blob)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Preset Library & Manager Modal Dialog */}
      <PresetManagerModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
      />

      {/* visionOS Real-Time Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExportModalOpen}
        progress={exportProgress}
        format={activeExportFormat}
        filename={activeExportFilename}
        resultBlob={exportResultBlob}
        onCancel={() => {
          exportManager.abort("User cancelled export");
          setIsExportModalOpen(false);
        }}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportProgress(null);
          setExportResultBlob(null);
        }}
      />

      {/* Cupertino Spatial Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#08080a] px-6 py-4 text-center text-xs text-zinc-500 font-mono">
        VoiceWave Studio • visionOS Frosted Glass Architecture • 8 Visual Archetypes • Zero-Halo Alpha
      </footer>
    </div>
  );
}
