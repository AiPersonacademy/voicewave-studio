# Project: VoiceWave Studio

## Architecture
VoiceWave Studio is a commercial-grade Cupertino/visionOS SaaS web application for generating and exporting broadcast-ready, transparent Voice User Interface (VUI) animations synchronized to speech and audio with sample-accurate fidelity.

### Architectural Subsystems & Data Flow
1. **Audio Engine (`src/audio/`)**:
   - 3-band Biquad IIR Filter Bank: Lowpass (280 Hz), Bandpass (1,200 Hz, Q=1.2), Highpass (3,200 Hz).
   - Dual-Pole Liquid Follower: Fast attack (<10ms) and exponential decay ($C^1$ velocity continuous).
   - Deterministic Offline Frame Buffer: Sample-accurate audio precomputation for offline video generation.
2. **Visualizer & Shader Pipeline (`src/visualizers/`)**:
   - Universal WebGL/Canvas2D Host supporting all 8 VUI archetypes in 1:1, 16:9, and 9:16 aspect ratios.
   - True premultiplied alpha rendering eliminating black/white halo artifacts.
   - Standardized uniform schema (Reactivity, Smoothing, Turbulence, Glow, Scale, 4-Color Palettes).
3. **visionOS UI/UX & State Store (`src/app/`, `src/components/`, `src/store/`)**:
   - Spatial glass styling with hairline borders, specular highlights, and blur depth.
   - Stage Framing (1:1, 16:9, 9:16) and Background Modes (Checkerboard, Dark Studio, Ambient Glow, Green Chroma, Blue Chroma).
   - Preset System: 12+ factory presets, LocalStorage persistence, JSON file export/import.
   - Voice Library & Playback Transport with audio file upload and microphone input.
4. **Multi-Engine Export Pipeline (`src/export/`)**:
   - Apple ProRes 4444 (`.mov` with 12-bit `yuva444p10le` alpha) via local converter server / Vite middleware.
   - WebM VP9 Alpha (`.webm`) with WebCodecs (`alpha: "keep"`).
   - Transparent PNG Sequence (`.zip`) with synchronized PCM `audio.wav`.
   - Chroma Key MP4 (Green/Blue key background for standard players).
   - Real-time Cupertino progress modal with speed indicator and instant abort/cancel.
