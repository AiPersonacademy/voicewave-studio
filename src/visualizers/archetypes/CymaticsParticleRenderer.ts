/**
 * src/visualizers/archetypes/CymaticsParticleRenderer.ts
 *
 * Archetype 5: Acoustic Particle Cymatics
 * 3,072+ quantum dust particles migrating along nodal lines of Ernst Chladni
 * standing wave potential fields: w(x,y) = a*sin(n*pi*x)*sin(m*pi*y) - b*sin(m*pi*x)*sin(n*pi*y).
 *
 * High-performance WebGL point sprites with true premultiplied alpha
 * and Verlet/Euler acoustic trapping integration.
 * Conforms to PROJECT.md §Interface Contracts.
 */

import type { VisualizerRenderer, VisualizerRenderParams } from "../types";
import { STANDARD_WEBGL_FLAGS } from "../WebGLContextManager";

export class CymaticsParticleRenderer implements VisualizerRenderer {
  readonly id = "cymatics-particle";
  readonly name = "Acoustic Particle Cymatics";
  readonly description = "Chladni nodal plate standing wave dust with WebGL point sprites";
  readonly substrate = "webgl";

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;

  // Particle simulation buffers (3,072 particles)
  private readonly particleCount = 3072;
  private posX: Float32Array = new Float32Array(this.particleCount);
  private posY: Float32Array = new Float32Array(this.particleCount);
  private velX: Float32Array = new Float32Array(this.particleCount);
  private velY: Float32Array = new Float32Array(this.particleCount);
  private intensity: Float32Array = new Float32Array(this.particleCount);

  // WebGL attribute stream: [x, y, intensity] * particleCount = 3 * N floats
  private gpuBufferData: Float32Array = new Float32Array(this.particleCount * 3);

  // Uniform locations cache
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uPointSizeLoc: WebGLUniformLocation | null = null;
  private uScaleLoc: WebGLUniformLocation | null = null;
  private uAspectLoc: WebGLUniformLocation | null = null;
  private uGlowLoc: WebGLUniformLocation | null = null;
  private uTransparentLoc: WebGLUniformLocation | null = null;
  private uColor0Loc: WebGLUniformLocation | null = null;
  private uColor1Loc: WebGLUniformLocation | null = null;
  private uColor2Loc: WebGLUniformLocation | null = null;
  private uColor3Loc: WebGLUniformLocation | null = null;

  private lastTime = 0;
  private width = 0;
  private height = 0;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.width = canvas.width || 800;
    this.height = canvas.height || 800;

