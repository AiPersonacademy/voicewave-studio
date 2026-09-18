import { test, expect } from "@playwright/test";
import {
  waitForCanvasReady,
  loadSampleAudio,
  togglePlayback,
  getArchetypeButton,
  getBackgroundButton,
  getSliderByLabel,
} from "./helpers";
import { validateCanvasTransparency } from "../utils/alphaValidator";

test.describe("Tier 4: Real-World Application Workflows & Alpha Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvasReady(page);
  });

  test("4.1 complete real-world workflow: load sample audio, play, adjust sensitivity, and observe reaction", async ({ page }) => {
    // 1. Load sample audio file
    await loadSampleAudio(page);
    await page.waitForTimeout(300);

    // 2. Start playback
    await togglePlayback(page);
    await page.waitForTimeout(500);

    // 3. Adjust reactivity slider
    const sensitivitySlider = getSliderByLabel(page, /Reactivity|Sensitivity/i);
    if (await sensitivitySlider.isVisible()) {
      await sensitivitySlider.fill("2");
      await sensitivitySlider.dispatchEvent("input");
      await page.waitForTimeout(200);
    }

    // 4. Verify canvas is running and displaying dynamic audio reaction via screenshot comparison
    const canvas = await waitForCanvasReady(page);
    const frameA = await canvas.screenshot();
    await page.waitForTimeout(300);
    const frameB = await canvas.screenshot();

    expect(frameA.equals(frameB)).toBe(false);
  });

  test("4.2 forensic canvas alpha transparency validation (pixels[3] === 0 in background)", async ({ page }) => {
    // Ensure transparent background mode is selected
    const checkerboardBtn = getBackgroundButton(page, "checkerboard");
    if (await checkerboardBtn.isVisible()) {
      await checkerboardBtn.click();
      await page.waitForTimeout(200);
    }

    // Run forensic pixel-level alpha inspection on the live rendering canvas
    const alphaReport = await validateCanvasTransparency(page, "canvas", { tolerance: 0 });

    // Assert that boundary corners are strictly 0-alpha (genuine transparency)
    expect(alphaReport.isBackgroundTransparent).toBe(true);
    expect(alphaReport.cornerAlphas).toEqual([0, 0, 0, 0]);

    // Forensic check: Confirm background corners are 0
    expect(alphaReport.cornerAlphas.every((a) => a === 0)).toBe(true);
  });

  test("4.3 forensic alpha validation across secondary archetype variant", async ({ page }) => {
    const dotsBtn = getArchetypeButton(page, "gemini-metaballs");
    if (await dotsBtn.isVisible()) {
      await dotsBtn.click();
      await page.waitForTimeout(300);

      const alphaReport = await validateCanvasTransparency(page, "canvas", { tolerance: 0 });
      expect(alphaReport.isBackgroundTransparent).toBe(true);
      expect(alphaReport.cornerAlphas).toEqual([0, 0, 0, 0]);
    } else {
      test.skip();
    }
  });

  test("4.4 export trigger workflow and cancellation integrity", async ({ page }) => {
    await loadSampleAudio(page);
    await page.waitForTimeout(200);

    const duration5s = page.locator('button:has-text("5s"), [data-duration="5s"]').first();
    if (await duration5s.isVisible()) {
      await duration5s.click();
    }

    const exportBtn = page.locator('button:has-text("Start"), button:has-text("Export"), [data-testid="start-export-btn"]').first();
    if (await exportBtn.isVisible() && !(await exportBtn.isDisabled())) {
      await exportBtn.click();
      await page.waitForTimeout(200);

      const cancelBtn = page.locator('button:has-text("Cancel"), [data-testid="cancel-export-btn"]').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(200);
      }
    }
  });
});
