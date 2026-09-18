import { COMMON_VERTEX_SHADER } from "@/visualizers/WebGLContextManager";
import { SiriWaveRenderer } from "@/visualizers/archetypes/SiriWaveRenderer";
import { ChatGptOrbRenderer } from "@/visualizers/archetypes/ChatGptOrbRenderer";
import { GeminiMetaballsRenderer } from "@/visualizers/archetypes/GeminiMetaballsRenderer";
import { ConcentricRingsRenderer } from "@/visualizers/archetypes/ConcentricRingsRenderer";
import { SciFiHudRenderer } from "@/visualizers/archetypes/SciFiHudRenderer";
import { PerimeterGlowRenderer } from "@/visualizers/archetypes/PerimeterGlowRenderer";

export const VERTEX_SHADER = COMMON_VERTEX_SHADER;

const siriFS = new SiriWaveRenderer().fragmentShaderSource;
const orbFS = new ChatGptOrbRenderer().fragmentShaderSource;
const metaballsFS = new GeminiMetaballsRenderer().fragmentShaderSource;
const ringsFS = new ConcentricRingsRenderer().fragmentShaderSource;
const hudFS = new SciFiHudRenderer().fragmentShaderSource;
const perimeterFS = new PerimeterGlowRenderer().fragmentShaderSource;

export const FRAGMENT_SHADERS: Record<string, string> = {
  wave: siriFS,
  "fluid-dots": metaballsFS,
  "siri-wave": siriFS,
  "apple-siri": siriFS,
  "chatgpt-orb": orbFS,
  "gemini-metaballs": metaballsFS,
  "concentric-rings": ringsFS,
  "cymatics-particles": siriFS,
  "cymatics-particle": siriFS,
  "glass-soundbars": siriFS,
  "scifi-hud": hudFS,
  "perimeter-glow": perimeterFS,
};
