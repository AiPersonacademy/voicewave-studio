/**
 * src/store/useAppStore.ts
 *
 * Central reactive application store for VoiceWave Studio using React 19's useSyncExternalStore.
 * Zero-dependency, thread-safe, fully typed with LocalStorage persistence and audio controller bridge.
 */

import { useSyncExternalStore } from "react";
import type { CanonicalArchetypeId, PaletteId } from "@/visualizers/types";
import { normalizeArchetypeId } from "@/visualizers/registry";
import type {
  VuiPreset,
  PresetFraming,
  PresetBackgroundMode,
  PresetParams,
} from "@/types/presets";
import { validatePresetSchema } from "@/types/presets";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";
import { audioController } from "@/audio/AudioController";

export const CUSTOM_PRESETS_STORAGE_KEY = "voicewave_custom_presets";

export interface AudioSourceInfo {
  type: "synthetic" | "file" | "mic";
  voiceId: string;
  name: string;
  url: string | null;
  duration: number;
}

export interface AppState {
  // Visualizer / Archetype
  archetype: CanonicalArchetypeId;
  palette: PaletteId;
  framing: PresetFraming;
  backgroundMode: PresetBackgroundMode;

  // Parameters
  params: PresetParams;
  canvasSize: number;
  renderScale: number;

  // Preset State
  activePresetId: string | null;
  customPresets: VuiPreset[];
  isPresetModalOpen: boolean;
  isDirty: boolean;

  // Audio Transport State
  audioSource: AudioSourceInfo;
  isPlaying: boolean;
  isMicActive: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  micError: string | null;
  frequencyBars: number[];
  frequencyData: {
    low: number;
    mid: number;
    high: number;
    amplitude: number;
  };

  // Actions
  setArchetype: (archetype: string) => void;
  setPalette: (palette: string) => void;
  setFraming: (framing: PresetFraming) => void;
  setBackgroundMode: (bg: PresetBackgroundMode) => void;
  updateParams: (params: Partial<PresetParams>) => void;
  resetParams: () => void;
  setSensitivity: (s: number) => void;
  setSmoothness: (sm: number) => void;
  setResetSpeed: (rs: number) => void;
  setTurbulence: (t: number) => void;
  setGlowIntensity: (g: number) => void;
  setScale: (sc: number) => void;
  setCanvasSize: (size: number) => void;
  setRenderScale: (scale: number) => void;

  // Preset CRUD & Import/Export
  applyPreset: (preset: VuiPreset) => void;
  saveCustomPreset: (name: string, description?: string) => VuiPreset;
  deleteCustomPreset: (id: string) => void;
  importCustomPresets: (jsonString: string) => { imported: number; errors: string[] };
  exportCustomPresets: () => void;
  exportCustomPresetsJson: () => string;
  setIsPresetModalOpen: (open: boolean) => void;

  // Audio Actions
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setLooping: (loop: boolean) => void;
  toggleLooping: () => void;
  loadSampleVoice: (voiceId: string) => Promise<void>;
  loadAudioFile: (file: File) => Promise<void>;
  toggleMic: () => Promise<void>;
}

function loadCustomPresetsFromStorage(): VuiPreset[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => validatePresetSchema(p).valid);
  } catch {
    return [];
  }
}

function saveCustomPresetsToStorage(presets: VuiPreset[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("Failed to write presets to LocalStorage:", err);
  }
}

type Listener = () => void;

class AppStoreEngine {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor() {
    const defaultPreset = DEFAULT_PRESETS[0];

