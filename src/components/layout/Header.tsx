/**
 * src/components/layout/Header.tsx
 *
 * visionOS Frosted Glass Header for VoiceWave Studio.
 * Houses branding, active preset pill with dirty state indicator, preset library trigger, and quick export.
 */

import React from "react";
import { Waves, Sparkles, ChevronDown, Sliders, Film } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onQuickExport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onQuickExport }) => {
  const activePresetId = useAppStore((s) => s.activePresetId);
  const customPresets = useAppStore((s) => s.customPresets);
  const isDirty = useAppStore((s) => s.isDirty);
  const setIsPresetModalOpen = useAppStore((s) => s.setIsPresetModalOpen);

  const activePreset =
    DEFAULT_PRESETS.find((p) => p.id === activePresetId) ||
    customPresets.find((p) => p.id === activePresetId) ||
    DEFAULT_PRESETS[0];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08080a]/80 backdrop-blur-2xl px-6 py-3 transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-purple-900/30">
            <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-[#09090b]">
              <Waves className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">VoiceWave Studio</span>
              <span className="rounded-full bg-white/[0.08] border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                Spatial VUI Pro
              </span>
              <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                WebGL 60FPS
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Cupertino-grade audio-reactive transparent voice animator
            </p>
          </div>
        </div>

        {/* Center: Active Preset Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="active-preset-pill"
            onClick={() => setIsPresetModalOpen(true)}
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 backdrop-blur-md hover:border-white/20 hover:bg-white/[0.08] transition-all cursor-pointer shadow-inner"
            title="Open Preset Library"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
              {activePreset?.name || "Siri Chromatic Flow"}
            </span>

            {/* Dirty state indicator dot */}
            {isDirty && (
              <span
                className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse"
                title="Parameters modified"
              />
            )}

            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Preset Manager Trigger Button */}
          <button
            type="button"
            data-testid="preset-manager-btn"
            onClick={() => setIsPresetModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <Sliders className="h-3.5 w-3.5 text-zinc-400" />
            <span>Presets</span>
          </button>

          {/* Quick Export Trigger */}
          <button
            type="button"
            data-testid="quick-export-trigger"
            onClick={() => onQuickExport?.()}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white",
              "bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400",
              "shadow-lg shadow-purple-900/30 active:scale-[0.98] transition-all"
            )}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Quick Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
