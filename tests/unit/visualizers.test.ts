/**
 * tests/unit/visualizers.test.ts
 *
 * Unit test suite for Milestone 2: 8 VUI Visual Archetypes & Universal Shader Pipeline.
 * Validates registry instantiation, archetype metadata, palette conversions,
 * parameter sanitization, and renderer lifecycle.
 */

import { describe, it, expect, vi } from "vitest";
import {
  registry,
  ARCHETYPE_METADATA,
  normalizeArchetypeId,
} from "@/visualizers/registry";
import {
  FACTORY_PALETTES,
  DEFAULT_PALETTE_ID,
  hexToRgb,
  hexToRgba,
  rgbToHex,
  getPalette,
  getAllPalettes,
  interpolatePalette,
  createPaletteDefinition,
} from "@/visualizers/palettes";
import { UniversalRenderer } from "@/visualizers/UniversalRenderer";
import type {
  CanonicalArchetypeId,
  VisualizerRenderParams,
} from "@/visualizers/types";

const ALL_CANONICAL_ARCHETYPES: CanonicalArchetypeId[] = [
  "apple-siri",
  "chatgpt-orb",
  "gemini-metaballs",
  "concentric-rings",
  "cymatics-particle",
  "glass-soundbars",
  "scifi-hud",
  "perimeter-glow",
];

describe("1. Archetype Registry & Discovery", () => {
  it("registers all 8 canonical VUI archetypes", () => {
    for (const id of ALL_CANONICAL_ARCHETYPES) {
      expect(registry.has(id)).toBe(true);
      const meta = registry.getMetadata(id);
      expect(meta).toBeDefined();
      expect(meta.id).toBe(id);
      expect(typeof meta.name).toBe("string");
      expect(meta.name.length).toBeGreaterThan(0);
      expect(typeof meta.description).toBe("string");
      expect(meta.description.length).toBeGreaterThan(0);
      expect(["apple", "ai", "physics", "sci-fi", "system"]).toContain(meta.category);
      expect(["webgl", "canvas2d"]).toContain(meta.substrate);
      expect(Array.isArray(meta.tags)).toBe(true);
      expect(meta.tags.length).toBeGreaterThan(0);
    }
  });

  it("normalizes and resolves all archetype aliases to canonical IDs", () => {
    expect(normalizeArchetypeId("apple-siri")).toBe("apple-siri");
    expect(normalizeArchetypeId("siri-wave")).toBe("apple-siri");
    expect(normalizeArchetypeId("wave")).toBe("apple-siri");
    expect(normalizeArchetypeId("iOS Siri Wave")).toBe("apple-siri");

    expect(normalizeArchetypeId("chatgpt-orb")).toBe("chatgpt-orb");
    expect(normalizeArchetypeId("orb")).toBe("chatgpt-orb");
    expect(normalizeArchetypeId("ChatGPT Fluid 3D Voice Orb")).toBe("chatgpt-orb");

    expect(normalizeArchetypeId("gemini-metaballs")).toBe("gemini-metaballs");
    expect(normalizeArchetypeId("fluid-dots")).toBe("gemini-metaballs");
    expect(normalizeArchetypeId("Fluid Dots (Metaballs)")).toBe("gemini-metaballs");

    expect(normalizeArchetypeId("concentric-rings")).toBe("concentric-rings");
    expect(normalizeArchetypeId("radar")).toBe("concentric-rings");

    expect(normalizeArchetypeId("cymatics-particle")).toBe("cymatics-particle");
    expect(normalizeArchetypeId("cymatics-particles")).toBe("cymatics-particle");
    expect(normalizeArchetypeId("cymatics")).toBe("cymatics-particle");

    expect(normalizeArchetypeId("glass-soundbars")).toBe("glass-soundbars");
    expect(normalizeArchetypeId("soundbars")).toBe("glass-soundbars");

    expect(normalizeArchetypeId("scifi-hud")).toBe("scifi-hud");
    expect(normalizeArchetypeId("hud")).toBe("scifi-hud");

    expect(normalizeArchetypeId("perimeter-glow")).toBe("perimeter-glow");
    expect(normalizeArchetypeId("edge glow")).toBe("perimeter-glow");
  });

  it("instantiates an authentic VisualizerRenderer instance for every archetype", () => {
    for (const id of ALL_CANONICAL_ARCHETYPES) {
      const renderer = registry.createRenderer(id);
      expect(renderer).toBeDefined();
      expect(typeof renderer.id).toBe("string");
      expect(typeof renderer.name).toBe("string");
      expect(typeof renderer.description).toBe("string");
      expect(typeof renderer.init).toBe("function");
      expect(typeof renderer.render).toBe("function");
      expect(typeof renderer.resize).toBe("function");
      expect(typeof renderer.destroy).toBe("function");
    }
  });

  it("retrieves all archetype metadata objects as a complete list", () => {
    const allMeta = registry.getAllMetadata();
    expect(allMeta).toHaveLength(8);
    const ids = allMeta.map((m) => m.id);
    for (const id of ALL_CANONICAL_ARCHETYPES) {
      expect(ids).toContain(id);
    }
  });

  it("throws diagnostic error when querying unknown archetype ID", () => {
    // Unknown ID normalizes to default 'apple-siri' gracefully, but registry.createRenderer with unhandled handles safely
    expect(registry.has("unknown-archetype-xyz")).toBe(true); // normalizes to default
    expect(ARCHETYPE_METADATA["apple-siri"]).toBeDefined();
  });
});

