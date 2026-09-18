/**
 * src/visualizers/palettes.ts
 *
 * Chromatic palette system for VoiceWave Studio.
 * Defines 6 factory palettes, hex to GLSL vec4 / normalized float conversions,
 * flat uniform buffers, and palette interpolation utilities.
 */

import type { ColorRGB, ColorRGBA, PaletteId } from "./types";

export interface ChromaticPalette {
  id: PaletteId;
  name: string;
  category: "apple" | "ai" | "cyber" | "minimal" | "nature" | "sunset";
  description: string;
  hex: [string, string, string, string];
  rgb: [ColorRGB, ColorRGB, ColorRGB, ColorRGB];
  rgba: [ColorRGBA, ColorRGBA, ColorRGBA, ColorRGBA];
  flatVec4: Float32Array; // 16 floats (4 x vec4) for gl.uniform4fv
  flatVec3: Float32Array; // 12 floats (4 x vec3) for gl.uniform3fv
}

/**
 * Converts a 3, 6, or 8 character hex string into normalized RGB floats [0..1].
 */
export function hexToRgb(hexInput: string): ColorRGB {
  let hex = hexInput.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const intVal = parseInt(hex.substring(0, 6), 16);
  if (isNaN(intVal)) {
    return [1.0, 1.0, 1.0];
  }
  return [
    ((intVal >> 16) & 255) / 255,
    ((intVal >> 8) & 255) / 255,
    (intVal & 255) / 255,
  ];
}

/**
 * Converts hex string to normalized RGBA floats [0..1].
 */
export function hexToRgba(hexInput: string, defaultAlpha = 1.0): ColorRGBA {
  let hex = hexInput.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const rgb = hexToRgb(hex);
  let a = defaultAlpha;
  if (hex.length === 8) {
    const alphaInt = parseInt(hex.substring(6, 8), 16);
    if (!isNaN(alphaInt)) {
      a = alphaInt / 255;
    }
  }
  return [rgb[0], rgb[1], rgb[2], a];
}

/**
 * Converts RGB floats [0..1] to standard #RRGGBB hex string.
 */
