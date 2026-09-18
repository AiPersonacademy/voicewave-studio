import { describe, it, expect } from "vitest";
import {
  validatePresetSchema,
  VALID_ARCHETYPES,
  VALID_FRAMINGS,
  VALID_BACKGROUNDS,
  type VuiPreset,
} from "@/types/presets";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";

export type { VuiPreset };

describe("VUI Preset Schema & Validation Contract", () => {
  const samplePreset: VuiPreset = {
    id: "ios18-siri-default",
    name: "Siri Chromatic Flow",
    category: "apple",
    description: "Cupertino iOS 18 ribbon with organic frequency dispersion",
    archetype: "apple-siri",
    framing: "1:1",
    backgroundMode: "checkerboard",
    params: {
      sensitivity: 1.4,
      smoothness: 0.92,
      resetSpeed: 0.85,
      turbulence: 0.4,
      glowIntensity: 1.2,
      scale: 1.0,
      palette: "siri-chromatic",
    },
  };

  it("successfully validates a compliant factory preset", () => {
    const res = validatePresetSchema(samplePreset);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("catches unsupported or malformed archetypes", () => {
    const invalid = { ...samplePreset, archetype: "non-existent-shape" };
    const res = validatePresetSchema(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Invalid archetype");
  });

  it("rejects invalid framing aspect ratios", () => {
    const invalid = { ...samplePreset, framing: "4:3" as any };
    const res = validatePresetSchema(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Invalid framing");
  });

  it("preserves round-trip JSON serialization integrity", () => {
    const serialized = JSON.stringify(samplePreset);
    const parsed = JSON.parse(serialized);
    const res = validatePresetSchema(parsed);
    expect(res.valid).toBe(true);
    expect(parsed).toEqual(samplePreset);
  });

  describe("14 Curated Factory Presets Compliance", () => {
    it("contains exactly 14 factory presets", () => {
      expect(DEFAULT_PRESETS).toHaveLength(14);
    });

    it("ensures all 14 factory presets validate schema with 0 errors", () => {
      for (const preset of DEFAULT_PRESETS) {
        const res = validatePresetSchema(preset);
        expect(res.valid, `Preset '${preset.id}' failed validation: ${res.errors.join(", ")}`).toBe(true);
        expect(res.errors).toHaveLength(0);
      }
    });

    it("covers Apple, AI, Broadcast, Minimal, Cyber, and Ambient categories", () => {
      const categories = new Set(DEFAULT_PRESETS.map((p) => p.category));
      expect(categories.has("apple")).toBe(true);
      expect(categories.has("ai")).toBe(true);
      expect(categories.has("broadcast")).toBe(true);
      expect(categories.has("minimal")).toBe(true);
      expect(categories.has("cyber")).toBe(true);
      expect(categories.has("ambient")).toBe(true);
    });

    it("covers all 3 framing modes (1:1, 16:9, 9:16)", () => {
      const framings = new Set(DEFAULT_PRESETS.map((p) => p.framing));
      expect(framings.has("1:1")).toBe(true);
      expect(framings.has("16:9")).toBe(true);
      expect(framings.has("9:16")).toBe(true);
    });

    it("covers multiple background modes (checkerboard, dark, glow, green-screen, blue-screen)", () => {
      const bgModes = new Set(DEFAULT_PRESETS.map((p) => p.backgroundMode));
      expect(bgModes.has("checkerboard")).toBe(true);
      expect(bgModes.has("dark")).toBe(true);
      expect(bgModes.has("glow")).toBe(true);
      expect(bgModes.has("green-screen")).toBe(true);
      expect(bgModes.has("blue-screen")).toBe(true);
    });

    it("exports valid schema options", () => {
      expect(VALID_ARCHETYPES.length).toBeGreaterThanOrEqual(8);
      expect(VALID_FRAMINGS).toContain("1:1");
      expect(VALID_BACKGROUNDS).toContain("checkerboard");
    });
  });
});