    this.state = {
      archetype: (defaultPreset.archetype as CanonicalArchetypeId) || "apple-siri",
      palette: (defaultPreset.params.palette as PaletteId) || "cupertino-siri",
      framing: defaultPreset.framing,
      backgroundMode: defaultPreset.backgroundMode,
      params: { ...defaultPreset.params },
      canvasSize: 420,
      renderScale: 1.0,

      activePresetId: defaultPreset.id,
      customPresets: loadCustomPresetsFromStorage(),
      isPresetModalOpen: false,
      isDirty: false,

      audioSource: {
        type: "synthetic",
        voiceId: "cupertino-siri",
        name: "Cupertino Siri",
        url: null,
        duration: 4.8,
      },
      isPlaying: false,
      isMicActive: false,
      isLooping: false,
      currentTime: 0,
      duration: 4.8,
      volume: 1.0,
      isMuted: false,
      micError: null,
      frequencyBars: new Array(16).fill(0),
      frequencyData: {
        low: 0,
        mid: 0,
        high: 0,
        amplitude: 0,
      },

      setArchetype: (archetypeInput) => {
        const canonical = normalizeArchetypeId(archetypeInput);
        this.setState({
          archetype: canonical,
          isDirty: true,
        });
      },

      setPalette: (paletteInput) => {
        this.setState({
          palette: paletteInput as PaletteId,
          params: { ...this.state.params, palette: paletteInput },
          isDirty: true,
        });
      },

      setFraming: (framing) => {
        this.setState({ framing, isDirty: true });
      },

      setBackgroundMode: (bg) => {
        this.setState({ backgroundMode: bg, isDirty: true });
      },

      updateParams: (partial) => {
        const updated = { ...this.state.params, ...partial };
        if (partial.palette) {
          this.setState({ params: updated, palette: partial.palette as PaletteId, isDirty: true });
        } else {
          this.setState({ params: updated, isDirty: true });
        }
        audioController.getAudioEngine()?.updateDynamics({
          sensitivity: updated.sensitivity,
          smoothness: updated.smoothness,
          resetSpeed: updated.resetSpeed,
        });
      },

      resetParams: () => {
        const preset =
          DEFAULT_PRESETS.find((p) => p.id === this.state.activePresetId) ||
          this.state.customPresets.find((p) => p.id === this.state.activePresetId) ||
          DEFAULT_PRESETS[0];

        this.setState({
          params: { ...preset.params },
          palette: preset.params.palette as PaletteId,
          framing: preset.framing,
          backgroundMode: preset.backgroundMode,
          archetype: preset.archetype as CanonicalArchetypeId,
          isDirty: false,
        });

        audioController.getAudioEngine()?.updateDynamics({
          sensitivity: preset.params.sensitivity,
          smoothness: preset.params.smoothness,
          resetSpeed: preset.params.resetSpeed,
        });
      },

      setSensitivity: (s) => {
        this.state.updateParams({ sensitivity: s });
      },

      setSmoothness: (sm) => {
        this.state.updateParams({ smoothness: sm });
      },

      setResetSpeed: (rs) => {
        this.state.updateParams({ resetSpeed: rs });
      },

      setTurbulence: (t) => {
        this.state.updateParams({ turbulence: t });
      },

      setGlowIntensity: (g) => {
        this.state.updateParams({ glowIntensity: g });
      },

      setScale: (sc) => {
        this.state.updateParams({ scale: sc });
      },

      setCanvasSize: (size) => {
        this.setState({ canvasSize: size });
      },

      setRenderScale: (scale) => {
        this.setState({ renderScale: scale });
      },

      applyPreset: (preset) => {
        const canonical = normalizeArchetypeId(preset.archetype);
        this.setState({
          archetype: canonical,
          framing: preset.framing,
          backgroundMode: preset.backgroundMode,
          palette: preset.params.palette as PaletteId,
          params: { ...preset.params },
          activePresetId: preset.id,
          isDirty: false,
        });

        audioController.getAudioEngine()?.updateDynamics({
          sensitivity: preset.params.sensitivity,
          smoothness: preset.params.smoothness,
          resetSpeed: preset.params.resetSpeed,
        });
      },

      saveCustomPreset: (name, description = "Custom user preset") => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newPreset: VuiPreset = {
          id,
          name: name.trim() || "Untitled Custom Preset",
          category: "custom",
          description: description.trim() || "User-defined VoiceWave preset",
          archetype: this.state.archetype,
          framing: this.state.framing,
          backgroundMode: this.state.backgroundMode,
          params: {
            ...this.state.params,
            palette: this.state.palette,
          },
          createdAt: Date.now(),
          isCustom: true,
        };

        const updated = [newPreset, ...this.state.customPresets];
        saveCustomPresetsToStorage(updated);
        this.setState({
          customPresets: updated,
          activePresetId: id,
          isDirty: false,
        });
        return newPreset;
      },

      deleteCustomPreset: (id) => {
        const updated = this.state.customPresets.filter((p) => p.id !== id);
        saveCustomPresetsToStorage(updated);
        this.setState({
          customPresets: updated,
          activePresetId: this.state.activePresetId === id ? null : this.state.activePresetId,
        });
      },

      importCustomPresets: (jsonString) => {
        try {
          const parsed = JSON.parse(jsonString);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const validPresets: VuiPreset[] = [];
          const errors: string[] = [];

          list.forEach((item, idx) => {
            const validation = validatePresetSchema(item);
            if (validation.valid) {
              validPresets.push({
                ...item,
                id: item.id || `imported-${Date.now()}-${idx}`,
                category: "custom",
                isCustom: true,
              });
            } else {
              errors.push(
                `Preset #${idx + 1} (${item?.name || "unknown"}): ${validation.errors.join(", ")}`
              );
            }
          });

          if (validPresets.length > 0) {
            const existingIds = new Set(this.state.customPresets.map((p) => p.id));
            const merged = [
              ...validPresets.filter((p) => !existingIds.has(p.id)),
              ...this.state.customPresets,
            ];
            saveCustomPresetsToStorage(merged);
            this.setState({ customPresets: merged });
          }

          return { imported: validPresets.length, errors };
        } catch (err: unknown) {
          const e = err as Error;
          return { imported: 0, errors: [e?.message || "Malformed JSON file"] };
        }
      },