export function rgbToHex([r, g, b]: ColorRGB): string {
  const toHex = (c: number) =>
    Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Helper to build a complete ChromaticPalette record with flat float arrays.
 */
export function createPaletteDefinition(
  id: PaletteId,
  name: string,
  category: ChromaticPalette["category"],
  description: string,
  hexColors: [string, string, string, string]
): ChromaticPalette {
  const rgb = hexColors.map(hexToRgb) as [ColorRGB, ColorRGB, ColorRGB, ColorRGB];
  const rgba = hexColors.map((h) => hexToRgba(h, 1.0)) as [ColorRGBA, ColorRGBA, ColorRGBA, ColorRGBA];

  const flatVec4 = new Float32Array(16);
  const flatVec3 = new Float32Array(12);

  for (let i = 0; i < 4; i++) {
    flatVec4[i * 4 + 0] = rgba[i][0];
    flatVec4[i * 4 + 1] = rgba[i][1];
    flatVec4[i * 4 + 2] = rgba[i][2];
    flatVec4[i * 4 + 3] = rgba[i][3];

    flatVec3[i * 3 + 0] = rgb[i][0];
    flatVec3[i * 3 + 1] = rgb[i][1];
    flatVec3[i * 3 + 2] = rgb[i][2];
  }

  return {
    id,
    name,
    category,
    description,
    hex: hexColors,
    rgb,
    rgba,
    flatVec4,
    flatVec3,
  };
}

// ---------------------------------------------------------------------------
// 6 Factory Chromatic Palettes
// ---------------------------------------------------------------------------

export const CUPERTINO_SIRI = createPaletteDefinition(
  "cupertino-siri",
  "Cupertino Siri",
  "apple",
  "Apple iOS 18 Siri spectrum: Sapphire blue, vivid magenta, emerald mint, and solar amber.",
  ["#0D74FF", "#F43F5E", "#00F5A0", "#FFB020"]
);

export const GEMINI_LIVE = createPaletteDefinition(
  "gemini-live",
  "Gemini Live",
  "ai",
  "Google Gemini signature chromatic quadruplet: Google blue, coral red, emerald, and sun gold.",
  ["#4285F4", "#EA4335", "#34A853", "#FBBC05"]
);

export const CYBERPUNK_AI = createPaletteDefinition(
  "cyberpunk-ai",
  "Cyberpunk AI",
  "cyber",
  "High-contrast neon synthwave: Electric cyan, hot fuchsia, dark violet, and radioactive yellow.",
  ["#00F0FF", "#FF007F", "#7928CA", "#FFE600"]
);

export const OPENAI_MONOCHROME = createPaletteDefinition(
  "openai-monochrome",
  "OpenAI Monochrome",
  "minimal",
  "Editorial architectural minimalism: Pure luminescence white, ghost zinc, cool zinc, and deep graphite.",
  ["#FFFFFF", "#E4E4E7", "#A1A1AA", "#3F3F46"]
);

export const AURORA_BOREALIS = createPaletteDefinition(
  "aurora-borealis",
  "Aurora Borealis",
  "nature",
  "Atmospheric northern lights: Polar emerald, glacial cyan, nordic indigo, and nightsky violet.",
  ["#10B981", "#06B6D4", "#6366F1", "#A855F7"]
);

export const SUNSET_HORIZON = createPaletteDefinition(
  "sunset-horizon",
  "Sunset Horizon",
  "sunset",
  "Vibrant dusk gradient: Deep crimson, radiant tangerine, twilight purple, and warm sun gold.",
  ["#E11D48", "#FB923C", "#8B5CF6", "#FDE047"]
);

export const FACTORY_PALETTES: Record<string, ChromaticPalette> = {
  [CUPERTINO_SIRI.id]: CUPERTINO_SIRI,
  [GEMINI_LIVE.id]: GEMINI_LIVE,
  [CYBERPUNK_AI.id]: CYBERPUNK_AI,
  [OPENAI_MONOCHROME.id]: OPENAI_MONOCHROME,
  [AURORA_BOREALIS.id]: AURORA_BOREALIS,
  [SUNSET_HORIZON.id]: SUNSET_HORIZON,
};

export const DEFAULT_PALETTE_ID = "cupertino-siri";

/**
 * Retrieves palette by ID with fallback to default.
 */
export function getPalette(id?: string): ChromaticPalette {
  if (id && FACTORY_PALETTES[id]) {
    return FACTORY_PALETTES[id];
  }
  // Also check common aliases
  if (id === "siri" || id === "siri-chromatic" || id === "apple") {
    return FACTORY_PALETTES["cupertino-siri"];
  }
  if (id === "gemini" || id === "google") {
    return FACTORY_PALETTES["gemini-live"];
  }
  if (id === "cyberpunk" || id === "cyber") {
    return FACTORY_PALETTES["cyberpunk-ai"];
  }
  if (id === "monochrome" || id === "openai" || id === "white") {
    return FACTORY_PALETTES["openai-monochrome"];
  }
  if (id === "aurora" || id === "northern-lights") {
    return FACTORY_PALETTES["aurora-borealis"];
  }
  if (id === "sunset" || id === "horizon") {
    return FACTORY_PALETTES["sunset-horizon"];
  }
  return FACTORY_PALETTES[DEFAULT_PALETTE_ID];
}

/**
 * Returns all factory palettes as an array.
 */
export function getAllPalettes(): ChromaticPalette[] {
  return Object.values(FACTORY_PALETTES);
}

/**
 * Smoothly interpolates across 4 RGB stops along normalized parameter t in [0, 1].
 */
export function interpolatePalette(
  t: number,
  c0: ColorRGB,
  c1: ColorRGB,
  c2: ColorRGB,
  c3: ColorRGB
): ColorRGB {
  const clampedT = Math.max(0, Math.min(1, t));
  if (clampedT < 0.333) {
    const f = clampedT * 3.0;
    return [
      c0[0] + (c1[0] - c0[0]) * f,
      c0[1] + (c1[1] - c0[1]) * f,
      c0[2] + (c1[2] - c0[2]) * f,
    ];
  } else if (clampedT < 0.666) {
    const f = (clampedT - 0.333) * 3.0;
    return [
      c1[0] + (c2[0] - c1[0]) * f,
      c1[1] + (c2[1] - c1[1]) * f,
      c1[2] + (c2[2] - c1[2]) * f,
    ];
  } else {
    const f = (clampedT - 0.666) * 3.0;
    return [
      c2[0] + (c3[0] - c2[0]) * f,
      c2[1] + (c3[1] - c2[1]) * f,
      c2[2] + (c3[2] - c2[2]) * f,
    ];
  }
}
