/**
 * src/visualizers/archetypes/ChatGptOrbRenderer.ts
 *
 * Archetype 2: ChatGPT Fluid 3D Voice Orb
 * Raymarched signed distance field sphere perturbed by 3-octave harmonic simplex noise,
 * accelerated via analytical ray-sphere bounding volume pruning (max 42 steps),
 * featuring Fresnel rim lighting, subsurface scattering glow, and zero-halo premultiplied alpha math.
 */

import { BaseWebGLQuadRenderer } from "../BaseWebGLQuadRenderer";

export class ChatGptOrbRenderer extends BaseWebGLQuadRenderer {
  readonly id = "chatgpt-orb";
  readonly name = "ChatGPT Fluid 3D Voice Orb";
  readonly description = "Raymarched SDF sphere with 3D simplex noise and Fresnel rim lighting";

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

// Fast Simplex 3D noise
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float gBaseRadius;
float gTurbulence;
float gLow;
float gMid;
float gHigh;
float gTime;

float mapSDF(vec3 p) {
    float r = length(p);
    vec3 q = p * 1.8;
    float t = gTime;
    
    // 3-octave noise displacement
    float n1 = snoise(q + vec3(0.0, t * 0.45, 0.0)) * (0.10 + 0.26 * gLow);
    float n2 = snoise(q * 2.1 - vec3(t * 0.7, 0.0, t * 0.35)) * (0.05 + 0.16 * gMid);
    float n3 = snoise(q * 4.2 + vec3(0.0, 0.0, t * 1.1)) * (0.02 + 0.08 * gHigh);
    
    float disp = (n1 + n2 + n3) * gTurbulence;
    return r - gBaseRadius - disp;
}

vec3 calcNormal(vec3 p, float h) {
    const vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * mapSDF(p + k.xyy * h) +
        k.yyx * mapSDF(p + k.yyx * h) +
        k.yxy * mapSDF(p + k.yxy * h) +
        k.xxx * mapSDF(p + k.xxx * h)
    );
}

