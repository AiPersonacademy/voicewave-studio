/**
 * src/components/inspector/PaletteSelector.tsx
 *
 * 6 Chromatic Palettes Selector with 4-stop gradient swatches.
 * Binds directly to the active palette in useAppStore.
 */

import React from "react";
import { FACTORY_PALETTES, type ChromaticPalette } from "@/visualizers/palettes";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const PALETTES: ChromaticPalette[] = Object.values(FACTORY_PALETTES);

export const PaletteSelector: React.FC = () => {
  const activePalette = useAppStore((s) => s.palette);
  const setPalette = useAppStore((s) => s.setPalette);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Chromatic Palettes (6)
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">4-Stop Stops</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PALETTES.map((pal) => {
          const isSelected = activePalette === pal.id;
          const gradientStyle = {
            background: `linear-gradient(135deg, ${pal.hex[0]}, ${pal.hex[1]}, ${pal.hex[2]}, ${pal.hex[3]})`,
          };

          return (
            <button
              key={pal.id}
              type="button"
              data-testid={`palette-${pal.id}`}
              onClick={() => setPalette(pal.id)}
              className={cn(
                "group relative flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-purple-500/70 bg-purple-500/15 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/50"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
              )}
            >
              {/* 4-Color Gradient Preview Bar */}
              <div
                className="h-4 w-full rounded-md shadow-inner border border-white/20"
                style={gradientStyle}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "text-xs font-medium truncate",
                      isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"
                    )}
                  >
                    {pal.name}
                  </span>
                  <div className="flex -space-x-1 shrink-0">
                    {pal.hex.map((c, i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full border border-zinc-900"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{pal.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PaletteSelector;
