/**
 * src/visualizers/WebGLContextManager.ts
 *
 * Robust WebGL context manager supporting WebGL 2 with WebGL 1 fallback.
 * Standardizes context flags, geometry quad management, shader compilation,
 * uniform caching, and context loss recovery.
 */

export const STANDARD_WEBGL_FLAGS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
  antialias: false,
  depth: false,
  stencil: false,
};

export const COMMON_VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export interface CachedProgram {
  program: WebGLProgram;
  vs: WebGLShader;
  fs: WebGLShader;
  uniformLocations: Map<string, WebGLUniformLocation | null>;
  attribLocations: Map<string, number>;
}

export class WebGLContextManager {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private isWebGL2 = false;
  private isContextLost = false;

  private quadBuffer: WebGLBuffer | null = null;
  private programCache = new Map<string, CachedProgram>();
  private onLostCallback?: () => void;
  private onRestoredCallback?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored, false);
    this.initContext();
  }

  private initContext(): void {
    // Try WebGL 2 first
    const gl2 = this.canvas.getContext("webgl2", STANDARD_WEBGL_FLAGS) as WebGL2RenderingContext | null;
    if (gl2) {
      this.gl = gl2;
      this.isWebGL2 = true;
    } else {
      // Fallback to WebGL 1
      const gl1 = (this.canvas.getContext("webgl", STANDARD_WEBGL_FLAGS) ||
        this.canvas.getContext("experimental-webgl", STANDARD_WEBGL_FLAGS)) as WebGLRenderingContext | null;
      if (!gl1) {
        throw new Error(
          "WebGL Initialization Failed: Neither WebGL 2 nor WebGL 1 is supported by this browser/GPU."
        );
      }
      this.gl = gl1;
      this.isWebGL2 = false;
    }

    this.initQuadBuffer();
  }

  private initQuadBuffer(): void {
    const gl = this.gl;
    if (!gl) return;

    // Single oversized triangle covering [-1, 1] NDC viewport
    // Vertices: (-1, -1), (3, -1), (-1, 3)
    const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  public getContext(): WebGL2RenderingContext | WebGLRenderingContext {
    if (!this.gl || this.isContextLost) {
      throw new Error("WebGL Context is not currently available (lost or uninitialized).");
    }
    return this.gl;
  }

  public isGl2(): boolean {
    return this.isWebGL2;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Compiles and links a vertex + fragment shader into a program.
   * Leverages caching by source hash and provides annotated compiler logs on failure.
   */
  public getOrCreateProgram(vsSource: string, fsSource: string): CachedProgram {
    const gl = this.getContext();
    const cacheKey = `${vsSource.trim()}:::${fsSource.trim()}`;

    const existing = this.programCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error("Failed to allocate WebGL program object.");
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || "Unknown linking error";
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`WebGL Program Link Error:\n${log}`);
    }

    const cached: CachedProgram = {
      program,
      vs,
      fs,
      uniformLocations: new Map(),
      attribLocations: new Map(),
    };

    this.programCache.set(cacheKey, cached);
    return cached;
  }

  /**
   * Compiles an individual shader with line-numbered diagnostics.
   */
  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.getContext();
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create shader of type: ${type}`);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "Unknown compilation error";
      gl.deleteShader(shader);

      // Format source code with line numbers for rapid debugging
      const lines = source.split("\n");
      const annotatedSource = lines
        .map((line, idx) => `${String(idx + 1).padStart(4, " ")} | ${line}`)
        .join("\n");

      const typeStr = type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT";
      throw new Error(
        `WebGL ${typeStr} Shader Compilation Failed:\n${log}\n\nAnnotated Source:\n${annotatedSource}`
      );
    }

    return shader;
  }

  /**
   * Retrieves a cached uniform location, avoiding GPU driver roundtrip overhead.
   */
  public getUniformLocation(cached: CachedProgram, name: string): WebGLUniformLocation | null {
    if (cached.uniformLocations.has(name)) {
      return cached.uniformLocations.get(name)!;
    }
    const gl = this.getContext();
    const loc = gl.getUniformLocation(cached.program, name);
    cached.uniformLocations.set(name, loc);
    return loc;
  }

  /**
   * Binds the fullscreen quad geometry buffer and configures attribute pointer.
   * Checks both attribName and fallback aliases (e.g. aPosition / aPos).
   */
  public bindFullscreenQuad(cached: CachedProgram, attribName = "aPosition"): void {
    const gl = this.getContext();
    if (!this.quadBuffer) {
      this.initQuadBuffer();
    }

    let loc = cached.attribLocations.get(attribName);
    if (loc === undefined) {
      loc = gl.getAttribLocation(cached.program, attribName);
      if (loc === -1 && attribName === "aPosition") {
        loc = gl.getAttribLocation(cached.program, "aPos");
      } else if (loc === -1 && attribName === "aPos") {
        loc = gl.getAttribLocation(cached.program, "aPosition");
      }
      cached.attribLocations.set(attribName, loc);
    }

    if (loc !== -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
  }

  /**
   * Draws the fullscreen triangle quad.
   */
  public drawQuad(): void {
    const gl = this.getContext();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Sets viewport and syncs canvas physical resolution.
   */
  public setViewport(width: number, height: number): void {
    const gl = this.getContext();
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  private handleContextLost(e: Event): void {
    e.preventDefault();
    this.isContextLost = true;
    this.programCache.clear();
    this.quadBuffer = null;
    this.onLostCallback?.();
  }

  private handleContextRestored(): void {
    this.isContextLost = false;
    this.initContext();
    this.onRestoredCallback?.();
  }

  public setContextLifecycleCallbacks(onLost?: () => void, onRestored?: () => void): void {
    this.onLostCallback = onLost;
    this.onRestoredCallback = onRestored;
  }

  public destroy(): void {
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);

    if (this.gl) {
      for (const [, cached] of this.programCache) {
        this.gl.deleteProgram(cached.program);
        this.gl.deleteShader(cached.vs);
        this.gl.deleteShader(cached.fs);
      }
      this.programCache.clear();

      if (this.quadBuffer) {
        this.gl.deleteBuffer(this.quadBuffer);
        this.quadBuffer = null;
      }
    }
    this.gl = null;
  }
}
