/**
 * src/visualizers/BaseWebGLQuadRenderer.ts
 *
 * Base class for full-screen quad procedural WebGL visualizers.
 * Standardizes context flags, geometry quad buffer, uniform locations caching,
 * uniform uploading, aspect ratio handling, and resource destruction.
 */

import type { VisualizerRenderer, VisualizerRenderParams } from "./types";
import { STANDARD_WEBGL_FLAGS, COMMON_VERTEX_SHADER } from "./WebGLContextManager";

export interface UniformLocations {
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uPhase: WebGLUniformLocation | null;
  uAspectRatio: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uLow: WebGLUniformLocation | null;
  uMid: WebGLUniformLocation | null;
  uHigh: WebGLUniformLocation | null;
  uAmp: WebGLUniformLocation | null;
  uSensitivity: WebGLUniformLocation | null;
  uReactivity: WebGLUniformLocation | null;
  uTurbulence: WebGLUniformLocation | null;
  uGlow: WebGLUniformLocation | null;
  uScale: WebGLUniformLocation | null;
  uAudioActive: WebGLUniformLocation | null;
  uTransparent: WebGLUniformLocation | null;
  uColor0: WebGLUniformLocation | null;
  uColor1: WebGLUniformLocation | null;
  uColor2: WebGLUniformLocation | null;
  uColor3: WebGLUniformLocation | null;
}

export abstract class BaseWebGLQuadRenderer implements VisualizerRenderer {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  readonly substrate = "webgl" as const;
  abstract readonly fragmentShaderSource: string;

  protected canvas: HTMLCanvasElement | null = null;
  protected gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  protected program: WebGLProgram | null = null;
  protected quadBuffer: WebGLBuffer | null = null;
  protected positionAttribLocation = -1;
  protected locations: UniformLocations | null = null;
  protected isColorVec3 = false;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const gl = (canvas.getContext("webgl2", STANDARD_WEBGL_FLAGS) ||
      canvas.getContext("webgl", STANDARD_WEBGL_FLAGS) ||
      canvas.getContext("experimental-webgl", STANDARD_WEBGL_FLAGS)) as
      | (WebGLRenderingContext | WebGL2RenderingContext)
      | null;

    if (!gl) {
      throw new Error(`[${this.id}] WebGL is not supported on this device/browser`);
    }
    this.gl = gl;

