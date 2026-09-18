import type { Page } from "@playwright/test";

export interface AlphaValidationResult {
  success: boolean;
  isBackgroundTransparent: boolean;
  hasVisibleContent: boolean;
  cornerAlphas: [number, number, number, number]; // [top-left, top-right, bottom-left, bottom-right]
  centerAlphaMax: number;
  centerAlphaAvg: number;
  zeroAlphaRatio: number;
  totalPixelsSampled: number;
  width: number;
  height: number;
  diagnostics?: string;
}

export interface PixelBufferReport {
  isZeroAlphaBackground: boolean;
  hasVisibleForeground: boolean;
  cornerAlphas: [number, number, number, number];
  centerMaxAlpha: number;
  zeroAlphaCount: number;
  totalSampled: number;
}

/**
 * Pure function: Analyzes an RGBA pixel buffer (Uint8Array or Uint8ClampedArray)
 * verifying that the boundary/background possesses genuine 0-alpha transparency,
 * and that active foreground pixels exist with alpha > 0.
 */
export function inspectPixelBuffer(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 0
): PixelBufferReport {
  if (rgba.length < width * height * 4) {
    throw new Error(
      `Pixel buffer size (${rgba.length}) is smaller than expected (${width * height * 4} bytes for ${width}x${height} RGBA)`
    );
  }

  const getPixelAlpha = (x: number, y: number): number => {
    const clampedX = Math.max(0, Math.min(width - 1, x));
    const clampedY = Math.max(0, Math.min(height - 1, y));
    const idx = (clampedY * width + clampedX) * 4;
    return rgba[idx + 3];
  };

  // Sample both absolute corners (0,0) and inset points
  const inset = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 8)));
  const tl = Math.max(getPixelAlpha(0, 0), getPixelAlpha(inset, inset));
  const tr = Math.max(getPixelAlpha(width - 1, 0), getPixelAlpha(width - 1 - inset, inset));
  const bl = Math.max(getPixelAlpha(0, height - 1), getPixelAlpha(inset, height - 1 - inset));
  const br = Math.max(getPixelAlpha(width - 1, height - 1), getPixelAlpha(width - 1 - inset, height - 1 - inset));
  const cornerAlphas: [number, number, number, number] = [tl, tr, bl, br];

  const isZeroAlphaBackground = cornerAlphas.every((a) => a <= tolerance);

  // Sample center region (inner 30% bounding box)
  const cxMin = Math.floor(width * 0.35);
  const cxMax = Math.floor(width * 0.65);
  const cyMin = Math.floor(height * 0.35);
  const cyMax = Math.floor(height * 0.65);

  let centerMaxAlpha = 0;
  let zeroAlphaCount = 0;
  let totalSampled = 0;

  // Stride-based sample for speed
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 50));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      totalSampled++;
      const a = getPixelAlpha(x, y);
      if (a <= tolerance) {
        zeroAlphaCount++;
      }
      if (x >= cxMin && x <= cxMax && y >= cyMin && y <= cyMax) {
        if (a > centerMaxAlpha) {
          centerMaxAlpha = a;
        }
      }
    }
  }

  const hasVisibleForeground = centerMaxAlpha > 10;

  return {
    isZeroAlphaBackground,
    hasVisibleForeground,
    cornerAlphas,
    centerMaxAlpha,
    zeroAlphaCount,
    totalSampled,
  };
}

/**
 * Playwright browser helper: Inspects the on-screen or off-screen canvas in the DOM.
 * Extracts RGBA pixels and verifies that the canvas background is genuinely transparent
 * (`pixels[3] === 0`), while the central visualizer contains non-zero alpha pixels.
 */
