/**
 * src/components/inspector/FramingBackgroundPanel.tsx
 *
 * Inspector panel for Framing Aspect Ratios (1:1, 16:9, 9:16)
 * and Stage Background Modes (Checkerboard, Dark Studio, Ambient Glow, Green Chroma, Blue Chroma).
 */

import React from "react";
import { Square, Monitor, Smartphone, Grid, Moon, SunMedium, Paintbrush } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { PresetFraming, PresetBackgroundMode } from "@/types/presets";
import { cn } from "@/lib/utils";

export const FramingBackgroundPanel: React.FC = () => {
  const framing = useAppStore((s) => s.framing);
  const backgroundMode = useAppStore((s) => s.backgroundMode);
  const setFraming = useAppStore((s) => s.setFraming);
  const setBackgroundMode = useAppStore((s) => s.setBackgroundMode);

  const framings: { id: PresetFraming; name: string; subtitle: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "1:1", name: "1:1 Square", subtitle: "420x420 (Social/Avatar)", icon: Square },
    { id: "16:9", name: "16:9 Landscape", subtitle: "560x315 (YouTube/Desktop)", icon: Monitor },
    { id: "9:16", name: "9:16 Portrait", subtitle: "315x560 (TikTok/Reels)", icon: Smartphone },
  ];

  const backgrounds: {
    id: PresetBackgroundMode;
    name: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    accent?: string;
  }[] = [
    {
      id: "checkerboard",
      name: "Transparent Checkerboard",
      description: "High-DPI transparent grid for alpha verification",
      icon: Grid,
    },
    {
      id: "dark",
      name: "Dark Studio",
      description: "visionOS matte obsidian (#09090b)",
      icon: Moon,
    },
    {
      id: "glow",
      name: "Neon Ambient Glow",
      description: "Dynamic audio-reactive radial glow",
      icon: SunMedium,
    },
    {
      id: "green-screen",
      name: "Green Screen (#00FF00)",
      description: "Broadcast chroma key green (#00FF00)",
      icon: Paintbrush,
      accent: "#00FF00",
    },
    {
      id: "blue-screen",
      name: "Blue Screen (#0000FF)",
      description: "Broadcast chroma key blue (#0000FF)",
      icon: Paintbrush,
      accent: "#0000FF",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Framing Aspect Ratios */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Framing Aspect Ratio
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">Viewport</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {framings.map((f) => {
            const Icon = f.icon;
            const isSelected = framing === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-testid={`framing-${f.id}`}
                data-framing={f.id}
                onClick={() => setFraming(f.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all cursor-pointer",
                  isSelected
                    ? "border-purple-500/60 bg-purple-500/15 text-white shadow-sm ring-1 ring-purple-500/40"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{f.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage Background Section (with text "Stage Background" for Playwright scoping) */}
      <div className="space-y-2.5 pt-2" aria-label="Stage Background">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Stage Background
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">Compositing</span>
        </div>

        <div className="space-y-1.5">
          {backgrounds.map((bg) => {
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
                  "w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-purple-500/60 bg-purple-500/15 text-white ring-1 ring-purple-500/40"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {bg.accent ? (
                    <span
                      className="h-3 w-3 rounded-full border border-white/30 shrink-0"
                      style={{ backgroundColor: bg.accent }}
                    />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-medium">{bg.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{bg.description}</div>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/5">
                  {bg.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FramingBackgroundPanel;
