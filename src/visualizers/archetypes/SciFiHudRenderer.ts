/**
 * src/visualizers/archetypes/SciFiHudRenderer.ts
 *
 * Archetype 7: Cyberpunk AI Core / Sci-Fi HUD
 * Tactical AI reticle with circular reticle rings, polar multi-harmonic oscilloscope waveform,
 * pulsing central regular hexagonal AI core, counter-rotating telemetry tick scales, sweeping radar beam,
 * and zero-halo premultiplied alpha GLSL rendering.
 *
 * Conforms to PROJECT.md §Interface Contracts.
 */

import { BaseWebGLQuadRenderer } from "../BaseWebGLQuadRenderer";

export class SciFiHudRenderer extends BaseWebGLQuadRenderer {
  readonly id = "scifi-hud";
  readonly name = "Cyberpunk AI Core / Sci-Fi HUD";
  readonly description = "Circular reticle rings, polar oscilloscope waveform & pulsing hexagonal core";

  readonly fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uPhase;
uniform float uAspect;
uniform float uAspectRatio;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uAmp;
uniform float uSensitivity;
uniform float uReactivity;
uniform float uTurbulence;
uniform float uGlow;
uniform float uScale;
uniform float uTransparent;
uniform vec4 uColor0;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

// Regular Hexagon Signed Distance Function
float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float ring(float r, float radius, float thickness) {
  return smoothstep(thickness, 0.0, abs(r - radius));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y) * 2.0;
  p /= max(0.2, uScale);

  float r = length(p);
  float theta = atan(p.y, p.x); // [-PI, PI]

  float reactivity = max(uReactivity, uSensitivity);
  vec3 col = vec3(0.0);

  // 1. Central Pulsing Hexagonal AI Core
  float hexR = 0.20 + 0.12 * uLow * reactivity;
  float dHex = sdHexagon(p, hexR);
  float hexEdge = smoothstep(0.012, 0.0, abs(dHex));
  float hexGlow = (0.014 * uGlow) / (abs(dHex) + 0.014);
  float hexCoreFill = step(dHex, 0.0) * (0.15 + 0.55 * uAmp);

  vec3 hexCol = mix(uColor0.rgb, uColor1.rgb, 0.5 + 0.5 * sin(uTime * 2.0));
  col += hexCol * (hexEdge * 1.6 + hexGlow + hexCoreFill * 0.45);

  // Inner core concentric geometric reticle
  float innerRing = ring(r, hexR * 0.52, 0.007);
  col += uColor2.rgb * innerRing * (0.7 + 0.6 * uHigh);

  // 2. Polar Multi-Harmonic Circular Oscilloscope
  float oscBaseR = 0.44;
  float oscWave = uAmp * reactivity * (
    0.055 * sin(4.0 * theta + uPhase * 2.0) * uLow +
    0.038 * sin(8.0 * theta - uPhase * 3.0) * uMid +
    0.022 * sin(18.0 * theta + uPhase * 5.0) * uHigh
  );
  float oscTargetR = oscBaseR + oscWave;
  float dOsc = abs(r - oscTargetR);
  float oscLine = smoothstep(0.011, 0.002, dOsc);
  float oscGlow = (0.007 * uGlow) / (dOsc + 0.005);
  vec3 oscCol = mix(uColor1.rgb, uColor2.rgb, 0.5 + 0.5 * cos(theta * 2.0 + uTime));
  col += oscCol * (oscLine * 1.9 + oscGlow);

  // 3. Inner Segmented Reticle Ring (Clockwise Rotation)
  float rotTheta1 = theta + uTime * 0.35;
  float seg1R = 0.60;
  float seg1Line = ring(r, seg1R, 0.006);
  float seg1Dashes = step(0.28, sin(rotTheta1 * 12.0));
  col += uColor0.rgb * seg1Line * seg1Dashes * 1.3;

  // 4. Outer Vernier Telemetry Scale (Counter-Clockwise Rotation)
  float rotTheta2 = theta - uTime * 0.20;
  float seg2R = 0.76;
  float seg2Line = ring(r, seg2R, 0.008);
  float seg2Ticks = step(0.18, cos(rotTheta2 * 24.0));
  col += uColor3.rgb * seg2Line * seg2Ticks * (0.8 + 0.5 * uMid);

  // 5. Cardinal Telemetry Chevrons / Crosshairs
  float crosshair = (smoothstep(0.004, 0.0, abs(p.x)) + smoothstep(0.004, 0.0, abs(p.y)));
  float crosshairMask = step(0.28, r) * (1.0 - step(0.86, r));
  col += vec3(0.9, 0.95, 1.0) * crosshair * crosshairMask * 0.45;

  // 6. Sweeping Phosphor Radar Beam
  float sweepAngle = mod(uTime * 2.6, TWO_PI) - PI;
  float angleDiff = mod(theta - sweepAngle + TWO_PI, TWO_PI);
  float radarBeam = exp(-angleDiff * 3.8) * step(r, 0.86) * step(0.20, r) * 0.32 * (uAmp + 0.2);
  col += uColor1.rgb * radarBeam * uGlow;

  // 7. Treble Glitch Flicker / Chromatic Pulse
  float glitch = step(0.88, fract(sin(uTime * 45.0 + theta * 10.0) * 43758.5453)) * uTurbulence * uHigh * 0.4;
  col += mix(uColor2.rgb, uColor3.rgb, fract(uTime * 3.0)) * glitch;

  // Radial bounding envelope: strictly zero outside active HUD radius
  // Prevents 1/d glow asymptotes from bleeding into outer canvas corners
  float hudMask = smoothstep(0.92, 0.85, r);
  col *= hudMask;

  col = clamp(col, 0.0, 1.0);

  // True Premultiplied Alpha compositing: zero halo around dark/void areas
  float lum = max(col.r, max(col.g, col.b));
  float alpha = smoothstep(0.005, 0.05, lum) * clamp(lum * 1.6, 0.0, 1.0) * hudMask;

  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

  if (uTransparent > 0.5) {
    vec3 rgb = max(vec3(0.0), col * alpha + dither * alpha);
    gl_FragColor = vec4(rgb, alpha);
  } else {
    vec3 rgb = max(vec3(0.0), col + dither);
    gl_FragColor = vec4(rgb, 1.0);
  }
}
`;
}
