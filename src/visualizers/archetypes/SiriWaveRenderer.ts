/**
 * src/visualizers/archetypes/SiriWaveRenderer.ts
 *
 * Archetype 1: Apple Siri Chromatic Wave (iOS 18)
 * 4 chromatic ribbons evaluated with longitudinal Gaussian envelope and multi-spectral dispersion,
 * cross-frequency modulation, dynamic line glow and inter-ribbon luminance,
 * and zero-halo premultiplied alpha math.
 */

import { BaseWebGLQuadRenderer } from "../BaseWebGLQuadRenderer";

export class SiriWaveRenderer extends BaseWebGLQuadRenderer {
  readonly id = "apple-siri";
  readonly name = "Apple Siri Chromatic Wave";
  readonly description = "iOS 18 multi-frequency chromatic ribbons with Gaussian dispersion";

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
const float BASE_FREQ = 1.15;
const float ABER_FREQ = 1.05;
const float FALLOFF   = 1.65;
const float BAND_FILL = 26000.0;
const float BAND_THICK = 0.075;

void main() {
    vec2 R = uResolution.xy;
    float aspect = uAspectRatio > 0.0 ? uAspectRatio : (R.x / max(R.y, 1.0));
    vec2 p = (gl_FragCoord.xy + 0.5) * 2.0 / R - 1.0;
    p.x *= aspect;
    float yScreen = p.y;
    
    float waveScale = max(0.55 * uScale, 0.1);
    p /= waveScale;

    float t = uTime;
    float isAct = clamp(uAudioActive, 0.0, 1.0);
    float sens = clamp(uSensitivity, 0.2, 3.0);
    float turb = clamp(uTurbulence, 0.0, 2.5);
    float glowMult = clamp(uGlow, 0.1, 3.0);

    // Natural calm idle breathing
    float idleBreath = 0.5 + 0.5 * sin(t * 1.25);
    
    // Vocal dynamics
    float vocalBloom = clamp(uAmp * sens, 0.0, 1.5);
    float A1 = mix(0.05 + 0.015 * idleBreath, 0.06 + 0.38 * vocalBloom, isAct);
    
    float vocalMid = clamp(uMid * sens, 0.0, 1.2);
    float A2 = A1 + (0.012 + 0.04 * vocalMid) * isAct;
    
    // Chromatic dispersion scaled by turbulence and voice activity
    float aberSpread = mix(0.55, 1.15 + 0.35 * vocalMid, isAct) * (0.6 + 0.4 * turb);
    
    // Line parameters
    float inten = mix(0.011, 0.017 + 0.016 * vocalBloom, isAct) * glowMult;
    float th = mix(0.02, 0.034, isAct);
    float soft = mix(0.007, 0.015 + 0.01 * vocalMid, isAct);

    float drift = uPhase;

    // Longitudinal Gaussian envelope
    float xN = p.x / min(aspect, 1.0);
    float env = cos(PI * 0.5 * min(abs(0.9 * xN), 1.0));
    env *= env;

    float yMain = A1 * env * sin(p.x * BASE_FREQ + drift);

    float bandFillTh = max(BAND_THICK, 1e-4);
    float bandAmt = 1e-4 * BAND_FILL * inten;

    // Dynamic frequency modulation of palette colors
    vec3 ribbonColors[4];
    ribbonColors[0] = mix(uColor0.rgb, vec3(0.1, 0.25, 0.95), 0.2 + 0.3 * uLow);
    ribbonColors[1] = mix(uColor1.rgb, vec3(0.95, 0.1, 0.55), 0.2 + 0.3 * uMid);
    ribbonColors[2] = mix(uColor2.rgb, vec3(0.0, 0.95, 0.8), 0.2 + 0.3 * uHigh);
    ribbonColors[3] = mix(uColor3.rgb, vec3(1.0, 0.7, 0.1), 0.2 + 0.3 * uAmp);

    vec3 num = vec3(0.0);
    vec3 den = vec3(0.0);

    for (int s = 0; s < 4; s++) {
        vec3 hue = ribbonColors[s];
        den += hue;

        float ab = mix(-aberSpread, aberSpread, float(s) / 3.0);
        float freqMod = ABER_FREQ + float(s) * 0.04 * turb;
        float yL = A2 * env * sin(p.x * freqMod + drift + ab);
        
        float d = abs(p.y - yL);
        float lor = 1.0 / (1.0 + (0.02 * d) * (0.02 * d));
        float line = (inten / (sqrt(d * d + soft * soft) + th)) * exp(-d * d * 18.0);
        
        float lo = min(yMain, yL);
        float hi = max(yMain, yL);
        float dBand = max(0.0, max(p.y - hi, lo - p.y));
        float band = (bandAmt / (dBand + bandFillTh)) * exp(-dBand * dBand * 24.0);
        
        num += hue * lor * (line + band);
    }
    vec3 col = num / max(den, vec3(0.001));

    // Centerline boost
    float dM = abs(p.y - yMain);
    float lorM = 1.0 / (1.0 + (0.02 * dM) * (0.02 * dM));
    col += (0.55 * inten * lorM / (sqrt(dM * dM + soft * soft) + th)) * exp(-dM * dM * 18.0);

    // Luminescence punch
    float punch = 1.0 + isAct * (0.32 * uAmp);
    col = pow(max(col * punch, 0.0), vec3(1.4));

    // Longitudinal falloff
    float gauss = exp(-pow(xN * FALLOFF, 2.0));
    col *= gauss;

    // Edge screen mask to prevent boundary clamping
    float xScreen = (gl_FragCoord.x + 0.5) * 2.0 / R.x - 1.0;
    float emX = clamp((abs(xScreen) - 1.0) / -0.15, 0.0, 1.0);
    float emT = clamp((abs(yScreen) - 1.0) / -0.4, 0.0, 1.0);
    col *= (emX * emX * (3.0 - 2.0 * emX)) * (emT * emT * (3.0 - 2.0 * emT));

    // Clamp col to [0, 1] to guarantee zero-halo premultiplied alpha math
    col = clamp(col, 0.0, 1.0);

    float lum = max(col.r, max(col.g, col.b));
    float alpha = smoothstep(0.005, 0.045, lum) * clamp(lum * 1.85, 0.0, 1.0);
    
    // High frequency dither
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
