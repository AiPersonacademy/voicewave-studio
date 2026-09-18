/**
 * src/components/stage/StageControls.tsx
 *
 * visionOS Frosted Glass Stage Controls Toolbar.
 * Provides controls for the 3 Framing Aspect Ratios (1:1, 16:9, 9:16)
 * and the 5 Stage Background Modes (Checkerboard, Dark Studio, Ambient Glow, Green Chroma, Blue Chroma).
 */

import React from "react";
import { Square, Monitor, Smartphone, Grid, Moon, SunMedium, Paintbrush } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { PresetFraming, PresetBackgroundMode } from "@/types/presets";
import { cn } from "@/lib/utils";

export const StageControls: React.FC = () => {
  const framing = useAppStore((s) => s.framing);
  const backgroundMode = useAppStore((s) => s.backgroundMode);
  const setFraming = useAppStore((s) => s.setFraming);
  const setBackgroundMode = useAppStore((s) => s.setBackgroundMode);

  const framingOptions: { id: PresetFraming; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "1:1", label: "1:1", icon: Square },
    { id: "16:9", label: "16:9", icon: Monitor },
    { id: "9:16", label: "9:16", icon: Smartphone },
  ];

  const backgroundOptions: {
    id: PresetBackgroundMode;
    label: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    accentColor?: string;
  }[] = [
    { id: "checkerboard", label: "Transparent Checkerboard", description: "Alpha Grid", icon: Grid },
    { id: "dark", label: "Dark Studio", description: "Obsidian", icon: Moon },
    { id: "glow", label: "Neon Ambient Glow", description: "Radial Glow", icon: SunMedium },
    { id: "green-screen", label: "Green Screen (#00FF00)", description: "Chroma Key", icon: Paintbrush, accentColor: "#00FF00" },
    { id: "blue-screen", label: "Blue Screen (#0000FF)", description: "Chroma Key", icon: Paintbrush, accentColor: "#0000FF" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 w-full px-2 py-2">
      {/* Left: Framing Mode Toolbar */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mr-1">
          Framing
        </span>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/60 p-1 backdrop-blur-xl">
          {framingOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = framing === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`framing-${opt.id}`}
                data-framing={opt.id}
                onClick={() => setFraming(opt.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-white/15 text-white border border-white/20 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                )}
                title={`Aspect Ratio ${opt.label}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Stage Background Mode Toolbar (scoped with "Stage Background" text) */}
      <div className="flex items-center gap-2" aria-label="Stage Background">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 mr-1">
          Stage Background
        </span>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/60 p-1 backdrop-blur-xl">
          {backgroundOptions.map((bg) => {
            const Icon = bg.icon;
            const isSelected = backgroundMode === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                data-testid={`bg-${bg.id}`}
                data-bg={bg.id}
                onClick={() => setBackgroundMode(bg.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-white/15 text-white border border-white/20 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                )}
                title={bg.label}
              >
                {bg.accentColor ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/30"
                    style={{ backgroundColor: bg.accentColor }}
                  />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline text-[11px]">{bg.id}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StageControls;
