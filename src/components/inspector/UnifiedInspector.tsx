/**
 * src/components/inspector/UnifiedInspector.tsx
 *
 * visionOS Frosted Glass Unified Inspector Panel.
 * Composes ArchetypeSelector, PaletteSelector, PhysicsPanel, OpticsPanel, and FramingBackgroundPanel.
 */

import React, { useState } from "react";
import { Sliders, Palette, Zap, Sun, Move, RotateCcw } from "lucide-react";
import { ArchetypeSelector } from "./ArchetypeSelector";
import { PaletteSelector } from "./PaletteSelector";
import { PhysicsPanel } from "./PhysicsPanel";
import { OpticsPanel } from "./OpticsPanel";
import { FramingBackgroundPanel } from "./FramingBackgroundPanel";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

type TabId = "all" | "archetypes" | "palettes" | "physics" | "optics" | "framing";

export const UnifiedInspector: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const resetParams = useAppStore((s) => s.resetParams);
  const isDirty = useAppStore((s) => s.isDirty);

  const tabs: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "all", label: "All Controls", icon: Sliders },
    { id: "archetypes", label: "Archetypes", icon: Zap },
    { id: "palettes", label: "Palettes", icon: Palette },
    { id: "physics", label: "Physics", icon: Zap },
    { id: "optics", label: "Optics", icon: Sun },
    { id: "framing", label: "Framing", icon: Move },
  ];

  return (
    <div className="relative flex flex-col w-full rounded-3xl border border-white/10 bg-[#09090b]/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold tracking-tight text-white">Unified Inspector</h2>
        </div>

        <button
          type="button"
          onClick={() => resetParams()}
          disabled={!isDirty}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Reset modified parameters to preset defaults"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-4 py-2 bg-white/[0.01]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all",
                isSelected
                  ? "bg-white/15 text-white border border-white/20 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panels Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 max-h-[calc(100vh-280px)]">
        {(activeTab === "all" || activeTab === "archetypes") && (
          <section className="space-y-3">
            <ArchetypeSelector />
          </section>
        )}

        {(activeTab === "all" || activeTab === "palettes") && (
          <section className="border-t border-white/10 pt-5 space-y-3">
            <PaletteSelector />
          </section>
        )}

        {(activeTab === "all" || activeTab === "physics") && (
          <section className="border-t border-white/10 pt-5 space-y-3">
            <PhysicsPanel />
          </section>
        )}

        {(activeTab === "all" || activeTab === "optics") && (
          <section className="border-t border-white/10 pt-5 space-y-3">
            <OpticsPanel />
          </section>
        )}

        {(activeTab === "all" || activeTab === "framing") && (
          <section className="border-t border-white/10 pt-5 space-y-3">
            <FramingBackgroundPanel />
          </section>
        )}
      </div>
    </div>
  );
};

export default UnifiedInspector;
