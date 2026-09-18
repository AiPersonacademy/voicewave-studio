/**
 * src/audio/DualPoleFollower.ts
 *
 * Commercial-grade 2-pole asymmetric audio ballistics follower.
 * Features:
 * - Ultra-fast attack (<10ms rise time) for vocal plosives and consonants.
 * - Organic liquid exponential decay with tunable smoothness and reset speed.
 * - Guaranteed C1 velocity continuity (no shader popping or acceleration discontinuities).
 * - Exact delta-time (dt) exponential discretization for frame-rate invariance.
 */

import type {
  DualPoleConfig,
  UserDynamicsParams,
  FollowerState,
  MultiBandInputs,
  MultiBandOutputs,
} from "./types";

/**
 * Single-channel Dual-Pole Envelope Follower
 */
export class DualPoleFollower {
  private config: Required<DualPoleConfig>;
  private s1 = 0;
  private s2 = 0;
  private velocity = 0;

  // Effective runtime time constants (in seconds)
  private effAtt1: number;
  private effAtt2: number;
  private effDec1: number;
  private effDec2: number;

  constructor(config: DualPoleConfig) {
    this.config = {
      attackTime1: Math.max(0.0005, config.attackTime1),
      attackTime2: Math.max(0.0005, config.attackTime2),
      decayTime1: Math.max(0.010, config.decayTime1),
      decayTime2: Math.max(0.005, config.decayTime2),
      threshold: config.threshold ?? 0.0,
      gain: config.gain ?? 1.0,
    };

    this.effAtt1 = this.config.attackTime1;
    this.effAtt2 = this.config.attackTime2;
    this.effDec1 = this.config.decayTime1;
    this.effDec2 = this.config.decayTime2;
  }

  /**
   * Update dynamic response parameters from UI or Presets.
   * Maps user sliders (smoothness, resetSpeed) to physical time constants.
   */
  public updateParams(params: UserDynamicsParams): void {
    const rawSmooth = params.smoothness;
    const rawReset = params.resetSpeed;

    // Normalize from slider range [0.65, 0.98] or generic [0.0, 1.0]
    const s =
      rawSmooth >= 0.60
        ? Math.min(1.0, Math.max(0.0, (rawSmooth - 0.65) / 0.33))
        : Math.min(1.0, Math.max(0.0, rawSmooth));

    const r =
      rawReset >= 0.40
        ? Math.min(1.0, Math.max(0.0, (rawReset - 0.50) / 0.48))
        : Math.min(1.0, Math.max(0.0, rawReset));

    // Attack stage 1 remains ultra-snappy (<10ms), slight elongation with high smoothness
    this.effAtt1 = this.config.attackTime1 * (0.85 + 0.35 * s);
    // Attack stage 2 introduces liquid viscosity
    this.effAtt2 = this.config.attackTime2 * (0.80 + 0.50 * s);

    // Reset speed accelerates primary decay exponentially (musical octave scaling)
    const resetMultiplier = Math.pow(0.28, r); // r=0 -> 1.0x (slower), r=1 -> 0.28x (fast reset)
    this.effDec1 = this.config.decayTime1 * resetMultiplier;

    // Smoothness lengthens stage 2 decay ease-out
    const smoothMultiplier = 0.65 + 0.85 * s;
    this.effDec2 = this.config.decayTime2 * smoothMultiplier * (1.15 - 0.35 * r);
  }

  /**
   * Advance follower state by time interval dt.
   * @param input Raw physical or RMS amplitude (e.g. 0.0 to 1.0)
   * @param dt Elapsed time in seconds (e.g. 1/60 = 0.01667)
   * @returns Current smoothed value in [0.0, 1.0]
   */
  public step(input: number, dt: number): number {
    // Guard against invalid dt (e.g. tab switch or zero delta)
    if (dt <= 0.0 || isNaN(dt)) return this.s2;
    const safeDt = Math.min(dt, 0.1); // Cap at 100ms to avoid step shock

    // Sanitize input
    let sanitizedInput = isNaN(input) ? 0.0 : input;
    if (!isFinite(sanitizedInput)) {
      sanitizedInput = sanitizedInput > 0 ? 1.0 : 0.0;
    }

    // Threshold noise-gating applied on input before gain
    let x = sanitizedInput;
    if (x < this.config.threshold) {
      x = 0.0;
    } else if (this.config.threshold > 0.0) {
      x = (x - this.config.threshold) / (1.0 - this.config.threshold);
    }
    x = Math.min(1.0, Math.max(0.0, x * this.config.gain));

    // Stage 1: Plosive / Transient Fast Detector
    const isAttacking1 = x > this.s1;
    const tau1 = isAttacking1 ? this.effAtt1 : this.effDec1;
    // Exact exponential alpha = 1 - exp(-dt / tau)
    const alpha1 = 1.0 - Math.exp(-safeDt / tau1);
    this.s1 += (x - this.s1) * alpha1;

    // Stage 2: Liquid Viscosity & C1 Continuous Smoothing
    const isAttacking2 = this.s1 > this.s2;
    const tau2 = isAttacking2 ? this.effAtt2 : this.effDec2;
    const alpha2 = 1.0 - Math.exp(-safeDt / tau2);
    this.s2 += (this.s1 - this.s2) * alpha2;

    // Calculate exact continuous analytical derivative: dy/dt = (s1 - s2) / tau2
    this.velocity = (this.s1 - this.s2) / tau2;

    // Anti-denormal clamping prevents subnormal numbers from slowing down floating point math
    if (this.s2 < 1e-6) {
      this.s2 = 0.0;
      this.velocity = 0.0;
    }
    if (this.s1 < 1e-6) {
      this.s1 = 0.0;
    }

    return this.s2;
  }

