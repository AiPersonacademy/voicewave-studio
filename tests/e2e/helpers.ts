import { type Page, type Locator } from "@playwright/test";

/**
 * Universal E2E Test Helpers for VoiceWave Studio
 * Supports dual-track progressive testing across current prototype and visionOS milestones.
 */

export const ARCHETYPES = [
  { id: "apple-siri", aliases: ["iOS Siri Wave", "Siri Wave", "Siri Chromatic Wave", "wave"] },
  { id: "chatgpt-orb", aliases: ["ChatGPT Fluid 3D Voice Orb", "Voice Orb", "Fluid Orb", "chatgpt-orb"] },
  { id: "gemini-metaballs", aliases: ["Fluid Dots (Metaballs)", "Gemini Live Fluid Metaballs", "Fluid Dots", "fluid-dots"] },
  { id: "concentric-rings", aliases: ["Concentric Acoustic Rings", "Concentric Rings", "Acoustic Radar", "concentric-rings"] },
  { id: "cymatics-particle", aliases: ["Acoustic Particle Cymatics", "Cymatics", "Particle Waves", "cymatics-particle"] },
  { id: "glass-soundbars", aliases: ["Neomorphic Glass Soundbars", "Glass Soundbars", "Soundbars", "glass-soundbars"] },
  { id: "scifi-hud", aliases: ["Cyberpunk AI Core / Sci-Fi HUD", "Sci-Fi HUD", "Cyberpunk AI Core", "scifi-hud"] },
  { id: "perimeter-glow", aliases: ["iOS Perimeter Edge Glow", "Perimeter Glow", "Edge Glow", "perimeter-glow"] },
];

export const FRAMINGS = ["1:1", "16:9", "9:16"] as const;

export const BACKGROUND_MODES = [
  { id: "checkerboard", aliases: ["Transparent Checkerboard", "Transparent Grid", "checkerboard"] },
  { id: "dark", aliases: ["Clean Dark Stage", "Dark Studio", "dark"] },
  { id: "glow", aliases: ["Neon Ambient Glow", "Ambient Glow", "glow"] },
  { id: "green-screen", aliases: ["Green Screen (#00FF00)", "Green Screen", "Green Chroma", "green-screen"] },
  { id: "blue-screen", aliases: ["Blue Screen (#0000FF)", "Blue Screen", "Blue Chroma", "blue-screen"] },
];

/**
 * Finds button or interactive control matching an archetype
 */
export function getArchetypeButton(page: Page, archetypeId: string): Locator {
  return page.locator(`[data-testid="archetype-${archetypeId}"], [data-archetype="${archetypeId}"]`).first();
}

/**
 * Finds button or control for framing aspect ratio
 */
export function getFramingButton(page: Page, framing: "1:1" | "16:9" | "9:16"): Locator {
  const selectors = [
    `[data-testid="framing-${framing}"]`,
    `[data-framing="${framing}"]`,
    `button:has-text("${framing}")`,
  ];
  return page.locator(selectors.join(", ")).first();
}

/**
 * Finds button for stage background mode (scoped to background section to prevent collision with export choices)
 */
export function getBackgroundButton(page: Page, bgId: string): Locator {
  const bg = BACKGROUND_MODES.find((b) => b.id === bgId);
  const aliases = bg ? bg.aliases : [bgId];

  const directSelectors = [
    `[data-testid="bg-${bgId}"]`,
    `[data-bg="${bgId}"]`,
  ];
  const directLocator = page.locator(directSelectors.join(", ")).first();

  const container = page.locator("div, section").filter({ hasText: /Stage Background/i }).first();
  const aliasSelectors = aliases.map((name) => `button:has-text("${name}")`);
  const scopedLocator = container.locator(aliasSelectors.join(", ")).first();

  return directLocator.or(scopedLocator).first();
}

/**
 * Locates enabled slider by associated label or regex
 */
export function getSliderByLabel(page: Page, labelRegex: RegExp): Locator {
  const pattern = labelRegex.source.toLowerCase();
  let idSelector = "";
  if (/reactivity|sensitivity/.test(pattern)) {
    idSelector = "#slider-sensitivity";
  } else if (/fluidity|smoothness/.test(pattern)) {
    idSelector = "#slider-smoothness";
  } else if (/reset\s*speed/.test(pattern)) {
    idSelector = "#slider-reset-speed";
  } else if (/turbulence/.test(pattern)) {
    idSelector = "#slider-turbulence";
  } else if (/glow/.test(pattern)) {
    idSelector = "#slider-glow";
  } else if (/display\s*size|scale|size/.test(pattern)) {
    idSelector = "#slider-size";
  }

  if (idSelector) {
    const byId = page.locator(idSelector);
    const byLabel = page.getByLabel(labelRegex);
    return byId.or(byLabel).first();
  }

  const byLabel = page.getByLabel(labelRegex);
  const byAncestor = page
    .locator("label, span")
    .filter({ hasText: labelRegex })
    .locator("xpath=ancestor::*[.//input[@type='range' and not(@disabled)]][1]//input[@type='range' and not(@disabled)]");

  return byLabel.or(byAncestor).first();
}

/**
 * Ensures the app canvas is visible and returns the element
 */
export async function waitForCanvasReady(page: Page, timeout = 25000): Promise<Locator> {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout });
  return canvas;
}

/**
 * Loads the built-in sample audio file and awaits decoding
 */
export async function loadSampleAudio(page: Page): Promise<void> {
  const sampleBtn = page.locator('button:has-text("Load Voice Sample"), button:has-text("Load Sample"), button:has-text("Sample Voice"), [data-testid="load-sample-btn"]').first();
  if (await sampleBtn.isVisible()) {
    await sampleBtn.click();
    // Await audio track indication
    await page.locator('p:has-text("sample-voice.wav"), [data-testid="audio-duration"], span:has-text("0:")').first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * Toggles audio playback (Play/Pause)
 */
export async function togglePlayback(page: Page): Promise<void> {
  const playPauseBtn = page.locator(
    'button[title="Play"], button[title="Pause"], button:has-text("Play"), button:has-text("Pause"), button[aria-label="Play"], button[aria-label="Pause"], [data-testid="play-pause-btn"]'
  ).first();
  await playPauseBtn.waitFor({ state: "visible", timeout: 10000 });
  await playPauseBtn.click();
}
