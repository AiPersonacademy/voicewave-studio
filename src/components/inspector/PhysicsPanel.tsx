/**
 * src/components/inspector/PhysicsPanel.tsx
 *
 * visionOS Physics & Ballistics Control Panel.
 * Provides precision sliders for Sensitivity, Smoothness, Reset Speed, and Turbulence.
 * Labels adhere strictly to Playwright test matchers (/Reactivity|Sensitivity/i, /Fluidity|Smoothness/i, /Reset Speed/i).
 */

import React from "react";
import { Gauge, Activity, RotateCcw, Zap } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export const PhysicsPanel: React.FC = () => {
  const params = useAppStore((s) => s.params);
  const setSensitivity = useAppStore((s) => s.setSensitivity);
  const setSmoothness = useAppStore((s) => s.setSmoothness);
  const setResetSpeed = useAppStore((s) => s.setResetSpeed);
  const setTurbulence = useAppStore((s) => s.setTurbulence);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Reactivity & Physics
        </h3>
        <span className="text-[10px] text-zinc-500 font-mono">Liquid Ballistics</span>
      </div>

      <div className="space-y-3.5">
        {/* Reactivity / Sensitivity Slider */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-sensitivity"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Reactivity / Sensitivity</span>
            </label>
            <span className="font-mono text-xs text-amber-400">
              {Number(params.sensitivity).toFixed(2)}x
            </span>
          </div>
          <input
            id="slider-sensitivity"
            type="range"
            min="0.2"
            max="3.0"
            step="0.05"
            value={params.sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Subtle (0.2)</span>
            <span>Default (1.2)</span>
            <span>Intense (3.0)</span>
          </div>
        </div>

        {/* Fluidity / Smoothness Slider */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-smoothness"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span>Fluidity / Smoothness</span>
            </label>
            <span className="font-mono text-xs text-cyan-400">
              {Number(params.smoothness).toFixed(2)}
            </span>
          </div>
          <input
            id="slider-smoothness"
            type="range"
            min="0.65"
            max="0.98"
            step="0.01"
            value={params.smoothness}
            onChange={(e) => setSmoothness(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Snappy (0.65)</span>
            <span>Liquid (0.91)</span>
            <span>Viscous (0.98)</span>
          </div>
        </div>

        {/* Reset Speed Slider */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-reset-speed"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
              <span>Reset Speed</span>
            </label>
            <span className="font-mono text-xs text-indigo-400">
              {Number(params.resetSpeed).toFixed(2)}
            </span>
          </div>
          <input
            id="slider-reset-speed"
            type="range"
            min="0.50"
            max="0.98"
            step="0.01"
            value={params.resetSpeed}
            onChange={(e) => setResetSpeed(parseFloat(e.target.value))}
            className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Instant (0.50)</span>
            <span>Natural (0.88)</span>
            <span>Slow Echo (0.98)</span>
          </div>
        </div>

        {/* Turbulence Slider */}
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="slider-turbulence"
              className="flex items-center gap-1.5 font-medium text-zinc-200 cursor-pointer"
            >
              <Gauge className="h-3.5 w-3.5 text-fuchsia-400" />
              <span>Turbulence</span>
            </label>
            <span className="font-mono text-xs text-fuchsia-400">
              {Number(params.turbulence).toFixed(2)}
            </span>
          </div>
          <input
            id="slider-turbulence"
            type="range"
            min="0.0"
            max="2.5"
            step="0.05"
            value={params.turbulence}
            onChange={(e) => setTurbulence(parseFloat(e.target.value))}
            className="w-full accent-fuchsia-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Calm (0.0)</span>
            <span>Flow (1.0)</span>
            <span>Chaos (2.5)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicsPanel;
