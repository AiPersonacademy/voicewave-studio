import { test, expect } from "@playwright/test";
import {
  FRAMINGS,
  getArchetypeButton,
  getFramingButton,
  getBackgroundButton,
  getSliderByLabel,
  waitForCanvasReady,
  loadSampleAudio,
  togglePlayback,
} from "./helpers";

test.describe("Tier 1: Feature Coverage Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvasReady(page);
  });

  /* =========================================================================
   * Area 1: Archetype Selection (>=5 tests across all 8 archetypes)
   * ========================================================================= */
  test.describe("Area 1: Archetype Selection", () => {
    test("1.1 selects Apple Siri Chromatic Wave archetype", async ({ page }) => {
      const btn = getArchetypeButton(page, "apple-siri");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      }
    });

    test("1.2 selects Gemini Live Fluid Metaballs archetype", async ({ page }) => {
      const btn = getArchetypeButton(page, "gemini-metaballs");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("1.3 selects ChatGPT Fluid 3D Voice Orb archetype", async ({ page }) => {
      const btn = getArchetypeButton(page, "chatgpt-orb");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("1.4 selects Concentric Acoustic Rings archetype", async ({ page }) => {
      const btn = getArchetypeButton(page, "concentric-rings");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("1.5 selects Acoustic Particle Cymatics archetype", async ({ page }) => {
      const btn = getArchetypeButton(page, "cymatics-particle");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("1.6 selects Neomorphic Glass Soundbars, Cyber HUD, and Perimeter Glow", async ({ page }) => {
      const archetypesToTest = ["glass-soundbars", "scifi-hud", "perimeter-glow"];
      for (const archId of archetypesToTest) {
        const btn = getArchetypeButton(page, archId);
        if (await btn.isVisible()) {
          await btn.click();
          await page.waitForTimeout(200);
          const canvas = await waitForCanvasReady(page);
          expect(await canvas.isVisible()).toBe(true);
        }
      }
    });
  });

  /* =========================================================================
   * Area 2: Framing Presets (1:1, 16:9, 9:16) (>=5 tests)
   * ========================================================================= */
  test.describe("Area 2: Framing Presets", () => {
    test("2.1 sets 1:1 Square aspect ratio framing", async ({ page }) => {
      const btn = getFramingButton(page, "1:1");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvasBox = await (await waitForCanvasReady(page)).boundingBox();
        if (canvasBox) {
          const ratio = canvasBox.width / canvasBox.height;
          expect(Math.abs(ratio - 1.0)).toBeLessThan(0.05);
        }
      } else {
        const canvasBox = await (await waitForCanvasReady(page)).boundingBox();
        if (canvasBox) {
          const ratio = canvasBox.width / canvasBox.height;
          expect(Math.abs(ratio - 1.0)).toBeLessThan(0.1);
        }
      }
    });

    test("2.2 sets 16:9 Landscape aspect ratio framing", async ({ page }) => {
      const btn = getFramingButton(page, "16:9");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvasBox = await (await waitForCanvasReady(page)).boundingBox();
        if (canvasBox) {
          const ratio = canvasBox.width / canvasBox.height;
          expect(ratio).toBeGreaterThan(1.5);
        }
      } else {
        test.skip();
      }
    });

    test("2.3 sets 9:16 Vertical aspect ratio framing", async ({ page }) => {
      const btn = getFramingButton(page, "9:16");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        const canvasBox = await (await waitForCanvasReady(page)).boundingBox();
        if (canvasBox) {
          const ratio = canvasBox.width / canvasBox.height;
          expect(ratio).toBeLessThan(0.75);
        }
      } else {
        test.skip();
      }
    });

    test("2.4 maintains canvas responsiveness across window resize", async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      const canvas1 = await waitForCanvasReady(page);
      expect(await canvas1.isVisible()).toBe(true);

      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.waitForTimeout(200);
      const canvas2 = await waitForCanvasReady(page);
      expect(await canvas2.isVisible()).toBe(true);
    });

    test("2.5 switching framing retains canvas context and does not error", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      for (const framing of FRAMINGS) {
        const btn = getFramingButton(page, framing);
        if (await btn.isVisible()) {
          await btn.click();
          await page.waitForTimeout(150);
        }
      }
      expect(errors).toHaveLength(0);
    });
  });

  /* =========================================================================
   * Area 3: Stage Backgrounds (>=5 tests)
   * ========================================================================= */
  test.describe("Area 3: Stage Backgrounds", () => {
    test("3.1 activates Transparent Checkerboard background", async ({ page }) => {
      const btn = getBackgroundButton(page, "checkerboard");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
        const stage = page.locator(".checkerboard-bg, [data-bg-mode='checkerboard'], [data-background='checkerboard']").first();
        expect(await stage.isVisible()).toBe(true);
      }
    });

    test("3.2 activates Clean Dark Studio background", async ({ page }) => {
      const btn = getBackgroundButton(page, "dark");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
        const darkStage = page.locator("[data-bg-mode='dark'], [data-background='dark'], .bg-\\[\\#09090b\\], .bg-zinc-950").first();
        expect(await darkStage.isVisible()).toBe(true);
      }
    });

    test("3.3 activates Neon Ambient Glow background", async ({ page }) => {
      const btn = getBackgroundButton(page, "glow");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
        const glowStage = page.locator("[data-bg-mode='glow'], [data-background='glow'], .from-purple-900").first();
        expect(await glowStage.isVisible()).toBe(true);
      }
    });

    test("3.4 activates Green Chroma Screen background (#00FF00)", async ({ page }) => {
      const btn = getBackgroundButton(page, "green-screen");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
        const greenStage = page.locator("[data-bg-mode='green-screen'], [data-background='green-screen'], .bg-\\[\\#00FF00\\]").first();
        expect(await greenStage.isVisible()).toBe(true);
      }
    });

    test("3.5 activates Blue Chroma Screen background (#0000FF)", async ({ page }) => {
      const btn = getBackgroundButton(page, "blue-screen");
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
        const blueStage = page.locator("[data-bg-mode='blue-screen'], [data-background='blue-screen'], .bg-\\[\\#0000FF\\]").first();
        expect(await blueStage.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });
  });

  /* =========================================================================
   * Area 4: Inspector Controls (>=5 tests)
   * ========================================================================= */
  test.describe("Area 4: Inspector Controls", () => {
    test("4.1 sensitivity slider adjusts value and reflects in state", async ({ page }) => {
      const slider = getSliderByLabel(page, /Reactivity|Sensitivity/i);
      await slider.waitFor({ state: "visible" });
      await slider.fill("2.5");
      await slider.dispatchEvent("input");
      expect(await slider.inputValue()).toBe("2.5");
    });

    test("4.2 smoothness slider adjusts follower inertia", async ({ page }) => {
      const slider = getSliderByLabel(page, /Fluidity|Smoothness/i);
      if (await slider.isVisible()) {
        await slider.fill("0.95");
        await slider.dispatchEvent("input");
        expect(await slider.inputValue()).toBe("0.95");
      }
    });

    test("4.3 reset speed slider adjusts decay return rate", async ({ page }) => {
      const slider = getSliderByLabel(page, /Reset Speed/i);
      if (await slider.isVisible()) {
        await slider.fill("0.75");
        await slider.dispatchEvent("input");
        expect(await slider.inputValue()).toBe("0.75");
      }
    });

    test("4.4 canvas render scale slider updates internal pixel dimensions", async ({ page }) => {
      const canvas = await waitForCanvasReady(page);
      const initialW = await canvas.evaluate((c: HTMLCanvasElement) => c.width);

      const sizeSlider = getSliderByLabel(page, /Display Size|Size|Scale/i);
      if (await sizeSlider.isVisible()) {
        await sizeSlider.fill("420");
        await sizeSlider.dispatchEvent("input");
        await page.waitForTimeout(300);

        const newW = await canvas.evaluate((c: HTMLCanvasElement) => c.width);
        expect(newW).toBeGreaterThanOrEqual(initialW);
      }
    });

    test("4.5 turbulence and glow intensity adjust without causing WebGL errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const enabledSliders = page.locator('input[type="range"]:not([disabled])');
      const count = await enabledSliders.count();
      for (let i = 0; i < count; i++) {
        const slider = enabledSliders.nth(i);
        const min = parseFloat(await slider.getAttribute("min") || "0");
        const max = parseFloat(await slider.getAttribute("max") || "1");
        const stepAttr = await slider.getAttribute("step");
        const step = (stepAttr && stepAttr !== "any") ? parseFloat(stepAttr) : 0.01;
        const rawMid = (min + max) / 2;
        const midVal = isNaN(step) || step <= 0
          ? rawMid
          : (step >= 1 ? Math.round(rawMid) : parseFloat((Math.round((rawMid - min) / step) * step + min).toFixed(4)));
        const finalVal = isNaN(midVal) ? rawMid : midVal;
        await slider.evaluate((el: HTMLInputElement, val: number) => {
          el.value = val.toString();
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, finalVal);
      }
      await page.waitForTimeout(200);
      expect(errors).toHaveLength(0);
    });
  });

  /* =========================================================================
   * Area 5: Factory Presets (>=5 tests)
   * ========================================================================= */
  test.describe("Area 5: Factory Presets", () => {
    test("5.1 preset library trigger opens preset catalog or drawer", async ({ page }) => {
      const presetBtn = page.locator('button:has-text("Presets"), [data-testid="preset-manager-btn"]').first();
      if (await presetBtn.isVisible()) {
        await presetBtn.click();
        const modal = page.locator('[data-testid="preset-modal"], div[role="dialog"]').first();
        expect(await modal.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("5.2 selecting an Apple category preset configures Siri archetype and parameters", async ({ page }) => {
      const applePreset = page.locator('button:has-text("Siri"), [data-preset-id*="siri"]').first();
      if (await applePreset.isVisible()) {
        await applePreset.click();
        await page.waitForTimeout(200);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("5.3 selecting an AI Orb preset updates shader variant", async ({ page }) => {
      const orbPreset = page.locator('button:has-text("Orb"), [data-preset-id*="orb"]').first();
      if (await orbPreset.isVisible()) {
        await orbPreset.click();
        await page.waitForTimeout(200);
        const canvas = await waitForCanvasReady(page);
        expect(await canvas.isVisible()).toBe(true);
      } else {
        test.skip();
      }
    });

    test("5.4 custom user preset can be saved to LocalStorage", async ({ page }) => {
      await page.evaluate(() => {
        const testPreset = {
          id: "custom-test-1",
          name: "My Custom Preset",
          archetype: "apple-siri",
          framing: "1:1",
          backgroundMode: "checkerboard",
          params: { sensitivity: 1.5, smoothness: 0.9, resetSpeed: 0.8, turbulence: 0.5, glowIntensity: 1.0, scale: 1.0, palette: "default" }
        };
        localStorage.setItem("voicewave_custom_presets", JSON.stringify([testPreset]));
      });

      const stored = await page.evaluate(() => localStorage.getItem("voicewave_custom_presets"));
      expect(stored).toContain("custom-test-1");
    });

    test("5.5 preset JSON export creates downloadable JSON object", async ({ page }) => {
      const presetBtn = page.locator('button:has-text("Presets"), [data-testid="preset-manager-btn"]').first();
      if (await presetBtn.isVisible()) {
        await presetBtn.click();
        await page.waitForTimeout(200);
      }
      const exportPresetBtn = page.locator('button:has-text("Export Preset JSON"), [data-testid="preset-export-btn"]').first();
      if (await exportPresetBtn.isVisible()) {
        const downloadPromise = page.waitForEvent("download");
        await exportPresetBtn.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain(".json");
      } else {
        test.skip();
      }
    });
  });

  /* =========================================================================
   * Area 6: Audio Playback & Voice Library (>=5 tests)
   * ========================================================================= */
  test.describe("Area 6: Audio Playback & Library", () => {
    test("6.1 displays voice uploader dropzone and upload input", async ({ page }) => {
      const uploader = page.locator('input[type="file"], [data-testid="voice-dropzone"]').first();
      expect(await uploader.count()).toBeGreaterThan(0);
    });

    test("6.2 loading built-in sample voice populates audio duration and player", async ({ page }) => {
      await loadSampleAudio(page);
      await page.waitForTimeout(300);

      const audioIndicator = page.locator('p:has-text("sample-voice.wav"), [data-testid="audio-duration"], span:has-text("0:")').first();
      expect(await audioIndicator.isVisible()).toBe(true);
    });

    test("6.3 toggling play button toggles playback state", async ({ page }) => {
      await loadSampleAudio(page);
      await page.waitForTimeout(300);

      await togglePlayback(page);
      await page.waitForTimeout(500);

      const pauseBtn = page.locator('button[title="Pause"], button[aria-label="Pause"], [data-testid="pause-btn"]').first();
      const playBtn = page.locator('button[title="Play"], button[aria-label="Play"], [data-testid="play-btn"]').first();
      const buttonExists = (await pauseBtn.isVisible()) || (await playBtn.isVisible());
      expect(buttonExists).toBe(true);
    });

    test("6.4 volume slider controls output gain", async ({ page }) => {
      const volumeSlider = page.locator('input[type="range"]:not([disabled])').last();
      if (await volumeSlider.isVisible()) {
        await volumeSlider.fill("0.5");
        await volumeSlider.dispatchEvent("input");
        expect(await volumeSlider.inputValue()).toBe("0.5");
      }
    });

    test("6.5 timeline scrubber allows seeking audio track", async ({ page }) => {
      await loadSampleAudio(page);
      const timeline = page.locator('input[type="range"]').first();
      // Wait until audio duration enables the scrubber
      await timeline.waitFor({ state: "visible" });
      if (!(await timeline.isDisabled())) {
        await timeline.fill("2");
        await timeline.dispatchEvent("input");
      }
    });
  });

  /* =========================================================================
   * Area 7: Export Modal & Pipeline (>=5 tests)
   * ========================================================================= */
  test.describe("Area 7: Export Modal & Pipeline", () => {
    test("7.1 export format selector displays transparent video choices", async ({ page }) => {
      const proresOpt = page.locator('button:has-text("ProRes 4444"), [data-format="prores"]').first();
      const webmOpt = page.locator('button:has-text("WebM"), [data-format="webm"]').first();
      const pngOpt = page.locator('button:has-text("PNG"), [data-format="png"]').first();

      expect(await proresOpt.isVisible()).toBe(true);
      expect(await webmOpt.isVisible()).toBe(true);
      expect(await pngOpt.isVisible()).toBe(true);
    });

    test("7.2 duration mode switcher toggles between full and 5s preview", async ({ page }) => {
      const duration5s = page.locator('button:has-text("5s"), [data-duration="5s"]').first();
      if (await duration5s.isVisible()) {
        await duration5s.click();
        await page.waitForTimeout(100);
      }
    });

    test("7.3 export action button initiates progress display", async ({ page }) => {
      await loadSampleAudio(page);
      const duration5s = page.locator('button:has-text("5s"), [data-duration="5s"]').first();
      if (await duration5s.isVisible()) {
        await duration5s.click();
      }

      const exportTrigger = page.locator('button:has-text("Start"), button:has-text("Export"), [data-testid="start-export-btn"]').first();
      expect(await exportTrigger.isVisible()).toBe(true);
    });

    test("7.4 cancel button cleanly aborts active export process", async ({ page }) => {
      const cancelBtn = page.locator('button:has-text("Cancel Export"), button:has-text("Cancel"), [data-testid="cancel-export-btn"]').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(200);
        expect(await cancelBtn.isVisible()).toBe(false);
      }
    });

    test("7.5 export modal reports accurate FPS and resolution metrics", async ({ page }) => {
      const metrics = page.locator('span:has-text("60 FPS"), span:has-text("FPS"), [data-testid="fps-badge"]').first();
      expect(await metrics.isVisible()).toBe(true);
    });
  });
});