5. **Quality & Verification (`tests/`)**:
   - Playwright E2E test suite running headlessly with WebGL/WebCodecs support.
   - Automated pixel-level alpha transparency validation (`pixels[3] === 0`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 3-Band Biquad Isolation | 280Hz Lowpass, 1200Hz Bandpass, 3200Hz Highpass for speech band separation | M1 | ORIGINAL_REQUEST §2 |
| 2 | Dual-Pole Liquid Follower | <10ms attack, exponential release for continuous organic fluid ballistics | M1 | ORIGINAL_REQUEST §2 |
| 3 | Deterministic Offline DSP | Frame-accurate audio feature precomputation buffer for video export | M1 | ORIGINAL_REQUEST §2 |
| 4 | Curated Voice Library | 5 voice samples + procedural synth fallback for zero-network testing | M1 | ORIGINAL_REQUEST §3 |
| 5 | Apple Siri Chromatic Wave (iOS 18) | 4 chromatic sub-ribbons with Gaussian envelope and dispersion | M2 | ORIGINAL_REQUEST §1 |
| 6 | ChatGPT Fluid 3D Voice Orb | Raymarched SDF sphere with 3-octave harmonic noise & Fresnel rim | M2 | ORIGINAL_REQUEST §1 |
| 7 | Gemini Live Fluid Metaballs | 4-6 orbiting drops with smooth-min coalescence and velocity stretch | M2 | ORIGINAL_REQUEST §1 |
| 8 | Concentric Acoustic Rings | Radial acoustic shockwave equation with directional beamforming lobes | M2 | ORIGINAL_REQUEST §1 |
| 9 | Acoustic Particle Cymatics | 2,000+ dust particles forming Chladni standing waves via potential fields | M2 | ORIGINAL_REQUEST §1 |
| 10 | Neomorphic Glass Soundbars | 24-32 pill bars with 2nd-order underdamped spring-damper physics | M2 | ORIGINAL_REQUEST §1 |
| 11 | Cyberpunk AI Core / Sci-Fi HUD | Circular reticle rings, circular oscilloscope waveform & pulsing core | M2 | ORIGINAL_REQUEST §1 |
| 12 | iOS Perimeter Edge Glow | Rounded-box SDF perimeter traveling wave & inward Gaussian bloom | M2 | ORIGINAL_REQUEST §1 |
| 13 | Zero-Halo Premultiplied Alpha | WebGL & Canvas 2D clean alpha compositing with zero dark fringe | M2 | ORIGINAL_REQUEST §1 |
| 14 | visionOS Frosted Glass Styling | Spatial translucent materials, specular hairlines, and blur depth | M3 | ORIGINAL_REQUEST §3 |
| 15 | Canvas Framing Presets | 1:1 Square, 16:9 Landscape, 9:16 Vertical responsive framing | M3 | ORIGINAL_REQUEST §3 |
| 16 | Stage Background Modes | Checkerboard, Dark Studio, Ambient Glow, Green Chroma, Blue Chroma | M3 | ORIGINAL_REQUEST §3 |
| 17 | Unified Inspector Controls | Reactivity, Smoothing, Turbulence, Glow, Scale, 6+ Palette Themes | M3 | ORIGINAL_REQUEST §3 |
| 18 | Preset Management System | 12 factory presets + custom save/load/delete + JSON export/import | M3 | ORIGINAL_REQUEST §3 |
| 19 | Apple ProRes 4444 Export | 12-bit alpha .mov export via FFmpeg yuva444p10le transcoding | M4 | ORIGINAL_REQUEST §4 |
| 20 | WebM VP9 Alpha Export | Client-side WebCodecs VideoEncoder with alpha: "keep" and webm-muxer | M4 | ORIGINAL_REQUEST §4 |
| 21 | Transparent PNG Sequence Zip | Lossless 32-bit RGBA PNG sequence + audio.wav zipped via fflate | M4 | ORIGINAL_REQUEST §4 |
| 22 | Chroma Key MP4 Export | Clean Green/Blue screen video container for standard video apps | M4 | ORIGINAL_REQUEST §4 |
| 23 | Real-Time Export Modal | Progress bar, frame counter, speed multiplier, and instant abort | M4 | ORIGINAL_REQUEST §4 |
| 24 | Playwright E2E Test Suite | Comprehensive automated tests for UI, archetypes, audio, and export | M5 / Test Track | ORIGINAL_REQUEST §5 |
| 25 | Alpha Transparency Validation | Forensic verification that exported canvas has genuine 0-alpha pixels | M5 / Test Track | ORIGINAL_REQUEST §5 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Audio DSP & Ballistics Engine | 3-band biquads, dual-pole liquid follower, deterministic buffer, voice catalog | none | DONE |
| M2 | 8 VUI Visual Archetypes | All 8 WebGL/Canvas2D archetypes, uniform interface, zero-halo alpha | M1 | DONE |
| M3 | visionOS SaaS UI/UX & Presets | Frosted glass layout, framing, backgrounds, inspector, presets, playback | M1, M2 | DONE |
| M4 | Multi-Engine Export Pipeline | ProRes 4444, WebM alpha (keep), PNG zip, Chroma MP4, progress modal | M1, M2, M3 | IN_PROGRESS |
| M5 | E2E Integration & Verification | 100% E2E test pass (Tiers 1-4) & adversarial coverage hardening (Tier 5) | M1..M4, Test Track | PLANNED |
| E2E | E2E Testing Track | Independent opaque-box test suite (Tiers 1-4), harness, TEST_READY.md | none | DONE |

---

## Interface Contracts

### Audio Engine ↔ Visualizers (`src/visualizers/types.ts`)
```typescript
export interface VisualizerRenderParams {
  time: number;
  phase: number;
  aspectRatio: number; // width / height
  low: number;         // 0.0 - 1.0 (Bass energy)
  mid: number;         // 0.0 - 1.0 (Vocal Mid energy)
  high: number;        // 0.0 - 1.0 (Treble energy)
  amplitude: number;   // 0.0 - 1.0 (RMS volume)
  sensitivity: number; // 0.2 - 3.0
  turbulence: number;  // 0.0 - 2.5
  glow: number;        // 0.0 - 3.0
  scale: number;       // 0.5 - 2.0
  palette: [number, number, number][]; // 4 RGB color stops
  isAudioActive: boolean;
  isTransparent: boolean;
}

export interface VisualizerRenderer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  init(canvas: HTMLCanvasElement): void;
  render(params: VisualizerRenderParams): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
```

### Visualizers ↔ Export Pipeline (`src/export/types.ts`)
```typescript
export interface FrameData {
  frameIndex: number;
  timestamp: number;
  low: number;
  mid: number;
  high: number;
  amplitude: number;
  phase: number;
  isAudioActive: boolean;
}

export interface ExportProgress {
  stage: "analyzing" | "rendering" | "encoding" | "packaging" | "converting" | "complete" | "cancelled" | "error";
  currentFrame: number;
  totalFrames: number;
  percent: number;
  fps: number;
  speed: string;
  timeRemainingSec: number;
  error?: string;
}
```

### UI Store ↔ Presets (`src/types/presets.ts`)
```typescript
export interface VuiPreset {
  id: string;
  name: string;
  category: "apple" | "ai" | "broadcast" | "minimal" | "cyber" | "custom";
  description: string;
  archetype: string;
  framing: "1:1" | "16:9" | "9:16";
  backgroundMode: "checkerboard" | "dark" | "glow" | "green-screen" | "blue-screen";
  params: {
    sensitivity: number;
    smoothness: number;
    resetSpeed: number;
    turbulence: number;
    glowIntensity: number;
    scale: number;
    palette: string;
  };
}
```

---

## Code Layout
```
src/
├── app/
│   ├── App.tsx                     # Main visionOS shell
│   ├── layout/                     # Header, StageWorkspace, InspectorSidebar
│   └── modals/                     # ExportProgressModal, PresetManagerModal
├── components/
│   ├── stage/                      # VUIStage, AspectRatioFrame, StageBackground, MetricsOverlay
│   ├── inspector/                  # ArchetypeGrid, PhysicsPanel, OpticsPanel, PaletteSelector, FramingPanel
│   └── audio/                      # AudioPlaybackBar, VoiceUploader, SampleVoiceLibrary
├── visualizers/                    # Modular Archetype Rendering System
│   ├── types.ts                    # VisualizerRenderer interface & render params
│   ├── registry.ts                 # Registry mapping archetype IDs to renderers
│   ├── palettes.ts                 # Palette definitions & GLSL color conversion
│   ├── WebGLContextManager.ts      # WebGL context initialization & quad geometry
│   ├── archetypes/
│   │   ├── SiriWaveRenderer.ts     # 1. Apple Siri Chromatic Wave
│   │   ├── ChatGptOrbRenderer.ts   # 2. ChatGPT Fluid 3D Voice Orb
│   │   ├── GeminiMetaballsRenderer.ts # 3. Gemini Live Fluid Metaballs
│   │   ├── ConcentricRingsRenderer.ts # 4. Concentric Acoustic Rings
│   │   ├── CymaticsParticleRenderer.ts # 5. Acoustic Particle Cymatics
│   │   ├── GlassSoundbarsRenderer.ts # 6. Neomorphic Glass Soundbars
│   │   ├── SciFiHudRenderer.ts     # 7. Cyberpunk AI Core HUD
│   │   └── PerimeterGlowRenderer.ts # 8. iOS Perimeter Edge Glow
│   └── shaders/                    # GLSL shaders & noise math
├── audio/
│   ├── AudioEngine.ts              # Live Web Audio Graph
│   ├── BiquadFilterBank.ts         # 3-band biquad filters (Low, Mid, High)
│   ├── DualPoleFollower.ts         # <10ms attack, exponential release follower
│   ├── OfflineDSP.ts               # Deterministic offline audio precomputation
│   └── sampleVoices.ts             # Curated sample voice profiles
├── export/
│   ├── ExportManager.ts            # Export coordinator with AbortController
│   ├── engines/
│   │   ├── ProRes4444Exporter.ts   # Apple ProRes 4444 MOV with 12-bit alpha
│   │   ├── WebMAlphaExporter.ts    # WebM VP9 with alpha: "keep"
│   │   ├── PNGSequenceExporter.ts  # 32-bit RGBA PNG .zip + audio.wav
│   │   └── ChromaMp4Exporter.ts    # Chroma key MP4
│   └── types.ts                    # Export types
├── store/
│   ├── useAppStore.ts              # Central Zustand store
│   └── defaultPresets.ts           # 12 factory presets
tests/
├── e2e/                            # Playwright E2E test specs
└── unit/                           # Vitest unit test specs
```