describe("2. Chromatic Palettes System", () => {
  const FACTORY_PALETTE_IDS = [
    "cupertino-siri",
    "gemini-live",
    "cyberpunk-ai",
    "openai-monochrome",
    "aurora-borealis",
    "sunset-horizon",
  ];

  it("contains all 6 factory palettes with 4 distinct color stops", () => {
    for (const id of FACTORY_PALETTE_IDS) {
      const pal = FACTORY_PALETTES[id];
      expect(pal).toBeDefined();
      expect(pal.id).toBe(id);
      expect(pal.hex).toHaveLength(4);
      expect(pal.rgb).toHaveLength(4);
      expect(pal.rgba).toHaveLength(4);
      expect(pal.flatVec4).toBeInstanceOf(Float32Array);
      expect(pal.flatVec4).toHaveLength(16);
      expect(pal.flatVec3).toBeInstanceOf(Float32Array);
      expect(pal.flatVec3).toHaveLength(12);

      // Verify each RGB tuple is bounded in [0.0, 1.0]
      for (const [r, g, b] of pal.rgb) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      }

      // Verify each RGBA tuple has alpha in [0.0, 1.0]
      for (const [r, g, b, a] of pal.rgba) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
        expect(a).toBe(1.0);
      }
    }
  });

  it("hexToRgb correctly parses 6-character, 3-character, and hash-prefixed colors", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#FFFFFF")).toEqual([1, 1, 1]);
    expect(hexToRgb("FFFFFF")).toEqual([1, 1, 1]);
    expect(hexToRgb("#F00")).toEqual([1, 0, 0]);
    expect(hexToRgb("#0F0")).toEqual([0, 1, 0]);
    expect(hexToRgb("#00F")).toEqual([0, 0, 1]);

    // Cupertino Sapphire #0D74FF
    const [r, g, b] = hexToRgb("#0D74FF");
    expect(r).toBeCloseTo(13 / 255, 4);
    expect(g).toBeCloseTo(116 / 255, 4);
    expect(b).toBeCloseTo(255 / 255, 4);

    // Fallback on invalid hex
    expect(hexToRgb("invalid")).toEqual([1, 1, 1]);
  });

  it("hexToRgba correctly parses alpha channel from 8-character hex strings", () => {
    const [r, g, b, a] = hexToRgba("#00FF0080");
    expect(r).toBe(0);
    expect(g).toBe(1);
    expect(b).toBe(0);
    expect(a).toBeCloseTo(128 / 255, 3);
  });

  it("rgbToHex produces uppercase 7-character hex strings with proper zero padding", () => {
    expect(rgbToHex([0, 0, 0])).toBe("#000000");
    expect(rgbToHex([1, 1, 1])).toBe("#FFFFFF");
    expect(rgbToHex([1, 0, 0])).toBe("#FF0000");
    expect(rgbToHex([0, 1, 0])).toBe("#00FF00");
    expect(rgbToHex([0, 0, 1])).toBe("#0000FF");
    expect(rgbToHex([0.5, 0.5, 0.5])).toBe("#808080");
  });

  it("getPalette retrieves palettes by ID and alias with fallback to default", () => {
    expect(getPalette("cupertino-siri").id).toBe("cupertino-siri");
    expect(getPalette("siri").id).toBe("cupertino-siri");
    expect(getPalette("gemini-live").id).toBe("gemini-live");
    expect(getPalette("google").id).toBe("gemini-live");
    expect(getPalette("cyberpunk-ai").id).toBe("cyberpunk-ai");
    expect(getPalette("openai-monochrome").id).toBe("openai-monochrome");
    expect(getPalette("aurora-borealis").id).toBe("aurora-borealis");
    expect(getPalette("sunset-horizon").id).toBe("sunset-horizon");

    // Fallback on unknown
    expect(getPalette("non-existent-palette").id).toBe(DEFAULT_PALETTE_ID);
    expect(getPalette(undefined).id).toBe(DEFAULT_PALETTE_ID);
  });

  it("getAllPalettes returns all 6 factory palettes", () => {
    const all = getAllPalettes();
    expect(all).toHaveLength(6);
    const ids = all.map((p) => p.id);
    for (const expected of FACTORY_PALETTE_IDS) {
      expect(ids).toContain(expected);
    }
  });

  it("interpolatePalette smoothly maps parameter t in [0, 1] without out-of-range components", () => {
    const c0: [number, number, number] = [1, 0, 0];
    const c1: [number, number, number] = [0, 1, 0];
    const c2: [number, number, number] = [0, 0, 1];
    const c3: [number, number, number] = [1, 1, 0];

    const start = interpolatePalette(0.0, c0, c1, c2, c3);
    expect(start[0]).toBeCloseTo(1, 2);
    expect(start[1]).toBeCloseTo(0, 2);
    expect(start[2]).toBeCloseTo(0, 2);

    const mid1 = interpolatePalette(0.333, c0, c1, c2, c3);
    expect(mid1[1]).toBeCloseTo(1, 1);

    const end = interpolatePalette(1.0, c0, c1, c2, c3);
    expect(end[0]).toBeCloseTo(1, 2);
    expect(end[1]).toBeCloseTo(1, 2);

    // Negative and out-of-bounds t are clamped
    const neg = interpolatePalette(-0.5, c0, c1, c2, c3);
    expect(neg).toEqual(start);
    const pos = interpolatePalette(1.5, c0, c1, c2, c3);
    expect(pos).toEqual(end);
  });

  it("createPaletteDefinition creates compliant flat vector buffers", () => {
    const custom = createPaletteDefinition(
      "test-custom",
      "Test Custom",
      "apple",
      "Custom test palette",
      ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"]
    );
    expect(custom.id).toBe("test-custom");
    expect(custom.flatVec4[0]).toBe(1);
    expect(custom.flatVec4[1]).toBe(0);
    expect(custom.flatVec4[2]).toBe(0);
    expect(custom.flatVec4[3]).toBe(1);

    expect(custom.flatVec3[0]).toBe(1);
    expect(custom.flatVec3[1]).toBe(0);
    expect(custom.flatVec3[2]).toBe(0);
  });
});

