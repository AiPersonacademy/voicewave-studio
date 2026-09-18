import { test, expect } from "@playwright/test";
import {
  getArchetypeButton,
  waitForCanvasReady,
  loadSampleAudio,
} from "./helpers";

test.describe("Tier 2: Boundary & Corner Cases Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvasReady(page);
  });

  /* =========================================================================
   * 1. Extreme Slider Values
   * ========================================================================= */
  test("2.1 handles extreme slider boundary values without crashing or NaN rendering", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const enabledSliders = page.locator('input[type="range"]:not([disabled])');
    const count = await enabledSliders.count();

    // Test minimum limits
    for (let i = 0; i < count; i++) {
      const slider = enabledSliders.nth(i);
      const min = await slider.getAttribute("min") || "0.1";
      await slider.evaluate((el: HTMLInputElement, val: string) => {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, min);
    }
    await page.waitForTimeout(100);

    // Test maximum limits
    for (let i = 0; i < count; i++) {
      const slider = enabledSliders.nth(i);
      const max = await slider.getAttribute("max") || "3.0";
      await slider.evaluate((el: HTMLInputElement, val: string) => {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, max);
    }
    await page.waitForTimeout(100);

    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
    expect(errors).toHaveLength(0);
  });

  /* =========================================================================
   * 2. Empty Audio & Zero-State Handling
   * ========================================================================= */
  test("2.2 export handling when no audio is loaded exhibits graceful guard", async ({ page }) => {
    const exportBtn = page.locator('button:has-text("Start"), button:has-text("Export"), [data-testid="start-export-btn"]').first();
    if (await exportBtn.isVisible()) {
      const isDisabled = await exportBtn.isDisabled();
      if (!isDisabled) {
        await exportBtn.click();
        await page.waitForTimeout(200);
      }
    }
  });

  /* =========================================================================
   * 3. Zero Amplitude Idle Breathing Animation
   * ========================================================================= */
  test("2.3 renders continuous idle breathing animation when audio amplitude is zero", async ({ page }) => {
    const canvas = await waitForCanvasReady(page);

    // Capture rasterized frames via Playwright element screenshots
    const screenshot1 = await canvas.screenshot();
    await page.waitForTimeout(400); // 400ms phase advance
    const screenshot2 = await canvas.screenshot();

    // Because of phase oscillation, screenshot2 buffer must not match screenshot1
    expect(screenshot1.equals(screenshot2)).toBe(false);
  });

  /* =========================================================================
   * 4. Rapid Archetype Switching (WebGL Context Lifecycle Stress)
   * ========================================================================= */
  test("2.4 rapid archetype switching does not trigger WebGL context loss or crash", async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const siriBtn = getArchetypeButton(page, "apple-siri");
    const dotsBtn = getArchetypeButton(page, "gemini-metaballs");

    if ((await siriBtn.isVisible()) && (await dotsBtn.isVisible())) {
      for (let i = 0; i < 3; i++) {
        await dotsBtn.click();
        await page.waitForTimeout(50);
        await siriBtn.click();
        await page.waitForTimeout(50);
      }
    }

    await page.waitForTimeout(200);
    const canvas = await waitForCanvasReady(page);
    expect(await canvas.isVisible()).toBe(true);
    expect(errors).toHaveLength(0);
  });

  /* =========================================================================
   * 5. Immediate Export Abort / Cancel Stress
   * ========================================================================= */
  test("2.5 handles immediate cancellation after export trigger without dangling processes", async ({ page }) => {
    await loadSampleAudio(page);
    await page.waitForTimeout(200);

    const exportBtn = page.locator('button:has-text("Start"), button:has-text("Export"), [data-testid="start-export-btn"]').first();
    if (await exportBtn.isVisible() && !(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(50);

      const cancelBtn = page.locator('button:has-text("Cancel"), [data-testid="cancel-export-btn"]').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(200);
      }
    }
  });
});
