import { test, expect } from "@playwright/test";

const ARCHETYPES = [
  "apple-siri",
  "chatgpt-orb",
  "gemini-metaballs",
  "concentric-rings",
  "cymatics-particle",
  "glass-soundbars",
  "scifi-hud",
  "perimeter-glow",
] as const;

test.describe("M2 Empirical Challenge: 8 VUI Archetypes & Forensic Alpha", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("M2.1: Extreme Uniforms Stability Stress (576 combinations per archetype)", async ({ page }) => {
    test.setTimeout(120000);
    const results = await page.evaluate(async (archetypeList) => {
      const { registry } = await import("/src/visualizers/registry.ts");
      const { FACTORY_PALETTES } = await import("/src/visualizers/palettes.ts");
      const paletteList = Object.values(FACTORY_PALETTES).map((p) => p.rgb);

      const logs: Array<{
        archetype: string;
        success: boolean;
        error?: string;
        glErrors: string[];
        combinationsTested: number;
      }> = [];

      for (const archId of archetypeList) {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        document.body.appendChild(canvas);

        let renderer: any = null;
        const glErrors: string[] = [];
        let combinationsTested = 0;

        try {
          renderer = registry.createRenderer(archId);
          renderer.init(canvas);

          const gl = (canvas.getContext("webgl2") ||
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

          const sensitivities = [0.1, 0.2, 1.5, 3.0];
          const turbulences = [0.0, 1.0, 2.5];
          const glows = [0.0, 0.1, 1.5, 3.0];
          const scales = [0.5, 1.0, 2.0];
          const audioStates = [
            { low: 0.0, mid: 0.0, high: 0.0, amp: 0.0, active: false },
            { low: 1.0, mid: 1.0, high: 1.0, amp: 1.0, active: true },
            { low: 1.0, mid: 0.0, high: 0.0, amp: 0.8, active: true },
            { low: 0.0, mid: 0.0, high: 1.0, amp: 0.8, active: true },
          ];

          for (const sens of sensitivities) {
            for (const turb of turbulences) {
              for (const glow of glows) {
                for (const sc of scales) {
                  for (const audio of audioStates) {
                    const pal = paletteList[combinationsTested % paletteList.length];

                    renderer.render({
                      time: combinationsTested * 0.1,
                      phase: combinationsTested * 0.25,
                      aspectRatio: 1.0,
                      low: audio.low,
                      mid: audio.mid,
                      high: audio.high,
                      amplitude: audio.amp,
                      sensitivity: sens,
                      turbulence: turb,
                      glow: glow,
                      scale: sc,
                      palette: pal,
                      isAudioActive: audio.active,
                      isTransparent: true,
                    });

                    combinationsTested++;

                    if (gl) {
                      const err = gl.getError();
                      if (err !== gl.NO_ERROR) {
                        glErrors.push(`glError 0x${err.toString(16)} at sens=${sens}, turb=${turb}, glow=${glow}, scale=${sc}`);
                      }
                    }
                  }
                }
              }
            }
          }

          logs.push({
            archetype: archId,
            success: glErrors.length === 0,
            glErrors,
            combinationsTested,
          });
        } catch (e: any) {
          logs.push({
            archetype: archId,
            success: false,
            error: e?.message || String(e),
            glErrors,
            combinationsTested,
          });
        } finally {
          if (renderer) {
            try { renderer.destroy(); } catch {}
          }
          canvas.parentElement?.removeChild(canvas);
        }
      }

      return logs;
    }, ARCHETYPES);

    console.log("M2.1 Extreme Uniform Stress Results:", JSON.stringify(results, null, 2));

    for (const res of results) {
      expect(res.error, `Archetype ${res.archetype} crashed: ${res.error}`).toBeUndefined();
      expect(res.glErrors, `Archetype ${res.archetype} threw WebGL errors: ${res.glErrors.join(", ")}`).toHaveLength(0);
      expect(res.success, `Archetype ${res.archetype} failed`).toBe(true);
      expect(res.combinationsTested).toBe(576);
    }
  });

  test("M2.2: Forensic Alpha Transparency Audit (Pixel Level Inspection)", async ({ page }) => {
    test.setTimeout(120000);
    const auditReport = await page.evaluate(async (archetypeList) => {
      const { registry } = await import("/src/visualizers/registry.ts");
      const { getPalette } = await import("/src/visualizers/palettes.ts");
      const defaultPalette = getPalette("cupertino-siri").rgb;

      const width = 300;
      const height = 300;

      const results: Array<{
        archetype: string;
        idleCorners: [number, number, number, number];
        idleCenterMax: number;
        activeCorners: [number, number, number, number];
        activeCenterMax: number;
        extremeCorners: [number, number, number, number];
        extremeCenterMax: number;
        premultiplicationViolations: number;
        zeroAlphaRatio: number;
      }> = [];

      for (const archId of archetypeList) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        document.body.appendChild(canvas);

        const renderer = registry.createRenderer(archId);
        renderer.init(canvas);

        const gl = (canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

        const readPixels = () => {
          const buf = new Uint8Array(width * height * 4);
          if (gl) {
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          }
          return buf;
        };

        const sample = (pixels: Uint8Array) => {
          const getA = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];
          const tl = getA(0, 0);
          const tr = getA(width - 1, 0);
          const bl = getA(0, height - 1);
          const br = getA(width - 1, height - 1);

          let centerMax = 0;
          let zeroAlphaCount = 0;
          let totalCount = 0;
          let premultViolations = 0;

          const cxMin = Math.floor(width * 0.35);
          const cxMax = Math.floor(width * 0.65);
          const cyMin = Math.floor(height * 0.35);
          const cyMax = Math.floor(height * 0.65);

          for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
              totalCount++;
              const idx = (y * width + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const a = pixels[idx + 3];

              if (a === 0) zeroAlphaCount++;
              if (r > a + 1 || g > a + 1 || b > a + 1) premultViolations++;

              if (x >= cxMin && x <= cxMax && y >= cyMin && y <= cyMax) {
                if (a > centerMax) centerMax = a;
              }
            }
          }

          return {
            corners: [tl, tr, bl, br] as [number, number, number, number],
            centerMax,
            zeroAlphaRatio: zeroAlphaCount / totalCount,
            premultViolations,
          };
        };

        // 1. Idle
        renderer.render({
          time: 1.0,
          phase: 0.5,
          aspectRatio: 1.0,
          low: 0.0,
          mid: 0.0,
          high: 0.0,
          amplitude: 0.0,
          sensitivity: 1.2,
          turbulence: 1.0,
          glow: 1.0,
          scale: 1.0,
          palette: defaultPalette,
          isAudioActive: false,
          isTransparent: true,
        });
        const idle = sample(readPixels());

        // 2. Active speech
        renderer.render({
          time: 2.5,
          phase: 1.5,
          aspectRatio: 1.0,
          low: 0.8,
          mid: 0.7,
          high: 0.5,
          amplitude: 0.8,
          sensitivity: 1.5,
          turbulence: 1.2,
          glow: 1.5,
          scale: 1.0,
          palette: defaultPalette,
          isAudioActive: true,
          isTransparent: true,
        });
        const active = sample(readPixels());

        // 3. Extreme scale (scale=2.0, glow=3.0, turbulence=2.5)
        renderer.render({
          time: 4.0,
          phase: 3.0,
          aspectRatio: 1.0,
          low: 1.0,
          mid: 1.0,
          high: 1.0,
          amplitude: 1.0,
          sensitivity: 2.5,
          turbulence: 2.5,
          glow: 3.0,
          scale: 2.0,
          palette: defaultPalette,
          isAudioActive: true,
          isTransparent: true,
        });
        const extreme = sample(readPixels());

        renderer.destroy();
        canvas.parentElement?.removeChild(canvas);

        results.push({
          archetype: archId,
          idleCorners: idle.corners,
          idleCenterMax: idle.centerMax,
          activeCorners: active.corners,
          activeCenterMax: active.centerMax,
          extremeCorners: extreme.corners,
          extremeCenterMax: extreme.centerMax,
          premultiplicationViolations: active.premultViolations,
          zeroAlphaRatio: active.zeroAlphaRatio,
        });
      }

      return results;
    }, ARCHETYPES);

    console.log("M2.2 Forensic Alpha Audit Report:", JSON.stringify(auditReport, null, 2));

    // Audit assertions: report every finding
    const failedCorners: Array<{ archetype: string; condition: string; corners: number[] }> = [];
    const failedCenters: Array<{ archetype: string; activeCenterMax: number }> = [];

    for (const rep of auditReport) {
      if (!rep.idleCorners.every((a) => a === 0)) {
        failedCorners.push({ archetype: rep.archetype, condition: "idle", corners: rep.idleCorners });
      }
      if (!rep.activeCorners.every((a) => a === 0)) {
        failedCorners.push({ archetype: rep.archetype, condition: "active", corners: rep.activeCorners });
      }
      if (!rep.extremeCorners.every((a) => a === 0)) {
        failedCorners.push({ archetype: rep.archetype, condition: "extreme", corners: rep.extremeCorners });
      }
      if (rep.activeCenterMax <= 0 && rep.archetype !== "perimeter-glow") {
        failedCenters.push({ archetype: rep.archetype, activeCenterMax: rep.activeCenterMax });
      }
    }

    console.log("Summary of Corner Violations (pixels[3] !== 0):", JSON.stringify(failedCorners, null, 2));
    console.log("Summary of Center Violations (pixels[3] <= 0):", JSON.stringify(failedCenters, null, 2));

    // This assertion captures whether any archetype failed corner alpha === 0
    expect(failedCorners, `Corner alpha violations detected: ${JSON.stringify(failedCorners)}`).toHaveLength(0);
    expect(failedCenters, `Center alpha violations detected: ${JSON.stringify(failedCenters)}`).toHaveLength(0);
  });
});
