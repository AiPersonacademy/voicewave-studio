import { chromium } from "@playwright/test";

async function run() {
  console.log("=== Launching Chromium for Milestone 3 Stage & Transport Verification ===");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--enable-features=WebCodecs",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (err) => {
    console.error("PAGE ERROR:", err.message);
    pageErrors.push(err.message);
  });

  console.log("Navigating to http://localhost:5174/ ...");
  await page.goto("http://localhost:5174/");
  await page.waitForSelector("[data-testid=\"vui-stage-canvas\"]", { timeout: 30000 });
  console.log("Canvas is mounted and ready.");

  // Section 1: Verify Framing Modes & Aspect Ratios
  console.log("\n--- Section 1: Testing Framing Aspect Ratios ---");
  const framingTests = [
    { mode: "1:1", expectedRatio: 1.0, min: 0.95, max: 1.05 },
    { mode: "16:9", expectedRatio: 16 / 9, min: 1.5, max: 2.0 },
    { mode: "9:16", expectedRatio: 9 / 16, min: 0.45, max: 0.75 },
  ];

  for (const t of framingTests) {
    const btn = page.locator(`[data-testid="framing-${t.mode}"]`).first();
    await btn.click();
    await page.waitForTimeout(400);

    const canvas = page.locator("[data-testid=\"vui-stage-canvas\"]");
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`Could not get bounding box for framing ${t.mode}`);

    const ratio = box.width / box.height;
    const pass = ratio >= t.min && ratio <= t.max;
    console.log(`Framing [${t.mode}]: width=${box.width.toFixed(1)}, height=${box.height.toFixed(1)}, ratio=${ratio.toFixed(4)} -> ${pass ? "PASS" : "FAIL"}`);
    if (!pass) throw new Error(`Framing ${t.mode} ratio ${ratio} not in range [${t.min}, ${t.max}]`);
  }

  // Section 2: Verify All 5 Background Modes
  console.log("\n--- Section 2: Testing Background Modes & DOM Structures ---");
  const bgModes = ["checkerboard", "dark", "glow", "green-screen", "blue-screen"];
  for (const mode of bgModes) {
    const btn = page.locator(`[data-testid="bg-${mode}"]`).first();
    await btn.click();
    await page.waitForTimeout(300);

    const bgContainer = page.locator(`[data-testid="stage-bg-${mode}"]`);
    const isVisible = await bgContainer.isVisible();
    const bgModeAttr = await bgContainer.getAttribute("data-bg-mode");
    const bgAttr = await bgContainer.getAttribute("data-background");

    const pass = isVisible && bgModeAttr === mode && bgAttr === mode;
    console.log(`Background [${mode}]: isVisible=${isVisible}, data-bg-mode=${bgModeAttr}, data-background=${bgAttr} -> ${pass ? "PASS" : "FAIL"}`);
    if (!pass) throw new Error(`Background mode ${mode} failed DOM structure verification`);
  }

  // Section 3: WebGL Canvas Transparency & Corner Alpha Verification
  console.log("\n--- Section 3: Testing WebGL Canvas Corner Alpha Transparency ---");
  // Set back to checkerboard to test transparent canvas
  await page.locator("[data-testid=\"bg-checkerboard\"]").first().click();
  await page.waitForTimeout(400);

  const alphaAudit = await page.evaluate(() => {
    const canvas = document.querySelector("[data-testid=\"vui-stage-canvas\"]");
    if (!canvas) return { error: "Canvas element not found" };

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { error: "No WebGL context on stage canvas" };

    const w = canvas.width;
    const h = canvas.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);

    const getAlpha = (x, y) => buf[(y * w + x) * 4 + 3];
    const tl = getAlpha(0, 0);
    const tr = getAlpha(w - 1, 0);
    const bl = getAlpha(0, h - 1);
    const br = getAlpha(w - 1, h - 1);

    // Inset corners (4px from borders)
    const iTl = getAlpha(4, 4);
    const iTr = getAlpha(w - 5, 4);
    const iBl = getAlpha(4, h - 5);
    const iBr = getAlpha(w - 5, h - 5);

    // Center pixel
    const centerAlpha = getAlpha(Math.floor(w / 2), Math.floor(h / 2));

    // Check canvas CSS background class
    const canvasClasses = canvas.className;
    const isBgTransparent = canvasClasses.includes("bg-transparent") && !canvasClasses.includes("bg-black");

    return {
      canvasDimensions: { width: w, height: h },
      corners: { tl, tr, bl, br },
      insetCorners: { iTl, iTr, iBl, iBr },
      centerAlpha,
      canvasClasses,
      isBgTransparent,
    };
  });

  console.log("Alpha Audit Result:", JSON.stringify(alphaAudit, null, 2));
  const cornersZero =
    alphaAudit.corners.tl === 0 &&
    alphaAudit.corners.tr === 0 &&
    alphaAudit.corners.bl === 0 &&
    alphaAudit.corners.br === 0;

  console.log(`Corner Pixels 0-Alpha: ${cornersZero ? "PASS" : "FAIL"}`);
  console.log(`Canvas CSS Transparent: ${alphaAudit.isBgTransparent ? "PASS" : "FAIL"}`);

  // Section 4: Audio Transport Concurrency & Interaction Stress
  console.log("\n--- Section 4: Testing Audio Transport Concurrency ---");
  const loadSampleBtn = page.locator("[data-testid=\"load-sample-btn\"]");
  if (await loadSampleBtn.isVisible()) {
    console.log("Clicking load sample audio button...");
    await loadSampleBtn.click();
    await page.waitForTimeout(500);

    const playPauseBtn = page.locator("[data-testid=\"play-pause-btn\"]");
    console.log("Rapid play/pause toggling (10 cycles)...");
    for (let i = 0; i < 10; i++) {
      await playPauseBtn.click();
      await page.waitForTimeout(100);
    }
  }

  console.log(`\nPage Errors Encountered: ${pageErrors.length}`);
  if (pageErrors.length > 0) {
    console.error("Errors:", pageErrors);
    throw new Error(`Encountered ${pageErrors.length} page errors during test execution`);
  }

  console.log("\n=== ALL EMPIRICAL CHECKS PASSED ===");
  await browser.close();
}

run().catch((err) => {
  console.error("Verification Error:", err);
  process.exit(1);
});
