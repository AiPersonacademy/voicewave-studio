import { describe, it, expect, vi } from "vitest";
import { UniversalRenderer } from "@/visualizers/UniversalRenderer";
import { WebGLContextManager } from "@/visualizers/WebGLContextManager";
import { CymaticsParticleRenderer } from "@/visualizers/archetypes/CymaticsParticleRenderer";
import { GlassSoundbarsRenderer } from "@/visualizers/archetypes/GlassSoundbarsRenderer";
import type { CanonicalArchetypeId, VisualizerRenderParams } from "@/visualizers/types";

const ALL_ARCHETYPES: CanonicalArchetypeId[] = [
  "apple-siri",
  "chatgpt-orb",
  "gemini-metaballs",
  "concentric-rings",
  "cymatics-particle",
  "glass-soundbars",
  "scifi-hud",
  "perimeter-glow",
];

// High-fidelity WebGL Mock / Spy conforming to WebGL 2 / 1 specifications
function createMockWebGLCanvas() {
  let isContextLostState = false;
  let nextId = 1;

  const activeShaders = new Set<any>();
  const activePrograms = new Set<any>();
  const activeBuffers = new Set<any>();
  const attachedShadersMap = new Map<any, Set<any>>();
  const deletedShadersPendingDetach = new Set<any>();

  const stats = {
    shadersCreated: 0,
    shadersDeleted: 0,
    programsCreated: 0,
    programsDeleted: 0,
    buffersCreated: 0,
    buffersDeleted: 0,
    drawCalls: 0,
    viewportsSet: [] as { x: number; y: number; w: number; h: number }[],
    clearCalls: 0,
    useProgramCalls: 0,
  };

  const listeners: Record<string, ((e: any) => void)[]> = {};

  const mockGl: any = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    DYNAMIC_DRAW: 35048,
    COLOR_BUFFER_BIT: 16384,
    FLOAT: 5126,
    TRIANGLES: 4,
    POINTS: 0,
    BLEND: 3042,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 771,

    isContextLost: () => isContextLostState,

    createShader: vi.fn((type: number) => {
      if (isContextLostState) return null;
      stats.shadersCreated++;
      const shader = { __id: nextId++, type, __deleted: false };
      activeShaders.add(shader);
      return shader;
    }),

    deleteShader: vi.fn((shader: any) => {
      if (!shader) return;
      shader.__deleted = true;
      let isAttached = false;
      for (const [, set] of attachedShadersMap) {
        if (set.has(shader)) {
          isAttached = true;
          break;
        }
      }
      if (!isAttached) {
        activeShaders.delete(shader);
        stats.shadersDeleted++;
      } else {
        deletedShadersPendingDetach.add(shader);
      }
    }),

    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn((_s, param) => {
      if (isContextLostState) return false;
      if (param === 35713) return true;
      return true;
    }),
    getShaderInfoLog: vi.fn(() => ""),

    createProgram: vi.fn(() => {
      if (isContextLostState) return null;
      stats.programsCreated++;
      const program = { __id: nextId++ };
      activePrograms.add(program);
      attachedShadersMap.set(program, new Set());
      return program;
    }),

    attachShader: vi.fn((prog: any, shader: any) => {
      if (prog && shader && attachedShadersMap.has(prog)) {
        attachedShadersMap.get(prog)!.add(shader);
      }
    }),

    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((_p, param) => {
      if (isContextLostState) return false;
      if (param === 35714) return true;
      return true;
    }),
    getProgramInfoLog: vi.fn(() => ""),

    deleteProgram: vi.fn((prog: any) => {
      if (!prog) return;
      if (activePrograms.has(prog)) {
        activePrograms.delete(prog);
        stats.programsDeleted++;

        const attached = attachedShadersMap.get(prog);
        if (attached) {
          for (const s of attached) {
            if (deletedShadersPendingDetach.has(s)) {
              deletedShadersPendingDetach.delete(s);
              activeShaders.delete(s);
              stats.shadersDeleted++;
            }
          }
        }
        attachedShadersMap.delete(prog);
      }
    }),

    createBuffer: vi.fn(() => {
      if (isContextLostState) return null;
      stats.buffersCreated++;
      const buf = { __id: nextId++ };
      activeBuffers.add(buf);
      return buf;
    }),

    deleteBuffer: vi.fn((buf: any) => {
      if (!buf) return;
      if (activeBuffers.has(buf)) {
        activeBuffers.delete(buf);
        stats.buffersDeleted++;
      }
    }),

    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    bufferSubData: vi.fn(),
    useProgram: vi.fn(() => {
      stats.useProgramCalls++;
    }),
    getAttribLocation: vi.fn((_prog, name) => {
      if (name === "aPosition" || name === "aPos") return 0;
      if (name === "aIntensity") return 1;
      return 0;
    }),
    getUniformLocation: vi.fn((_prog, name) => ({ __name: name })),
    enableVertexAttribArray: vi.fn(),
    disableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniform1fv: vi.fn(),
    viewport: vi.fn((x, y, w, h) => {
      stats.viewportsSet.push({ x, y, w, h });
    }),
    clearColor: vi.fn(),
    clear: vi.fn(() => {
      stats.clearCalls++;
    }),
    drawArrays: vi.fn(() => {
      stats.drawCalls++;
    }),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
  };

  const canvas: any = {
    width: 420,
    height: 420,
    getContext: vi.fn((type: string) => {
      if (type.includes("webgl")) {
        return isContextLostState ? null : mockGl;
      }
      return null;
    }),
    addEventListener: vi.fn((type: string, cb: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((fn) => fn !== cb);
      }
    }),
    dispatchEvent: vi.fn((event: any) => {
      const fns = [...(listeners[event.type] || [])];
      for (const fn of fns) fn(event);
      return true;
    }),
  };

  return {
    canvas,
    mockGl,
    stats,
    activeShaders,
    activePrograms,
    activeBuffers,
    listeners,
    simulateContextLoss: () => {
      isContextLostState = true;
      const event = {
        type: "webglcontextlost",
        defaultPrevented: false,
        preventDefault: vi.fn(() => {
          (event as any).defaultPrevented = true;
        }),
      };
      canvas.dispatchEvent(event);
      return event;
    },
    simulateContextRestored: () => {
      isContextLostState = false;
      const event = { type: "webglcontextrestored" };
      canvas.dispatchEvent(event);
      return event;
    },
  };
}

