/**
 * src/visualizers/archetypes/GeminiMetaballsRenderer.ts
 *
 * Archetype 3: Gemini Live Fluid Metaballs
 * 4 vibrant liquid drops in Google signature chromatic spectrum (Blue, Red, Green, Yellow)
 * orbiting in an iconic 4-lobed fluid clover, reaching inward with organic fluid bridges
 * upon speech detection, with 2.5D specular dome glints, central intelligence core,
 * and zero-halo premultiplied alpha math.
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

// Polynomial smooth-minimum for organic fluid coalescence
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
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

    float t = uTime * 0.90 + uPhase * 0.40;
    float vocalAmp = clamp(uAmp * sens, 0.0, 1.5);
    float vocalLow = clamp(uLow * sens, 0.0, 1.5);
    float vocalMid = clamp(uMid * sens, 0.0, 1.5);

    // Balanced 4-lobed orbital geometry:
    // Retains symmetrical quad-separation so the 4 Google colors form an iconic fluid clover
    float baseOrbit = 0.25 * userScale;
    float orbitRadius = baseOrbit * mix(1.0, 0.76, isAct * clamp(vocalAmp * 0.6, 0.0, 0.75));
    
    // Base droplet radius
    float baseR = (0.095 + 0.025 * vocalLow * isAct) * userScale;
    
    // Dynamic smooth-min blend radius: liquid bridges form when voice is active
    float blendK = mix(0.040, 0.095 + 0.045 * vocalMid, isAct) * userScale;

    // Google Signature Quad-Colors
    vec3 dropColor[4];
    dropColor[0] = uColor0.rgb; // Google Blue (#4285F4)
    dropColor[1] = uColor1.rgb; // Google Red (#EA4335)
    dropColor[2] = uColor2.rgb; // Google Green (#34A853)
    dropColor[3] = uColor3.rgb; // Google Yellow (#FBBC05)

    // Coordinated synchronized quad-orbital motion
    float rot = t * 0.75 * (0.85 + 0.15 * turb);

    vec2 dropPos[4];
    float dropR[4];
    float angles[4];

    for (int i = 0; i < 4; i++) {
        float baseAng = float(i) * (PI * 0.5); // 0, 90, 180, 270 deg
        angles[i] = baseAng + rot;
        float ang = angles[i];
        
        // Fluid eccentric wobble
        float wobble = 1.0 + 0.10 * sin(t * 2.0 + float(i) * 1.57);
        dropPos[i] = vec2(cos(ang), sin(ang)) * (orbitRadius * wobble);
        
        // Individual droplet pulsation
        float rPulse = 1.0 + 0.12 * sin(t * 2.4 + float(i) * 1.57) + 0.14 * vocalAmp * isAct;
        dropR[i] = baseR * rPulse;
    }

    // Evaluate smooth-min SDF & saturated inverse-distance color weights
    float dMeta = 1e4;
    vec3 colorAcc = vec3(0.0);
    float weightAcc = 0.0;

    for (int i = 0; i < 4; i++) {
        vec2 diff = p - dropPos[i];
        
        // Velocity direction stretching for organic teardrop fluidity
        vec2 velDir = vec2(-sin(angles[i]), cos(angles[i]));
        float vProj = dot(diff, velDir);
        float stretchFactor = 0.18 * (1.0 + 0.3 * uHigh * isAct);
        vec2 deformed = diff - velDir * (vProj * stretchFactor);
        
        float d = length(deformed) - dropR[i];
        dMeta = (i == 0) ? d : smin(dMeta, d, blendK);

        // Normalized power weight ensuring rich, saturated colors in each droplet lobe
        float w = 1.0 / (pow(max(length(diff) - dropR[i] * 0.4, 0.001) + 0.055, 3.6));
        colorAcc += dropColor[i] * w;
        weightAcc += w;
    }

    // Center Google intelligence core (spark/droplet that glows with speech)
    float centerCoreR = (0.040 + 0.025 * vocalAmp * isAct) * userScale;
    float dCenter = length(p) - centerCoreR;
    dMeta = smin(dMeta, dCenter, blendK * 0.80);

    vec3 blendedCol = colorAcc / max(weightAcc, 1e-5);
    // Core center adds a subtle white-blue luminance nexus
    float centerProx = exp(-length(p) * 20.0 / userScale);
    blendedCol = mix(blendedCol, vec3(0.96, 0.98, 1.0), centerProx * 0.50 * isAct);

    // Compute numerical normal for 2.5D liquid dome lighting
    float eps = 0.004 * userScale;
    vec2 grad = vec2(
        smin(length(p + vec2(eps, 0.0) - dropPos[0]) - dropR[0], length(p + vec2(eps, 0.0) - dropPos[1]) - dropR[1], blendK) -
        smin(length(p - vec2(eps, 0.0) - dropPos[0]) - dropR[0], length(p - vec2(eps, 0.0) - dropPos[1]) - dropR[1], blendK),
        smin(length(p + vec2(0.0, eps) - dropPos[0]) - dropR[0], length(p + vec2(0.0, eps) - dropPos[1]) - dropR[1], blendK) -
        smin(length(p - vec2(0.0, eps) - dropPos[0]) - dropR[0], length(p - vec2(0.0, eps) - dropPos[1]) - dropR[1], blendK)
    ) / (2.0 * eps);

    vec2 n2D = normalize(grad);
    float domeZ = sqrt(max(0.0, 1.0 - clamp(dot(n2D, n2D) * 0.45, 0.0, 0.90)));
    vec3 normal3D = normalize(vec3(n2D * 0.55, domeZ));

    // Specular and diffuse dome lighting (delicate glint, no overexposure)
    vec3 lightDir = normalize(vec3(0.35, 0.55, 1.0));
    float diff = max(dot(normal3D, lightDir), 0.0);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfV = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal3D, halfV), 0.0), 32.0) * 0.35;

    float fresnel = pow(1.0 - normal3D.z, 2.0) * 0.30;

    // Rich liquid color composite: diffuse body + subtle specular + soft Fresnel rim
    vec3 fluidColor = blendedCol * (0.70 + 0.30 * diff) + vec3(spec) + blendedCol * fresnel;

    // Edge anti-aliasing (smooth step)
    float edgeAA = smoothstep(0.005 * userScale, -0.005 * userScale, dMeta);
    
    // Soft outer atmospheric glow
    float glowMask = smoothstep(0.90 * userScale, 0.30 * userScale, length(p));
    float outerGlow = exp(-max(dMeta, 0.0) * 16.0 / userScale) * glowVal * (0.30 + 0.40 * vocalAmp) * glowMask;

    vec3 finalCol = clamp(fluidColor * edgeAA + blendedCol * outerGlow * 0.65, 0.0, 1.0);
    float alpha = clamp(edgeAA + outerGlow * 0.80, 0.0, 1.0);

    float lum = max(finalCol.r, max(finalCol.g, finalCol.b));
    float finalAlpha = smoothstep(0.005, 0.04, lum) * alpha;

    // High frequency dither
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
