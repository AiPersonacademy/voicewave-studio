/**
 * src/visualizers/registry.ts
 *
 * Central registry for all 8 Voice User Interface (VUI) Visual Archetypes.
 * Enables dynamic discovery, metadata inspection, and renderer factory instantiation.
 * Conforms to PROJECT.md §Interface Contracts.
 */

import type {
  CanonicalArchetypeId,
  ArchetypeId,
  ArchetypeMetadata,
  VisualizerRenderer,
} from "./types";

import { SiriWaveRenderer } from "./archetypes/SiriWaveRenderer";
import { ChatGptOrbRenderer } from "./archetypes/ChatGptOrbRenderer";
import { GeminiMetaballsRenderer } from "./archetypes/GeminiMetaballsRenderer";
import { ConcentricRingsRenderer } from "./archetypes/ConcentricRingsRenderer";
import { CymaticsParticleRenderer } from "./archetypes/CymaticsParticleRenderer";
import { GlassSoundbarsRenderer } from "./archetypes/GlassSoundbarsRenderer";
import { SciFiHudRenderer } from "./archetypes/SciFiHudRenderer";
import { PerimeterGlowRenderer } from "./archetypes/PerimeterGlowRenderer";

export type RendererFactory = () => VisualizerRenderer;

export const ARCHETYPE_METADATA: Record<CanonicalArchetypeId, ArchetypeMetadata> = {
  "apple-siri": {
    id: "apple-siri",
    name: "Apple Siri Chromatic Wave",
    subtitle: "iOS 18 Multi-Frequency Dispersive Ribbon",
    description: "4 chromatic sub-ribbons evaluated with longitudinal Gaussian envelopes and multi-spectral dispersion.",
    category: "apple",
    substrate: "webgl",
    defaultPalette: "cupertino-siri",
    recommendedScale: 1.0,
    recommendedTurbulence: 1.0,
    recommendedGlow: 1.2,
    tags: ["apple", "siri", "wave", "ribbon", "chromatic"],
  },
  "chatgpt-orb": {
    id: "chatgpt-orb",
    name: "ChatGPT Fluid 3D Voice Orb",
    subtitle: "Organic Raymarched Harmonic Sphere",
    description: "Raymarched 3D signed distance field sphere perturbed by 3-octave harmonic simplex noise with Fresnel rim lighting.",
    category: "ai",
    substrate: "webgl",
    defaultPalette: "openai-monochrome",
    recommendedScale: 1.0,
    recommendedTurbulence: 1.2,
    recommendedGlow: 1.4,
    tags: ["chatgpt", "openai", "orb", "sphere", "3d", "raymarching"],
  },
  "gemini-metaballs": {
    id: "gemini-metaballs",
    name: "Gemini Live Fluid Metaballs",
    subtitle: "Orbiting Liquid Droplet Coalescence",
    description: "4 to 6 chromatic drops orbiting and coalescing via polynomial smooth-minimum SDF with acoustic velocity stretching.",
    category: "ai",
    substrate: "webgl",
    defaultPalette: "gemini-live",
    recommendedScale: 1.0,
    recommendedTurbulence: 1.0,
    recommendedGlow: 1.0,
    tags: ["gemini", "google", "metaballs", "fluid", "droplets"],
  },
  "concentric-rings": {
    id: "concentric-rings",
    name: "Concentric Acoustic Rings",
    subtitle: "Smart Speaker Radar & Acoustic Pulses",
    description: "Continuous radial acoustic shockwaves with multi-lobe angular beamforming modulation.",
    category: "system",
    substrate: "webgl",
    defaultPalette: "cupertino-siri",
    recommendedScale: 1.0,
    recommendedTurbulence: 0.8,
    recommendedGlow: 1.5,
    tags: ["radar", "rings", "pulses", "alexa", "acoustic"],
  },
  "cymatics-particle": {
    id: "cymatics-particle",
    name: "Acoustic Particle Cymatics",
    subtitle: "2,000+ Quantum Dust Standing Waves",
    description: "Ernst Chladni nodal plate standing wave simulation driving 2,000+ particles via acoustic potential gradients.",
    category: "physics",
    substrate: "webgl",
    defaultPalette: "aurora-borealis",
    recommendedScale: 1.0,
    recommendedTurbulence: 1.1,
    recommendedGlow: 1.2,
    tags: ["cymatics", "particles", "chladni", "physics", "quantum"],
  },
  "glass-soundbars": {
    id: "glass-soundbars",
    name: "Neomorphic Glass Soundbars",
    subtitle: "Apple Music Pill Bars with Spring Physics",
    description: "24-32 logarithmic frequency pill bars governed by 2nd-order underdamped spring-damper equations (zeta=0.72).",
    category: "apple",
    substrate: "webgl",
    defaultPalette: "sunset-horizon",
    recommendedScale: 1.0,
    recommendedTurbulence: 0.7,
    recommendedGlow: 1.0,
    tags: ["soundbars", "equalizer", "springs", "apple-music", "glass"],
  },
  "scifi-hud": {
    id: "scifi-hud",
    name: "Cyberpunk AI Core / Sci-Fi HUD",
    subtitle: "Polar Reticle Rings & Oscilloscope",
    description: "Multi-layered polar telemetry HUD with segmented reticle rings, circular oscilloscope waveform, and pulsing regular hexagonal core.",
    category: "sci-fi",
    substrate: "webgl",
    defaultPalette: "cyberpunk-ai",
    recommendedScale: 1.0,
    recommendedTurbulence: 1.3,
    recommendedGlow: 1.6,
    tags: ["cyberpunk", "hud", "reticle", "oscilloscope", "sci-fi"],
  },
  "perimeter-glow": {
    id: "perimeter-glow",
    name: "iOS Perimeter Edge Glow",
    subtitle: "Rounded-Box SDF Border Breathing",
    description: "Perimeter arc-length chromatic traveling waves with inward Gaussian bloom and corner lens flare amplifiers.",
    category: "apple",
    substrate: "webgl",
    defaultPalette: "cupertino-siri",
    recommendedScale: 1.0,
    recommendedTurbulence: 0.9,
    recommendedGlow: 1.8,
    tags: ["perimeter", "glow", "border", "ios18", "edge"],
  },
};

