/**
 * src/components/stage/VUIStage.tsx
 *
 * visionOS Stage Workspace Viewport for VoiceWave Studio.
 * Renders centered canvas with 3 exact framing modes (1:1 420x420, 16:9 560x315, 9:16 315x560),
 * 5 production background modes, StageControls toolbar, and real-time audio metrics readout.
 */

import React, { useMemo } from "react";
import { AudioReactiveSiriWave } from "@/components/ui/audio-reactive-siri-wave";
import { StageControls } from "./StageControls";
import { useAppStore } from "@/store/useAppStore";
import { getPalette } from "@/visualizers/palettes";
import { normalizeArchetypeId } from "@/visualizers/registry";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface VUIStageProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  liveAudioRef?: {
    current: {
      low: number;
      mid: number;
      high: number;
      amplitude: number;
      isActive: boolean;
    } | null;
  };
}

export const VUIStage: React.FC<VUIStageProps> = ({ canvasRef, liveAudioRef }) => {
  const archetype = useAppStore((s) => s.archetype);
  const palette = useAppStore((s) => s.palette);
  const framing = useAppStore((s) => s.framing);
  const backgroundMode = useAppStore((s) => s.backgroundMode);
  const params = useAppStore((s) => s.params);
  const canvasSize = useAppStore((s) => s.canvasSize);
  const renderScale = useAppStore((s) => s.renderScale);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const isMicActive = useAppStore((s) => s.isMicActive);
  const frequencyData = useAppStore((s) => s.frequencyData);

  const isAudioActive = isPlaying || isMicActive;
  const canonicalId = useMemo(() => normalizeArchetypeId(archetype), [archetype]);

  // Compute exact pixel dimensions matching framing contract:
  // 1:1 Square: 420x420
  // 16:9 Landscape: 560x315
  // 9:16 Portrait: 315x560
  const computedSize = useMemo(() => {
    if (canvasSize && canvasSize !== 420) {
      // User explicitly customized size slider
      return canvasSize;
    }
    if (framing === "16:9" || framing === "9:16") {
      return 560;
    }
    return 420;
  }, [canvasSize, framing]);

  // Extract primary palette color stop for dynamic ambient glow
  const activePalette = useMemo(() => getPalette(palette), [palette]);
  const primaryRgb = activePalette.rgb[0] || [168, 85, 247];

  return (
    <div className="relative w-full rounded-3xl border border-white/10 bg-[#09090b]/60 p-4 backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-between min-h-[620px] overflow-hidden">
      {/* Top Header: Voice Activity Status & FPS Badge */}
      <div className="flex items-center justify-between w-full px-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs backdrop-blur-md">
          <div
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              isAudioActive ? "bg-emerald-400 animate-ping" : "bg-zinc-600"
            )}
          />
          <span className="text-zinc-300 font-medium">
            {isMicActive
              ? "Live Mic Streaming"
              : isPlaying
              ? "Voice Modulating Animation"
              : "Idle (Idle Shader Breathing)"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="fps-badge"
            className="rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-emerald-400"
          >
            60 FPS
          </span>
          <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[11px] font-medium text-purple-300">
            {canonicalId}
          </span>
        </div>
      </div>

      {/* Center Stage Workspace Viewport */}
      <div className="flex items-center justify-center flex-1 w-full py-6">
        <div
          data-testid={`stage-bg-${backgroundMode}`}
          data-bg-mode={backgroundMode}
          data-background={backgroundMode}
          className={cn(
            "relative flex items-center justify-center rounded-2xl p-4 transition-all duration-300 max-w-full overflow-hidden",
            backgroundMode === "checkerboard" && "stage-checkerboard checkerboard-bg border border-white/10",
            backgroundMode === "dark" && "bg-[#09090b] border border-white/5",
            backgroundMode === "glow" &&
              "from-purple-900 border border-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.25)]",
            backgroundMode === "green-screen" && "bg-[#00FF00] border border-emerald-400/40",
            backgroundMode === "blue-screen" && "bg-[#0000FF] border border-blue-400/40"
          )}
          style={
            backgroundMode === "glow"
              ? {
                  background: `radial-gradient(circle at 50% 50%, rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, 0.25) 0%, rgba(20, 10, 35, 0.6) 50%, #08080a 90%)`,
                }
              : undefined
          }
        >
          {/* Universal WebGL/Canvas2D Visualizer */}
          <AudioReactiveSiriWave
            canvasRef={canvasRef}
            archetype={canonicalId}
            paletteId={palette}
            framing={framing}
            size={computedSize}
            renderScale={renderScale}
            transparentBackground={backgroundMode !== "dark" && backgroundMode !== "checkerboard" ? true : true}
            sensitivity={params.sensitivity}
            smoothness={params.smoothness}
            resetSpeed={params.resetSpeed}
            turbulence={params.turbulence}
            glow={params.glowIntensity}
            scale={params.scale}
            audioLow={frequencyData.low}
            audioMid={frequencyData.mid}
            audioHigh={frequencyData.high}
            audioAmplitude={frequencyData.amplitude}
            isAudioActive={isAudioActive}
            liveAudioRef={liveAudioRef}
            className={cn(
              "transition-all duration-200",
              backgroundMode === "glow" && "drop-shadow-[0_0_50px_rgba(168,85,247,0.4)]"
            )}
          />
        </div>
      </div>

      {/* Stage Controls: Framing and Stage Background Toolbars */}
      <div className="w-full border-t border-white/10 pt-2">
        <StageControls />
      </div>

      {/* Frequency Band Readouts */}
      <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2.5 px-2 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-blue-400">Low/Bass:</span>
          <span className="text-zinc-200">{Math.round((frequencyData.low || 0) * 100)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-purple-400">Voice/Mid:</span>
          <span className="text-zinc-200">{Math.round((frequencyData.mid || 0) * 100)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-pink-400">Treble:</span>
          <span className="text-zinc-200">{Math.round((frequencyData.high || 0) * 100)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400">RMS Amp:</span>
          <span className="text-zinc-200">{Math.round((frequencyData.amplitude || 0) * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default VUIStage;
