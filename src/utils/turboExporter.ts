import { Muxer, ArrayBufferTarget } from "webm-muxer"
import { VERTEX_SHADER, FRAGMENT_SHADERS } from "@/components/ui/audio-reactive-siri-wave"
import type { SiriWaveVariant } from "@/components/ui/siri-wave"

export interface TurboExportProgress {
  current: number
  total: number
  percent: number
  fps: number
  speedRatio: string
}

export interface TurboExportOptions {
  audioBuffer: AudioBuffer
  variant: SiriWaveVariant
  size: number
  renderScale: number
  sensitivity: number
  smoothness: number
  resetSpeed: number
  duration: number
  fps?: number
  onProgress?: (progress: TurboExportProgress) => void
  signal?: AbortSignal
}

export function isTurboExportSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof AudioData !== "undefined"
  )
}

interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  x1: number
  x2: number
  y1: number
  y2: number
}

function createBiquadLowpass(fc: number, fs: number): Biquad {
  const w0 = (2 * Math.PI * fc) / fs
  const alpha = Math.sin(w0) / (2 * 0.707)
  const cosw0 = Math.cos(w0)
  const b0 = (1 - cosw0) / 2
  const b1 = 1 - cosw0
  const b2 = (1 - cosw0) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

function createBiquadBandpass(fc: number, q: number, fs: number): Biquad {
  const w0 = (2 * Math.PI * fc) / fs
  const alpha = Math.sin(w0) / (2 * q)
  const cosw0 = Math.cos(w0)
  const b0 = alpha
  const b1 = 0
  const b2 = -alpha
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

function createBiquadHighpass(fc: number, fs: number): Biquad {
  const w0 = (2 * Math.PI * fc) / fs
  const alpha = Math.sin(w0) / (2 * 0.707)
  const cosw0 = Math.cos(w0)
  const b0 = (1 + cosw0) / 2
  const b1 = -(1 + cosw0)
  const b2 = (1 + cosw0) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

function applyBiquad(filter: Biquad, x: number): number {
  const y =
    filter.b0 * x +
    filter.b1 * filter.x1 +
    filter.b2 * filter.x2 -
    filter.a1 * filter.y1 -
    filter.a2 * filter.y2
  filter.x2 = filter.x1
  filter.x1 = x
  filter.y2 = filter.y1
  filter.y1 = y
  return y
}

export interface FrameData {
  time: number
  phase: number
  low: number
  mid: number
  high: number
  amp: number
  isActive: boolean
}

export function precomputeFrames(
  audioBuffer: AudioBuffer,
  targetDuration: number,
  fps: number,
  sensitivity: number,
  smoothness: number,
  resetSpeed: number
): FrameData[] {
  const fs = audioBuffer.sampleRate
  const totalSamples = audioBuffer.length
  const numChannels = audioBuffer.numberOfChannels

  // Downmix to mono
  const mono = new Float32Array(totalSamples)
  const ch0 = audioBuffer.getChannelData(0)
  if (numChannels === 1) {
    mono.set(ch0)
  } else {
    const ch1 = audioBuffer.getChannelData(1)
    for (let i = 0; i < totalSamples; i++) {
      mono[i] = (ch0[i] + ch1[i]) * 0.5
    }
  }

  // Pre-filter into Low (280Hz), Mid (1200Hz, Q=1.2), and High (3200Hz) bands
  const lowSig = new Float32Array(totalSamples)
  const midSig = new Float32Array(totalSamples)
  const highSig = new Float32Array(totalSamples)

  const lp = createBiquadLowpass(280, fs)
  const bp = createBiquadBandpass(1200, 1.2, fs)
  const hp = createBiquadHighpass(3200, fs)

  for (let i = 0; i < totalSamples; i++) {
    const s = mono[i]
    lowSig[i] = applyBiquad(lp, s)
    midSig[i] = applyBiquad(bp, s)
    highSig[i] = applyBiquad(hp, s)
  }

  const totalFrames = Math.round(targetDuration * fps)
  const dt = 1.0 / fps
  const windowSize = Math.round(fs * 0.038) // 38ms acoustic analysis window

  // Cascaded 2-pole liquid follower ballistics
  const userSmooth = Math.min(Math.max(smoothness, 0.65), 0.98)
  const att1 = 0.52 - (userSmooth - 0.65) * 0.4
  const att2 = 0.46 - (userSmooth - 0.65) * 0.36
  const r = Math.min(Math.max(resetSpeed, 0.5), 0.98)
  const dec1 = 0.12 + (r - 0.5) * 0.18
  const dec2 = 0.16 + (r - 0.5) * 0.18

  const liquidStep = (s1: number, s2: number, target: number): [number, number] => {
    const a1 = target > s1 ? att1 : dec1
    const a2 = s1 > s2 ? att2 : dec2
    const nextS1 = s1 + (target - s1) * a1
    const nextS2 = s2 + (nextS1 - s2) * a2
    return [nextS1, nextS2]
  }

  let ampS1 = 0, ampS2 = 0
  let lowS1 = 0, lowS2 = 0
  let midS1 = 0, midS2 = 0
  let highS1 = 0, highS2 = 0
  let actS1 = 0, actS2 = 0
  let phase = 0

  const frames: FrameData[] = []

  for (let f = 0; f < totalFrames; f++) {
    const t = f * dt
    const center = Math.round(t * fs)
    const start = Math.max(0, center - Math.floor(windowSize / 2))
    const end = Math.min(totalSamples, start + windowSize)
    const count = end - start

    let sumSqMono = 0
    let sumSqLow = 0
    let sumSqMid = 0
    let sumSqHigh = 0

    if (count > 0) {
      for (let k = start; k < end; k++) {
        const m = mono[k]
        sumSqMono += m * m
        const l = lowSig[k]
        sumSqLow += l * l
        const mi = midSig[k]
        sumSqMid += mi * mi
        const h = highSig[k]
        sumSqHigh += h * h
      }
    }

    const rmsMono = count > 0 ? Math.sqrt(sumSqMono / count) : 0
    const rmsLow = count > 0 ? Math.sqrt(sumSqLow / count) : 0
    const rmsMid = count > 0 ? Math.sqrt(sumSqMid / count) : 0
    const rmsHigh = count > 0 ? Math.sqrt(sumSqHigh / count) : 0

    // Calibrated vocal dynamic curves
    const inAmp = Math.min(1.0, Math.max(0, (rmsMono - 0.005) * 4.8))
    const inLow = Math.min(1.0, Math.max(0, (rmsLow - 0.003) * 4.5))
    const inMid = Math.min(1.0, Math.max(0, (rmsMid - 0.003) * 5.2))
    const inHigh = Math.min(1.0, Math.max(0, (rmsHigh - 0.002) * 6.0))
    const inActive = inAmp > 0.015

    const targetAmp = inActive ? inAmp : 0
    const targetActive = inActive ? 1.0 : 0.0

    ;[ampS1, ampS2] = liquidStep(ampS1, ampS2, targetAmp)
    ;[lowS1, lowS2] = liquidStep(lowS1, lowS2, inLow)
    ;[midS1, midS2] = liquidStep(midS1, midS2, inMid)
    ;[highS1, highS2] = liquidStep(highS1, highS2, inHigh)
    ;[actS1, actS2] = liquidStep(actS1, actS2, targetActive)

    const smoothedAmp = ampS2
    const smoothedLow = lowS2
    const smoothedMid = midS2
    const smoothedHigh = highS2
    const smoothedActive = actS2

    const currentSpeed = 0.85 + smoothedActive * (0.75 * smoothedAmp * sensitivity)
    phase = (phase + currentSpeed * dt) % (20.0 * Math.PI)

    frames.push({
      time: t,
      phase,
      low: smoothedLow,
      mid: smoothedMid,
      high: smoothedHigh,
      amp: smoothedAmp,
      isActive: smoothedActive > 0.1,
    })
  }

  return frames
}

export async function exportTurboWebM(options: TurboExportOptions): Promise<Blob> {
  const {
    audioBuffer,
    variant,
    size,
    renderScale,
    sensitivity,
    smoothness,
    resetSpeed,
    duration,
    fps = 60,
    onProgress,
    signal,
  } = options

  const dim = Math.round(size * renderScale)
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const targetDuration = Math.min(duration, audioBuffer.duration)

  // 1. Precompute all animation frames in ~15ms
  const frames = precomputeFrames(
    audioBuffer,
    targetDuration,
    fps,
    sensitivity,
    smoothness,
    resetSpeed
  )

  // 2. Initialize webm-muxer
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "V_VP9",
      width: dim,
      height: dim,
      frameRate: fps,
      alpha: true,
    },
    audio: {
      codec: "A_OPUS",
      numberOfChannels: numChannels,
      sampleRate: sampleRate,
    },
    firstTimestampBehavior: "strict",
  })

  // 3. Initialize WebCodecs VideoEncoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => console.error("Turbo VideoEncoder error:", err),
  })
  videoEncoder.configure({
    codec: "vp09.00.10.08",
    width: dim,
    height: dim,
    bitrate: 16_000_000,
    alpha: "discard",
  })

  // 4. Initialize WebCodecs AudioEncoder
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => console.error("Turbo AudioEncoder error:", err),
  })
  audioEncoder.configure({
    codec: "opus",
    sampleRate: sampleRate,
    numberOfChannels: numChannels,
    bitrate: 128_000,
  })

  // 5. Offline audio encoding in 40ms chunks
  const totalAudioSamples = Math.min(
    audioBuffer.length,
    Math.round(targetDuration * sampleRate)
  )
  const chunkSize = 1920 // ~40ms at 48kHz

  for (let offset = 0; offset < totalAudioSamples; offset += chunkSize) {
    if (signal?.aborted) {
      videoEncoder.close()
      audioEncoder.close()
      throw new Error("Export cancelled")
    }

    const framesThisChunk = Math.min(chunkSize, totalAudioSamples - offset)
    const planarData = new Float32Array(framesThisChunk * numChannels)

    for (let ch = 0; ch < numChannels; ch++) {
      const channel = audioBuffer.getChannelData(ch)
      const channelOffset = ch * framesThisChunk
      for (let s = 0; s < framesThisChunk; s++) {
        planarData[channelOffset + s] = channel[offset + s]
      }
    }

    const timestampUs = Math.round((offset / sampleRate) * 1_000_000)
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: sampleRate,
      numberOfFrames: framesThisChunk,
      numberOfChannels: numChannels,
      timestamp: timestampUs,
      data: planarData,
    })

    audioEncoder.encode(audioData)
    audioData.close()
  }

  // 6. Setup offscreen WebGL renderer
  const canvas = document.createElement("canvas")
  canvas.width = dim
  canvas.height = dim

  const gl = canvas.getContext("webgl", {
    powerPreference: "high-performance",
    alpha: true,
    premultipliedAlpha: true,
  })
  if (!gl) throw new Error("WebGL not available for Turbo export")

  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(log ?? "Shader compile error")
    }
    return shader
  }

  const program = gl.createProgram()!
  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADERS[variant])
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  )
  const aPos = gl.getAttribLocation(program, "aPos")
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uResolution = gl.getUniformLocation(program, "iResolution")
  const uTime = gl.getUniformLocation(program, "iTime")
  const uPhase = gl.getUniformLocation(program, "uPhase")
  const uLow = gl.getUniformLocation(program, "uLow")
  const uMid = gl.getUniformLocation(program, "uMid")
  const uHigh = gl.getUniformLocation(program, "uHigh")
  const uAmp = gl.getUniformLocation(program, "uAmp")
  const uSensitivity = gl.getUniformLocation(program, "uSensitivity")
  const uAudioActive = gl.getUniformLocation(program, "uAudioActive")
  const uTransparent = gl.getUniformLocation(program, "uTransparent")

  gl.viewport(0, 0, dim, dim)

  // 7. Render each frame and encode via WebCodecs
  const totalFrames = frames.length
  const renderStartTime = performance.now()

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      videoEncoder.close()
      audioEncoder.close()
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
      throw new Error("Export cancelled")
    }

    const f = frames[i]
    gl.uniform2f(uResolution, dim, dim)
    gl.uniform1f(uTime, f.time)
    gl.uniform1f(uPhase, f.phase)
    gl.uniform1f(uLow, f.low)
    gl.uniform1f(uMid, f.mid)
    gl.uniform1f(uHigh, f.high)
    gl.uniform1f(uAmp, f.amp)
    gl.uniform1f(uSensitivity, sensitivity)
    gl.uniform1f(uAudioActive, f.isActive ? 1.0 : 0.0)
    gl.uniform1f(uTransparent, 1.0)

    gl.drawArrays(gl.TRIANGLES, 0, 3)

    const timestampUs = Math.round(f.time * 1_000_000)
    const videoFrame = new VideoFrame(canvas, { timestamp: timestampUs })
    videoEncoder.encode(videoFrame, { keyFrame: i % (fps * 2) === 0 })
    videoFrame.close()

    // Handle encoder queue backpressure to avoid memory accumulation
    if (videoEncoder.encodeQueueSize > 6) {
      await new Promise<void>((resolve) => {
        videoEncoder.ondequeue = () => {
          if (videoEncoder.encodeQueueSize <= 2) {
            videoEncoder.ondequeue = null
            resolve()
          }
        }
      })
    }

    // Yield every 30 frames for smooth UI progress
    if (i % 30 === 0 || i === totalFrames - 1) {
      const elapsedSec = (performance.now() - renderStartTime) / 1000
      const fpsAchieved = elapsedSec > 0 ? Math.round(i / elapsedSec) : 0
      const speedRatio = fpsAchieved > 0 ? (fpsAchieved / fps).toFixed(1) : "1.0"

      onProgress?.({
        current: f.time,
        total: targetDuration,
        percent: Math.min(100, Math.round(((i + 1) / totalFrames) * 100)),
        fps: fpsAchieved,
        speedRatio: `${speedRatio}x`,
      })

      // Micro-yield to allow UI thread to paint
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // 8. Flush and finalize
  await videoEncoder.flush()
  await audioEncoder.flush()
  muxer.finalize()

  // Clean WebGL resources
  gl.deleteProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  gl.deleteBuffer(buffer)

  const outputBuffer = muxer.target.buffer
  return new Blob([outputBuffer], { type: "video/webm" })
}