const DUMMY_PARAMS: VisualizerRenderParams = {
  time: 1.0,
  phase: 0.5,
  aspectRatio: 1.0,
  low: 0.5,
  mid: 0.4,
  high: 0.3,
  amplitude: 0.6,
  sensitivity: 1.2,
  turbulence: 1.0,
  glow: 1.0,
  scale: 1.0,
  palette: [
    [0.1, 0.4, 0.9],
    [0.9, 0.2, 0.5],
    [0.0, 0.9, 0.6],
    [1.0, 0.7, 0.1],
  ],
  isAudioActive: true,
  isTransparent: true,
};

describe("Milestone 2 Archetype Switching & Context Lifecycle Stress Suite", () => {
  describe("1. Rapid Archetype Switching Lifecycle & WebGL Resource Leaks", () => {
    it("empirically tracks WebGL objects across 80 rapid switches (10 cycles x 8 archetypes)", () => {
      const { canvas, stats, activePrograms, activeBuffers, activeShaders } = createMockWebGLCanvas();
      const ur = new UniversalRenderer("apple-siri");
      ur.init(canvas);

      ur.render(DUMMY_PARAMS);
      expect(stats.programsCreated).toBe(1);
      expect(stats.buffersCreated).toBe(1);

      const cycleCount = 10;
      for (let c = 0; c < cycleCount; c++) {
        for (const archId of ALL_ARCHETYPES) {
          ur.switchArchetype(archId);
          ur.render({
            ...DUMMY_PARAMS,
            time: c * 0.1,
            aspectRatio: 1.0,
          });
        }
      }

      console.log(
        "[Stress Test: 80 Rapid Switches]\n" +
          `  - Programs created: ${stats.programsCreated}, deleted: ${stats.programsDeleted}, active: ${activePrograms.size}\n` +
          `  - Buffers created: ${stats.buffersCreated}, deleted: ${stats.buffersDeleted}, active: ${activeBuffers.size}\n` +
          `  - Shaders created: ${stats.shadersCreated}, deleted: ${stats.shadersDeleted}, active: ${activeShaders.size}\n` +
          `  - Total draw calls: ${stats.drawCalls}`
      );

      // Verify that programs and buffers are strictly cleaned up
      expect(activePrograms.size).toBe(1);
      expect(activeBuffers.size).toBe(1);

      ur.destroy();

      expect(activePrograms.size).toBe(0);
      expect(activeBuffers.size).toBe(0);

      // Report active shaders (checking if any shaders were leaked by archetypes)
      console.log(`  [Post-Destroy] Active leaked shaders: ${activeShaders.size}`);
      expect(activeShaders.size).toBe(0);
    });

    it("evaluates CymaticsParticleRenderer shader deallocation in isolation", () => {
      const { canvas, stats, activeShaders, activePrograms, activeBuffers } = createMockWebGLCanvas();
      const cymatics = new CymaticsParticleRenderer();
      cymatics.init(canvas);
      cymatics.render(DUMMY_PARAMS);

      expect(stats.shadersCreated).toBe(2);
      expect(stats.programsCreated).toBe(1);
      expect(stats.buffersCreated).toBe(1);

      cymatics.destroy();

      console.log(
        "[Isolation Test: CymaticsParticleRenderer]\n" +
          `  - Shaders created: ${stats.shadersCreated}, deleted: ${stats.shadersDeleted}, leaked: ${activeShaders.size}\n` +
          `  - Programs created: ${stats.programsCreated}, deleted: ${stats.programsDeleted}, active: ${activePrograms.size}\n` +
          `  - Buffers created: ${stats.buffersCreated}, deleted: ${stats.buffersDeleted}, active: ${activeBuffers.size}`
      );

      expect(activePrograms.size).toBe(0);
      expect(activeBuffers.size).toBe(0);

      const leakedShaders = activeShaders.size;
      console.log(`  [Empirical Observation] Leaked shaders in Cymatics: ${leakedShaders}`);
      expect(leakedShaders).toBe(0);
    });

    it("evaluates GlassSoundbarsRenderer shader deallocation in isolation", () => {
      const { canvas, stats, activeShaders, activePrograms, activeBuffers } = createMockWebGLCanvas();
      const soundbars = new GlassSoundbarsRenderer();
      soundbars.init(canvas);
      soundbars.render(DUMMY_PARAMS);

      expect(stats.shadersCreated).toBe(2);
      expect(stats.programsCreated).toBe(1);
      expect(stats.buffersCreated).toBe(1);

      soundbars.destroy();

      console.log(
        "[Isolation Test: GlassSoundbarsRenderer]\n" +
          `  - Shaders created: ${stats.shadersCreated}, deleted: ${stats.shadersDeleted}, leaked: ${activeShaders.size}\n` +
          `  - Programs created: ${stats.programsCreated}, deleted: ${stats.programsDeleted}, active: ${activePrograms.size}\n` +
          `  - Buffers created: ${stats.buffersCreated}, deleted: ${stats.buffersDeleted}, active: ${activeBuffers.size}`
      );

      expect(activePrograms.size).toBe(0);
      expect(activeBuffers.size).toBe(0);

      const leakedShaders = activeShaders.size;
      console.log(`  [Empirical Observation] Leaked shaders in GlassSoundbars: ${leakedShaders}`);
      expect(leakedShaders).toBe(0);
    });
  });

  describe("2. Dynamic Viewport Resize Stress Across 1:1, 16:9, and 9:16", () => {
    it("stress tests dynamic aspect ratio transitions (1:1 -> 16:9 -> 9:16) during active rendering", () => {
      const { canvas, stats } = createMockWebGLCanvas();
      const ur = new UniversalRenderer("apple-siri");
      ur.init(canvas);

      const aspectRatios = [
        { name: "1:1 Square (420x420)", w: 420, h: 420, aspect: 1.0 },
        { name: "16:9 Landscape (1920x1080)", w: 1920, h: 1080, aspect: 1920 / 1080 },
        { name: "9:16 Vertical (1080x1920)", w: 1080, h: 1920, aspect: 1080 / 1920 },
        { name: "16:9 Small Preview (840x472)", w: 840, h: 472, aspect: 840 / 472 },
        { name: "9:16 Small Preview (472x840)", w: 472, h: 840, aspect: 472 / 840 },
        { name: "1:1 Studio Master (1080x1080)", w: 1080, h: 1080, aspect: 1.0 },
      ];

      for (let cycle = 0; cycle < 5; cycle++) {
        for (const archId of ALL_ARCHETYPES) {
          ur.switchArchetype(archId);
          for (const ar of aspectRatios) {
            ur.resize(ar.w, ar.h);
            ur.render({
              ...DUMMY_PARAMS,
              aspectRatio: ar.aspect,
              time: cycle * 0.5,
            });

            expect(canvas.width).toBe(ar.w);
            expect(canvas.height).toBe(ar.h);

            const lastVp = stats.viewportsSet[stats.viewportsSet.length - 1];
            expect(lastVp.w).toBe(ar.w);
            expect(lastVp.h).toBe(ar.h);
          }
        }
      }

      console.log(
        "[Dynamic Resize Stress Test]\n" +
          `  - Successfully executed 5 cycles x 8 archetypes x 6 aspect ratio presets = 240 dynamic resizes & renders\n` +
          `  - Total viewports set: ${stats.viewportsSet.length}\n` +
          "  - Zero crashes or invalid dimensions recorded."
      );

      ur.destroy();
    });

    it("evaluates boundary and extreme resize parameters (0, negative, fractional, 8K)", () => {
      const { canvas } = createMockWebGLCanvas();
      const ur = new UniversalRenderer("apple-siri");
      ur.init(canvas);

      // 1. Zero dimensions -> must clamp to >= 1
      ur.resize(0, 0);
      expect(canvas.width).toBe(1);
      expect(canvas.height).toBe(1);

      // 2. Negative dimensions -> must clamp to >= 1
      ur.resize(-500, -300);
      expect(canvas.width).toBe(1);
      expect(canvas.height).toBe(1);

      // 3. Fractional dimensions -> must round to integer pixels
      ur.resize(419.7, 319.2);
      expect(canvas.width).toBe(420);
      expect(canvas.height).toBe(319);

      // 4. Extreme 8K resolution (7680x4320)
      ur.resize(7680, 4320);
      expect(canvas.width).toBe(7680);
      expect(canvas.height).toBe(4320);
      ur.render(DUMMY_PARAMS);

      // 5. Extreme ultrawide aspect ratios (3840x100 and 100x3840)
      ur.resize(3840, 100);
      ur.render({ ...DUMMY_PARAMS, aspectRatio: 3840 / 100 });
      expect(canvas.width).toBe(3840);
      expect(canvas.height).toBe(100);

      ur.resize(100, 3840);
      ur.render({ ...DUMMY_PARAMS, aspectRatio: 100 / 3840 });
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(3840);

      ur.destroy();
    });
  });

  describe("3. WebGL Context Loss & Lifecycle Recovery", () => {
    it("tests system behavior when webglcontextlost occurs", () => {
      const mock = createMockWebGLCanvas();
      const ur = new UniversalRenderer("apple-siri");
      ur.init(mock.canvas);

      ur.render(DUMMY_PARAMS);

      // Simulate WebGL Context Loss
      const lostEvent = mock.simulateContextLoss();

      console.log(
        "[Context Loss Test]\n" +
          `  - Dispatched 'webglcontextlost' event\n` +
          `  - Was preventDefault() called? ${lostEvent.defaultPrevented}`
      );
      expect(lostEvent.defaultPrevented).toBe(true);

      // Calling render() during context loss should not throw fatal unhandled exceptions
      expect(() => {
        ur.render(DUMMY_PARAMS);
      }).not.toThrow();

      // What happens if switchArchetype is called during context loss?
      let switchError: any = null;
      try {
        ur.switchArchetype("chatgpt-orb");
      } catch (err: any) {
        switchError = err;
      }
      console.log(`  - switchArchetype during context loss result: ${switchError ? switchError.message : "Handled safely"}`);
      expect(switchError).toBeNull();

      // Simulate context restoration and verify rendering resumes
      mock.simulateContextRestored();
      expect(() => {
        ur.render(DUMMY_PARAMS);
      }).not.toThrow();

      ur.destroy();
    });

    it("tests WebGLContextManager standalone context loss recovery", () => {
      const mock = createMockWebGLCanvas();
      let lostCallbackCalled = false;
      let restoredCallbackCalled = false;

      const mgr = new WebGLContextManager(mock.canvas);
      mgr.setContextLifecycleCallbacks(
        () => {
          lostCallbackCalled = true;
        },
        () => {
          restoredCallbackCalled = true;
        }
      );

      // Simulate context loss
      const lostEvent = mock.simulateContextLoss();
      expect(lostEvent.defaultPrevented).toBe(true);
      expect(lostCallbackCalled).toBe(true);

      // Simulate context restoration
      mock.simulateContextRestored();
      expect(restoredCallbackCalled).toBe(true);

      mgr.destroy();
      console.log(
        "[WebGLContextManager Standalone Recovery]\n" +
          `  - preventDefault() called: ${lostEvent.defaultPrevented}\n` +
          `  - onLostCallback called: ${lostCallbackCalled}\n` +
          `  - onRestoredCallback called: ${restoredCallbackCalled}`
      );
    });
  });
});
