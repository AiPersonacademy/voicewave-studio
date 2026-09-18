/**
 * src/data/defaultPresets.ts
 *
 * 14 Curated Factory Presets for VoiceWave Studio.
 * Spans Apple, AI, Broadcast, Minimal, Cyber, and Ambient categories.
 * Conforms strictly to validatePresetSchema() in src/types/presets.ts.
 */

import type { VuiPreset } from "@/types/presets";

export const DEFAULT_PRESETS: VuiPreset[] = [
  // =========================================================================
  // 1. APPLE CATEGORY
  // =========================================================================
  {
    id: "ios18-siri-default",
    name: "Siri Chromatic Flow",
    category: "apple",
    description: "Cupertino iOS 18 ribbon with organic frequency dispersion and Gaussian envelopes.",
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
      palette: "cupertino-siri",
    },
  },
  {
    id: "apple-music-soundbars",
    name: "Apple Music Soundbars",
    category: "apple",
    description: "24 logarithmic neomorphic pill bars governed by 2nd-order underdamped spring physics.",
    archetype: "glass-soundbars",
    framing: "16:9",
    backgroundMode: "dark",
    params: {
      sensitivity: 1.2,
      smoothness: 0.88,
      resetSpeed: 0.90,
      turbulence: 0.6,
      glowIntensity: 1.0,
      scale: 1.0,
      palette: "sunset-horizon",
    },
  },
  {
    id: "ios-perimeter-halo",
    name: "iOS Perimeter Edge Glow",
    category: "apple",
    description: "Perimeter traveling wave breathing along rounded visionOS display boundary.",
    archetype: "perimeter-glow",
    framing: "9:16",
    backgroundMode: "glow",
    params: {
      sensitivity: 1.3,
      smoothness: 0.90,
      resetSpeed: 0.88,
      turbulence: 0.8,
      glowIntensity: 1.8,
      scale: 1.0,
      palette: "cupertino-siri",
    },
  },

  // =========================================================================
  // 2. AI CATEGORY
  // =========================================================================
  {
    id: "chatgpt-orb-luminescence",
    name: "ChatGPT Fluid Orb",
    category: "ai",
    description: "Raymarched 3D signed distance field sphere with 3-octave harmonic noise and Fresnel rim.",
    archetype: "chatgpt-orb",
    framing: "1:1",
    backgroundMode: "dark",
    params: {
      sensitivity: 1.5,
      smoothness: 0.94,
      resetSpeed: 0.82,
      turbulence: 1.2,
      glowIntensity: 1.4,
      scale: 1.0,
      palette: "openai-monochrome",
    },
  },
  {
    id: "gemini-live-coalescence",
    name: "Gemini Live Fluid Drops",
    category: "ai",
    description: "4-6 orbiting liquid droplets coalescing via polynomial smooth-minimum SDF with acoustic stretch.",
    archetype: "gemini-metaballs",
    framing: "1:1",
    backgroundMode: "checkerboard",
    params: {
      sensitivity: 1.3,
      smoothness: 0.91,
      resetSpeed: 0.86,
      turbulence: 1.0,
      glowIntensity: 1.0,
      scale: 1.0,
      palette: "gemini-live",
    },
  },
  {
    id: "chatgpt-voice-neon",
    name: "ChatGPT Electric Neon",
    category: "ai",
    description: "High-energy cyber-luminescent harmonic orb with reactive specular bloom.",
    archetype: "chatgpt-orb",
    framing: "1:1",
    backgroundMode: "glow",
    params: {
      sensitivity: 1.6,
      smoothness: 0.92,
      resetSpeed: 0.85,
      turbulence: 1.5,
      glowIntensity: 1.6,
      scale: 1.05,
      palette: "cyberpunk-ai",
    },
  },

  // =========================================================================
  // 3. BROADCAST CATEGORY
  // =========================================================================
  {
    id: "broadcast-alexa-radar",
    name: "Concentric Acoustic Radar",
    category: "broadcast",
    description: "Smart speaker acoustic shockwaves with directional multi-lobe beamforming modulation.",
    archetype: "concentric-rings",
    framing: "16:9",
    backgroundMode: "green-screen",
    params: {
      sensitivity: 1.1,
      smoothness: 0.86,
      resetSpeed: 0.92,
      turbulence: 0.5,
      glowIntensity: 1.5,
      scale: 1.0,
      palette: "cupertino-siri",
    },
  },
  {
    id: "broadcast-chroma-podium",
    name: "Chroma Soundbar Stage",
    category: "broadcast",
    description: "Broadcast-ready green screen soundbars optimized for news, podcasting, and keynotes.",
    archetype: "glass-soundbars",
    framing: "16:9",
    backgroundMode: "green-screen",
    params: {
      sensitivity: 1.3,
      smoothness: 0.89,
      resetSpeed: 0.90,
      turbulence: 0.7,
      glowIntensity: 1.1,
      scale: 1.0,
      palette: "gemini-live",
    },
  },

  // =========================================================================
  // 4. MINIMAL CATEGORY
  // =========================================================================
  {
    id: "editorial-monochrome-wave",
    name: "Architectural Mono Wave",
    category: "minimal",
    description: "Pure monochrome ribbon with whisper-quiet responsiveness and architectural restraint.",
    archetype: "apple-siri",
    framing: "1:1",
    backgroundMode: "dark",
    params: {
      sensitivity: 1.0,
      smoothness: 0.95,
      resetSpeed: 0.80,
      turbulence: 0.3,
      glowIntensity: 0.8,
      scale: 1.0,
      palette: "openai-monochrome",
    },
  },
  {
    id: "minimal-chladni-plate",
    name: "Minimalist Cymatics Plate",
    category: "minimal",
    description: "2,000 quantum dust particles forming Ernst Chladni nodal plate geometries in pure white.",
    archetype: "cymatics-particle",
    framing: "1:1",
    backgroundMode: "dark",
    params: {
      sensitivity: 1.2,
      smoothness: 0.90,
      resetSpeed: 0.85,
      turbulence: 0.8,
      glowIntensity: 1.0,
      scale: 1.0,
      palette: "openai-monochrome",
    },
  },

  // =========================================================================
  // 5. CYBER CATEGORY
  // =========================================================================
  {
    id: "cyberpunk-telemetry-hud",
    name: "Cyberpunk Tactical HUD",
    category: "cyber",
    description: "Polar telemetry HUD with circular oscilloscope waveform, reticle rings, and pulsing core.",
    archetype: "scifi-hud",
    framing: "16:9",
    backgroundMode: "dark",
    params: {
      sensitivity: 1.5,
      smoothness: 0.87,
      resetSpeed: 0.93,
      turbulence: 1.4,
      glowIntensity: 1.8,
      scale: 1.0,
      palette: "cyberpunk-ai",
    },
  },
  {
    id: "matrix-edge-breach",
    name: "Neon Perimeter Breach",
    category: "cyber",
    description: "High-contrast blue-screen perimeter traveling wave with intense corner chromatic bloom.",
    archetype: "perimeter-glow",
    framing: "9:16",
    backgroundMode: "blue-screen",
    params: {
      sensitivity: 1.4,
      smoothness: 0.89,
      resetSpeed: 0.90,
      turbulence: 1.1,
      glowIntensity: 2.0,
      scale: 1.0,
      palette: "cyberpunk-ai",
    },
  },

  // =========================================================================
  // 6. AMBIENT CATEGORY
  // =========================================================================
  {
    id: "aurora-cymatics-zen",
    name: "Aurora Borealis Cymatics",
    category: "ambient",
    description: "Glacial emerald and violet Chladni particle waves tuned for meditation and ambient audio.",
    archetype: "cymatics-particle",
    framing: "1:1",
    backgroundMode: "glow",
    params: {
      sensitivity: 1.3,
      smoothness: 0.93,
      resetSpeed: 0.84,
      turbulence: 1.0,
      glowIntensity: 1.3,
      scale: 1.0,
      palette: "aurora-borealis",
    },
  },
  {
    id: "sunset-acoustic-shockwave",
    name: "Sunset Shockwave Echo",
    category: "ambient",
    description: "Warm sunset radial pulses with smooth decay envelopes over ambient neon twilight.",
    archetype: "concentric-rings",
    framing: "1:1",
    backgroundMode: "glow",
    params: {
      sensitivity: 1.4,
      smoothness: 0.90,
      resetSpeed: 0.86,
      turbulence: 0.9,
      glowIntensity: 1.5,
      scale: 1.0,
      palette: "sunset-horizon",
    },
  },
];
