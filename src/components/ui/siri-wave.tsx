"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { UniversalRenderer } from "@/visualizers/UniversalRenderer";
import { getPalette } from "@/visualizers/palettes";
import type { VisualizerRenderParams } from "@/visualizers/types";

/**
 * Siri-style procedural visualizers rendered on a WebGL canvas.
 *
 * Supports all 8 VUI Archetypes + legacy aliases:
 * - "wave" | "apple-siri" | "siri-wave" — iOS 18 Siri Chromatic Wave
 * - "fluid-dots" | "gemini-metaballs"   — Gemini Live Fluid Metaballs
 * - "chatgpt-orb"                       — ChatGPT Fluid 3D Voice Orb
 * - "concentric-rings"                  — Concentric Acoustic Rings
 * - "cymatics-particles" | "cymatics-particle" — Acoustic Particle Cymatics
 * - "glass-soundbars"                   — Neomorphic Glass Soundbars
 * - "scifi-hud"                         — Cyberpunk AI Core / Sci-Fi HUD
 * - "perimeter-glow"                    — iOS Perimeter Edge Glow
 */
export type SiriWaveVariant =
  | "wave"
  | "fluid-dots"
  | "siri-wave"
  | "apple-siri"
  | "chatgpt-orb"
  | "gemini-metaballs"
  | "concentric-rings"
  | "cymatics-particles"
  | "cymatics-particle"
  | "glass-soundbars"
  | "scifi-hud"
  | "perimeter-glow";

export interface SiriWaveProps extends React.HTMLAttributes<HTMLCanvasElement> {
  variant?: SiriWaveVariant;
  size?: number;
  renderScale?: number;
  paletteId?: string;
  isTransparent?: boolean;
}

export function SiriWave({
  variant = "wave",
  size = 420,
  renderScale = 1.0,
  paletteId = "cupertino-siri",
  isTransparent = false,
  className,
  style,
  ...props
}: SiriWaveProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<UniversalRenderer | null>(null);

  // Maintain renderer lifecycle
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!rendererRef.current) {
      rendererRef.current = new UniversalRenderer(variant);
      rendererRef.current.init(canvas);
    } else {
      rendererRef.current.switchArchetype(variant);
    }

    const dim = Math.round(size * renderScale);
    rendererRef.current.resize(dim, dim);
  }, [variant, size, renderScale]);

  // Teardown renderer on unmount
  React.useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  // Autonomous animation loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    let lastTime = start;
    let phase = 0;

    const frame = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const t = (now - start) / 1000;

      // Gentle autonomous idle motion
      const low = 0.25 + 0.2 * Math.sin(t * 0.9) * Math.sin(t * 0.4 + 1.0);
      const mid = 0.3 + 0.25 * Math.sin(t * 1.5 + 2.0) * Math.sin(t * 0.6);
      const high = 0.2 + 0.2 * Math.sin(t * 2.7 + 4.0) * Math.sin(t * 0.8 + 2.0);
      const amp = 0.2 + 0.15 * Math.sin(t * 1.2);

      phase = (phase + 1.2 * dt) % (20.0 * Math.PI);

      if (rendererRef.current) {
        const palette = getPalette(paletteId).rgb;
        const params: VisualizerRenderParams = {
          time: t,
          phase,
          aspectRatio: 1.0,
          low,
          mid,
          high,
          amplitude: amp,
          sensitivity: 1.0,
          turbulence: 0.8,
          glow: 1.2,
          scale: 1.0,
          palette,
          isAudioActive: true,
          isTransparent,
        };
        rendererRef.current.render(params);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [paletteId, isTransparent]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block rounded-[20px] bg-black", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}

export default SiriWave;
