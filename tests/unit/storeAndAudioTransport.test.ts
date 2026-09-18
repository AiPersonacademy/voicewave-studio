/**
 * tests/unit/storeAndAudioTransport.test.ts
 *
 * Comprehensive Unit Test Suite for useAppStore, AudioController, and Preset Serialization.
 * Validates store state transitions, custom preset saving/loading, LocalStorage persistence,
 * JSON export/import, and AudioController Web Audio operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appStore, CUSTOM_PRESETS_STORAGE_KEY } from "@/store/useAppStore";
import { AudioController, audioController } from "@/audio/AudioController";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";
import { type VuiPreset } from "@/types/presets";

// Mock Audio Infrastructure
class MockAudioNode {
  public connections: MockAudioNode[] = [];
  public disconnected = false;

  connect(dest: MockAudioNode) {
    this.connections.push(dest);
    this.disconnected = false;
    return dest;
  }

  disconnect() {
    this.connections = [];
    this.disconnected = true;
  }
}

class MockGainNode extends MockAudioNode {
  public gain = {
    value: 1.0,
    setValueAtTime: vi.fn(),
  };
}

class MockBiquadFilterNode extends MockAudioNode {
  public type = "lowpass";
  public frequency = { value: 280 };
  public Q = { value: 0.707 };
}

class MockAnalyserNode extends MockAudioNode {
  public fftSize = 512;
  public smoothingTimeConstant = 0.0;
  public frequencyBinCount = 256;

  getFloatTimeDomainData(arr: Float32Array) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = 0.1 * Math.sin((i / arr.length) * 2 * Math.PI);
    }
  }

  getByteFrequencyData(arr: Uint8Array) {
    arr.fill(128);
  }
}

class MockMediaStreamAudioDestinationNode extends MockAudioNode {
  public stream = {} as MediaStream;
}

class MockAudioContext {
  public state: "suspended" | "running" | "closed" = "suspended";
  public sampleRate = 48000;
  public currentTime = 0;
  public destination = new MockAudioNode();
  public createdNodes: MockAudioNode[] = [];

  createGain() {
    const g = new MockGainNode();
    this.createdNodes.push(g);
    return g as unknown as GainNode;
  }

  createBiquadFilter() {
    const b = new MockBiquadFilterNode();
    this.createdNodes.push(b);
    return b as unknown as BiquadFilterNode;
  }

  createAnalyser() {
    const a = new MockAnalyserNode();
    this.createdNodes.push(a);
    return a as unknown as AnalyserNode;
  }

  createMediaStreamDestination() {
    const m = new MockMediaStreamAudioDestinationNode();
    this.createdNodes.push(m);
    return m as unknown as MediaStreamAudioDestinationNode;
  }

  createMediaElementSource(_el: unknown) {
    const s = new MockAudioNode();
    this.createdNodes.push(s);
    return s as unknown as MediaElementAudioSourceNode;
  }

  createMediaStreamSource(_stream: unknown) {
    const s = new MockAudioNode();
    this.createdNodes.push(s);
    return s as unknown as MediaStreamAudioSourceNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const channelData = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (ch: number) => channelData[ch],
      copyToChannel: (src: Float32Array, ch: number) => {
        channelData[ch].set(src);
      },
    };
  }

  async decodeAudioData(_arrayBuf: ArrayBuffer) {
    return this.createBuffer(1, 48000, 48000);
  }

  async resume() {
    this.state = "running";
  }

  async close() {
    this.state = "closed";
  }
}

class MockAudio {
  public src = "";
  public volume = 1.0;
  public loop = false;
  public currentTime = 0;
  public duration = 4.8;
  public crossOrigin = "";
  public paused = true;
  private listeners: Record<string, Array<() => void>> = {};

  addEventListener(ev: string, fn: () => void) {
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);
  }

  removeEventListener(ev: string, fn: () => void) {
    this.listeners[ev] = (this.listeners[ev] || []).filter((l) => l !== fn);
  }

  async play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }
}

describe("Central AppStore State Transitions & Presets", () => {
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
    });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:http://localhost/test"),
      revokeObjectURL: vi.fn(),
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

  describe("1. State Transitions & Parameter Tuning", () => {
    it("initializes with default archetype and framing", () => {
      const state = appStore.getState();
      expect(state.archetype).toBe("apple-siri");
      expect(state.framing).toBe("1:1");
      expect(state.backgroundMode).toBe("checkerboard");
      expect(state.params.sensitivity).toBe(1.4);
      expect(state.params.smoothness).toBe(0.92);
      expect(state.params.resetSpeed).toBe(0.85);
      expect(state.isDirty).toBe(false);
    });

    it("transitions archetype and sets dirty flag", () => {
      appStore.getState().setArchetype("chatgpt-orb");
      expect(appStore.getState().archetype).toBe("chatgpt-orb");
      expect(appStore.getState().isDirty).toBe(true);

      appStore.getState().setArchetype("gemini-metaballs");
      expect(appStore.getState().archetype).toBe("gemini-metaballs");
    });

    it("transitions framing mode between 1:1, 16:9, and 9:16", () => {
      appStore.getState().setFraming("16:9");
      expect(appStore.getState().framing).toBe("16:9");

      appStore.getState().setFraming("9:16");
      expect(appStore.getState().framing).toBe("9:16");

      appStore.getState().setFraming("1:1");
      expect(appStore.getState().framing).toBe("1:1");
    });

    it("transitions background modes across all 5 production backdrops", () => {
      const modes = ["dark", "glow", "green-screen", "blue-screen", "checkerboard"] as const;
      for (const mode of modes) {
        appStore.getState().setBackgroundMode(mode);
        expect(appStore.getState().backgroundMode).toBe(mode);
      }
    });

    it("updates individual physics and optics parameters", () => {
      appStore.getState().setSensitivity(2.4);
      expect(appStore.getState().params.sensitivity).toBe(2.4);

      appStore.getState().setSmoothness(0.96);
      expect(appStore.getState().params.smoothness).toBe(0.96);

      appStore.getState().setResetSpeed(0.72);
      expect(appStore.getState().params.resetSpeed).toBe(0.72);

      appStore.getState().setTurbulence(1.8);
      expect(appStore.getState().params.turbulence).toBe(1.8);

      appStore.getState().setGlowIntensity(2.5);
      expect(appStore.getState().params.glowIntensity).toBe(2.5);

      appStore.getState().setScale(1.25);
      expect(appStore.getState().params.scale).toBe(1.25);

      appStore.getState().setCanvasSize(560);
      expect(appStore.getState().canvasSize).toBe(560);

      appStore.getState().setRenderScale(1.5);
      expect(appStore.getState().renderScale).toBe(1.5);
    });

    it("resets modified parameters back to preset defaults", () => {
      appStore.getState().applyPreset(DEFAULT_PRESETS[0]);
      appStore.getState().setSensitivity(3.0);
      appStore.getState().setTurbulence(2.5);
      expect(appStore.getState().isDirty).toBe(true);

      appStore.getState().resetParams();
      expect(appStore.getState().params.sensitivity).toBe(DEFAULT_PRESETS[0].params.sensitivity);
      expect(appStore.getState().params.turbulence).toBe(DEFAULT_PRESETS[0].params.turbulence);
      expect(appStore.getState().isDirty).toBe(false);
    });
  });

  describe("2. Custom Preset Management & LocalStorage Persistence", () => {
    it("saves current settings as custom preset and persists to LocalStorage", () => {
      appStore.getState().setArchetype("scifi-hud");
      appStore.getState().setFraming("16:9");
      appStore.getState().setBackgroundMode("dark");
      appStore.getState().setSensitivity(1.9);

      const saved = appStore.getState().saveCustomPreset("Tactical Cyber 4K", "Studio production profile");
      expect(saved.id).toMatch(/^custom-/);
      expect(saved.name).toBe("Tactical Cyber 4K");
      expect(saved.category).toBe("custom");
      expect(saved.archetype).toBe("scifi-hud");
      expect(saved.framing).toBe("16:9");
      expect(saved.backgroundMode).toBe("dark");
      expect(saved.params.sensitivity).toBe(1.9);
      expect(saved.isCustom).toBe(true);

      // Verify state was updated
      expect(appStore.getState().customPresets).toContainEqual(saved);
      expect(appStore.getState().activePresetId).toBe(saved.id);

      // Verify LocalStorage received serialized preset
      const rawStored = storageState[CUSTOM_PRESETS_STORAGE_KEY];
      expect(rawStored).toBeDefined();
      const parsedStored = JSON.parse(rawStored);
      expect(parsedStored).toHaveLength(1);
      expect(parsedStored[0].name).toBe("Tactical Cyber 4K");
    });

    it("deletes custom preset and updates LocalStorage", () => {
      const p1 = appStore.getState().saveCustomPreset("Preset To Delete");
      expect(appStore.getState().customPresets).toHaveLength(1);

      appStore.getState().deleteCustomPreset(p1.id);
      expect(appStore.getState().customPresets).toHaveLength(0);

      const parsedStored = JSON.parse(storageState[CUSTOM_PRESETS_STORAGE_KEY] || "[]");
      expect(parsedStored).toHaveLength(0);
    });

    it("applies a custom preset and configures all visualizer states", () => {
      const custom: VuiPreset = {
        id: "custom-special-1",
        name: "Special Ambient",
        category: "custom",
        description: "Custom test",
        archetype: "cymatics-particle",
        framing: "9:16",
        backgroundMode: "glow",
        params: {
          sensitivity: 2.1,
          smoothness: 0.94,
          resetSpeed: 0.82,
          turbulence: 1.6,
          glowIntensity: 2.2,
          scale: 1.1,
          palette: "aurora-borealis",
        },
        isCustom: true,
      };

      appStore.getState().applyPreset(custom);

      const state = appStore.getState();
      expect(state.archetype).toBe("cymatics-particle");
      expect(state.framing).toBe("9:16");
      expect(state.backgroundMode).toBe("glow");
      expect(state.palette).toBe("aurora-borealis");
      expect(state.params.sensitivity).toBe(2.1);
      expect(state.params.glowIntensity).toBe(2.2);
      expect(state.activePresetId).toBe("custom-special-1");
      expect(state.isDirty).toBe(false);
    });
  });

  describe("3. JSON Serialization & Import/Export", () => {
    it("exports presets as clean valid JSON string", () => {
      const json = appStore.getState().exportCustomPresetsJson();
      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(14);
    });

    it("imports valid custom presets from JSON string", () => {
      const externalPresets = [
        {
          id: "imported-1",
          name: "External Preset 1",
          category: "custom",
          description: "From external source",
          archetype: "glass-soundbars",
          framing: "16:9",
          backgroundMode: "green-screen",
          params: {
            sensitivity: 1.5,
            smoothness: 0.9,
            resetSpeed: 0.85,
            turbulence: 0.5,
            glowIntensity: 1.0,
            scale: 1.0,
            palette: "sunset-horizon",
          },
        },
      ];

      const res = appStore.getState().importCustomPresets(JSON.stringify(externalPresets));
      expect(res.imported).toBe(1);
      expect(res.errors).toHaveLength(0);

      const customPresets = appStore.getState().customPresets;
      const found = customPresets.find((p) => p.name === "External Preset 1");
      expect(found).toBeDefined();
      expect(found?.archetype).toBe("glass-soundbars");
    });

    it("safely catches and reports malformed JSON without crashing", () => {
      const res = appStore.getState().importCustomPresets("{ invalid json :::");
      expect(res.imported).toBe(0);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    it("rejects invalid preset objects missing required fields", () => {
      const invalidPresets = [
        {
          name: "Broken Preset",
          archetype: "non-existent-shape",
          params: {},
        },
      ];

      const res = appStore.getState().importCustomPresets(JSON.stringify(invalidPresets));
      expect(res.imported).toBe(0);
      expect(res.errors.length).toBeGreaterThan(0);
    });
  });

  describe("4. Audio Transport & AudioController Dispatch", () => {
    it("maintains AudioController singleton identity", () => {
      const c1 = AudioController.getInstance();
      const c2 = AudioController.getInstance();
      expect(c1).toBe(c2);
      expect(c1).toBe(audioController);
    });

    it("modifies volume with clamping", () => {
      appStore.getState().setVolume(0.65);
      expect(appStore.getState().volume).toBe(0.65);
      expect(audioController.getVolume()).toBe(0.65);

      // Clamp overflow
      appStore.getState().setVolume(1.5);
      expect(appStore.getState().volume).toBe(1.0);
      expect(audioController.getVolume()).toBe(1.0);

      // Clamp negative
      appStore.getState().setVolume(-0.2);
      expect(appStore.getState().volume).toBe(0);
      expect(audioController.getVolume()).toBe(0);
    });

    it("toggles mute on and off preserving previous volume", () => {
      appStore.getState().setVolume(0.8);
      appStore.getState().toggleMute();
      expect(appStore.getState().isMuted).toBe(true);
      expect(audioController.getVolume()).toBe(0);

      appStore.getState().toggleMute();
      expect(appStore.getState().isMuted).toBe(false);
      expect(appStore.getState().volume).toBe(0.8);
      expect(audioController.getVolume()).toBe(0.8);
    });

    it("toggles looping mode on audio controller and store", () => {
      expect(appStore.getState().isLooping).toBe(false);
      appStore.getState().toggleLooping();
      expect(appStore.getState().isLooping).toBe(true);
      expect(audioController.getIsLooping()).toBe(true);

      appStore.getState().setLooping(false);
      expect(appStore.getState().isLooping).toBe(false);
      expect(audioController.getIsLooping()).toBe(false);
    });

    it("loads synthetic voice and updates store audio source", async () => {
      await appStore.getState().loadSampleVoice("cupertino-siri");
      const state = appStore.getState();
      expect(state.audioSource.type).toBe("synthetic");
      expect(state.audioSource.voiceId).toBe("cupertino-siri");
      expect(state.audioSource.name).toBe("Cupertino Siri");
      expect(state.duration).toBeGreaterThan(4.0);
      expect(state.currentTime).toBe(0);

      const buffer = audioController.getAudioBuffer();
      expect(buffer).not.toBeNull();
      expect(buffer?.numberOfChannels).toBe(1);
      expect(buffer?.duration).toBeGreaterThan(4.0);
    });

    it("samples audio frame returning raw, smoothed, and 16 preview bars", () => {
      const frame = audioController.sampleFrame();
      expect(frame).toBeDefined();
      expect(frame.raw).toBeDefined();
      expect(frame.smoothed).toBeDefined();
      expect(frame.previewBars).toBeInstanceOf(Float32Array);
      expect(frame.previewBars.length).toBe(16);
    });

    it("updates liveAudioDataRef synchronously on sampleFrame()", () => {
      expect(audioController.liveAudioDataRef).toBeDefined();
      expect(audioController.liveAudioDataRef.current).toBeDefined();

      const frame = audioController.sampleFrame(1 / 60);
      const live = audioController.liveAudioDataRef.current;
      expect(live.low).toBe(frame.smoothed.low);
      expect(live.mid).toBe(frame.smoothed.mid);
      expect(live.high).toBe(frame.smoothed.high);
      expect(live.amplitude).toBe(frame.smoothed.amplitude);
    });

    it("propagates onBandEnergyUpdate callback to appStore frequencyData", () => {
      const callbacks = (audioController as any).callbacks;
      expect(callbacks).toBeDefined();
      expect(callbacks.onBandEnergyUpdate).toBeDefined();

      // Dispatch simulated energy
      callbacks.onBandEnergyUpdate({
        low: 0.72,
        mid: 0.54,
        high: 0.31,
        amplitude: 0.65,
      });

      const freq = appStore.getState().frequencyData;
      expect(freq.low).toBe(0.72);
      expect(freq.mid).toBe(0.54);
      expect(freq.high).toBe(0.31);
      expect(freq.amplitude).toBe(0.65);
    });

    it("exposes exporter helper methods: getAudioBuffer, getAudioStream, getAudioContext", () => {
      expect(typeof audioController.getAudioBuffer).toBe("function");
      expect(typeof audioController.getAudioStream).toBe("function");
      expect(typeof audioController.getAudioContext).toBe("function");

      const stream = audioController.getAudioStream();
      expect(stream === null || typeof stream === "object").toBe(true);

      const ctx = audioController.getAudioContext();
      expect(ctx === null || typeof ctx === "object").toBe(true);
    });
  });
});