      exportCustomPresets: () => {
        const presetsToExport =
          this.state.customPresets.length > 0 ? this.state.customPresets : DEFAULT_PRESETS;
        const blob = new Blob([JSON.stringify(presetsToExport, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `voicewave-presets-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      exportCustomPresetsJson: () => {
        const presetsToExport =
          this.state.customPresets.length > 0 ? this.state.customPresets : DEFAULT_PRESETS;
        return JSON.stringify(presetsToExport, null, 2);
      },

      setIsPresetModalOpen: (open) => {
        this.setState({ isPresetModalOpen: open });
      },

      play: async () => {
        await audioController.play();
      },

      pause: () => {
        audioController.pause();
      },

      togglePlay: async () => {
        await audioController.togglePlay();
      },

      seek: (seconds) => {
        audioController.seek(seconds);
      },

      setVolume: (volume) => {
        const clamped = Math.max(0, Math.min(1, volume));
        audioController.setVolume(clamped);
        this.setState({ volume: clamped, isMuted: clamped === 0 });
      },

      toggleMute: () => {
        if (this.state.isMuted) {
          const prev = this.state.volume > 0 ? this.state.volume : 1.0;
          audioController.setVolume(prev);
          this.setState({ volume: prev, isMuted: false });
        } else {
          audioController.setVolume(0);
          this.setState({ isMuted: true });
        }
      },

      setLooping: (loop) => {
        audioController.setLooping(loop);
        this.setState({ isLooping: loop });
      },

      toggleLooping: () => {
        const next = !this.state.isLooping;
        audioController.setLooping(next);
        this.setState({ isLooping: next });
      },

      loadSampleVoice: async (voiceId) => {
        const result = await audioController.loadSyntheticVoice(voiceId);
        this.setState({
          audioSource: {
            type: "synthetic",
            voiceId,
            name: result.name,
            url: result.url,
            duration: result.duration,
          },
          currentTime: 0,
          duration: result.duration,
          isPlaying: false,
        });
      },

      loadAudioFile: async (file) => {
        const result = await audioController.loadAudioFile(file);
        this.setState({
          audioSource: {
            type: "file",
            voiceId: "uploaded-file",
            name: result.name,
            url: result.url,
            duration: result.duration,
          },
          currentTime: 0,
          duration: result.duration,
          isPlaying: false,
        });
      },

      toggleMic: async () => {
        const res = await audioController.toggleMicrophone();
        this.setState({
          isMicActive: res.isMicActive,
          micError: res.error || null,
          isPlaying: res.isMicActive ? false : this.state.isPlaying,
        });
      },
    };

    // Connect AudioController callbacks to reactive store
    audioController.setCallbacks({
      onTimeUpdate: (currentTime, duration) => {
        this.setState({
          currentTime,
          duration: duration || this.state.duration,
        });
      },
      onPlaybackStateChange: (isPlaying) => {
        this.setState({ isPlaying });
      },
      onMicStateChange: (isMicActive, error) => {
        this.setState({
          isMicActive,
          micError: error || null,
        });
      },
      onFrequencyBarsUpdate: (bars) => {
        this.setState({ frequencyBars: bars });
      },
      onBandEnergyUpdate: (energy) => {
        this.setState({
          frequencyData: {
            low: energy.low,
            mid: energy.mid,
            high: energy.high,
            amplitude: energy.amplitude,
          },
        });
      },
    });
  }

  public getState = (): AppState => this.state;

  public setState = (
    updater: Partial<AppState> | ((prev: AppState) => Partial<AppState>)
  ): void => {
    const partial = typeof updater === "function" ? updater(this.state) : updater;
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  };

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export const appStore = new AppStoreEngine();

/**
 * React 19 external store hook with selector support.
 */
export function useAppStore<T = AppState>(selector?: (state: AppState) => T): T {
  return useSyncExternalStore(
    appStore.subscribe,
    () => (selector ? selector(appStore.getState()) : (appStore.getState() as unknown as T)),
    () => (selector ? selector(appStore.getState()) : (appStore.getState() as unknown as T))
  );
}

// Attach Zustand-compatible static helpers to useAppStore
useAppStore.getState = appStore.getState;
useAppStore.setState = appStore.setState;
useAppStore.subscribe = appStore.subscribe;
