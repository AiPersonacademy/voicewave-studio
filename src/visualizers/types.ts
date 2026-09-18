/**
 * src/visualizers/types.ts
 *
 * Core interfaces and type definitions for VoiceWave Studio's visualizer pipeline.
 * Conforms to PROJECT.md §Interface Contracts.
 */

export type CanonicalArchetypeId =
  | "apple-siri"
  | "chatgpt-orb"
  | "gemini-metaballs"
  | "concentric-rings"
  | "cymatics-particle"
  | "glass-soundbars"
  | "scifi-hud"
  | "perimeter-glow";

export type ArchetypeId =
  | CanonicalArchetypeId
  | "siri-wave"
  | "cymatics-particles"
  | "wave"
  | "fluid-dots";

export type PaletteId =
  | "cupertino-siri"
  | "gemini-live"
  | "cyberpunk-ai"
  | "openai-monochrome"
  | "aurora-borealis"
  | "sunset-horizon"
  | string;

export type FramingMode = "1:1" | "16:9" | "9:16";

export type StageBackgroundMode =
  | "checkerboard"
  | "dark"
  | "glow"
  | "green-screen"
  | "blue-screen"
  | "solid-black";

export type ColorRGB = [number, number, number];
export type ColorRGBA = [number, number, number, number];

export interface VisualizerRenderParams {
  time: number;
  phase: number;
  aspectRatio: number; // width / height
  low: number;         // 0.0 - 1.0 (Bass energy)
  mid: number;         // 0.0 - 1.0 (Vocal Mid energy)
  high: number;        // 0.0 - 1.0 (Treble energy)
  amplitude: number;   // 0.0 - 1.0 (RMS volume)
  sensitivity: number; // 0.2 - 3.0 (Default 1.2)
  turbulence: number;  // 0.0 - 2.5 (Default 1.0)
  glow: number;        // 0.0 - 3.0 (Default 1.0)
  scale: number;       // 0.5 - 2.0 (Default 1.0)
  palette: ColorRGB[]; // 4 RGB color stops [0..1, 0..1, 0..1]
  isAudioActive: boolean;
  isTransparent: boolean;
}

export interface VisualizerRenderer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly substrate?: "webgl" | "canvas2d";
  init(canvas: HTMLCanvasElement): void;
  render(params: VisualizerRenderParams): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface VisualizerMetadata {
  id: CanonicalArchetypeId;
  name: string;
  subtitle: string;
  description: string;
  category: "apple" | "ai" | "physics" | "sci-fi" | "system";
  substrate: "webgl" | "canvas2d";
  defaultPalette: PaletteId;
  recommendedScale: number;
  recommendedTurbulence: number;
  recommendedGlow: number;
  tags: string[];
}

export type ArchetypeMetadata = VisualizerMetadata;