    const gl =
      (canvas.getContext("webgl2", STANDARD_WEBGL_FLAGS) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", STANDARD_WEBGL_FLAGS) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", STANDARD_WEBGL_FLAGS) as WebGLRenderingContext | null);

    if (!gl) {
      throw new Error("WebGL is not supported in this environment");
    }
    this.gl = gl;

    this.initShaders(gl);
    this.initParticles();
    this.initBuffers(gl);
  }

  private initShaders(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    const vsSource = `
      precision mediump float;
      attribute vec2 aPosition;
      attribute float aIntensity;

      uniform vec2 uResolution;
      uniform float uPointSize;
      uniform float uScale;
      uniform float uAspect;

      varying float vIntensity;

      void main() {
        vIntensity = aIntensity;
        vec2 p = aPosition * uScale;
        
        // Preserve circular aspect ratio without distortion
        if (uAspect >= 1.0) {
          p.x /= uAspect;
        } else {
          p.y *= uAspect;
        }

        gl_Position = vec4(p, 0.0, 1.0);
        gl_PointSize = uPointSize * (1.0 + aIntensity * 0.85);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying float vIntensity;

      uniform vec3 uColor0;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uGlow;
      uniform float uTransparent;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float r2 = dot(coord, coord);
        if (r2 > 0.25) {
          discard;
        }

        // Dual Gaussian profile: intense sharp core + soft outer quantum halo
        float core = exp(-r2 * 28.0);
        float halo = exp(-r2 * 7.0) * 0.45;
        float alpha = (core + halo) * clamp(0.45 + 0.55 * vIntensity, 0.0, 1.0);

        // 4-stop color interpolation along acoustic intensity
        vec3 col;
        if (vIntensity < 0.333) {
          col = mix(uColor0, uColor1, vIntensity * 3.0);
        } else if (vIntensity < 0.666) {
          col = mix(uColor1, uColor2, (vIntensity - 0.333) * 3.0);
        } else {
          col = mix(uColor2, uColor3, (vIntensity - 0.666) * 3.0);
        }

        // Specular glow amplification
        col *= (1.0 + uGlow * 1.25);
        col = min(col, vec3(1.0));
        alpha = clamp(alpha * (1.0 + uGlow * 0.2), 0.0, 1.0);

        // True premultiplied alpha output for zero-halo compositing
        if (uTransparent > 0.5) {
          gl_FragColor = vec4(col * alpha, alpha);
        } else {
          gl_FragColor = vec4(col * alpha, 1.0);
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
      throw new Error(`Failed to link Cymatics WebGL program: ${info}`);
    }

    this.program = program;
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Cache uniform locations
    this.uResolutionLoc = gl.getUniformLocation(program, "uResolution");
    this.uPointSizeLoc = gl.getUniformLocation(program, "uPointSize");
    this.uScaleLoc = gl.getUniformLocation(program, "uScale");
    this.uAspectLoc = gl.getUniformLocation(program, "uAspect");
    this.uGlowLoc = gl.getUniformLocation(program, "uGlow");
    this.uTransparentLoc = gl.getUniformLocation(program, "uTransparent");
    this.uColor0Loc = gl.getUniformLocation(program, "uColor0");
    this.uColor1Loc = gl.getUniformLocation(program, "uColor1");
    this.uColor2Loc = gl.getUniformLocation(program, "uColor2");
    this.uColor3Loc = gl.getUniformLocation(program, "uColor3");
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

  private initParticles(): void {
    const N = this.particleCount;
    for (let i = 0; i < N; i++) {
      // Uniform random distribution in unit disk
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 0.88;
      this.posX[i] = Math.cos(angle) * radius;
      this.posY[i] = Math.sin(angle) * radius;
      this.velX[i] = (Math.random() - 0.5) * 0.02;
      this.velY[i] = (Math.random() - 0.5) * 0.02;
      this.intensity[i] = Math.random();
    }
  }

  private initBuffers(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    const buf = gl.createBuffer();
    if (!buf) throw new Error("Failed to create WebGL buffer");
    this.vertexBuffer = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.gpuBufferData.byteLength, gl.DYNAMIC_DRAW);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  render(params: VisualizerRenderParams): void {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program || !this.vertexBuffer) return;

    // Time delta computation
    const now = params.time;
    let dt = this.lastTime > 0 ? now - this.lastTime : 0.016;
    this.lastTime = now;
    if (dt <= 0 || dt > 0.05) dt = 0.016;

    // 1. Simulation Physics Update (CPU Chladni Field)
    this.updatePhysics(params, dt);

    // 2. Upload particle vertex data to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.gpuBufferData);

    // 3. Setup WebGL State
    gl.viewport(0, 0, this.width, this.height);
    if (params.isTransparent) {
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
    } else {
      gl.clearColor(0.02, 0.02, 0.03, 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Bind Attributes
    const aPosLoc = gl.getAttribLocation(program, "aPosition");
    const aIntLoc = gl.getAttribLocation(program, "aIntensity");
    const stride = 3 * Float32Array.BYTES_PER_ELEMENT;

    if (aPosLoc !== -1) {
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
    }

    if (aIntLoc !== -1) {
      gl.enableVertexAttribArray(aIntLoc);
      gl.vertexAttribPointer(aIntLoc, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    }

    // Set Uniforms
    if (this.uResolutionLoc) gl.uniform2f(this.uResolutionLoc, this.width, this.height);
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    if (this.uPointSizeLoc) gl.uniform1f(this.uPointSizeLoc, 4.5 * dpr * Math.max(0.6, params.scale));
    if (this.uScaleLoc) gl.uniform1f(this.uScaleLoc, params.scale);
    if (this.uAspectLoc) gl.uniform1f(this.uAspectLoc, params.aspectRatio);
    if (this.uGlowLoc) gl.uniform1f(this.uGlowLoc, params.glow);
    if (this.uTransparentLoc) gl.uniform1f(this.uTransparentLoc, params.isTransparent ? 1.0 : 0.0);

    // Palettes (4 RGB tuples)
    const p = params.palette;
    const p0 = p[0] || [0.05, 0.45, 1.0];
    const p1 = p[1] || [0.95, 0.25, 0.4];
    const p2 = p[2] || [0.0, 0.95, 0.65];
    const p3 = p[3] || [1.0, 0.7, 0.1];

    if (this.uColor0Loc) gl.uniform3f(this.uColor0Loc, p0[0], p0[1], p0[2]);
    if (this.uColor1Loc) gl.uniform3f(this.uColor1Loc, p1[0], p1[1], p1[2]);
    if (this.uColor2Loc) gl.uniform3f(this.uColor2Loc, p2[0], p2[1], p2[2]);
    if (this.uColor3Loc) gl.uniform3f(this.uColor3Loc, p3[0], p3[1], p3[2]);

    // Blending: Additive with Premultiplied Alpha
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Render Point Sprites
    gl.drawArrays(gl.POINTS, 0, this.particleCount);

    if (aPosLoc !== -1) gl.disableVertexAttribArray(aPosLoc);
    if (aIntLoc !== -1) gl.disableVertexAttribArray(aIntLoc);
  }

  private updatePhysics(params: VisualizerRenderParams, dt: number): void {
    const N = this.particleCount;

    // Chladni modal frequencies driven by audio bands:
    // Bass drives fundamental mode n in [2, 5]
    // Vocal mid drives formant harmonic m in [3, 7]
    const n = 2.0 + Math.round(params.low * 3.0);
    const m = 3.0 + Math.round(params.mid * 4.0);

    // Modal wave numbers
    const kn = (n * Math.PI) / 2.0;
    const km = (m * Math.PI) / 2.0;

    // Relative modal weights modulated by treble & phase
    const a = 1.0;
    const b = 0.85 + 0.35 * Math.sin(params.phase * 0.4) + 0.25 * params.high;

    // Acoustic trapping force strength
    const baseForce = 28.0 * params.sensitivity * (params.amplitude + 0.12);
    const damping = Math.pow(0.86, dt / 0.016);
    const jitterMag = params.turbulence * (0.01 + 0.08 * params.high);
    const maxRadius = 0.94;

    let gpuIdx = 0;

    for (let i = 0; i < N; i++) {
      let x = this.posX[i];
      let y = this.posY[i];
      let vx = this.velX[i];
      let vy = this.velY[i];

      // Chladni standing wave function:
      // w(x, y) = a*sin(kn*x)*sin(km*y) - b*sin(km*x)*sin(kn*y)
      const sinKnX = Math.sin(kn * x);
      const cosKnX = Math.cos(kn * x);
      const sinKmY = Math.sin(km * y);
      const cosKmY = Math.cos(km * y);

      const sinKmX = Math.sin(km * x);
      const cosKmX = Math.cos(km * x);
      const sinKnY = Math.sin(kn * y);
      const cosKnY = Math.cos(kn * y);

      const w = a * sinKnX * sinKmY - b * sinKmX * sinKnY;

      // Analytical gradient: dw/dx and dw/dy
      const dw_dx = a * kn * cosKnX * sinKmY - b * km * cosKmX * sinKnY;
      const dw_dy = a * km * sinKnX * cosKmY - b * kn * sinKmX * cosKnY;

      // Acoustic potential U = 0.5 * w^2 => Force F = -w * grad(w)
      // Particles are pushed away from antinodes (w != 0) toward nodal lines (w = 0)
      const fx = -w * dw_dx * baseForce;
      const fy = -w * dw_dy * baseForce;

      // Brownian turbulence jitter
      const jx = (Math.random() - 0.5) * jitterMag;
      const jy = (Math.random() - 0.5) * jitterMag;

      // Semi-implicit Euler / Verlet velocity step
      vx = (vx + (fx + jx) * dt) * damping;
      vy = (vy + (fy + jy) * dt) * damping;

      x += vx * dt;
      y += vy * dt;

      // Circular plate boundary restitution
      const dist = Math.sqrt(x * x + y * y);
      if (dist > maxRadius) {
        const nx = x / dist;
        const ny = y / dist;
        x = nx * maxRadius;
        y = ny * maxRadius;
        // Inward bounce with energy loss
        const dot = vx * nx + vy * ny;
        vx = (vx - 1.5 * dot * nx) * 0.4;
        vy = (vy - 1.5 * dot * ny) * 0.4;
      }

      // Nodal proximity intensity: 1.0 when perfectly sitting on nodal line
      const nodalCloseness = Math.exp(-Math.abs(w) * 6.0);
      const speed = Math.sqrt(vx * vx + vy * vy);
      const intVal = Math.min(1.0, nodalCloseness * 0.75 + speed * 1.5);

      this.posX[i] = x;
      this.posY[i] = y;
      this.velX[i] = vx;
      this.velY[i] = vy;
      this.intensity[i] = intVal;

      // Fill GPU interleaved vertex stream [x, y, intensity]
      this.gpuBufferData[gpuIdx++] = x;
      this.gpuBufferData[gpuIdx++] = y;
      this.gpuBufferData[gpuIdx++] = intVal;
    }
  }

  destroy(): void {
    const gl = this.gl;
    if (gl) {
      if (this.vertexBuffer) {
        gl.deleteBuffer(this.vertexBuffer);
        this.vertexBuffer = null;
      }
      if (this.program) {
        gl.deleteProgram(this.program);
        this.program = null;
      }
    }
    this.gl = null;
    this.canvas = null;
  }
}
