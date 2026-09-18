import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Configuration for VoiceWave Studio
 * Supports headless Chromium with SwiftShader WebGL and WebCodecs
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker to avoid GPU context contention on Windows/SwiftShader
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 90000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: "http://localhost:5174",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
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
    },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
