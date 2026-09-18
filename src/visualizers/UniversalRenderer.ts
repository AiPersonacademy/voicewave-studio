/**
 * src/visualizers/UniversalRenderer.ts
 *
 * Unified rendering coordinator for VoiceWave Studio.
 * Coordinates the visualizer lifecycle (init, render, resize, destroy),
 * handles archetype hot-swapping, and sanitizes input parameters.
 * Conforms to PROJECT.md §Interface Contracts.
 */

import { registry, normalizeArchetypeId } from "./registry";
import type { CanonicalArchetypeId, VisualizerRenderer, VisualizerRenderParams, ColorRGB } from "./types";

const FALLBACK_PALETTE: ColorRGB[] = [
  [0.05, 0.45, 1.0],
  [0.95, 0.25, 0.4],
  [0.0, 0.95, 0.65],
  [1.0, 0.7, 0.1],
];

export class UniversalRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private activeRenderer: VisualizerRenderer | null = null;
  private currentArchetypeId: CanonicalArchetypeId;
  private width = 420;
  private height = 420;
  private isContextLost = false;

  private boundHandleContextLost = this.handleContextLost.bind(this);
  private boundHandleContextRestored = this.handleContextRestored.bind(this);

  constructor(initialArchetypeId: string = "apple-siri") {
    this.currentArchetypeId = normalizeArchetypeId(initialArchetypeId);
  }

  /**
   * Initializes the renderer against an HTMLCanvasElement.
   */
  public init(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas && this.activeRenderer && !this.isContextLost) {
      return;
    }

    this.detachCanvasListeners();

    if (this.activeRenderer) {
      try {
        this.activeRenderer.destroy();
      } catch {
        // Suppress teardown errors
      }
      this.activeRenderer = null;
    }

    this.canvas = canvas;
    this.isContextLost = false;
    this.attachCanvasListeners();
    this.instantiateActiveRenderer();
  }

  private attachCanvasListeners(): void {
    if (!this.canvas) return;
    this.canvas.addEventListener("webglcontextlost", this.boundHandleContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.boundHandleContextRestored, false);
  }

  private detachCanvasListeners(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener("webglcontextlost", this.boundHandleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.boundHandleContextRestored);
  }

  private handleContextLost(e: Event): void {
    // Calling preventDefault() is MANDATORY per WebGL 1.0 §5.14.13
    // to permit the browser to restore the context when the GPU recovers.
    e.preventDefault();
    this.isContextLost = true;

    if (this.activeRenderer) {
      try {
        this.activeRenderer.destroy();
      } catch {
        // Suppress teardown errors under lost context
      }
      this.activeRenderer = null;
    }
  }

  private handleContextRestored(): void {
    this.isContextLost = false;
    this.instantiateActiveRenderer();
  }

  /**
   * Switches the active archetype.
   */
  public switchArchetype(newArchetypeId: string): void {
    const canonical = normalizeArchetypeId(newArchetypeId);
    if (this.currentArchetypeId === canonical && this.activeRenderer && !this.isContextLost) {
      return;
    }

    this.currentArchetypeId = canonical;

    if (this.canvas) {
      if (this.activeRenderer) {
        try {
          this.activeRenderer.destroy();
        } catch {
          // Suppress errors during teardown
        }
        this.activeRenderer = null;
      }

      // If context is currently lost, defer renderer instantiation until webglcontextrestored
      if (!this.isContextLost) {
        this.instantiateActiveRenderer();
      }
    }
  }

  private instantiateActiveRenderer(): void {
    if (!this.canvas || this.isContextLost) return;

    try {
      this.activeRenderer = registry.createRenderer(this.currentArchetypeId);
      this.activeRenderer.init(this.canvas);
      this.activeRenderer.resize(this.width, this.height);
    } catch (err) {
      console.warn(`[UniversalRenderer] Failed to initialize archetype '${this.currentArchetypeId}':`, err);
      this.activeRenderer = null;
    }
  }

  /**
   * Renders one frame with sanitized parameters.
   */
  public render(params: VisualizerRenderParams): void {
    if (this.isContextLost || !this.activeRenderer) return;

    const clamp01 = (val: number, fallback = 0) => {
      if (val === Infinity || val > 1) return 1;
      if (val === -Infinity || val < 0) return 0;
      if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
      return Math.max(0, Math.min(1, val));
    };

    const clampRange = (val: number, min: number, max: number, fallback: number) => {
      if (val === Infinity || val > max) return max;
      if (val === -Infinity || val < min) return min;
      if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
      return Math.max(min, Math.min(max, val));
    };

    // Parameter sanitization: protect GPU from NaNs, Infinities, and out-of-bound spikes
    const safeParams: VisualizerRenderParams = {
      time: typeof params.time === "number" && Number.isFinite(params.time) ? params.time : 0,
      phase: typeof params.phase === "number" && Number.isFinite(params.phase) ? params.phase : 0,
      aspectRatio:
        typeof params.aspectRatio === "number" && Number.isFinite(params.aspectRatio) && params.aspectRatio > 0
          ? params.aspectRatio
          : 1.0,
      low: clamp01(params.low, 0),
      mid: clamp01(params.mid, 0),
      high: clamp01(params.high, 0),
      amplitude: clamp01(params.amplitude, 0),
      sensitivity: clampRange(params.sensitivity, 0.1, 3.0, 1.2),
      turbulence: clampRange(params.turbulence, 0.0, 3.0, 1.0),
      glow: clampRange(params.glow, 0.0, 4.0, 1.0),
      scale: clampRange(params.scale, 0.2, 3.0, 1.0),
      palette:
        params.palette && params.palette.length >= 4 && params.palette.every((c) => Array.isArray(c) && c.length >= 3)
          ? params.palette
          : FALLBACK_PALETTE,
      isAudioActive: Boolean(params.isAudioActive),
      isTransparent: Boolean(params.isTransparent),
    };

    this.activeRenderer.render(safeParams);
  }

  /**
   * Resizes the canvas backbuffer and renderer viewport.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));

    if (this.canvas) {
      if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
      }
    }

    if (this.activeRenderer && !this.isContextLost) {
      this.activeRenderer.resize(this.width, this.height);
    }
  }

  public getActiveArchetypeId(): CanonicalArchetypeId {
    return this.currentArchetypeId;
  }

  public getActiveRenderer(): VisualizerRenderer | null {
    return this.activeRenderer;
  }

  /**
   * Full teardown of active renderer and references.
   */
  public destroy(): void {
    this.detachCanvasListeners();
    if (this.activeRenderer) {
      try {
        this.activeRenderer.destroy();
      } catch {
        // Suppress teardown errors
      }
      this.activeRenderer = null;
    }
    this.canvas = null;
    this.isContextLost = false;
  }
}
