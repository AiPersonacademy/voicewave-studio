/**
 * src/components/inspector/ArchetypeSelector.tsx
 *
 * 8-Archetype Grid Selector with visionOS frosted glass styling.
 * Exposes canonical archetypes with required testids, data attributes, and test text aliases.
 */

import React from "react";
import {
  Waves,
  CircleDot,
  Atom,
  Radio,
  Sparkles,
  BarChart3,
  Crosshair,
  Maximize2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { normalizeArchetypeId } from "@/visualizers/registry";
import { cn } from "@/lib/utils";

interface ArchetypeCard {
  id: string;
  name: string;
  subtitle: string;
  badge: "WebGL" | "Canvas2D";
  icon: React.FC<{ className?: string }>;
}

const ARCHETYPE_LIST: ArchetypeCard[] = [
  {
    id: "apple-siri",
    name: "Apple Siri Chromatic Wave",
    subtitle: "iOS 18 dispersion ribbons",
    badge: "WebGL",
    icon: Waves,
  },
  {
    id: "chatgpt-orb",
    name: "ChatGPT Fluid 3D Voice Orb",
    subtitle: "Raymarched SDF organic sphere",
    badge: "WebGL",
    icon: CircleDot,
  },
  {
    id: "gemini-metaballs",
    name: "Gemini Live Fluid Metaballs",
    subtitle: "Smooth-min orbiting liquid drops",
    badge: "WebGL",
    icon: Atom,
  },
  {
    id: "concentric-rings",
    name: "Concentric Acoustic Rings",
    subtitle: "Acoustic radar shockwave pulses",
    badge: "WebGL",
    icon: Radio,
  },
  {
    id: "cymatics-particle",
    name: "Acoustic Particle Cymatics",
    subtitle: "2,000+ Chladni nodal particles",
    badge: "WebGL",
    icon: Sparkles,
  },
  {
    id: "glass-soundbars",
    name: "Neomorphic Glass Soundbars",
    subtitle: "Spring-damper Cupertino pill bars",
    badge: "WebGL",
    icon: BarChart3,
  },
  {
    id: "scifi-hud",
    name: "Cyberpunk AI Core / Sci-Fi HUD",
    subtitle: "Circular telemetry reticle & core",
    badge: "WebGL",
    icon: Crosshair,
  },
  {
    id: "perimeter-glow",
    name: "iOS Perimeter Edge Glow",
    subtitle: "Traveling edge wave & bloom",
    badge: "WebGL",
    icon: Maximize2,
  },
];

export const ArchetypeSelector: React.FC = () => {
  const activeArchetype = useAppStore((s) => s.archetype);
  const setArchetype = useAppStore((s) => s.setArchetype);
  const canonicalActive = normalizeArchetypeId(activeArchetype);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Visual Archetypes (8)
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">Shader Core</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ARCHETYPE_LIST.map((item) => {
          const Icon = item.icon;
          const isSelected = canonicalActive === item.id;

          return (
            <button
              key={item.id}
              type="button"
              data-testid={`archetype-${item.id}`}
              data-archetype={item.id}
              onClick={() => setArchetype(item.id)}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-purple-500/60 bg-purple-500/15 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/40"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                  isSelected
                    ? "border-purple-400 bg-purple-500/20 text-purple-300"
                    : "border-white/10 bg-white/[0.04] text-zinc-400 group-hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "text-xs font-medium truncate",
                      isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"
                    )}
                  >
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[9px] font-mono px-1 rounded bg-white/[0.06] text-zinc-400 border border-white/5">
                    {item.badge}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">{item.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ArchetypeSelector;
