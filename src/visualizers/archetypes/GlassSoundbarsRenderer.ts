/**
 * src/visualizers/archetypes/GlassSoundbarsRenderer.ts
 *
 * Archetype 6: Neomorphic Glass Soundbars
 * 28 vertical Apple Music pill bars with 2nd-order underdamped spring-damper physics (zeta = 0.72),
 * translucent frosted glass bodies, specular top cap glares, and zero-halo transparent compositing.
 *
 * Supports both WebGL (primary, zero context conflicts) and Canvas 2D (fallback).
 * Conforms to PROJECT.md §Interface Contracts.
 */

import type { VisualizerRenderer, VisualizerRenderParams, ColorRGB } from "../types";
import { STANDARD_WEBGL_FLAGS } from "../WebGLContextManager";
import { interpolatePalette } from "../palettes";

interface SoundbarPhysicsState {
  currentHeight: number; // Normalized height [0, 1]
  velocity: number;      // First derivative dy/dt
  targetHeight: number;  // Target height from audio spectrum
  peakHeight: number;    // Peak hold drop indicator
  peakVelocity: number;  // Peak drop velocity
}

export class GlassSoundbarsRenderer implements VisualizerRenderer {
  readonly id = "glass-soundbars";
  readonly name = "Neomorphic Glass Soundbars";
  readonly description = "Apple Music pill bars with 2nd-order underdamped spring-damper physics (zeta = 0.72)";
  readonly substrate = "webgl";

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private quadBuffer: WebGLBuffer | null = null;

  // 28 frequency bars across the spectrum
  private readonly barCount = 28;
  private bars: SoundbarPhysicsState[] = [];
  private barHeightsArray = new Float32Array(28);
  private peakHeightsArray = new Float32Array(28);

  // Physics constants: zeta = 0.72 (Cupertino organic underdamped bounce)
  private readonly zeta = 0.72;
  private readonly omegaN = 34.0; // Natural angular frequency in rad/s

  private lastTime = 0;
  private width = 0;
  private height = 0;

  // WebGL uniform locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uAspectLoc: WebGLUniformLocation | null = null;
  private uScaleLoc: WebGLUniformLocation | null = null;
  private uGlowLoc: WebGLUniformLocation | null = null;
  private uTransparentLoc: WebGLUniformLocation | null = null;
  private uColor0Loc: WebGLUniformLocation | null = null;
  private uColor1Loc: WebGLUniformLocation | null = null;
  private uColor2Loc: WebGLUniformLocation | null = null;
  private uColor3Loc: WebGLUniformLocation | null = null;
  private uBarHeightsLoc: WebGLUniformLocation | null = null;
  private uPeakHeightsLoc: WebGLUniformLocation | null = null;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.width = canvas.width || 800;
    this.height = canvas.height || 800;

    // Initialize bar physics state
    this.bars = [];
    for (let i = 0; i < this.barCount; i++) {
      this.bars.push({
        currentHeight: 0.08,
        velocity: 0,
        targetHeight: 0.08,
        peakHeight: 0.08,
        peakVelocity: 0,
      });
      this.barHeightsArray[i] = 0.08;
      this.peakHeightsArray[i] = 0.08;
    }

