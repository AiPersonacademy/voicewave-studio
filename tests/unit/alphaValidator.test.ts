import { describe, it, expect } from "vitest";
import { inspectPixelBuffer } from "../utils/alphaValidator";

describe("inspectPixelBuffer (Alpha Transparency Validator)", () => {
  it("correctly identifies a perfectly transparent background with active center", () => {
    const width = 100;
    const height = 100;
    const buffer = new Uint8ClampedArray(width * height * 4); // All zeros initially (alpha = 0)

    // Draw active content in center (cx=50, cy=50)
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        const idx = (y * width + x) * 4;
        buffer[idx + 0] = 200; // R
        buffer[idx + 1] = 100; // G
        buffer[idx + 2] = 255; // B
        buffer[idx + 3] = 240; // Alpha
      }
    }

    const report = inspectPixelBuffer(buffer, width, height, 0);
    expect(report.isZeroAlphaBackground).toBe(true);
    expect(report.hasVisibleForeground).toBe(true);
    expect(report.cornerAlphas).toEqual([0, 0, 0, 0]);
    expect(report.centerMaxAlpha).toBe(240);
  });

  it("detects when background corners are contaminated with non-zero alpha (e.g. black opaque background)", () => {
    const width = 80;
    const height = 80;
    const buffer = new Uint8ClampedArray(width * height * 4);

    // Contaminate top-left corner
    buffer[3] = 255; // Corner (0,0) alpha = 255

    const report = inspectPixelBuffer(buffer, width, height, 0);
    expect(report.isZeroAlphaBackground).toBe(false);
    expect(report.cornerAlphas[0]).toBe(255);
  });

  it("flags empty / completely black/transparent buffers without foreground as missing visible content", () => {
    const width = 50;
    const height = 50;
    const buffer = new Uint8ClampedArray(width * height * 4); // all 0

    const report = inspectPixelBuffer(buffer, width, height, 0);
    expect(report.isZeroAlphaBackground).toBe(true);
    expect(report.hasVisibleForeground).toBe(false);
    expect(report.centerMaxAlpha).toBe(0);
  });

  it("throws error when buffer size does not match dimensions", () => {
    const buffer = new Uint8ClampedArray(10);
    expect(() => inspectPixelBuffer(buffer, 100, 100)).toThrow(/smaller than expected/);
  });
});
