"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SiriWaveVariant } from "@/components/ui/siri-wave";
import { UniversalRenderer } from "@/visualizers/UniversalRenderer";
import { getPalette } from "@/visualizers/palettes";
import { normalizeArchetypeId } from "@/visualizers/registry";
import type { ArchetypeId, FramingMode, VisualizerRenderParams, PaletteId } from "@/visualizers/types";

export { VERTEX_SHADER, FRAGMENT_SHADERS } from "./shaderConstants";

export interface AudioReactiveSiriWaveProps
  extends Omit<React.HTMLAttributes<HTMLCanvasElement>, "children"> {
  variant?: SiriWaveVariant;
  archetype?: ArchetypeId;
  paletteId?: PaletteId;
  framing?: FramingMode;
  size?: number;
  renderScale?: number;
  transparentBackground?: boolean;
  sensitivity?: number;
  smoothness?: number;
  resetSpeed?: number;
  turbulence?: number;
  glow?: number;
  scale?: number;
  audioLow?: number;
  audioMid?: number;
  audioHigh?: number;
  audioAmplitude?: number;
  isAudioActive?: boolean;
  liveAudioRef?: {
    current: {
      low: number;
      mid: number;
      high: number;
      amplitude: number;
      isActive: boolean;
    } | null;
  };
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function AudioReactiveSiriWave({
  variant = "wave",
  archetype,
  paletteId = "cupertino-siri",
  framing = "1:1",
  size = 420,
  renderScale = 1.0,
  transparentBackground = true,
  sensitivity = 1.2,
  smoothness = 0.91,
  resetSpeed = 0.88,
  turbulence = 1.0,
  glow = 1.0,
  scale = 1.0,
  audioLow = 0,
  audioMid = 0,
  audioHigh = 0,
  audioAmplitude = 0,
  isAudioActive = false,
  liveAudioRef,
  className,
  style,
  canvasRef: externalCanvasRef,
  ...props
}: AudioReactiveSiriWaveProps) {
  const internalCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const rendererRef = React.useRef<UniversalRenderer | null>(null);

  // Resolve active archetype (prioritize archetype prop, fallback to variant)
  const resolvedArchetype = React.useMemo(() => {
    if (archetype) return archetype;
    if (variant === "wave") return "apple-siri";
    if (variant === "fluid-dots") return "gemini-metaballs";
    return variant;
  }, [archetype, variant]);

  const canonicalId = React.useMemo(() => {
    return normalizeArchetypeId(resolvedArchetype);
  }, [resolvedArchetype]);

  // Dimensions based on framing aspect ratio
  const { displayWidth, displayHeight, renderWidth, renderHeight } = React.useMemo(() => {
    let w = size;
    let h = size;
    if (framing === "16:9") {
      h = Math.round((size * 9) / 16);
    } else if (framing === "9:16") {
      w = Math.round((size * 9) / 16);
    }
    const rw = Math.round(w * renderScale);
    const rh = Math.round(h * renderScale);
    return { displayWidth: w, displayHeight: h, renderWidth: rw, renderHeight: rh };
  }, [size, framing, renderScale]);

  // Keep latest dynamic parameters in ref for 60 FPS animation loop
  const paramsRef = React.useRef({
    sensitivity,
    smoothness,
    resetSpeed,
    turbulence,
    glow,
    scale,
    paletteId,
    transparentBackground,
    audioLow,
    audioMid,
    audioHigh,
    audioAmplitude,
    isAudioActive,
    renderWidth,
    renderHeight,
  });

  React.useEffect(() => {
    paramsRef.current = {
      sensitivity,
      smoothness,
      resetSpeed,
      turbulence,
      glow,
      scale,
      paletteId,
      transparentBackground,
      audioLow,
      audioMid,
      audioHigh,
      audioAmplitude,
      isAudioActive,
      renderWidth,
      renderHeight,
    };
  }, [
    sensitivity,
    smoothness,
    resetSpeed,
    turbulence,
    glow,
    scale,
    paletteId,
    transparentBackground,
    audioLow,
    audioMid,
    audioHigh,
    audioAmplitude,
    isAudioActive,
    renderWidth,
    renderHeight,
  ]);

  // Mount & Update UniversalRenderer
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!rendererRef.current) {
      rendererRef.current = new UniversalRenderer(resolvedArchetype);
      rendererRef.current.init(canvas);
    } else {
      rendererRef.current.switchArchetype(resolvedArchetype);
    }
    rendererRef.current.resize(renderWidth, renderHeight);
  }, [canvasRef, resolvedArchetype, renderWidth, renderHeight]);

  // Teardown renderer on unmount
  React.useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  // Animation Loop with Cascaded Dual-Pole Ballistics
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    let lastTime = start;
    let phase = 0;

    // Two-pole cascaded liquid follower states (Stage 1 + Stage 2)
    // Guarantees C1-continuous velocity curves
    let ampS1 = 0, ampS2 = 0;
    let lowS1 = 0, lowS2 = 0;
    let midS1 = 0, midS2 = 0;
    let highS1 = 0, highS2 = 0;
    let actS1 = 0, actS2 = 0;

    const frame = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const t = (now - start) / 1000;

      const p = paramsRef.current;
      const live = liveAudioRef?.current;

      const inLow = live ? live.low : p.audioLow;
      const inMid = live ? live.mid : p.audioMid;
      const inHigh = live ? live.high : p.audioHigh;
      const inAmp = live ? live.amplitude : p.audioAmplitude;
      const inActive = live ? (live.isActive ? 1.0 : 0.0) : (p.isAudioActive ? 1.0 : 0.0);

      // Target voice energy with soft noise floor
      const targetAmp = inActive > 0.5 ? Math.max(0, (inAmp - 0.015) / 0.985) : 0;
      const targetActive = inActive > 0.5 && targetAmp > 0.015 ? 1.0 : 0.0;

      // User smoothness controls liquid viscosity (0.65 to 0.98, default 0.91)
      const userSmooth = Math.min(Math.max(p.smoothness, 0.65), 0.98);
      const att1 = 0.52 - (userSmooth - 0.65) * 0.40;
      const att2 = 0.46 - (userSmooth - 0.65) * 0.36;

      const r = Math.min(Math.max(p.resetSpeed, 0.5), 0.98);
      const dec1 = 0.12 + (r - 0.5) * 0.18;
      const dec2 = 0.16 + (r - 0.5) * 0.18;

      const liquidStep = (s1: number, s2: number, target: number): [number, number] => {
        const a1 = target > s1 ? att1 : dec1;
        const a2 = s1 > s2 ? att2 : dec2;
        const nextS1 = s1 + (target - s1) * a1;
        const nextS2 = s2 + (nextS1 - s2) * a2;
        return [nextS1, nextS2];
      };

      [ampS1, ampS2] = liquidStep(ampS1, ampS2, targetAmp);
      [lowS1, lowS2] = liquidStep(lowS1, lowS2, inLow);
      [midS1, midS2] = liquidStep(midS1, midS2, inMid);
      [highS1, highS2] = liquidStep(highS1, highS2, inHigh);
      [actS1, actS2] = liquidStep(actS1, actS2, targetActive);

      // Gentle drift speed acceleration
      const driftSpeed = 0.85 + actS2 * (0.75 * ampS2 * p.sensitivity);
      phase = (phase + driftSpeed * dt) % (20.0 * Math.PI);

      if (rendererRef.current) {
        const activePalette = getPalette(p.paletteId);
        const renderParams: VisualizerRenderParams = {
          time: t,
          phase,
          aspectRatio: p.renderWidth / Math.max(1, p.renderHeight),
          low: lowS2,
          mid: midS2,
          high: highS2,
          amplitude: ampS2,
          sensitivity: p.sensitivity,
          turbulence: p.turbulence,
          glow: p.glow,
          scale: p.scale,
          palette: activePalette.rgb,
          isAudioActive: actS2 > 0.5,
          isTransparent: p.transparentBackground,
        };

        rendererRef.current.render(renderParams);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [canvasRef, liveAudioRef]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="vui-stage-canvas"
      data-archetype={canonicalId}
      data-framing={framing}
      className={cn(
        "block rounded-[20px] transition-all duration-300",
        transparentBackground ? "bg-transparent" : "bg-black",
        className
      )}
      style={{
        width: displayWidth,
        height: displayHeight,
        aspectRatio: `${displayWidth} / ${displayHeight}`,
        ...style,
      }}
      {...props}
    />
  );
}

export default AudioReactiveSiriWave;