    // Try WebGL first (preserves single WebGL context across all 8 archetypes)
    const gl =
      (canvas.getContext("webgl2", STANDARD_WEBGL_FLAGS) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", STANDARD_WEBGL_FLAGS) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", STANDARD_WEBGL_FLAGS) as WebGLRenderingContext | null);

    if (gl) {
      this.gl = gl;
      this.initWebGL(gl);
    } else {
      // Fallback to Canvas 2D if canvas was already in 2D mode
      const ctx2d = canvas.getContext("2d", { alpha: true });
      if (ctx2d) {
        this.ctx2d = ctx2d;
      }
    }
  }

  private initWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    const vsSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;

      uniform vec2 uResolution;
      uniform float uAspect;
      uniform float uScale;
      uniform float uGlow;
      uniform float uTransparent;
      uniform vec4 uColor0;
      uniform vec4 uColor1;
      uniform vec4 uColor2;
      uniform vec4 uColor3;
      uniform float uBarHeights[28];
      uniform float uPeakHeights[28];

      // Capsule / Pill SDF in 2D
      float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h) - r;
      }

      vec3 interpolatePalette(float t) {
        float ct = clamp(t, 0.0, 1.0);
        if (ct < 0.333) {
          return mix(uColor0.rgb, uColor1.rgb, ct * 3.0);
        } else if (ct < 0.666) {
          return mix(uColor1.rgb, uColor2.rgb, (ct - 0.333) * 3.0);
        } else {
          return mix(uColor2.rgb, uColor3.rgb, (ct - 0.666) * 3.0);
        }
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * min(uResolution.x, uResolution.y));
        uv /= max(0.5, uScale);

        float totalWidth = 1.6;
        float slotWidth = totalWidth / 28.0;
        float barWidth = slotWidth * 0.68;
        float barRadius = barWidth * 0.5;
        float startX = -totalWidth * 0.5 + slotWidth * 0.5;
        float baseY = -0.55;
        float maxHeight = 1.1;

        vec3 colAcc = vec3(0.0);
        float alphaAcc = 0.0;

        // Bounding box check for performance
        if (uv.y >= baseY - barRadius - 0.2 && uv.y <= baseY + maxHeight + 0.3 &&
            uv.x >= -totalWidth * 0.5 - 0.2 && uv.x <= totalWidth * 0.5 + 0.2) {

          for (int i = 0; i < 28; i++) {
            float barX = startX + float(i) * slotWidth;
            float h = uBarHeights[i] * maxHeight;
            float peakH = uPeakHeights[i] * maxHeight;

            vec2 pA = vec2(barX, baseY);
            vec2 pB = vec2(barX, baseY + h);
            float dPill = sdCapsule(uv, pA, pB, barRadius);

            float normIdx = float(i) / 27.0;
            vec3 barColor = interpolatePalette(normIdx);

            // Ambient bar glow
            float glowDist = max(dPill, 0.0);
            float glow = exp(-glowDist * 14.0) * (0.15 + 0.25 * uGlow) * uBarHeights[i];
            colAcc += barColor * glow;
            alphaAcc += glow * 0.45;

            // Bar solid body
            if (dPill <= 0.0) {
              float vNorm = clamp((uv.y - baseY) / max(h, 0.01), 0.0, 1.0);
              
              // Vertical neomorphic glass gradient
              vec3 glassCol = mix(barColor * 0.7, barColor * 1.15, vNorm);
              
              // Top cap specular highlight glare
              float capDist = length(uv - pB);
              float glare = exp(-capDist * capDist / (barRadius * barRadius * 1.5)) * 0.85;
              glassCol += vec3(glare);

              // Hairline glass edge bevel
              float edge = smoothstep(-0.008, 0.0, dPill);
              glassCol += vec3(0.35) * edge;

              colAcc = max(colAcc, glassCol);
              alphaAcc = max(alphaAcc, 0.92);
            }

            // Floating peak hold drop indicator
            vec2 peakPos = vec2(barX, baseY + peakH + barRadius + 0.02);
            float dPeak = length(uv - peakPos) - (barRadius * 0.45);
            if (dPeak <= 0.0) {
              vec3 peakCol = mix(barColor, vec3(1.0), 0.75);
              colAcc = max(colAcc, peakCol);
              alphaAcc = max(alphaAcc, 0.95);
            }
          }
        }

        colAcc = clamp(colAcc, 0.0, 1.0);
        float lum = max(colAcc.r, max(colAcc.g, colAcc.b));
        float finalAlpha = smoothstep(0.005, 0.045, lum) * clamp(alphaAcc, 0.0, 1.0);

        if (uTransparent > 0.5) {
          gl_FragColor = vec4(colAcc * finalAlpha, finalAlpha);
        } else {
          gl_FragColor = vec4(colAcc, 1.0);
        }
      }
    `;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error("Failed to create WebGL program");
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`Failed to link GlassSoundbars WebGL program: ${info}`);
    }

    this.program = program;
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Fullscreen quad buffer
    const quadVertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) throw new Error("Failed to create quad buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    this.quadBuffer = quadBuffer;

    // Cache uniforms
    this.uResolutionLoc = gl.getUniformLocation(program, "uResolution");
    this.uAspectLoc = gl.getUniformLocation(program, "uAspect");
    this.uScaleLoc = gl.getUniformLocation(program, "uScale");
    this.uGlowLoc = gl.getUniformLocation(program, "uGlow");
    this.uTransparentLoc = gl.getUniformLocation(program, "uTransparent");
    this.uColor0Loc = gl.getUniformLocation(program, "uColor0");
    this.uColor1Loc = gl.getUniformLocation(program, "uColor1");
    this.uColor2Loc = gl.getUniformLocation(program, "uColor2");
    this.uColor3Loc = gl.getUniformLocation(program, "uColor3");
    this.uBarHeightsLoc = gl.getUniformLocation(program, "uBarHeights");
    this.uPeakHeightsLoc = gl.getUniformLocation(program, "uPeakHeights");
  }

  private compileShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${info}`);
    }
    return shader;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  render(params: VisualizerRenderParams): void {
    if (this.width === 0 || this.height === 0) return;

    const now = params.time;
    let dt = this.lastTime > 0 ? now - this.lastTime : 0.016;
    this.lastTime = now;
    if (dt <= 0 || dt > 0.05) dt = 0.016;

    // 1. Advance 2nd-Order Spring-Damper Physics
    this.updatePhysics(params, dt);

    // 2. Render via WebGL if available, otherwise Canvas 2D
    if (this.gl && this.program && this.quadBuffer) {
      this.renderWebGL(params);
    } else if (this.ctx2d) {
      this.renderCanvas2D(this.ctx2d, params);
    }
  }

  private updatePhysics(params: VisualizerRenderParams, dt: number): void {
    const K = this.barCount;
    const minHeight = 0.05; // Idle breathing floor

    for (let k = 0; k < K; k++) {
      const bar = this.bars[k];
      const normFreq = k / (K - 1); // 0.0 (bass) to 1.0 (treble)

      // Frequency band spectral distribution curves:
      const wLow = Math.exp(-Math.pow((normFreq - 0.1) / 0.16, 2));
      const wMid = Math.exp(-Math.pow((normFreq - 0.45) / 0.24, 2));
      const wHigh = Math.exp(-Math.pow((normFreq - 0.85) / 0.22, 2));

      // Bar turbulence modulation (sinusoidal lively flutter)
      const phaseOffset = k * 0.42 + params.phase * 3.0;
      const flutter = 1.0 + 0.22 * params.turbulence * Math.sin(phaseOffset);

      // Synthesize composite target height [minHeight, 1.0]
      const rawTarget =
        (wLow * params.low * 1.15 + wMid * params.mid * 1.0 + wHigh * params.high * 0.85) *
        params.sensitivity *
        flutter;

      bar.targetHeight = Math.min(1.0, Math.max(minHeight, rawTarget * params.scale));

      // 2nd-Order Harmonic Oscillator Integration:
      const displacement = bar.currentHeight - bar.targetHeight;
      const springAcc = -this.omegaN * this.omegaN * displacement - 2.0 * this.zeta * this.omegaN * bar.velocity;

      bar.velocity += springAcc * dt;
      bar.currentHeight += bar.velocity * dt;

      if (bar.currentHeight < minHeight) {
        bar.currentHeight = minHeight;
        if (bar.velocity < 0) bar.velocity = 0;
      }
      if (bar.currentHeight > 1.05) {
        bar.currentHeight = 1.05;
        if (bar.velocity > 0) bar.velocity = 0;
      }

      // Floating peak hold indicator physics (gravity drop)
      if (bar.currentHeight >= bar.peakHeight) {
        bar.peakHeight = bar.currentHeight;
        bar.peakVelocity = 0;
      } else {
        bar.peakVelocity += 1.8 * dt;
        bar.peakHeight -= bar.peakVelocity * dt;
        if (bar.peakHeight < bar.currentHeight) {
          bar.peakHeight = bar.currentHeight;
          bar.peakVelocity = 0;
        }
      }

      this.barHeightsArray[k] = bar.currentHeight;
      this.peakHeightsArray[k] = bar.peakHeight;
    }
  }

  private renderWebGL(params: VisualizerRenderParams): void {
    const gl = this.gl!;
    const program = this.program!;

    gl.viewport(0, 0, this.width, this.height);
    if (params.isTransparent) {
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
    } else {
      gl.clearColor(0.02, 0.02, 0.03, 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const aPosLoc = gl.getAttribLocation(program, "aPosition");
    if (aPosLoc !== -1) {
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
    }

    if (this.uResolutionLoc) gl.uniform2f(this.uResolutionLoc, this.width, this.height);
    if (this.uAspectLoc) gl.uniform1f(this.uAspectLoc, params.aspectRatio);
    if (this.uScaleLoc) gl.uniform1f(this.uScaleLoc, params.scale);
    if (this.uGlowLoc) gl.uniform1f(this.uGlowLoc, params.glow);
    if (this.uTransparentLoc) gl.uniform1f(this.uTransparentLoc, params.isTransparent ? 1.0 : 0.0);

    const p = params.palette;
    const p0 = p[0] || [0.05, 0.45, 1.0];
    const p1 = p[1] || [0.95, 0.25, 0.4];
    const p2 = p[2] || [0.0, 0.95, 0.65];
    const p3 = p[3] || [1.0, 0.7, 0.1];

    if (this.uColor0Loc) gl.uniform4f(this.uColor0Loc, p0[0], p0[1], p0[2], 1.0);
    if (this.uColor1Loc) gl.uniform4f(this.uColor1Loc, p1[0], p1[1], p1[2], 1.0);
    if (this.uColor2Loc) gl.uniform4f(this.uColor2Loc, p2[0], p2[1], p2[2], 1.0);
    if (this.uColor3Loc) gl.uniform4f(this.uColor3Loc, p3[0], p3[1], p3[2], 1.0);

    if (this.uBarHeightsLoc) gl.uniform1fv(this.uBarHeightsLoc, this.barHeightsArray);
    if (this.uPeakHeightsLoc) gl.uniform1fv(this.uPeakHeightsLoc, this.peakHeightsArray);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (aPosLoc !== -1) gl.disableVertexAttribArray(aPosLoc);
  }

  private renderCanvas2D(ctx: CanvasRenderingContext2D, params: VisualizerRenderParams): void {
    const W = this.width;
    const H = this.height;
    const K = this.barCount;

    if (params.isTransparent) {
      ctx.clearRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);
    }

    const p = params.palette;
    const c0: ColorRGB = p[0] || [0.05, 0.45, 1.0];
    const c1: ColorRGB = p[1] || [0.95, 0.25, 0.4];
    const c2: ColorRGB = p[2] || [0.0, 0.95, 0.65];
    const c3: ColorRGB = p[3] || [1.0, 0.7, 0.1];

    const availableWidth = W * 0.82;
    const maxBarHeight = H * 0.65;
    const totalSpacingRatio = 0.35;
    const totalSlots = K + (K - 1) * totalSpacingRatio;
    const barWidth = Math.max(4, Math.min(24, availableWidth / totalSlots));
    const barGap = barWidth * totalSpacingRatio;
    const totalRenderedWidth = K * barWidth + (K - 1) * barGap;

    const startX = (W - totalRenderedWidth) / 2;
    const baseY = H * 0.78;
    const cornerRadius = barWidth / 2;

    for (let k = 0; k < K; k++) {
      const bar = this.bars[k];
      const h = bar.currentHeight * maxBarHeight;
      const x = startX + k * (barWidth + barGap);
      const y = baseY - h;

      const [r, g, b] = interpolatePalette(k / (K - 1), c0, c1, c2, c3);
      const r255 = Math.round(r * 255);
      const g255 = Math.round(g * 255);
      const b255 = Math.round(b * 255);

      const grad = ctx.createLinearGradient(x, baseY, x, y);
      grad.addColorStop(0, `rgba(${r255}, ${g255}, ${b255}, 0.72)`);
      grad.addColorStop(0.7, `rgba(${r255}, ${g255}, ${b255}, 0.88)`);
      grad.addColorStop(1, `rgba(255, 255, 255, 0.95)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, barWidth, h, [cornerRadius, cornerRadius, 2, 2]);
      } else {
        ctx.rect(x, y, barWidth, h);
      }
      ctx.fill();

      // Peak drop dot
      const peakY = baseY - bar.peakHeight * maxBarHeight - cornerRadius;
      ctx.fillStyle = `rgba(${r255}, ${g255}, ${b255}, 0.9)`;
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, peakY, cornerRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  destroy(): void {
    const gl = this.gl;
    if (gl) {
      if (this.quadBuffer) {
        gl.deleteBuffer(this.quadBuffer);
        this.quadBuffer = null;
      }
      if (this.program) {
        gl.deleteProgram(this.program);
        this.program = null;
      }
    }
    this.gl = null;
    this.ctx2d = null;
    this.canvas = null;
  }
}
