import { chromium } from "@playwright/test";

const ARCHETYPES = [
  "apple-siri",
  "chatgpt-orb",
  "gemini-metaballs",
  "concentric-rings",
  "cymatics-particle",
  "glass-soundbars",
  "scifi-hud",
  "perimeter-glow",
];

async function run() {
  console.log("=== Launching Chromium with SwiftShader WebGL ===");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--enable-features=WebCodecs",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.goto("http://127.0.0.1:5174/");
  await page.waitForLoadState("domcontentloaded");

  console.log("=== Page loaded. Starting forensic alpha audit across all 8 archetypes ===");

  const report = await page.evaluate(async (archetypeList) => {
    const { registry } = await import("/src/visualizers/registry.ts");
    const { getPalette } = await import("/src/visualizers/palettes.ts");
    const defaultPalette = getPalette("cupertino-siri").rgb;

    const width = 300;
    const height = 300;

    const data = {};

    for (const archId of archetypeList) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      document.body.appendChild(canvas);

      const renderer = registry.createRenderer(archId);
      renderer.init(canvas);

      const gl = canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      const readAlpha = () => {
        const buf = new Uint8Array(width * height * 4);
        if (gl) {
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        }
        return buf;
      };

      const analyze = (pixels) => {
        const getAlpha = (x, y) => pixels[(y * width + x) * 4 + 3];

        // Absolute corners (0,0), (w-1,0), (0,h-1), (w-1,h-1)
        const tl = getAlpha(0, 0);
        const tr = getAlpha(width - 1, 0);
        const bl = getAlpha(0, height - 1);
        const br = getAlpha(width - 1, height - 1);

        // 4px inset corners
        const inset = 4;
        const iTl = getAlpha(inset, inset);
        const iTr = getAlpha(width - 1 - inset, inset);
        const iBl = getAlpha(inset, height - 1 - inset);
        const iBr = getAlpha(width - 1 - inset, height - 1 - inset);

        // Center region (inner 30%: [0.35w, 0.65w] x [0.35h, 0.65h])
        const cxMin = Math.floor(width * 0.35);
        const cxMax = Math.floor(width * 0.65);
        const cyMin = Math.floor(height * 0.35);
        const cyMax = Math.floor(height * 0.65);

        let centerMax = 0;
        let zeroCount = 0;
        let total = 0;
        let premultFails = 0;

        for (let y = 0; y < height; y += 2) {
          for (let x = 0; x < width; x += 2) {
            total++;
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            if (a === 0) zeroCount++;
            if (r > a + 1 || g > a + 1 || b > a + 1) premultFails++;

            if (x >= cxMin && x <= cxMax && y >= cyMin && y <= cyMax) {
              if (a > centerMax) centerMax = a;
            }
          }
        }

        return {
          corners: [tl, tr, bl, br],
          insetCorners: [iTl, iTr, iBl, iBr],
          centerMax,
          zeroAlphaRatio: zeroCount / total,
          premultFails,
        };
      };

      // State 1: Idle
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
      const idle = analyze(readAlpha());

      // State 2: Active
      renderer.render({
        time: 2.5,
        phase: 1.5,
        aspectRatio: 1.0,
        low: 0.8,
        mid: 0.7,
        high: 0.5,
        amplitude: 0.85,
        sensitivity: 1.5,
        turbulence: 1.2,
        glow: 1.5,
        scale: 1.0,
        palette: defaultPalette,
        isAudioActive: true,
        isTransparent: true,
      });
      const active = analyze(readAlpha());

      // State 3: Extreme scale
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
      const extreme = analyze(readAlpha());

      renderer.destroy();
      canvas.parentElement.removeChild(canvas);

      data[archId] = {
        idle,
        active,
        extreme,
      };
    }

    return data;
  }, ARCHETYPES);

  console.log("=== FORENSIC ALPHA REPORT START ===");
  console.log(JSON.stringify(report, null, 2));
  console.log("=== FORENSIC ALPHA REPORT END ===");

  await browser.close();
}

run().catch((err) => {
  console.error("Runner Error:", err);
  process.exit(1);
});
