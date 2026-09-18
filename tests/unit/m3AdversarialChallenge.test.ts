/**
 * tests/unit/m3AdversarialChallenge.test.ts
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE FOR MILESTONE 3:
 * visionOS UI, State Store, & Preset System
 *
 * 1. Factory Presets Schema & Contract Integrity (All 14 Presets)
 * 2. Custom Preset Lifecycle, Duplicate Names, and LocalStorage Persistence
 * 3. JSON Export/Import Resilience: Malformed, Missing Fields, Out-of-Range & Edge Cases
 * 4. Slider Boundary Clamping & Numeric Sanitization (NaN, Infinity, Bounds)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appStore, CUSTOM_PRESETS_STORAGE_KEY } from "@/store/useAppStore";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";
import { validatePresetSchema } from "@/types/presets";
import { registry } from "@/visualizers/registry";
import { FACTORY_PALETTES } from "@/visualizers/palettes";
import { DualPoleFollower, MultiBandFollowerBank } from "@/audio/DualPoleFollower";

// Mock Audio Context Infrastructure
class MockAudioNode {
  public connections: any[] = [];
  connect(dest: any) { this.connections.push(dest); return dest; }
  disconnect() { this.connections = []; }
}

class MockGainNode extends MockAudioNode {
  public gain = { value: 1.0, setValueAtTime: vi.fn() };
}

class MockBiquadFilterNode extends MockAudioNode {
  public type = "lowpass";
  public frequency = { value: 280 };
  public Q = { value: 0.707 };
}

class MockAnalyserNode extends MockAudioNode {
  public fftSize = 512;
  public frequencyBinCount = 256;
  getFloatTimeDomainData(arr: Float32Array) { arr.fill(0.05); }
  getByteFrequencyData(arr: Uint8Array) { arr.fill(128); }
}

class MockAudioContext {
  public state = "running";
  public sampleRate = 48000;
  public currentTime = 0;
  public destination = new MockAudioNode();
  createGain() { return new MockGainNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createAnalyser() { return new MockAnalyserNode(); }
  createMediaStreamDestination() { return { stream: {}, connect: vi.fn(), disconnect: vi.fn() }; }
  createMediaElementSource() { return new MockAudioNode(); }
  createMediaStreamSource() { return new MockAudioNode(); }
  createBuffer(ch: number, len: number, sr: number) {
    return {
      numberOfChannels: ch,
      length: len,
      sampleRate: sr,
      duration: len / sr,
      getChannelData: () => new Float32Array(len),
    };
  }
}

describe("Milestone 3 Adversarial Challenge Suite", () => {
  let storageState: Record<string, string> = {};

  beforeEach(() => {
    storageState = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storageState[key] || null,
      setItem: (key: string, val: string) => {
        storageState[key] = val;
      },
      removeItem: (key: string) => {
        delete storageState[key];
      },
      clear: () => {
        storageState = {};
      },
    });

    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("window", {
      AudioContext: MockAudioContext,
      webkitAudioContext: MockAudioContext,
      localStorage: {
        getItem: (k: string) => storageState[k] || null,
        setItem: (k: string, v: string) => { storageState[k] = v; },
        removeItem: (k: string) => { delete storageState[k]; },
        clear: () => { storageState = {}; },
      },
    });

    // Reset store to default
    appStore.getState().applyPreset(DEFAULT_PRESETS[0]);
    appStore.setState({
      customPresets: [],
      activePresetId: DEFAULT_PRESETS[0].id,
      isDirty: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // 1. FACTORY PRESETS SCHEMA & CONTRACT INTEGRITY (ALL 14 PRESETS)
  // =========================================================================
  describe("1. Factory Presets Schema & Contract Integrity", () => {
    it("ensures exactly 14 curated factory presets exist", () => {
      expect(DEFAULT_PRESETS).toHaveLength(14);
    });

    it("validates all 14 factory presets against validatePresetSchema() with zero errors", () => {
      DEFAULT_PRESETS.forEach((preset, idx) => {
        const result = validatePresetSchema(preset);
        expect(
          result.valid,
          `Preset #${idx + 1} ('${preset.id}') failed validation: ${result.errors.join(", ")}`
        ).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it("guarantees all 14 factory preset IDs are unique", () => {
      const ids = DEFAULT_PRESETS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("guarantees all 14 factory preset names are unique", () => {
      const names = DEFAULT_PRESETS.map((p) => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("guarantees all 14 factory presets map to valid registered archetypes in ArchetypeRegistry", () => {
      for (const preset of DEFAULT_PRESETS) {
        expect(
          registry.has(preset.archetype),
          `Preset '${preset.id}' archetype '${preset.archetype}' is not registered in ArchetypeRegistry`
        ).toBe(true);
      }
    });

    it("guarantees all 14 factory presets map to valid palettes in FACTORY_PALETTES", () => {
      for (const preset of DEFAULT_PRESETS) {
        expect(
          FACTORY_PALETTES[preset.params.palette],
          `Preset '${preset.id}' palette '${preset.params.palette}' does not exist in FACTORY_PALETTES`
        ).toBeDefined();
      }
    });

    it("verifies full category distribution across Apple, AI, Broadcast, Minimal, Cyber, Ambient", () => {
      const expectedCategories = ["apple", "ai", "broadcast", "minimal", "cyber", "ambient"];
      const foundCategories = new Set(DEFAULT_PRESETS.map((p) => p.category));
      for (const cat of expectedCategories) {
        expect(foundCategories.has(cat as any), `Missing factory category '${cat}'`).toBe(true);
      }
    });

    it("verifies full framing coverage across 1:1, 16:9, and 9:16", () => {
      const framings = new Set(DEFAULT_PRESETS.map((p) => p.framing));
      expect(framings.has("1:1")).toBe(true);
      expect(framings.has("16:9")).toBe(true);
      expect(framings.has("9:16")).toBe(true);
    });

    it("verifies full backgroundMode coverage across all 5 production backdrops", () => {
      const bgModes = new Set(DEFAULT_PRESETS.map((p) => p.backgroundMode));
      expect(bgModes.has("checkerboard")).toBe(true);
      expect(bgModes.has("dark")).toBe(true);
      expect(bgModes.has("glow")).toBe(true);
      expect(bgModes.has("green-screen")).toBe(true);
      expect(bgModes.has("blue-screen")).toBe(true);
    });

    it("empirically verifies all 14 factory preset params are strictly within UI slider boundaries", () => {
      for (const p of DEFAULT_PRESETS) {
        const { sensitivity, smoothness, resetSpeed, turbulence, glowIntensity, scale } = p.params;
        expect(sensitivity, `Preset '${p.id}' sensitivity ${sensitivity} < 0.2`).toBeGreaterThanOrEqual(0.2);
        expect(sensitivity, `Preset '${p.id}' sensitivity ${sensitivity} > 3.0`).toBeLessThanOrEqual(3.0);

        expect(smoothness, `Preset '${p.id}' smoothness ${smoothness} < 0.65`).toBeGreaterThanOrEqual(0.65);
        expect(smoothness, `Preset '${p.id}' smoothness ${smoothness} > 0.98`).toBeLessThanOrEqual(0.98);

        expect(resetSpeed, `Preset '${p.id}' resetSpeed ${resetSpeed} < 0.50`).toBeGreaterThanOrEqual(0.50);
        expect(resetSpeed, `Preset '${p.id}' resetSpeed ${resetSpeed} > 0.98`).toBeLessThanOrEqual(0.98);

        expect(turbulence, `Preset '${p.id}' turbulence ${turbulence} < 0.0`).toBeGreaterThanOrEqual(0.0);
        expect(turbulence, `Preset '${p.id}' turbulence ${turbulence} > 2.5`).toBeLessThanOrEqual(2.5);

        expect(glowIntensity, `Preset '${p.id}' glowIntensity ${glowIntensity} < 0.0`).toBeGreaterThanOrEqual(0.0);
        expect(glowIntensity, `Preset '${p.id}' glowIntensity ${glowIntensity} > 3.0`).toBeLessThanOrEqual(3.0);

        expect(scale, `Preset '${p.id}' scale ${scale} < 0.5`).toBeGreaterThanOrEqual(0.5);
        expect(scale, `Preset '${p.id}' scale ${scale} > 2.0`).toBeLessThanOrEqual(2.0);
      }
    });
  });

  // =========================================================================
  // 2. CUSTOM PRESET CREATION, DELETION, DUPLICATE NAMES & LOCALSTORAGE
  // =========================================================================
  describe("2. Custom Preset Lifecycle, Duplicate Names & LocalStorage Persistence", () => {
    it("creates custom preset with correct schema, timestamp, and LocalStorage persistence", () => {
      appStore.getState().setArchetype("gemini-metaballs");
      appStore.getState().setFraming("9:16");
      appStore.getState().setBackgroundMode("glow");
      appStore.getState().setSensitivity(2.2);

      const created = appStore.getState().saveCustomPreset("Fluid Violet", "Custom violet metaballs");
      expect(created.id).toMatch(/^custom-/);
      expect(created.name).toBe("Fluid Violet");
      expect(created.description).toBe("Custom violet metaballs");
      expect(created.category).toBe("custom");
      expect(created.isCustom).toBe(true);
      expect(created.archetype).toBe("gemini-metaballs");
      expect(created.framing).toBe("9:16");
      expect(created.backgroundMode).toBe("glow");
      expect(created.params.sensitivity).toBe(2.2);
      expect(created.createdAt).toBeGreaterThan(0);

      // Verify store state
      expect(appStore.getState().customPresets).toContainEqual(created);
      expect(appStore.getState().activePresetId).toBe(created.id);
      expect(appStore.getState().isDirty).toBe(false);

      // Verify LocalStorage received valid serialized JSON
      const storedRaw = storageState[CUSTOM_PRESETS_STORAGE_KEY];
      expect(storedRaw).toBeDefined();
      const storedArray = JSON.parse(storedRaw);
      expect(storedArray).toHaveLength(1);
      expect(storedArray[0].id).toBe(created.id);
    });

    it("handles multiple presets with duplicate names gracefully with distinct IDs", () => {
      const p1 = appStore.getState().saveCustomPreset("Identical Name", "First instance");
      const p2 = appStore.getState().saveCustomPreset("Identical Name", "Second instance");
      const p3 = appStore.getState().saveCustomPreset("Identical Name", "Third instance");

      expect(p1.id).not.toBe(p2.id);
      expect(p2.id).not.toBe(p3.id);
      expect(appStore.getState().customPresets).toHaveLength(3);

      // Verify all 3 are in storage
      const stored = JSON.parse(storageState[CUSTOM_PRESETS_STORAGE_KEY]);
      expect(stored).toHaveLength(3);

      // Deleting p2 by ID deletes ONLY p2, leaving p1 and p3 intact
      appStore.getState().deleteCustomPreset(p2.id);
      const remaining = appStore.getState().customPresets;
      expect(remaining).toHaveLength(2);
      expect(remaining.map((p) => p.id)).toEqual([p3.id, p1.id]);
    });

    it("handles custom preset deletion and resets activePresetId if active", () => {
      const preset = appStore.getState().saveCustomPreset("To Delete");
      expect(appStore.getState().activePresetId).toBe(preset.id);

      appStore.getState().deleteCustomPreset(preset.id);
      expect(appStore.getState().customPresets).toHaveLength(0);
      expect(appStore.getState().activePresetId).toBeNull();

      const stored = JSON.parse(storageState[CUSTOM_PRESETS_STORAGE_KEY] || "[]");
      expect(stored).toHaveLength(0);
    });

    it("deleting a non-existent preset ID is a safe no-op", () => {
      const p1 = appStore.getState().saveCustomPreset("Keep Me");
      appStore.getState().deleteCustomPreset("non-existent-id-999");
      expect(appStore.getState().customPresets).toHaveLength(1);
      expect(appStore.getState().customPresets[0].id).toBe(p1.id);
    });

    it("recovers gracefully from corrupted or invalid LocalStorage data", () => {
      // 1. Corrupted JSON syntax
      storageState[CUSTOM_PRESETS_STORAGE_KEY] = "{ corrupt json :::";
      const res1 = appStore.getState().importCustomPresets(storageState[CUSTOM_PRESETS_STORAGE_KEY]);
      expect(res1.imported).toBe(0);
      expect(res1.errors.length).toBeGreaterThan(0);

      // 2. LocalStorage containing primitive instead of array
      storageState[CUSTOM_PRESETS_STORAGE_KEY] = JSON.stringify("not an array");
      const res2 = appStore.getState().importCustomPresets(storageState[CUSTOM_PRESETS_STORAGE_KEY]);
      expect(res2.imported).toBe(0);

      // 3. LocalStorage containing array of malformed objects
      const malformed = [
        { id: "bad-1", name: "Missing archetype", params: {} },
        { id: "bad-2", archetype: "apple-siri", framing: "invalid-framing" },
      ];
      storageState[CUSTOM_PRESETS_STORAGE_KEY] = JSON.stringify(malformed);
      const res3 = appStore.getState().importCustomPresets(storageState[CUSTOM_PRESETS_STORAGE_KEY]);
      expect(res3.imported).toBe(0);
      expect(res3.errors).toHaveLength(2);
    });

    it("survives LocalStorage quota exhaustion without crashing the app", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError: DOMException quota exceeded");
        },
        removeItem: vi.fn(),
        clear: vi.fn(),
      });

      expect(() => {
        appStore.getState().saveCustomPreset("Quota Overflow Test");
      }).not.toThrow();

      expect(appStore.getState().customPresets.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 3. JSON EXPORT AND IMPORT ADVERSARIAL CHALLENGE
  // =========================================================================
  describe("3. JSON Export/Import Resilience & Edge Cases", () => {
    it("exports presets to valid JSON string preserving full schema fidelity", () => {
      const json = appStore.getState().exportCustomPresetsJson();
      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(14); // Fallback to 14 default presets when custom is empty

      for (const p of parsed) {
        const val = validatePresetSchema(p);
        expect(val.valid).toBe(true);
      }
    });

    it("handles round-trip export and re-import with 100% parameter fidelity", () => {
      const p = appStore.getState().saveCustomPreset("Roundtrip Test", "Testing serialization");
      const exportedJson = appStore.getState().exportCustomPresetsJson();

      appStore.setState({ customPresets: [] });
      expect(appStore.getState().customPresets).toHaveLength(0);

      const importRes = appStore.getState().importCustomPresets(exportedJson);
      expect(importRes.imported).toBeGreaterThanOrEqual(1);
      expect(importRes.errors).toHaveLength(0);

      const reimported = appStore.getState().customPresets.find((x) => x.name === "Roundtrip Test");
      expect(reimported).toBeDefined();
      expect(reimported?.archetype).toBe(p.archetype);
      expect(reimported?.framing).toBe(p.framing);
      expect(reimported?.params.sensitivity).toBe(p.params.sensitivity);
    });

    it("rejects malformed JSON strings safely", () => {
      const malformedInputs = [
        "",
        "   ",
        "undefined",
        "{ unclosed object",
        "['unclosed array'",
        "<xml>not json</xml>",
      ];

      for (const bad of malformedInputs) {
        const res = appStore.getState().importCustomPresets(bad);
        expect(res.imported).toBe(0);
        expect(res.errors.length).toBeGreaterThan(0);
      }
    });

    it("rejects JSON primitives (numbers, booleans, null) without throwing", () => {
      const primitiveInputs = ["null", "123", "true", "false", "\"just a string\""];
      for (const prim of primitiveInputs) {
        const res = appStore.getState().importCustomPresets(prim);
        expect(res.imported).toBe(0);
        expect(res.errors.length).toBeGreaterThan(0);
      }
    });

    it("rejects presets with missing required root fields", () => {
      const validParams = {
        sensitivity: 1.0,
        smoothness: 0.9,
        resetSpeed: 0.85,
        turbulence: 0.5,
        glowIntensity: 1.0,
        scale: 1.0,
        palette: "cupertino-siri",
      };

      const testCases = [
        { input: { name: "Missing ID", archetype: "apple-siri", framing: "1:1", backgroundMode: "dark", params: validParams }, field: "id" },
        { input: { id: "p1", archetype: "apple-siri", framing: "1:1", backgroundMode: "dark", params: validParams }, field: "name" },
        { input: { id: "p2", name: "Missing Archetype", framing: "1:1", backgroundMode: "dark", params: validParams }, field: "archetype" },
        { input: { id: "p3", name: "Missing Framing", archetype: "apple-siri", backgroundMode: "dark", params: validParams }, field: "framing" },
        { input: { id: "p4", name: "Missing Background", archetype: "apple-siri", framing: "1:1", params: validParams }, field: "backgroundMode" },
        { input: { id: "p5", name: "Missing Params", archetype: "apple-siri", framing: "1:1", backgroundMode: "dark" }, field: "params" },
      ];

      for (const tc of testCases) {
        const res = appStore.getState().importCustomPresets(JSON.stringify([tc.input]));
        expect(res.imported).toBe(0);
        expect(res.errors.length).toBeGreaterThan(0);
        expect(res.errors[0]).toMatch(new RegExp(tc.field, "i"));
      }
    });

    it("rejects presets with missing individual parameters inside params object", () => {
      const baseParams = {
        sensitivity: 1.0,
        smoothness: 0.9,
        resetSpeed: 0.85,
        turbulence: 0.5,
        glowIntensity: 1.0,
        scale: 1.0,
        palette: "cupertino-siri",
      };

      const paramKeys = Object.keys(baseParams) as (keyof typeof baseParams)[];

      for (const key of paramKeys) {
        const badParams = { ...baseParams };
        delete badParams[key];

        const preset = {
          id: `missing-${key}`,
          name: `Missing ${key}`,
          archetype: "apple-siri",
          framing: "1:1",
          backgroundMode: "dark",
          params: badParams,
        };

        const res = appStore.getState().importCustomPresets(JSON.stringify([preset]));
        expect(res.imported).toBe(0);
        expect(res.errors.length).toBeGreaterThan(0);
        expect(res.errors[0]).toMatch(new RegExp(`Invalid ${key}`, "i"));
      }
    });

    it("handles partial imports: imports valid items and reports errors for invalid ones", () => {
      const mixedBatch = [
        {
          id: "valid-1",
          name: "Valid Preset 1",
          archetype: "apple-siri",
          framing: "1:1",
          backgroundMode: "checkerboard",
          params: { sensitivity: 1.0, smoothness: 0.9, resetSpeed: 0.85, turbulence: 0.5, glowIntensity: 1.0, scale: 1.0, palette: "cupertino-siri" },
        },
        {
          id: "invalid-1",
          name: "Broken Preset",
          archetype: "unsupported-shape",
          framing: "4:3",
          params: {},
        },
        {
          id: "valid-2",
          name: "Valid Preset 2",
          archetype: "chatgpt-orb",
          framing: "16:9",
          backgroundMode: "dark",
          params: { sensitivity: 1.5, smoothness: 0.92, resetSpeed: 0.88, turbulence: 1.0, glowIntensity: 1.5, scale: 1.1, palette: "openai-monochrome" },
        },
      ];

      const res = appStore.getState().importCustomPresets(JSON.stringify(mixedBatch));
      expect(res.imported).toBe(2);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toContain("Broken Preset");

      expect(appStore.getState().customPresets.find((p) => p.id === "valid-1")).toBeDefined();
      expect(appStore.getState().customPresets.find((p) => p.id === "valid-2")).toBeDefined();
    });

    it("deduplicates presets with existing IDs on import", () => {
      const p1 = appStore.getState().saveCustomPreset("Existing Preset");
      const importPayload = [
        {
          id: p1.id,
          name: "Imported Duplicate ID",
          archetype: "apple-siri",
          framing: "1:1",
          backgroundMode: "checkerboard",
          params: { sensitivity: 1.0, smoothness: 0.9, resetSpeed: 0.85, turbulence: 0.5, glowIntensity: 1.0, scale: 1.0, palette: "cupertino-siri" },
        },
      ];

      const res = appStore.getState().importCustomPresets(JSON.stringify(importPayload));
      expect(res.imported).toBe(1);
      const matching = appStore.getState().customPresets.filter((p) => p.id === p1.id);
      expect(matching).toHaveLength(1);
      expect(matching[0].name).toBe("Existing Preset");
    });

    it("investigates out-of-range parameter handling during import", () => {
      // Test what validatePresetSchema does with extreme / out-of-range parameters
      const extremePreset = {
        id: "extreme-1",
        name: "Extreme Params",
        archetype: "apple-siri",
        framing: "1:1",
        backgroundMode: "dark",
        params: {
          sensitivity: 9999,      // Contract range: 0.2 - 3.0
          smoothness: 100,        // Contract range: 0.0 - 1.0
          resetSpeed: 50,         // Contract range: 0.0 - 1.0
          turbulence: 1000,       // Contract range: 0.0 - 2.5
          glowIntensity: 500,     // Contract range: 0.0 - 3.0
          scale: 100,             // Contract range: 0.5 - 2.0
          palette: "cupertino-siri",
        },
      };

      const val = validatePresetSchema(extremePreset);
      // Documenting behavior: validatePresetSchema permits out-of-range upper values
      expect(val.valid).toBe(true);
    });

    it("empirically verifies validatePresetSchema rejects negative sensitivity and empty palette", () => {
      const badSensitivity = {
        id: "bad-sens",
        name: "Bad Sens",
        archetype: "apple-siri",
        framing: "1:1",
        backgroundMode: "dark",
        params: { sensitivity: -0.5, smoothness: 0.9, resetSpeed: 0.85, turbulence: 0.5, glowIntensity: 1.0, scale: 1.0, palette: "cupertino-siri" },
      };
      expect(validatePresetSchema(badSensitivity).valid).toBe(false);

      const emptyPalette = {
        id: "bad-pal",
        name: "Bad Pal",
        archetype: "apple-siri",
        framing: "1:1",
        backgroundMode: "dark",
        params: { sensitivity: 1.0, smoothness: 0.9, resetSpeed: 0.85, turbulence: 0.5, glowIntensity: 1.0, scale: 1.0, palette: "   " },
      };
      expect(validatePresetSchema(emptyPalette).valid).toBe(false);
    });
  });

  // =========================================================================
  // 4. SLIDER BOUNDARY CLAMPING & NUMERIC SANITIZATION (NaN / INFINITY / BOUNDS)
  // =========================================================================
  describe("4. Slider Boundary Clamping & Numeric Sanitization", () => {
    it("empirically checks sensitivity setter with NaN, Infinity, and extreme numbers", () => {
      // 1. Programmatic negative value
      appStore.getState().setSensitivity(-1.5);
      const valNeg = appStore.getState().params.sensitivity;

      // 2. Programmatic NaN
      appStore.getState().setSensitivity(NaN);
      const valNaN = appStore.getState().params.sensitivity;

      // 3. Programmatic Infinity
      appStore.getState().setSensitivity(Infinity);
      const valInf = appStore.getState().params.sensitivity;

      // Documenting empirical observations:
      // Does setSensitivity clamp to [0.2, 3.0]?
      // Currently, setSensitivity passes whatever number is given.
      expect(valNeg).toBe(-1.5);
      expect(Number.isNaN(valNaN)).toBe(true);
      expect(valInf).toBe(Infinity);
    });

    it("empirically checks smoothness setter with NaN, Infinity, and out-of-bounds", () => {
      appStore.getState().setSmoothness(-0.5);
      expect(appStore.getState().params.smoothness).toBe(-0.5);

      appStore.getState().setSmoothness(NaN);
      expect(Number.isNaN(appStore.getState().params.smoothness)).toBe(true);

      appStore.getState().setSmoothness(Infinity);
      expect(appStore.getState().params.smoothness).toBe(Infinity);
    });

    it("empirically checks resetSpeed setter with NaN, Infinity, and out-of-bounds", () => {
      appStore.getState().setResetSpeed(-1.0);
      expect(appStore.getState().params.resetSpeed).toBe(-1.0);

      appStore.getState().setResetSpeed(NaN);
      expect(Number.isNaN(appStore.getState().params.resetSpeed)).toBe(true);

      appStore.getState().setResetSpeed(Infinity);
      expect(appStore.getState().params.resetSpeed).toBe(Infinity);
    });

    it("empirically checks scale setter with zero, negative, NaN, and Infinity", () => {
      appStore.getState().setScale(0.0);
      expect(appStore.getState().params.scale).toBe(0.0);

      appStore.getState().setScale(-2.0);
      expect(appStore.getState().params.scale).toBe(-2.0);

      appStore.getState().setScale(NaN);
      expect(Number.isNaN(appStore.getState().params.scale)).toBe(true);

      appStore.getState().setScale(Infinity);
      expect(appStore.getState().params.scale).toBe(Infinity);
    });

    it("empirically checks canvasSize setter with negative and huge numbers", () => {
      appStore.getState().setCanvasSize(-100);
      expect(appStore.getState().canvasSize).toBe(-100);

      appStore.getState().setCanvasSize(NaN);
      expect(Number.isNaN(appStore.getState().canvasSize)).toBe(true);

      appStore.getState().setCanvasSize(50000);
      expect(appStore.getState().canvasSize).toBe(50000);
    });

    it("verifies volume setter has explicit boundary clamping in store", () => {
      appStore.getState().setVolume(-0.5);
      expect(appStore.getState().volume).toBe(0.0);

      appStore.getState().setVolume(1.8);
      expect(appStore.getState().volume).toBe(1.0);

      appStore.getState().setVolume(0.5);
      expect(appStore.getState().volume).toBe(0.5);
    });

    it("evaluates downstream ballistics stability when NaN smoothness is provided", () => {
      const follower = new DualPoleFollower({
        attackTime1: 0.0025,
        attackTime2: 0.0035,
        decayTime1: 0.13,
        decayTime2: 0.07,
      });

      follower.updateParams({ smoothness: NaN, resetSpeed: 0.85 });
      const out = follower.step(1.0, 1 / 60);
      // Empirical verification: when smoothness is NaN, time constants effAtt become NaN and output is NaN
      expect(Number.isNaN(out)).toBe(true);
    });

    it("evaluates downstream ballistics stability when NaN sensitivity is applied", () => {
      const bank = new MultiBandFollowerBank();
      bank.updateParams({ sensitivity: NaN, smoothness: 0.9, resetSpeed: 0.85 });

      const out = bank.step({ low: 0.5, mid: 0.5, high: 0.5, amplitude: 0.5 }, 1 / 60);
      // When sensitivity is NaN, input scaled by NaN becomes NaN, which follower sanitizes to 0.0
      expect(Number.isNaN(out.amplitude)).toBe(false);
      expect(out.amplitude).toBe(0.0);
    });

    it("verifies UI rendering safety when params contain NaN or Infinity", () => {
      appStore.getState().setSensitivity(NaN);
      const params = appStore.getState().params;
      
      // In PhysicsPanel.tsx: Number(params.sensitivity).toFixed(2)
      const formattedSensitivity = Number(params.sensitivity).toFixed(2);
      expect(formattedSensitivity).toBe("NaN");

      appStore.getState().setGlowIntensity(Infinity);
      const formattedGlow = Number(appStore.getState().params.glowIntensity).toFixed(1);
      expect(formattedGlow).toBe("Infinity");
    });
  });
});
