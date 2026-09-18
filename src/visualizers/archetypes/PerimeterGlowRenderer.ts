/**
 * src/visualizers/archetypes/PerimeterGlowRenderer.ts
 *
 * Archetype 8: iOS Perimeter Edge Glow
 * iOS 18 Siri-inspired perimeter screen illumination with exact 2D rounded-rectangle SDF,
 * traveling chromatic wave along the perimeter, corner lens flare amplifiers,
 * inward Gaussian bloom driven by Bass energy, and zero-halo premultiplied alpha math.
 *
 * Conforms to PROJECT.md §Interface Contracts.
 */

import { BaseWebGLQuadRenderer } from "../BaseWebGLQuadRenderer";

export class PerimeterGlowRenderer extends BaseWebGLQuadRenderer {
  readonly id = "perimeter-glow";
  readonly name = "iOS Perimeter Edge Glow";
  readonly description = "Rounded-rectangle SDF traveling wave & inward Gaussian bloom";

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

// Exact 2D Rounded Box Signed Distance Function
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Smooth 4-color palette interpolation along parameter t in [0, 1]
vec3 samplePalette(float t) {
  float f = fract(t);
  if (f < 0.25) {
    return mix(uColor0.rgb, uColor1.rgb, smoothstep(0.0, 1.0, f * 4.0));
  } else if (f < 0.50) {
    return mix(uColor1.rgb, uColor2.rgb, smoothstep(0.0, 1.0, (f - 0.25) * 4.0));
  } else if (f < 0.75) {
    return mix(uColor2.rgb, uColor3.rgb, smoothstep(0.0, 1.0, (f - 0.50) * 4.0));
  } else {
    return mix(uColor3.rgb, uColor0.rgb, smoothstep(0.0, 1.0, (f - 0.75) * 4.0));
  }
}

void main() {
  float aspect = uAspect > 0.0 ? uAspect : (uAspectRatio > 0.0 ? uAspectRatio : (uResolution.x / max(uResolution.y, 1.0)));
  float reactivity = max(uReactivity, uSensitivity);

  // Normalized coordinate space [-aspect, aspect] x [-1.0, 1.0]
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / (0.5 * uResolution.y);

  // Aspect ratio half-extents with 6% inset margin from canvas boundary
  // This guarantees outer corners at (+/-Aspect, +/-1.0) strictly reside outside the bezel (alpha = 0)
  float margin = 0.06;
  vec2 halfSize = vec2(aspect * (1.0 - margin), 1.0 - margin);
  float cornerRadius = 0.20 * min(halfSize.x, halfSize.y);

  // Signed distance to rounded bezel
  float dBox = sdRoundedBox(uv, halfSize, cornerRadius);

  // 1. Inward Perimeter Distance (dInward >= 0 for points inside the display)
  float dInward = max(0.0, -dBox);

  // 2. Inward Gaussian Bloom Profile (expands deeply into center with Bass energy)
  float sigmaGlow = (0.045 + 0.18 * uLow * reactivity) * max(0.5, uScale);
  float bloom = exp(-(dInward * dInward) / (2.0 * sigmaGlow * sigmaGlow));
  bloom *= (0.75 + 1.25 * uAmp);

  // 3. Hairline Edge Core (brilliant neon rim right on the bezel)
  float coreLine = smoothstep(0.016, 0.0, dInward) * (1.3 + 0.9 * uAmp);

  // 4. Corner Lens Flare Detection (Siri iOS 18 Corner Bloom)
  vec2 q = abs(uv) - halfSize + vec2(cornerRadius);
  float cornerDist = length(max(q, 0.0));
  float cornerFactor = smoothstep(cornerRadius * 1.5, 0.0, cornerDist);
  float cornerBoost = 1.0 + 1.6 * cornerFactor * (uMid + uHigh);

  // 5. Traveling Acoustic Wave along the perimeter
  float angle = atan(uv.y / halfSize.y, uv.x / halfSize.x); // [-PI, PI]
  float normPerimeter = (angle + PI) / TWO_PI; // [0, 1]

  float wave = sin(4.0 * TWO_PI * normPerimeter - uPhase * 2.6) * uMid * 0.8
             + 0.5 * cos(8.0 * TWO_PI * normPerimeter + uPhase * 3.4) * uHigh
             + 0.25 * sin(14.0 * TWO_PI * normPerimeter - uPhase * 5.0) * uTurbulence;

  // 6. Chromatic Palette Dispersion
  float colorCoord = fract(normPerimeter + 0.08 * wave + uPhase * 0.03);
  vec3 color = samplePalette(colorCoord);

  // Secondary harmonic color fringe (subtle chromatic aberration)
  vec3 colorOffset = samplePalette(colorCoord + 0.03 * uTurbulence);
  color = mix(color, colorOffset, 0.35);

  // 7. Composite Optical Emission
  float totalIntensity = (bloom + coreLine) * cornerBoost * (1.0 + 0.35 * wave) * uGlow;
  vec3 col = color * totalIntensity;

  // Strict boundary mask: zero alpha for points on or outside the outer bezel (dBox >= 0)
  // Eliminates dark halos, and guarantees genuine 0-alpha corner pixels
  float boundaryAlpha = smoothstep(0.001, -0.003, dBox);
  float opticalAlpha = clamp(totalIntensity * 1.45, 0.0, 1.0);
  float alpha = boundaryAlpha * opticalAlpha;

  col = clamp(col, 0.0, 1.0);

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
