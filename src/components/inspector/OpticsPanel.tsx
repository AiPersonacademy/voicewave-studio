/**
 * src/components/inspector/OpticsPanel.tsx
 *
 * visionOS Optics & Spatial Display Panel.
 * Provides controls for Glow Intensity and Display Size / Scale.
 * Adheres strictly to E2E test matcher (/Display Size|Size|Scale/i).
 */

import React from "react";
import { Sun, Maximize, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export const OpticsPanel: React.FC = () => {
  const params = useAppStore((s) => s.params);
  const canvasSize = useAppStore((s) => s.canvasSize);
  const setGlowIntensity = useAppStore((s) => s.setGlowIntensity);
  const setScale = useAppStore((s) => s.setScale);
  const setCanvasSize = useAppStore((s) => s.setCanvasSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Optics & Spatial Sizing
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">Shader Bloom</span>
      </div>

      <div className="space-y-3.5">
        {/* Glow Intensity Slider */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-glow"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <Sun className="h-3.5 w-3.5 text-yellow-400" />
              <span>Glow Intensity</span>
            </label>
            <span className="font-mono text-xs text-yellow-400">
              {Number(params.glowIntensity).toFixed(1)}x
            </span>
          </div>
          <input
            id="slider-glow"
            type="range"
            min="0.0"
            max="3.0"
            step="0.1"
            value={params.glowIntensity}
            onChange={(e) => setGlowIntensity(parseFloat(e.target.value))}
            className="w-full accent-yellow-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>None (0.0)</span>
            <span>Balanced (1.2)</span>
            <span>Radiant (3.0)</span>
          </div>
        </div>

        {/* Display Size / Scale Slider (matching /Display Size|Size|Scale/i and accepting 420) */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-size"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <Maximize className="h-3.5 w-3.5 text-purple-400" />
              <span>Display Size / Scale</span>
            </label>
            <span className="font-mono text-xs text-purple-400">{canvasSize}px</span>
          </div>
          <input
            id="slider-size"
            type="range"
            min="280"
            max="720"
            step="10"
            value={canvasSize}
            onChange={(e) => setCanvasSize(parseInt(e.target.value, 10))}
            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Compact (280px)</span>
            <span>Default (420px)</span>
            <span>Studio (720px)</span>
          </div>
        </div>

        {/* Zoom Scale Multiplier Slider */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-zoom"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Optical Zoom Multiplier</span>
            </label>
            <span className="font-mono text-xs text-emerald-400">
              {Number(params.scale).toFixed(2)}x
            </span>
          </div>
          <input
            id="slider-zoom"
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={params.scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Wide (0.5x)</span>
            <span>Standard (1.0x)</span>
            <span>Macro (2.0x)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpticsPanel;