    // Compile vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) throw new Error(`[${this.id}] Failed to create vertex shader`);
    gl.shaderSource(vs, COMMON_VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vs);
      gl.deleteShader(vs);
      throw new Error(`[${this.id}] Vertex shader compilation failed: ${info}`);
    }

    // Compile fragment shader
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) {
      gl.deleteShader(vs);
      throw new Error(`[${this.id}] Failed to create fragment shader`);
    }
    gl.shaderSource(fs, this.fragmentShaderSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`[${this.id}] Fragment shader compilation failed: ${info}`);
    }

    // Link program
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`[${this.id}] Failed to create WebGL program`);
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`[${this.id}] Program linking failed: ${info}`);
    }

    this.program = program;
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Fullscreen single-triangle quad covering [-1, 1] NDC
    const quadVertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) throw new Error(`[${this.id}] Failed to create quad buffer`);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    this.quadBuffer = quadBuffer;

    this.positionAttribLocation = gl.getAttribLocation(program, "aPosition");
    if (this.positionAttribLocation === -1) {
      this.positionAttribLocation = gl.getAttribLocation(program, "aPos");
    }

    // Cache uniform locations
    this.locations = {
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uTime: gl.getUniformLocation(program, "uTime"),
      uPhase: gl.getUniformLocation(program, "uPhase"),
      uAspectRatio: gl.getUniformLocation(program, "uAspectRatio"),
      uAspect: gl.getUniformLocation(program, "uAspect"),
      uLow: gl.getUniformLocation(program, "uLow"),
      uMid: gl.getUniformLocation(program, "uMid"),
      uHigh: gl.getUniformLocation(program, "uHigh"),
      uAmp: gl.getUniformLocation(program, "uAmp"),
      uSensitivity: gl.getUniformLocation(program, "uSensitivity"),
      uReactivity: gl.getUniformLocation(program, "uReactivity"),
      uTurbulence: gl.getUniformLocation(program, "uTurbulence"),
      uGlow: gl.getUniformLocation(program, "uGlow"),
      uScale: gl.getUniformLocation(program, "uScale"),
      uAudioActive: gl.getUniformLocation(program, "uAudioActive"),
      uTransparent: gl.getUniformLocation(program, "uTransparent"),
      uColor0: gl.getUniformLocation(program, "uColor0"),
      uColor1: gl.getUniformLocation(program, "uColor1"),
      uColor2: gl.getUniformLocation(program, "uColor2"),
      uColor3: gl.getUniformLocation(program, "uColor3"),
    };
  }

  render(params: VisualizerRenderParams): void {
    const { gl, program, quadBuffer, positionAttribLocation, locations, canvas } = this;
    if (!gl || !program || !quadBuffer || !locations || !canvas) return;

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    if (positionAttribLocation !== -1) {
      gl.enableVertexAttribArray(positionAttribLocation);
      gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    }

    // Upload scalar & vector uniforms
    if (locations.uResolution) gl.uniform2f(locations.uResolution, canvas.width, canvas.height);
    if (locations.uTime) gl.uniform1f(locations.uTime, params.time);
    if (locations.uPhase) gl.uniform1f(locations.uPhase, params.phase);
    if (locations.uAspectRatio) gl.uniform1f(locations.uAspectRatio, params.aspectRatio);
    if (locations.uAspect) gl.uniform1f(locations.uAspect, params.aspectRatio);
    if (locations.uLow) gl.uniform1f(locations.uLow, params.low);
    if (locations.uMid) gl.uniform1f(locations.uMid, params.mid);
    if (locations.uHigh) gl.uniform1f(locations.uHigh, params.high);
    if (locations.uAmp) gl.uniform1f(locations.uAmp, params.amplitude);
    if (locations.uSensitivity) gl.uniform1f(locations.uSensitivity, params.sensitivity);
    if (locations.uReactivity) gl.uniform1f(locations.uReactivity, params.sensitivity);
    if (locations.uTurbulence) gl.uniform1f(locations.uTurbulence, params.turbulence);
    if (locations.uGlow) gl.uniform1f(locations.uGlow, params.glow);
    if (locations.uScale) gl.uniform1f(locations.uScale, params.scale);
    if (locations.uAudioActive) gl.uniform1f(locations.uAudioActive, params.isAudioActive ? 1.0 : 0.0);
    if (locations.uTransparent) gl.uniform1f(locations.uTransparent, params.isTransparent ? 1.0 : 0.0);

    // Palette stops with robust fallbacks
    const p = params.palette;
    const c0 = p && p[0] ? p[0] : [0.05, 0.45, 1.0];
    const c1 = p && p[1] ? p[1] : [0.95, 0.15, 0.7];
    const c2 = p && p[2] ? p[2] : [0.0, 0.95, 0.55];
    const c3 = p && p[3] ? p[3] : [1.0, 0.68, 0.1];

    if (this.isColorVec3) {
      if (locations.uColor0) gl.uniform3f(locations.uColor0, c0[0], c0[1], c0[2]);
      if (locations.uColor1) gl.uniform3f(locations.uColor1, c1[0], c1[1], c1[2]);
      if (locations.uColor2) gl.uniform3f(locations.uColor2, c2[0], c2[1], c2[2]);
      if (locations.uColor3) gl.uniform3f(locations.uColor3, c3[0], c3[1], c3[2]);
    } else {
      if (locations.uColor0) gl.uniform4f(locations.uColor0, c0[0], c0[1], c0[2], 1.0);
      if (locations.uColor1) gl.uniform4f(locations.uColor1, c1[0], c1[1], c1[2], 1.0);
      if (locations.uColor2) gl.uniform4f(locations.uColor2, c2[0], c2[1], c2[2], 1.0);
      if (locations.uColor3) gl.uniform4f(locations.uColor3, c3[0], c3[1], c3[2], 1.0);
    }

    // Viewport & clear
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (params.isTransparent) {
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
    } else {
      gl.clearColor(0.04, 0.04, 0.06, 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render fullscreen single triangle
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (positionAttribLocation !== -1) {
      gl.disableVertexAttribArray(positionAttribLocation);
    }
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  destroy(): void {
    const { gl, program, quadBuffer } = this;
    if (gl) {
      if (quadBuffer) gl.deleteBuffer(quadBuffer);
      if (program) gl.deleteProgram(program);
    }
    this.quadBuffer = null;
    this.program = null;
    this.locations = null;
    this.gl = null;
    this.canvas = null;
  }
}