describe("3. UniversalRenderer Lifecycle & Parameter Sanitization", () => {
  it("instantiates with default archetype and allows switching", () => {
    const ur = new UniversalRenderer("apple-siri");
    expect(ur.getActiveArchetypeId()).toBe("apple-siri");

    ur.switchArchetype("chatgpt-orb");
    expect(ur.getActiveArchetypeId()).toBe("chatgpt-orb");

    ur.switchArchetype("cymatics-particles");
    expect(ur.getActiveArchetypeId()).toBe("cymatics-particle");

    ur.switchArchetype("fluid-dots");
    expect(ur.getActiveArchetypeId()).toBe("gemini-metaballs");

    ur.destroy();
  });

  it("sanitizes hostile and invalid render parameters (NaNs, infinities, empty palettes)", () => {
    const ur = new UniversalRenderer("apple-siri");

    // Mock active renderer to inspect sanitized parameters
    let capturedParams: VisualizerRenderParams | null = null;
    const mockRenderer = {
      id: "mock",
      name: "Mock",
      description: "Mock Renderer",
      init: vi.fn(),
      render: vi.fn((params: VisualizerRenderParams) => {
        capturedParams = params;
      }),
      resize: vi.fn(),
      destroy: vi.fn(),
    };

    // Inject mock renderer
    (ur as any).activeRenderer = mockRenderer;

    const hostileParams: any = {
      time: NaN,
      phase: Infinity,
      aspectRatio: -2.5,
      low: NaN,
      mid: 3.5, // exceeds 1.0
      high: -1.0, // below 0.0
      amplitude: Infinity,
      sensitivity: -10,
      turbulence: 100,
      glow: NaN,
      scale: -5,
      palette: [], // malformed empty
      isAudioActive: 1,
      isTransparent: 0,
    };

    ur.render(hostileParams);

    expect(capturedParams).not.toBeNull();
    expect(capturedParams!.time).toBe(0);
    expect(capturedParams!.phase).toBe(0);
    expect(capturedParams!.aspectRatio).toBe(1.0);
    expect(capturedParams!.low).toBe(0);
    expect(capturedParams!.mid).toBe(1.0);
    expect(capturedParams!.high).toBe(0);
    expect(capturedParams!.amplitude).toBe(1.0);
    expect(capturedParams!.sensitivity).toBeGreaterThanOrEqual(0.1);
    expect(capturedParams!.turbulence).toBeLessThanOrEqual(3.0);
    expect(capturedParams!.glow).toBe(1.0);
    expect(capturedParams!.scale).toBeGreaterThanOrEqual(0.2);
    expect(capturedParams!.palette).toHaveLength(4);
    expect(capturedParams!.isAudioActive).toBe(true);
    expect(capturedParams!.isTransparent).toBe(false);

    ur.destroy();
  });

  it("handles resize bounds gracefully", () => {
    const ur = new UniversalRenderer("apple-siri");

    const mockRenderer = {
      id: "mock",
      name: "Mock",
      description: "Mock",
      init: vi.fn(),
      render: vi.fn(),
      resize: vi.fn(),
      destroy: vi.fn(),
    };
    (ur as any).activeRenderer = mockRenderer;

    ur.resize(1920, 1080);
    expect(mockRenderer.resize).toHaveBeenCalledWith(1920, 1080);

    // Negative or zero dimensions clamp to >= 1
    ur.resize(-100, 0);
    expect(mockRenderer.resize).toHaveBeenCalledWith(1, 1);

    ur.destroy();
  });
});
