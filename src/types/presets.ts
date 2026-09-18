/**
 * src/types/presets.ts
 *
 * Canonical VUI Preset & Inspector type definitions for VoiceWave Studio.
 * Conforms strictly to PROJECT.md §Interface Contracts and tests/unit/presetSchema.test.ts.
 */

export type PresetCategory =
  | "apple"
  | "ai"
  | "broadcast"
  | "minimal"
  | "cyber"
  | "ambient"
  | "custom";

export type PresetFraming = "1:1" | "16:9" | "9:16";

export type PresetBackgroundMode =
  | "checkerboard"
  | "dark"
  | "glow"
  | "green-screen"
  | "blue-screen";

export interface PresetParams {
  /** Voice Reactivity Sensitivity: 0.2 - 3.0 */
  sensitivity: number;
  /** Fluidity / Ballistics Inertia: 0.0 - 1.0 */
  smoothness: number;
  /** Ballistics Reset Speed / Decay: 0.0 - 1.0 */
  resetSpeed: number;
  /** Fluid Turbulence / Noise Chaos: 0.0 - 2.5 */
  turbulence: number;
  /** Glow / Specular Bloom: 0.0 - 3.0 */
  glowIntensity: number;
  /** Display Zoom / Scale Multiplier: 0.5 - 2.0 */
  scale: number;
  /** Palette ID (e.g. "cupertino-siri", "gemini-live") */
  palette: string;
}

export interface VuiPreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  archetype: string;
  framing: PresetFraming;
  backgroundMode: PresetBackgroundMode;
  params: PresetParams;
  createdAt?: number;
  isCustom?: boolean;
}

export interface PresetValidationResult {
  valid: boolean;
  errors: string[];
}

export const VALID_ARCHETYPES = [
  "apple-siri",
  "chatgpt-orb",
  "gemini-metaballs",
  "concentric-rings",
  "cymatics-particle",
  "glass-soundbars",
  "scifi-hud",
  "perimeter-glow",
  "wave",
  "fluid-dots",
] as const;

export const VALID_FRAMINGS: readonly PresetFraming[] = ["1:1", "16:9", "9:16"] as const;

export const VALID_BACKGROUNDS: readonly PresetBackgroundMode[] = [
  "checkerboard",
  "dark",
  "glow",
  "green-screen",
  "blue-screen",
] as const;

/**
 * Validates any object against the strict VuiPreset schema contract.
 */
export function validatePresetSchema(preset: unknown): PresetValidationResult {
  const errors: string[] = [];
  if (!preset || typeof preset !== "object") {
    return { valid: false, errors: ["Preset must be an object"] };
  }

  const p = preset as Record<string, unknown>;

  if (!p.id || typeof p.id !== "string") errors.push("Invalid preset ID");
  if (!p.name || typeof p.name !== "string") errors.push("Invalid preset name");

  const validArchetypeList: readonly string[] = VALID_ARCHETYPES;
  if (!p.archetype || typeof p.archetype !== "string" || !validArchetypeList.includes(p.archetype)) {
    errors.push(`Invalid archetype: ${String(p.archetype)}`);
  }

  const validFramingList: readonly string[] = VALID_FRAMINGS;
  if (!p.framing || typeof p.framing !== "string" || !validFramingList.includes(p.framing)) {
    errors.push(`Invalid framing: ${String(p.framing)}`);
  }

  const validBackgroundList: readonly string[] = VALID_BACKGROUNDS;
  if (!p.backgroundMode || typeof p.backgroundMode !== "string" || !validBackgroundList.includes(p.backgroundMode)) {
    errors.push(`Invalid backgroundMode: ${String(p.backgroundMode)}`);
  }

  if (!p.params || typeof p.params !== "object") {
    errors.push("Missing params object");
  } else {
    const params = p.params as Record<string, unknown>;
    const { sensitivity, smoothness, resetSpeed, turbulence, glowIntensity, scale, palette } = params;

    if (typeof sensitivity !== "number" || Number.isNaN(sensitivity) || sensitivity < 0) {
      errors.push("Invalid sensitivity");
    }
    if (typeof smoothness !== "number" || Number.isNaN(smoothness)) {
      errors.push("Invalid smoothness");
    }
    if (typeof resetSpeed !== "number" || Number.isNaN(resetSpeed)) {
      errors.push("Invalid resetSpeed");
    }
    if (typeof turbulence !== "number" || Number.isNaN(turbulence)) {
      errors.push("Invalid turbulence");
    }
    if (typeof glowIntensity !== "number" || Number.isNaN(glowIntensity)) {
      errors.push("Invalid glowIntensity");
    }
    if (typeof scale !== "number" || Number.isNaN(scale)) {
      errors.push("Invalid scale");
    }
    if (typeof palette !== "string" || palette.trim().length === 0) {
      errors.push("Invalid palette");
    }
  }

  return { valid: errors.length === 0, errors };
}
