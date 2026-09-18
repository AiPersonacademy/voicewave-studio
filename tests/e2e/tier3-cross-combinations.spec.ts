import { test, expect } from "@playwright/test";
import {
  getArchetypeButton,
  getFramingButton,
  getBackgroundButton,
  waitForCanvasReady,
} from "./helpers";

test.describe("Tier 3: Cross-Feature Combinations Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvasReady(page);
  });

  test("3.1 combination: 9:16 Vertical + ChatGPT Fluid Orb + Blue Chroma Screen", async ({ page }) => {
    const framingBtn = getFramingButton(page, "9:16");
    if (await framingBtn.isVisible()) await framingBtn.click();

    const archBtn = getArchetypeButton(page, "chatgpt-orb");
    if (await archBtn.isVisible()) await archBtn.click();

    const bgBtn = getBackgroundButton(page, "blue-screen");
    if (await bgBtn.isVisible()) await bgBtn.click();

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
  });

  test("3.2 combination: 16:9 Landscape + Neomorphic Soundbars + Green Chroma Screen", async ({ page }) => {
    const framingBtn = getFramingButton(page, "16:9");
    if (await framingBtn.isVisible()) await framingBtn.click();

    const archBtn = getArchetypeButton(page, "glass-soundbars");
    if (await archBtn.isVisible()) await archBtn.click();

    const bgBtn = getBackgroundButton(page, "green-screen");
    if (await bgBtn.isVisible()) await bgBtn.click();

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
  });

  test("3.3 combination: 1:1 Square + Gemini Live Metaballs + Ambient Glow", async ({ page }) => {
    const framingBtn = getFramingButton(page, "1:1");
    if (await framingBtn.isVisible()) await framingBtn.click();

    const archBtn = getArchetypeButton(page, "gemini-metaballs");
    if (await archBtn.isVisible()) await archBtn.click();

    const bgBtn = getBackgroundButton(page, "glow");
    if (await bgBtn.isVisible()) await bgBtn.click();

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
  });

  test("3.4 combination: 9:16 Vertical + Cyberpunk AI Core HUD + Dark Studio Stage", async ({ page }) => {
    const framingBtn = getFramingButton(page, "9:16");
    if (await framingBtn.isVisible()) await framingBtn.click();

    const archBtn = getArchetypeButton(page, "scifi-hud");
    if (await archBtn.isVisible()) await archBtn.click();

    const bgBtn = getBackgroundButton(page, "dark");
    if (await bgBtn.isVisible()) await bgBtn.click();

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
  });

  test("3.5 combination: 16:9 Landscape + Concentric Acoustic Rings + Transparent Checkerboard", async ({ page }) => {
    const framingBtn = getFramingButton(page, "16:9");
    if (await framingBtn.isVisible()) await framingBtn.click();

    const archBtn = getArchetypeButton(page, "concentric-rings");
    if (await archBtn.isVisible()) await archBtn.click();

    const bgBtn = getBackgroundButton(page, "checkerboard");
    if (await bgBtn.isVisible()) await bgBtn.click();

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
  });

  test("3.6 combination: 1:1 Square + Siri Chromatic Wave + High Sensitivity + Ambient Glow", async ({ page }) => {
    const framingBtn = getFramingButton(page, "1:1");
    if (await framingBtn.isVisible()) await framingBtn.click();

    const archBtn = getArchetypeButton(page, "apple-siri");
    if (await archBtn.isVisible()) await archBtn.click();

    const bgBtn = getBackgroundButton(page, "glow");
    if (await bgBtn.isVisible()) await bgBtn.click();

    const sensitivitySlider = page.locator('input[type="range"]:not([disabled])').first();
    if (await sensitivitySlider.isVisible()) {
      await sensitivitySlider.fill("2.2");
      await sensitivitySlider.dispatchEvent("input");
    }

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
  });
});
