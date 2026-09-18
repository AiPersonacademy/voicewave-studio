/**
 * src/visualizers/archetypes/ConcentricRingsRenderer.ts
 *
 * Archetype 4: Concentric Acoustic Rings
 * Multi-packet expanding radial acoustic shockwaves with directional beamforming lobes,
 * central acoustic transducer core, and a smooth radial dissipation envelope
 * guaranteeing clean zero-alpha canvas borders.
 */

import { BaseWebGLQuadRenderer } from "../BaseWebGLQuadRenderer";

export class ConcentricRingsRenderer extends BaseWebGLQuadRenderer {
  readonly id = "concentric-rings";
  readonly name = "Concentric Acoustic Rings";
  readonly description = "Radial radar shockwaves with directional beamforming lobes";

  readonly fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uPhase;
uniform float uAspectRatio;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uAmp;
uniform float uSensitivity;
uniform float uTurbulence;
uniform float uGlow;
uniform float uScale;
uniform float uAudioActive;
uniform float uTransparent;
uniform vec4 uColor0;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;

const float PI = 3.14159265359;
const int NUM_WAVES = 5;

void main() {
    vec2 R = uResolution.xy;
    float aspect = uAspectRatio > 0.0 ? uAspectRatio : (R.x / max(R.y, 1.0));
    vec2 p = (gl_FragCoord.xy - 0.5 * R) / min(R.x, R.y);

    float sens = clamp(uSensitivity, 0.2, 3.0);
    float turb = clamp(uTurbulence, 0.0, 2.5);
    float glowVal = clamp(uGlow, 0.1, 3.0);
    float userScale = clamp(uScale, 0.5, 2.0);
    float isAct = clamp(uAudioActive, 0.0, 1.0);

    float r = length(p) / userScale;
    float theta = atan(p.y, p.x);

    float t = uTime * 0.75 + uPhase * 0.45;
    float ampBoost = 0.25 + 0.75 * uAmp * sens;

    // Directional beamforming lobes (acoustic radiation pattern)
    float lobeMid = 0.35 * cos(2.0 * theta - uPhase * 0.6) * uMid * sens;
    float lobeHigh = 0.20 * cos(4.0 * theta + t * 1.5) * uHigh * turb;
    float lobeLow = 0.15 * cos(theta + PI * 0.25) * uLow;
    float beamPattern = max(0.2, 1.0 + (lobeMid + lobeHigh + lobeLow) * isAct);

    vec3 waveColAcc = vec3(0.0);
    float waveIntensityAcc = 0.0;

    for (int k = 0; k < NUM_WAVES; k++) {
        float fracOffset = float(k) / float(NUM_WAVES);
        float waveAge = fract(t * 0.55 + fracOffset);
        
        float waveRadius = waveAge * 1.35;
        float env = sin(waveAge * PI) * (1.0 - waveAge * 0.55) * ampBoost;
        float sigma = 0.018 + 0.035 * waveAge;
        
        float distToCrest = abs(r - waveRadius);
        float crestProfile = exp(-(distToCrest * distToCrest) / (2.0 * sigma * sigma));
        float crestIntensity = (crestProfile / sqrt(r + 0.14)) * env * beamPattern;
        
        vec3 ringHue = mix(uColor1.rgb, uColor2.rgb, waveAge);
        
        waveColAcc += ringHue * crestIntensity;
        waveIntensityAcc += crestIntensity;
    }

    float ripple = sin(r * 45.0 - t * 6.0) * 0.5 + 0.5;
    waveColAcc += uColor3.rgb * (ripple * 0.08 * uHigh * turb * isAct);

    // Central acoustic transducer core (Gaussian falloff, reaches 0.0 at outer radii)
    float coreGlow = exp(-r * r * 36.0) * (0.6 + 1.4 * uLow * sens);
    vec3 coreCol = uColor0.rgb * coreGlow;

    // Radial dissipation envelope: soundwaves naturally dissipate before canvas boundary
    float radialFalloff = smoothstep(0.65, 0.38, r);
    vec3 totalCol = clamp((waveColAcc + coreCol) * glowVal * radialFalloff, 0.0, 1.0);

    float lum = max(totalCol.r, max(totalCol.g, totalCol.b));
    float alpha = smoothstep(0.005, 0.045, lum) * clamp(lum * 1.85, 0.0, 1.0);

    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

    if (uTransparent > 0.5) {
        vec3 rgb = max(vec3(0.0), totalCol * alpha + dither * alpha);
        gl_FragColor = vec4(rgb, alpha);
    } else {
        vec3 rgb = max(vec3(0.0), totalCol + dither);
        gl_FragColor = vec4(rgb, 1.0);
    }
}
`;
}
