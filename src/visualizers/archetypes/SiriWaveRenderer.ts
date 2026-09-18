/**
 * src/visualizers/archetypes/SiriWaveRenderer.ts
 *
 * Archetype 1: Apple Siri Chromatic Wave (iOS 18)
 * Authentic multi-harmonic chromatic ribbons (Sapphire, Magenta, Mint, Solar Amber)
 * with longitudinal Gaussian envelope, distinct wave frequencies, harmonic criss-crossing,
 * crystalline core filaments, translucent silk membrane fill, and zero-halo premultiplied alpha math.
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

void main() {
    vec2 R = uResolution.xy;
    float aspect = uAspectRatio > 0.0 ? uAspectRatio : (R.x / max(R.y, 1.0));
    vec2 p = (gl_FragCoord.xy + 0.5) * 2.0 / R - 1.0;
    p.x *= aspect;
    float yScreen = p.y;

    float waveScale = max(0.62 * uScale, 0.1);
    p /= waveScale;

    float t = uTime;
    float isAct = clamp(uAudioActive, 0.0, 1.0);
    float sens = clamp(uSensitivity, 0.2, 3.0);
    float turb = clamp(uTurbulence, 0.0, 2.5);
    float glowMult = clamp(uGlow, 0.2, 3.0);

    // Natural calm idle breathing wave - elegant undulating baseline
    float idleBreath = sin(t * 1.5) * 0.5 + 0.5;
    float idleAmp = 0.14 + 0.04 * idleBreath;

    // Vocal dynamics with multi-band responsiveness
    float vocalAmp = clamp(uAmp * sens, 0.0, 1.6);
    float vocalLow = clamp(uLow * sens, 0.0, 1.5);
    float vocalMid = clamp(uMid * sens, 0.0, 1.5);
    float vocalHigh = clamp(uHigh * sens, 0.0, 1.5);

    // Dynamic amplitude for the wave bundle
    float totalAmp = mix(idleAmp, 0.22 + 0.44 * vocalAmp + 0.14 * vocalLow, isAct);

    // Longitudinal Gaussian & Cosine Envelope - smooth taper at edges
    float xN = p.x / min(aspect, 1.55);
    float envCos = cos(PI * 0.5 * clamp(abs(0.68 * xN), 0.0, 1.0));
    float envGauss = exp(-pow(xN * 1.25, 2.0));
    float env = envCos * envCos * envGauss;

    // Phase drift
    float drift = uPhase;

    // 4 Apple Siri Spectral Ribbon Hues
    vec3 ribbonColors[4];
    ribbonColors[0] = uColor0.rgb; // Sapphire Blue (#0D74FF)
    ribbonColors[1] = uColor1.rgb; // Vivid Magenta (#F43F5E)
    ribbonColors[2] = uColor2.rgb; // Mint / Cyan (#00F5A0)
    ribbonColors[3] = uColor3.rgb; // Solar Amber (#FFB020)

    // Distinct harmonic frequencies, phase offsets, and amplitude weightings
    float freqs[4];
    freqs[0] = 1.20;
    freqs[1] = 1.95;
    freqs[2] = 1.55;
    freqs[3] = 2.65;

    float phaseOffsets[4];
    phaseOffsets[0] = 0.0;
    phaseOffsets[1] = 1.70;
    phaseOffsets[2] = 3.30;
    phaseOffsets[3] = 4.85;

    float ampScales[4];
    ampScales[0] = 1.00;
    ampScales[1] = 0.88 + 0.35 * vocalMid * isAct;
    ampScales[2] = 0.92 + 0.30 * vocalLow * isAct;
    ampScales[3] = 0.78 + 0.40 * vocalHigh * isAct;

    vec3 colAcc = vec3(0.0);
    float yMain = 0.0;
    float yMin = 1e3;
    float yMax = -1e3;

    for (int s = 0; s < 4; s++) {
        float f = freqs[s] * (1.0 + 0.08 * turb * sin(t * 0.6 + float(s)));
        float ph = drift * (0.9 + float(s) * 0.15) + phaseOffsets[s];
        float ribbonAmp = totalAmp * ampScales[s];
        
        // Multi-frequency harmonic ribbon trajectory
        float yRibbon = ribbonAmp * env * (
            0.78 * sin(p.x * f + ph) +
            0.22 * sin(p.x * (f * 1.6) + ph * 1.3)
        );

        yMin = min(yMin, yRibbon);
        yMax = max(yMax, yRibbon);

        if (s == 0) yMain = yRibbon;

        float d = abs(p.y - yRibbon);

        // Core thin luminous line (crystalline filament), modulated by envelope so ends float cleanly!
        float coreLine = (0.016 * glowMult * env) / (d * d * 35.0 + d * 4.0 + 0.014);

        // Soft atmospheric ribbon halo
        float ribbonHalo = (0.010 * glowMult * env) / (d * 8.0 + 0.045);

        // Additive chromatic ribbon light
        colAcc += ribbonColors[s] * (coreLine * 1.35 + ribbonHalo * 0.65);
    }

    // High-energy central white-blue filament (Siri's signature luminous spine)
    float dSpine = abs(p.y - yMain);
    float spine = (0.022 * glowMult * env * (0.8 + 0.6 * vocalAmp * isAct)) / (dSpine * dSpine * 70.0 + dSpine * 6.0 + 0.012);
    vec3 spineColor = mix(vec3(0.92, 0.96, 1.0), uColor2.rgb, 0.25);
    colAcc += spineColor * spine * 0.95;

    // Translucent silk membrane fill between ribbons
    if (p.y >= yMin && p.y <= yMax) {
        float span = max(yMax - yMin, 0.001);
        float normY = clamp((p.y - yMin) / span, 0.0, 1.0);
        vec3 membraneColor = mix(
            mix(ribbonColors[2], ribbonColors[0], 0.5),
            mix(ribbonColors[1], ribbonColors[3], 0.5),
            normY
        );
        float membraneAlpha = sin(normY * PI) * (0.10 + 0.16 * vocalAmp * isAct) * env * glowMult;
        colAcc += membraneColor * membraneAlpha;
    }

    // Edge screen mask to prevent boundary clipping
    float xScreen = (gl_FragCoord.x + 0.5) * 2.0 / R.x - 1.0;
    float emX = clamp((abs(xScreen) - 1.0) / -0.15, 0.0, 1.0);
    float emY = clamp((abs(yScreen) - 1.0) / -0.35, 0.0, 1.0);
    colAcc *= (emX * emX * (3.0 - 2.0 * emX)) * (emY * emY * (3.0 - 2.0 * emY));

    // Clamp colAcc to [0, 1] for zero-halo premultiplied alpha math
    vec3 finalCol = clamp(colAcc, 0.0, 1.0);

    float lum = max(finalCol.r, max(finalCol.g, finalCol.b));
    float alpha = smoothstep(0.004, 0.04, lum) * clamp(lum * 1.6, 0.0, 1.0);

    // High-frequency dither to prevent banding
    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

    if (uTransparent > 0.5) {
        vec3 rgb = max(vec3(0.0), finalCol * alpha + dither * alpha);
        gl_FragColor = vec4(rgb, alpha);
    } else {
        vec3 rgb = max(vec3(0.0), finalCol + dither);
        gl_FragColor = vec4(rgb, 1.0);
    }
}
`;
}
