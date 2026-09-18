# Test Architecture & Infrastructure Documentation

## 1. Overview & Principles
VoiceWave Studio implements a dual-track verification architecture providing fast, mathematical unit testing and comprehensive, browser-level end-to-end (E2E) testing. The testing harness is designed for **opaque-box testing**, verifying features against interface contracts specified in `PROJECT.md` and `ORIGINAL_REQUEST.md` rather than brittle internal implementation details.

### Core Testing Pillars:
1. **Sample-Accurate Determinism**: Pure unit tests verifying 3-band biquad filter isolation (280Hz lowpass, 1200Hz bandpass, 3200Hz highpass) and 2-pole liquid follower dynamics (<10ms attack, smooth exponential decay).
2. **Hardware/Software WebGL & WebCodecs Emulation**: Playwright configured with Chromium flags supporting headless GPU rendering (`--use-gl=angle`, `--use-angle=swiftshader`, `--enable-webgl`, `--enable-features=WebCodecs`).
3. **Forensic Canvas Alpha Transparency**: Automated pixel inspection utility (`tests/utils/alphaValidator.ts`) confirming genuine alpha transparency (`pixels[3] === 0`) at background corners and active non-zero alpha in the foreground.
4. **Progressive Testability**: Resilient locators (`data-testid`, semantic text, data attributes) designed to support incremental milestone rollouts without regressions.

---

## 2. Infrastructure Configuration

### 2.1 Playwright E2E Configuration (`playwright.config.ts`)
- **Engine**: Chromium (Desktop Chrome profile, 1440x900 viewport).
- **GPU & Media Flags**:
  - `--use-gl=angle` & `--use-angle=swiftshader`: Software rasterized WebGL for headless CI environments.
  - `--enable-webgl`: Full WebGL 1.0 and 2.0 pipeline support.
  - `--enable-features=WebCodecs`: Hardware and software accelerated WebCodecs VideoEncoder support.
  - `--autoplay-policy=no-user-gesture-required`: Unlocks Web Audio playback without user click blocks.
  - `--use-fake-ui-for-media-stream` & `--use-fake-device-for-media-stream`: Mock microphone and audio streams.
- **Web Server**: Automatically orchestrates Vite development server (`npm run dev`) on `http://localhost:5174`.
- **Worker Concurrency**: Single worker (`workers: 1`) to prevent GPU context contention and memory exhaustion on Windows SwiftShader instances.

### 2.2 Vitest Unit Testing (`vitest.config.ts`)
- **Test Runner**: Vitest 5.x.
- **Environment**: Node.js with native V8 execution and path alias mapping (`@` -> `./src`).
- **Scope**: Mathematical DSP algorithms, filter coefficient validation, 2-pole dynamics, preset schema contracts, and pixel buffer analysis algorithms.

---

## 3. Test Suite Tier Mapping

| Tier | Suite File | Scope & Objectives | Test Count |
|---|---|---|---|
| **Tier 1: Feature Coverage** | `tests/e2e/tier1-feature-coverage.spec.ts` | >=5 tests per core feature area: Archetype selection across all 8 archetypes, framing presets (1:1, 16:9, 9:16), stage backgrounds (checkerboard, dark, glow, green, blue chroma), inspector controls, factory presets, audio playback & voice uploader, export modal & progress. | 35+ tests |
| **Tier 2: Boundary & Corner Cases** | `tests/e2e/tier2-boundary-corner-cases.spec.ts` | Extreme slider limits (min/max), zero amplitude idle breathing animation, empty audio / uninitialized state guards, rapid archetype switching (WebGL context lifecycle stress), immediate export cancellation. | 5+ tests |
| **Tier 3: Cross-Feature Combinations** | `tests/e2e/tier3-cross-combinations.spec.ts` | Pairwise matrix tests: 9:16 + ChatGPT Orb + Blue Chroma, 16:9 + Neomorphic Soundbars + Green Chroma, 1:1 + Gemini Metaballs + Glow, 9:16 + Cyberpunk HUD + Dark Studio, 16:9 + Concentric Rings + Checkerboard, 1:1 + Siri Wave + High Sensitivity. | 6+ tests |
| **Tier 4: Real-World Workflows & Alpha** | `tests/e2e/tier4-workflows-alpha.spec.ts` | Full user journey: Voice upload -> Playback -> Sensitivity reaction -> Preset tuning -> Export trigger & cancellation. Canvas pixel alpha transparency forensic validation (`pixels[3] === 0`). | 4+ tests |
| **Unit Tier: DSP & Schemas** | `tests/unit/*.test.ts` | Biquad filter mathematics, dual-pole follower step dynamics, VUI preset schema validation & JSON serialization, pixel buffer alpha analysis algorithm. | 14 tests |

---

## 4. Canvas Alpha Transparency Verification Methodology

The utility `tests/utils/alphaValidator.ts` provides two primary forensic functions:

1. **`validateCanvasTransparency(page, selector, options)`**:
   - Injected into the browser runtime.
   - Creates a temporary 2D reading context and draws the live WebGL/Canvas2D surface into it.
   - Extracts 32-bit RGBA pixel buffers (`ctx.getImageData`).
   - Evaluates the 4 bounding corners (both absolute corner `(0, 0)` and inset corner samples) to ensure alpha channel is `0` (`pixels[3] === 0`).
   - Evaluates the central 30% bounding box to confirm active visualizer content has rendered with non-zero alpha (`pixels[3] > 0`), ensuring the canvas is not falsely blank.
   - Returns metrics including `cornerAlphas`, `centerAlphaMax`, `zeroAlphaRatio`, and `totalPixelsSampled`.

2. **`inspectPixelBuffer(rgba, width, height, tolerance)`**:
   - Pure algorithm for offline image buffer testing (unit tests and server-side frame audits).

---

## 5. Execution Commands

```bash
# Run fast Vitest unit tests
npm test
# or
npm run test:unit

# Run full Playwright E2E test suite
npm run test:e2e

# Run specific E2E test tier
npx playwright test tests/e2e/tier1-feature-coverage.spec.ts
npx playwright test tests/e2e/tier2-boundary-corner-cases.spec.ts
npx playwright test tests/e2e/tier3-cross-combinations.spec.ts
npx playwright test tests/e2e/tier4-workflows-alpha.spec.ts
```