/**
 * Normalizes any archetype string or alias into its canonical ArchetypeId.
 */
export function normalizeArchetypeId(id: string): CanonicalArchetypeId {
  const clean = id.trim().toLowerCase();
  switch (clean) {
    case "apple-siri":
    case "siri-wave":
    case "siri":
    case "wave":
    case "ios siri wave":
    case "siri chromatic wave":
      return "apple-siri";

    case "chatgpt-orb":
    case "chatgpt":
    case "orb":
    case "voice orb":
    case "fluid orb":
    case "chatgpt fluid 3d voice orb":
      return "chatgpt-orb";

    case "gemini-metaballs":
    case "gemini":
    case "metaballs":
    case "fluid-dots":
    case "fluid dots":
    case "fluid dots (metaballs)":
    case "gemini live fluid metaballs":
      return "gemini-metaballs";

    case "concentric-rings":
    case "rings":
    case "radar":
    case "acoustic radar":
    case "concentric acoustic rings":
      return "concentric-rings";

    case "cymatics-particle":
    case "cymatics-particles":
    case "cymatics":
    case "particle waves":
    case "acoustic particle cymatics":
      return "cymatics-particle";

    case "glass-soundbars":
    case "soundbars":
    case "bars":
    case "neomorphic glass soundbars":
      return "glass-soundbars";

    case "scifi-hud":
    case "scifi":
    case "hud":
    case "cyberpunk ai core":
    case "cyberpunk ai core / sci-fi hud":
      return "scifi-hud";

    case "perimeter-glow":
    case "perimeter":
    case "edge glow":
    case "ios perimeter edge glow":
      return "perimeter-glow";

    default:
      return "apple-siri";
  }
}

export class ArchetypeRegistry {
  private factories = new Map<CanonicalArchetypeId, RendererFactory>();

  constructor() {
    // Auto-register the 8 standard factory renderers
    this.register("apple-siri", () => new SiriWaveRenderer());
    this.register("chatgpt-orb", () => new ChatGptOrbRenderer());
    this.register("gemini-metaballs", () => new GeminiMetaballsRenderer());
    this.register("concentric-rings", () => new ConcentricRingsRenderer());
    this.register("cymatics-particle", () => new CymaticsParticleRenderer());
    this.register("glass-soundbars", () => new GlassSoundbarsRenderer());
    this.register("scifi-hud", () => new SciFiHudRenderer());
    this.register("perimeter-glow", () => new PerimeterGlowRenderer());
  }

  public register(id: ArchetypeId, factory: RendererFactory): void {
    const canonical = normalizeArchetypeId(id);
    this.factories.set(canonical, factory);
  }

  public has(id: string): boolean {
    const canonical = normalizeArchetypeId(id);
    return this.factories.has(canonical);
  }

  public getMetadata(id: string): ArchetypeMetadata {
    const canonical = normalizeArchetypeId(id);
    const meta = ARCHETYPE_METADATA[canonical];
    if (!meta) {
      throw new Error(`Unknown archetype ID: "${id}".`);
    }
    return meta;
  }

  public getAllMetadata(): ArchetypeMetadata[] {
    return Object.values(ARCHETYPE_METADATA);
  }

  public createRenderer(id: string): VisualizerRenderer {
    const canonical = normalizeArchetypeId(id);
    const factory = this.factories.get(canonical);
    if (!factory) {
      throw new Error(
        `Renderer factory for archetype "${id}" (canonical: "${canonical}") is not registered.`
      );
    }
    return factory();
  }
}

export const registry = new ArchetypeRegistry();