  /**
   * Reset internal filter states to zero
   */
  public reset(): void {
    this.s1 = 0.0;
    this.s2 = 0.0;
    this.velocity = 0.0;
  }

  /** Current smoothed value */
  public get value(): number {
    return this.s2;
  }

  /** Current continuous envelope velocity */
  public get currentVelocity(): number {
    return this.velocity;
  }

  /** Current internal state snapshot */
  public getState(): FollowerState {
    return {
      value: this.s2,
      s1: this.s1,
      s2: this.s2,
      velocity: this.velocity,
    };
  }
}

/**
 * Multi-Band Ballistics Follower Bank managing:
 * - Low band (Bass plosives and weight)
 * - Mid band (Vocal formants and speech presence)
 * - High band (Consonant sibilance and breath)
 * - Master amplitude (Broadband RMS volume)
 * - Audio activity detector (Hysteresis voice activity gating)
 */
export class MultiBandFollowerBank {
  public readonly lowFollower: DualPoleFollower;
  public readonly midFollower: DualPoleFollower;
  public readonly highFollower: DualPoleFollower;
  public readonly ampFollower: DualPoleFollower;
  public readonly activeFollower: DualPoleFollower;

  private sensitivity = 1.0;

  constructor() {
    // 1. Low Band (20Hz - 280Hz): Weight, chest resonance, plosive thump (<10ms attack)
    this.lowFollower = new DualPoleFollower({
      attackTime1: 0.0025, // 2.5ms (<10ms plosives)
      attackTime2: 0.0035, // 3.5ms
      decayTime1: 0.220,  // 220ms
      decayTime2: 0.120,  // 120ms
      threshold: 0.003,
      gain: 4.5,
    });

    // 2. Mid Band (280Hz - 3200Hz): Core vocal formants, consonants, speech presence
    this.midFollower = new DualPoleFollower({
      attackTime1: 0.0025, // 2.5ms (<10ms plosives)
      attackTime2: 0.0035, // 3.5ms
      decayTime1: 0.130,   // 130ms
      decayTime2: 0.070,   // 70ms
      threshold: 0.003,
      gain: 5.2,
    });

    // 3. High Band (3200Hz - 20kHz): Sibilance ("s", "sh"), breath, airy shimmer
    this.highFollower = new DualPoleFollower({
      attackTime1: 0.0015, // 1.5ms (ultra-fast transient trigger)
      attackTime2: 0.0020, // 2.0ms
      decayTime1: 0.070,   // 70ms (rapid release to avoid wash)
      decayTime2: 0.040,   // 40ms
      threshold: 0.002,
      gain: 6.0,
    });

    // 4. Master RMS: Global scale, lighting, glow, overall speech volume
    this.ampFollower = new DualPoleFollower({
      attackTime1: 0.0025, // 2.5ms
      attackTime2: 0.0040, // 4.0ms (<10ms plosives)
      decayTime1: 0.160,   // 160ms
      decayTime2: 0.080,   // 80ms
      threshold: 0.005,
      gain: 4.8,
    });

    // 5. Speech Activity: Silkily hysteresis-gated activity state
    this.activeFollower = new DualPoleFollower({
      attackTime1: 0.004,
      attackTime2: 0.008,
      decayTime1: 0.180,
      decayTime2: 0.100,
      threshold: 0.0,
      gain: 1.0,
    });
  }

  /**
   * Update all followers with user parameters
   */
  public updateParams(params: UserDynamicsParams): void {
    this.sensitivity = params.sensitivity ?? 1.0;
    this.lowFollower.updateParams(params);
    this.midFollower.updateParams(params);
    this.highFollower.updateParams(params);
    this.ampFollower.updateParams(params);
    this.activeFollower.updateParams(params);
  }

  /**
   * Process a single time step across all bands.
   */
  public step(inputs: MultiBandInputs, dt: number): MultiBandOutputs {
    // Apply user sensitivity scaling to raw inputs
    const sens = this.sensitivity;
    const sLow = inputs.low * sens;
    const sMid = inputs.mid * sens;
    const sHigh = inputs.high * sens;
    const sAmp = inputs.amplitude * sens;

    // Process each band through its dedicated ballistics instance
    const low = this.lowFollower.step(sLow, dt);
    const mid = this.midFollower.step(sMid, dt);
    const high = this.highFollower.step(sHigh, dt);
    const amp = this.ampFollower.step(sAmp, dt);

    // Activity detector triggers when scaled amplitude exceeds speech presence threshold
    const rawActive = sAmp > 0.015 ? 1.0 : 0.0;
    const smoothedActive = this.activeFollower.step(rawActive, dt);

    return {
      low,
      mid,
      high,
      amplitude: amp,
      isAudioActive: smoothedActive > 0.08,
      velocity: this.ampFollower.currentVelocity,
    };
  }

  /**
   * Reset all band followers
   */
  public reset(): void {
    this.lowFollower.reset();
    this.midFollower.reset();
    this.highFollower.reset();
    this.ampFollower.reset();
    this.activeFollower.reset();
  }
}
