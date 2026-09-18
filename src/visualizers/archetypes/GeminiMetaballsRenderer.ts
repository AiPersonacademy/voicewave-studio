/**
 * src/visualizers/archetypes/GeminiMetaballsRenderer.ts
 *
 * Archetype 3: Gemini Live Fluid Metaballs
 * 4 orbiting liquid drops with dynamic acoustic velocity stretching,
 * polynomial smooth-minimum coalescence into a single fluid drop upon speech detection,
 * 4-color fluid field interpolation, and pseudo-3D specular dome lighting.
 */

import { BaseWebGLQuadRenderer } from "../BaseWebGLQuadRenderer";

export class GeminiMetaballsRenderer extends BaseWebGLQuadRenderer {
  readonly id = "gemini-metaballs";
  readonly name = "Gemini Live Fluid Metaballs";
  readonly description = "Multi-color smooth-min coalescing liquid drops with velocity stretch";

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

// Polynomial smooth-minimum
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

void main() {
    vec2 R = uResolution.xy;
    float aspect = uAspectRatio > 0.0 ? uAspectRatio : (R.x / max(R.y, 1.0));
    vec2 p = (gl_FragCoord.xy - 0.5 * R) / min(R.x, R.y);

    float sens = clamp(uSensitivity, 0.2, 3.0);
    float turb = clamp(uTurbulence, 0.0, 2.5);
    float glowVal = clamp(uGlow, 0.1, 3.0);
    float userScale = clamp(uScale, 0.5, 2.0);
    float isAct = clamp(uAudioActive, 0.0, 1.0);

    float t = uTime * 0.9 + uPhase * 0.4;
    float vocalContract = clamp(uAmp * sens, 0.0, 1.0);

    // Orbital radius: drops contract and coalesce when audio is active
    float baseOrbit = 0.26 * userScale;
    float orbitRadius = baseOrbit * mix(1.0, 0.32, isAct * vocalContract);
    float baseR = 0.11 * userScale * (1.0 + 0.35 * uLow * isAct);
    
    // Dynamic smooth-min blend radius
    float blendK = (0.09 + 0.14 * uMid * turb * isAct + 0.05 * uAmp) * userScale;

    vec2 dropPos[4];
    float dropR[4];
    vec3 dropColor[4];

    dropColor[0] = uColor0.rgb; // Google Blue
    dropColor[1] = uColor1.rgb; // Google Red
    dropColor[2] = uColor2.rgb; // Google Green
    dropColor[3] = uColor3.rgb; // Google Gold

    float speeds[4];
    speeds[0] = 1.1;
    speeds[1] = -0.95;
    speeds[2] = 1.35;
    speeds[3] = -1.15;

    float angles[4];
    angles[0] = t * speeds[0];
    angles[1] = t * speeds[1] + PI * 0.5;
    angles[2] = t * speeds[2] + PI;
    angles[3] = t * speeds[3] + PI * 1.5;

    for (int i = 0; i < 4; i++) {
        float ang = angles[i];
        float rEcc = orbitRadius * (1.0 + 0.18 * sin(t * 1.8 + float(i) * 1.5));
        dropPos[i] = vec2(cos(ang) * rEcc, sin(ang) * rEcc * 0.9);
        dropR[i] = baseR * (0.9 + 0.2 * sin(t * 2.2 + float(i) * 2.0));
    }

    // Evaluate smooth-min SDF & color weights
    float dMeta = 1e4;
    vec3 colorAcc = vec3(0.0);
    float weightAcc = 0.0;

    for (int i = 0; i < 4; i++) {
        vec2 diff = p - dropPos[i];
        vec2 velDir = vec2(-sin(angles[i]), cos(angles[i]));
        float vProj = dot(diff, velDir);
        float stretchFactor = 0.25 * (1.0 + 0.5 * uHigh);
        vec2 deformed = diff - velDir * (vProj * stretchFactor);
        
        float d = length(deformed) - dropR[i];
        dMeta = (i == 0) ? d : smin(dMeta, d, blendK);

        // Inverse distance color weighting
        float w = 1.0 / (max(d, 0.0) * max(d, 0.0) + 0.008);
        colorAcc += dropColor[i] * w;
        weightAcc += w;
    }

    vec3 blendedCol = colorAcc / max(weightAcc, 1e-4);

    // Compute 2D numerical normal for pseudo-3D dome lighting
    float eps = 0.004 * userScale;
    vec2 grad = vec2(
        smin(length(p + vec2(eps, 0.0) - dropPos[0]) - dropR[0], length(p + vec2(eps, 0.0) - dropPos[1]) - dropR[1], blendK) -
        smin(length(p - vec2(eps, 0.0) - dropPos[0]) - dropR[0], length(p - vec2(eps, 0.0) - dropPos[1]) - dropR[1], blendK),
        smin(length(p + vec2(0.0, eps) - dropPos[0]) - dropR[0], length(p + vec2(0.0, eps) - dropPos[1]) - dropR[1], blendK) -
        smin(length(p - vec2(0.0, eps) - dropPos[0]) - dropR[0], length(p - vec2(0.0, eps) - dropPos[1]) - dropR[1], blendK)
    ) / (2.0 * eps);

    vec2 n2D = normalize(grad);
    float domeZ = sqrt(max(0.0, 1.0 - clamp(dot(n2D, n2D) * 0.4, 0.0, 0.95)));
    vec3 normal3D = normalize(vec3(n2D * 0.65, domeZ));

    // Specular lighting
    vec3 lightDir = normalize(vec3(0.5, 0.7, 1.0));
    float diff = max(dot(normal3D, lightDir), 0.0);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfV = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal3D, halfV), 0.0), 32.0) * (0.8 + 0.4 * uHigh);

    float fresnel = pow(1.0 - normal3D.z, 2.5);

    vec3 fluidColor = blendedCol * (0.45 + 0.55 * diff) + vec3(spec) + blendedCol * fresnel * 0.8;
    fluidColor *= (1.0 + 0.35 * uAmp * isAct);

    float edgeAA = smoothstep(0.006 * userScale, -0.006 * userScale, dMeta);
    float glowMask = smoothstep(0.80 * userScale, 0.40 * userScale, length(p));
    float outerGlow = exp(-max(dMeta, 0.0) * 16.0 / userScale) * glowVal * (0.4 + 0.6 * uAmp) * glowMask;

    vec3 finalCol = clamp(fluidColor * edgeAA + blendedCol * outerGlow, 0.0, 1.0);
    float alpha = clamp(edgeAA + outerGlow * 0.85, 0.0, 1.0);

    float lum = max(finalCol.r, max(finalCol.g, finalCol.b));
    float finalAlpha = smoothstep(0.005, 0.04, lum) * alpha;

    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

    if (uTransparent > 0.5) {
        vec3 rgb = max(vec3(0.0), finalCol * finalAlpha + dither * finalAlpha);
        gl_FragColor = vec4(rgb, finalAlpha);
    } else {
        vec3 rgb = max(vec3(0.0), finalCol + dither);
        gl_FragColor = vec4(rgb, 1.0);
    }
}
`;
}
