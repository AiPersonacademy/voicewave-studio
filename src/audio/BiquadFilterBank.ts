/**
 * src/audio/BiquadFilterBank.ts
 *
 * 3-Band Biquad IIR Filter Bank isolating Low (280Hz), Mid (1200Hz, Q=1.2), and High (3200Hz).
 * Implemented using Direct Form II Transposed difference equations with anti-denormal clamping.
 * Formulated for exact mathematical parity with Web Audio BiquadFilterNodes.
 */

import type {
  BiquadType,
  BiquadCoefficients,
  BiquadFilterConfig,
} from "./types";

/**
 * Single 2nd-order Biquad IIR Filter implemented via Direct Form II Transposed.
 * Computes exact bilinear-transformed coefficients per the Audio EQ Cookbook (Robert Bristow-Johnson).
 */
export class BiquadFilter {
  readonly type: BiquadType;
  readonly frequency: number;
  readonly q: number;
  readonly sampleRate: number;
  readonly coeffs: BiquadCoefficients;

  // State registers for Direct Form II Transposed
  private s1 = 0;
  private s2 = 0;

  constructor(config: BiquadFilterConfig) {
    this.type = config.type;
    this.frequency = config.frequency;
    this.q = config.q;
    this.sampleRate = config.sampleRate;
    this.coeffs = BiquadFilter.computeCoefficients(
      this.type,
      this.frequency,
      this.q,
      this.sampleRate
    );
  }

  /**
   * Compute normalized Direct Form II Transposed biquad coefficients
   */
  static computeCoefficients(
    type: BiquadType,
    fc: number,
    q: number,
    fs: number
  ): BiquadCoefficients {
    // Safety clamp frequency to strictly below Nyquist (0.49 * fs)
    const safeFc = Math.min(Math.max(10, fc), fs * 0.49);
    const safeQ = Math.max(0.01, q);

    const w0 = (2 * Math.PI * safeFc) / fs;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * safeQ);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;

    switch (type) {
      case "lowpass":
        b0 = (1 - cosw0) * 0.5;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) * 0.5;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;

      case "bandpass":
        // Constant 0 dB peak gain bandpass
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;

      case "highpass":
        b0 = (1 + cosw0) * 0.5;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) * 0.5;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
    }

    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0,
    };
  }

  /**
   * Process a single audio sample using Direct Form II Transposed.
   * State update:
   * y[n]  = b0 * x[n] + s1[n-1]
   * s1[n] = b1 * x[n] - a1 * y[n] + s2[n-1]
   * s2[n] = b2 * x[n] - a2 * y[n]
   */
  step(x: number): number {
    let sample = x;
    if (!Number.isFinite(sample)) sample = 0.0;

    const y = this.coeffs.b0 * sample + this.s1;
    this.s1 = this.coeffs.b1 * sample - this.coeffs.a1 * y + this.s2;
    this.s2 = this.coeffs.b2 * sample - this.coeffs.a2 * y;

    // Combined anti-denormal clamping and non-finite state recovery
    if (!Number.isFinite(this.s1) || Math.abs(this.s1) < 1e-15) this.s1 = 0.0;
    if (!Number.isFinite(this.s2) || Math.abs(this.s2) < 1e-15) this.s2 = 0.0;

    return Number.isFinite(y) ? y : 0.0;
  }

  /**
   * Process an entire Float32Array PCM buffer in-place or into output buffer
   */
  process(input: Float32Array, output?: Float32Array): Float32Array {
    const out = output || new Float32Array(input.length);
    const len = input.length;
    for (let i = 0; i < len; i++) {
      out[i] = this.step(input[i]);
    }
    return out;
  }

  /**
   * Reset internal delay registers to zero
   */
  reset(): void {
    this.s1 = 0;
    this.s2 = 0;
  }

  /**
   * Analytical complex transfer function magnitude |H(e^{j\omega})| at frequency f (Hz)
   */
  getMagnitudeResponse(f: number): number {
    if (f <= 0) {
      // Direct DC gain evaluation
      const numDC = this.coeffs.b0 + this.coeffs.b1 + this.coeffs.b2;
      const denDC = 1 + this.coeffs.a1 + this.coeffs.a2;
      return denDC === 0 ? 0 : Math.abs(numDC / denDC);
    }

    const w = (2 * Math.PI * f) / this.sampleRate;
    const cosw = Math.cos(w);
    const sinw = Math.sin(w);
    const cos2w = Math.cos(2 * w);
    const sin2w = Math.sin(2 * w);

    // Numerator: b0 + b1*e^{-jw} + b2*e^{-j2w}
    const numReal = this.coeffs.b0 + this.coeffs.b1 * cosw + this.coeffs.b2 * cos2w;
    const numImag = -this.coeffs.b1 * sinw - this.coeffs.b2 * sin2w;

    // Denominator: 1 + a1*e^{-jw} + a2*e^{-j2w}
    const denReal = 1 + this.coeffs.a1 * cosw + this.coeffs.a2 * cos2w;
    const denImag = -this.coeffs.a1 * sinw - this.coeffs.a2 * sin2w;

    const numMagSq = numReal * numReal + numImag * numImag;
    const denMagSq = denReal * denReal + denImag * denImag;

    return denMagSq === 0 ? 0 : Math.sqrt(numMagSq / denMagSq);
  }
}

/**
 * 3-Band Biquad Filter Bank isolating:
 * - Low: 280 Hz Lowpass (Butterworth Q = 0.70710678)
 * - Mid: 1,200 Hz Bandpass (Q = 1.2)
 * - High: 3,200 Hz Highpass (Butterworth Q = 0.70710678)
 */
export class BiquadFilterBank {
  readonly sampleRate: number;
  readonly lowFilter: BiquadFilter;
  readonly midFilter: BiquadFilter;
  readonly highFilter: BiquadFilter;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.lowFilter = new BiquadFilter({
      type: "lowpass",
      frequency: 280,
      q: 0.70710678,
      sampleRate,
    });
    this.midFilter = new BiquadFilter({
      type: "bandpass",
      frequency: 1200,
      q: 1.2,
      sampleRate,
    });
    this.highFilter = new BiquadFilter({
      type: "highpass",
      frequency: 3200,
      q: 0.70710678,
      sampleRate,
    });
  }

  /**
   * Filter mono PCM audio buffer into three isolated Float32Array bands
   */
  processBands(monoPCM: Float32Array): {
    low: Float32Array;
    mid: Float32Array;
    high: Float32Array;
  } {
    const len = monoPCM.length;
    const low = new Float32Array(len);
    const mid = new Float32Array(len);
    const high = new Float32Array(len);

    for (let i = 0; i < len; i++) {
      const s = monoPCM[i];
      low[i] = this.lowFilter.step(s);
      mid[i] = this.midFilter.step(s);
      high[i] = this.highFilter.step(s);
    }

    return { low, mid, high };
  }

  /**
   * Reset all filter states in the bank
   */
  reset(): void {
    this.lowFilter.reset();
    this.midFilter.reset();
    this.highFilter.reset();
  }
}