void main() {
    vec2 R = uResolution.xy;
    float aspect = uAspectRatio > 0.0 ? uAspectRatio : (R.x / max(R.y, 1.0));
    vec2 uv = (gl_FragCoord.xy - 0.5 * R) / min(R.x, R.y);

    float sens = clamp(uSensitivity, 0.2, 3.0);
    float turb = clamp(uTurbulence, 0.0, 2.5);
    float glowVal = clamp(uGlow, 0.1, 3.0);
    float userScale = clamp(uScale, 0.5, 2.0);

    gLow = clamp(uLow * sens, 0.0, 1.5);
    gMid = clamp(uMid * sens, 0.0, 1.5);
    gHigh = clamp(uHigh * sens, 0.0, 1.5);
    gTurbulence = turb * mix(0.4, 1.0, uAudioActive);
    gTime = uTime * 0.85 + uPhase * 0.4;
    gBaseRadius = (0.50 + 0.18 * gLow + 0.03 * sin(uTime * 1.5)) * userScale;

    // Ray setup
    vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 rd = normalize(vec3(uv, -1.75));

    // Bounding sphere intersection acceleration
    float rBound = gBaseRadius + 0.45 * turb + 0.1;
    float b = dot(ro, rd);
    float c = dot(ro, ro) - rBound * rBound;
    float h = b * b - c;

    float dCenter = length(uv);
    float radialEnvelope = smoothstep(0.67, 0.45, dCenter);
    float glowFalloff = smoothstep(0.85 * userScale, 0.40 * userScale, dCenter);
    float ambientGlow = exp(-dCenter * dCenter * 16.0 / (userScale * userScale)) * 0.05 * glowVal * (1.0 + uAmp) * glowFalloff * radialEnvelope;

    // Early exit if ray completely misses bounding volume
    if (h < 0.0) {
        vec3 haloCol = mix(uColor0.rgb, uColor1.rgb, clamp(dCenter * 1.5, 0.0, 1.0)) * ambientGlow;
        float lum = max(haloCol.r, max(haloCol.g, haloCol.b));
        float alpha = smoothstep(0.005, 0.04, lum) * clamp(lum * 1.8, 0.0, 1.0) * radialEnvelope;
        haloCol *= radialEnvelope;
        if (uTransparent > 0.5) {
            gl_FragColor = vec4(haloCol * alpha, alpha);
        } else {
            gl_FragColor = vec4(haloCol, 1.0);
        }
        return;
    }

    // Raymarch only within bounding sphere entry and exit
    float tNear = max(-b - sqrt(h), 0.0);
    float tFar = -b + sqrt(h);

    float t = tNear;
    float hitDist = -1.0;
    float minDist = 1e4;
    
    // Step budget <= 48 steps (MAX_STEPS = 42)
    const int MAX_STEPS = 42;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = mapSDF(p);
        minDist = min(minDist, d);
        if (d < 0.0018) {
            hitDist = t;
            break;
        }
        t += max(d * 0.75, 0.007);
        if (t > tFar) break;
    }

    vec3 col = vec3(0.0);
    float alphaAcc = 0.0;

    if (hitDist > 0.0) {
        // Surface hit
        vec3 p = ro + rd * hitDist;
        vec3 n = calcNormal(p, 0.004);
        
        vec3 lightDir1 = normalize(vec3(0.8, 1.0, 1.2));
        vec3 lightDir2 = normalize(vec3(-0.9, -0.6, -0.5));
        
        float diff1 = max(dot(n, lightDir1), 0.0);
        float diff2 = max(dot(n, lightDir2), 0.0) * 0.4;
        
        // Fresnel rim term
        float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
        float depthGrad = clamp((length(p) - gBaseRadius * 0.7) / (gBaseRadius * 0.6), 0.0, 1.0);
        
        vec3 coreCol = mix(uColor0.rgb, uColor1.rgb, depthGrad);
        vec3 mantleCol = mix(coreCol, uColor2.rgb, fresnel * 0.85);
        vec3 rimCol = mix(mantleCol, uColor3.rgb, pow(fresnel, 3.2));
        
        // Specular highlight
        vec3 halfV = normalize(lightDir1 - rd);
        float spec = pow(max(dot(n, halfV), 0.0), 28.0) * (0.6 + 0.4 * gHigh);
        
        col = rimCol * (0.35 + 0.65 * diff1 + diff2) + spec * uColor3.rgb;
        col += uColor2.rgb * fresnel * (1.2 + 0.8 * glowVal * uAmp);
        
        alphaAcc = clamp(0.75 + 0.25 * fresnel + 0.2 * uAmp, 0.0, 1.0);
    } else {
        // Glancing ray: accumulate subsurface halo
        float glowFactor = exp(-max(minDist, 0.0) * 12.0) * (0.4 + 0.6 * glowVal);
        col = mix(uColor1.rgb, uColor2.rgb, clamp(minDist * 4.0, 0.0, 1.0)) * glowFactor;
        alphaAcc = clamp(glowFactor * 0.7, 0.0, 0.8);
    }

    col += mix(uColor0.rgb, uColor3.rgb, clamp(dCenter * 1.2, 0.0, 1.0)) * ambientGlow;
    alphaAcc = max(alphaAcc, clamp(ambientGlow * 2.0, 0.0, 1.0));

    // Tone map / clamp col to [0, 1] so that col * finalAlpha <= finalAlpha is strictly guaranteed
    col = clamp(col, 0.0, 1.0);

    float lum = max(col.r, max(col.g, col.b));
    float finalAlpha = smoothstep(0.006, 0.045, lum) * clamp(alphaAcc, 0.0, 1.0);

    // Enforce strict zero-alpha corners and radial boundary falloff under all scales
    finalAlpha *= radialEnvelope;
    col *= radialEnvelope;

    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

    if (uTransparent > 0.5) {
        vec3 rgb = clamp(col * finalAlpha + dither * finalAlpha, vec3(0.0), vec3(finalAlpha));
        gl_FragColor = vec4(rgb, finalAlpha);
    } else {
        vec3 rgb = max(vec3(0.0), col + dither);
        gl_FragColor = vec4(rgb, 1.0);
    }
}
`;
}
