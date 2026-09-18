import { zipSync } from "fflate"
import { VERTEX_SHADER, FRAGMENT_SHADERS } from "@/components/ui/audio-reactive-siri-wave"
import type { SiriWaveVariant } from "@/components/ui/siri-wave"
import { precomputeFrames } from "./turboExporter"
import { audioBufferToWav } from "./wavHelper"

export interface PNGSequenceExportOptions {
  audioBuffer: AudioBuffer
  variant: SiriWaveVariant
  size: number
  renderScale: number
  sensitivity: number
  smoothness: number
  resetSpeed: number
  duration: number
  fps?: number
  onProgress?: (progress: { current: number; total: number; percent: number; fps: number }) => void
  signal?: AbortSignal
}

/**
 * Exports a true transparent 32-bit RGBA PNG image sequence + WAV audio in a .zip archive.
 * 100% universal: Works natively in Premiere Pro, DaVinci Resolve, After Effects, CapCut, and Final Cut Pro.
 */
export async function exportPNGSequenceZip(options: PNGSequenceExportOptions): Promise<Blob> {
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
  const targetDuration = Math.min(duration, audioBuffer.duration)

  // 1. Precompute frame parameters using liquid acoustic ballistics
  const frames = precomputeFrames(
    audioBuffer,
    targetDuration,
    fps,
    sensitivity,
    smoothness,
    resetSpeed
  )

  // 2. Setup offscreen WebGL canvas with transparent alpha and preserveDrawingBuffer
  const canvas = document.createElement("canvas")
  canvas.width = dim
  canvas.height = dim

  const gl = canvas.getContext("webgl", {
    powerPreference: "high-performance",
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) throw new Error("WebGL not available for PNG Sequence export")

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

  const totalFrames = frames.length
  const zipFiles: Record<string, Uint8Array> = {}
  const startTime = performance.now()

  // Pre-allocate base64 decode helper
  const decodeBase64ToUint8 = (b64: string): Uint8Array => {
    const binary = atob(b64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let j = 0; j < len; j++) {
      bytes[j] = binary.charCodeAt(j)
    }
    return bytes
  }

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
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

    // Capture transparent PNG synchronously
    const dataUrl = canvas.toDataURL("image/png")
    const commaIdx = dataUrl.indexOf(",")
    const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
    const frameNum = String(i + 1).padStart(5, "0")
    zipFiles[`sequence/frame_${frameNum}.png`] = decodeBase64ToUint8(b64)

    if (i % 8 === 0 || i === totalFrames - 1) {
      const elapsed = (performance.now() - startTime) / 1000
      const currentFps = Math.round((i + 1) / Math.max(0.1, elapsed))
      onProgress?.({
        current: f.time,
        total: targetDuration,
        percent: Math.min(100, Math.round(((i + 1) / totalFrames) * 100)),
        fps: currentFps,
      })
      // Periodic yield to browser event loop
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // Add synchronized 16-bit PCM WAV audio
  try {
    const wavBuffer = audioBufferToWav(audioBuffer, targetDuration)
    zipFiles["audio.wav"] = new Uint8Array(wavBuffer)
  } catch (e) {
    console.warn("Could not encode audio.wav for PNG sequence:", e)
  }

  // Add helpful instructions readme
  const readmeText = `VOICE ANIMATION - TRANSPARENT PNG SEQUENCE (${fps} FPS)
======================================================
This archive contains a lossless 32-bit RGBA PNG image sequence with native alpha channel.

HOW TO IMPORT:
1. Adobe Premiere Pro:
   - File -> Import -> Select 'sequence/frame_00001.png'
   - Check the checkbox 'Image Sequence' at the bottom
   - Click Import -> Drag clip onto timeline above your video!
   - Import 'audio.wav' onto an audio track.

2. DaVinci Resolve:
   - Media Pool -> Import Media -> Select the 'sequence' folder
   - DaVinci automatically recognizes image sequences as a single transparent video clip!

3. After Effects:
   - File -> Import -> File -> Select 'frame_00001.png' -> Check 'PNG Sequence' -> Import.

4. CapCut / Mobile Editors:
   - Import individual PNGs or use our Apple ProRes 4444 (.mov) export format.
`
  zipFiles["README_IMPORT_INSTRUCTIONS.txt"] = new TextEncoder().encode(readmeText)

  // Clean up WebGL
  gl.deleteProgram(program)
  gl.deleteBuffer(buffer)

  // Create ZIP archive
  const zipped = zipSync(zipFiles, { level: 1 })
  return new Blob([zipped as any], { type: "application/zip" })
}