export async function validateCanvasTransparency(
  page: Page,
  canvasSelector = "canvas",
  options: { tolerance?: number; timeoutMs?: number } = {}
): Promise<AlphaValidationResult> {
  const { tolerance = 0 } = options;

  return await page.evaluate(
    ({ selector, tol }) => {
      const canvas = document.querySelector(selector) as HTMLCanvasElement | null;
      if (!canvas) {
        return {
          success: false,
          isBackgroundTransparent: false,
          hasVisibleContent: false,
          cornerAlphas: [255, 255, 255, 255] as [number, number, number, number],
          centerAlphaMax: 0,
          centerAlphaAvg: 0,
          zeroAlphaRatio: 0,
          totalPixelsSampled: 0,
          width: 0,
          height: 0,
          diagnostics: `Canvas not found with selector: "${selector}"`,
        };
      }

      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) {
        return {
          success: false,
          isBackgroundTransparent: false,
          hasVisibleContent: false,
          cornerAlphas: [255, 255, 255, 255] as [number, number, number, number],
          centerAlphaMax: 0,
          centerAlphaAvg: 0,
          zeroAlphaRatio: 0,
          totalPixelsSampled: 0,
          width,
          height,
          diagnostics: `Canvas has zero dimensions: ${width}x${height}`,
        };
      }

      // Create a temporary 2D canvas to capture WebGL or 2D pixels reliably
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx2d = tempCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx2d) {
        return {
          success: false,
          isBackgroundTransparent: false,
          hasVisibleContent: false,
          cornerAlphas: [255, 255, 255, 255] as [number, number, number, number],
          centerAlphaMax: 0,
          centerAlphaAvg: 0,
          zeroAlphaRatio: 0,
          totalPixelsSampled: 0,
          width,
          height,
          diagnostics: "Failed to obtain 2D context for pixel reading",
        };
      }

      // Draw the source canvas into our reader canvas
      ctx2d.clearRect(0, 0, width, height);
      ctx2d.drawImage(canvas, 0, 0);
      const imgData = ctx2d.getImageData(0, 0, width, height);
      const data = imgData.data;

      const getAlpha = (x: number, y: number) => {
        const cx = Math.max(0, Math.min(width - 1, x));
        const cy = Math.max(0, Math.min(height - 1, y));
        const i = (cy * width + cx) * 4;
        return data[i + 3];
      };

      const inset = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 10)));
      const tl = Math.max(getAlpha(0, 0), getAlpha(inset, inset));
      const tr = Math.max(getAlpha(width - 1, 0), getAlpha(width - 1 - inset, inset));
      const bl = Math.max(getAlpha(0, height - 1), getAlpha(inset, height - 1 - inset));
      const br = Math.max(getAlpha(width - 1, height - 1), getAlpha(width - 1 - inset, height - 1 - inset));
      const cornerAlphas: [number, number, number, number] = [tl, tr, bl, br];

      const isBackgroundTransparent = cornerAlphas.every((a) => a <= tol);

      // Center region
      const cxMin = Math.floor(width * 0.35);
      const cxMax = Math.floor(width * 0.65);
      const cyMin = Math.floor(height * 0.35);
      const cyMax = Math.floor(height * 0.65);

      let centerMax = 0;
      let centerSum = 0;
      let centerCount = 0;
      let zeroAlphaCount = 0;
      let totalSampled = 0;

      const stride = Math.max(1, Math.floor(Math.min(width, height) / 40));
      for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
          totalSampled++;
          const a = getAlpha(x, y);
          if (a <= tol) {
            zeroAlphaCount++;
          }
          if (x >= cxMin && x <= cxMax && y >= cyMin && y <= cyMax) {
            centerCount++;
            centerSum += a;
            if (a > centerMax) {
              centerMax = a;
            }
          }
        }
      }

      const centerAlphaAvg = centerCount > 0 ? centerSum / centerCount : 0;
      const zeroAlphaRatio = totalSampled > 0 ? zeroAlphaCount / totalSampled : 0;
      const hasVisibleContent = centerMax > 5;

      return {
        success: isBackgroundTransparent && hasVisibleContent,
        isBackgroundTransparent,
        hasVisibleContent,
        cornerAlphas,
        centerAlphaMax: centerMax,
        centerAlphaAvg,
        zeroAlphaRatio,
        totalPixelsSampled: totalSampled,
        width,
        height,
        diagnostics: `Corners: [${cornerAlphas.join(",")}], CenterMax: ${centerMax}, ZeroAlphaRatio: ${(zeroAlphaRatio * 100).toFixed(1)}%`,
      };
    },
    { selector: canvasSelector, tol: tolerance }
  );
}

/**
 * Validates transparency of a Base64 or Blob Data URL directly in browser.
 */
export async function validateDataUrlTransparency(
  page: Page,
  dataUrl: string,
  tolerance = 0
): Promise<AlphaValidationResult> {
  return await page.evaluate(
    async ({ url, tol }) => {
      return new Promise<AlphaValidationResult>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({
              success: false,
              isBackgroundTransparent: false,
              hasVisibleContent: false,
              cornerAlphas: [255, 255, 255, 255],
              centerAlphaMax: 0,
              centerAlphaAvg: 0,
              zeroAlphaRatio: 0,
              totalPixelsSampled: 0,
              width: img.width,
              height: img.height,
              diagnostics: "Could not create 2D context for image inspection",
            });
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          const data = imgData.data;
          const w = img.width;
          const h = img.height;

          const getAlpha = (x: number, y: number) => {
            const cx = Math.max(0, Math.min(w - 1, x));
            const cy = Math.max(0, Math.min(h - 1, y));
            return data[(cy * w + cx) * 4 + 3];
          };

          const inset = Math.max(1, Math.min(4, Math.floor(Math.min(w, h) / 10)));
          const corners: [number, number, number, number] = [
            Math.max(getAlpha(0, 0), getAlpha(inset, inset)),
            Math.max(getAlpha(w - 1, 0), getAlpha(w - 1 - inset, inset)),
            Math.max(getAlpha(0, h - 1), getAlpha(inset, h - 1 - inset)),
            Math.max(getAlpha(w - 1, h - 1), getAlpha(w - 1 - inset, h - 1 - inset)),
          ];

          const isBackgroundTransparent = corners.every((a) => a <= tol);
          let centerMax = 0;
          for (let y = Math.floor(h * 0.35); y <= Math.floor(h * 0.65); y += 2) {
            for (let x = Math.floor(w * 0.35); x <= Math.floor(w * 0.65); x += 2) {
              const a = getAlpha(x, y);
              if (a > centerMax) centerMax = a;
            }
          }

          resolve({
            success: isBackgroundTransparent && centerMax > 5,
            isBackgroundTransparent,
            hasVisibleContent: centerMax > 5,
            cornerAlphas: corners,
            centerAlphaMax: centerMax,
            centerAlphaAvg: centerMax / 2,
            zeroAlphaRatio: 0.5,
            totalPixelsSampled: 100,
            width: w,
            height: h,
            diagnostics: `DataURL Corners: [${corners.join(",")}], CenterMax: ${centerMax}`,
          });
        };
        img.onerror = () => {
          resolve({
            success: false,
            isBackgroundTransparent: false,
            hasVisibleContent: false,
            cornerAlphas: [255, 255, 255, 255],
            centerAlphaMax: 0,
            centerAlphaAvg: 0,
            zeroAlphaRatio: 0,
            totalPixelsSampled: 0,
            width: 0,
            height: 0,
            diagnostics: "Failed to load data URL image",
          });
        };
        img.src = url;
      });
    },
    { url: dataUrl, tol: tolerance }
  );
}
