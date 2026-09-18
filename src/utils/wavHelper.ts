/**
 * Converts an AudioBuffer to a standard 16-bit PCM WAV file ArrayBuffer.
 * Works synchronously in any browser without external dependencies.
 */
export function audioBufferToWav(buffer: AudioBuffer, targetDuration?: number): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const maxSamples = targetDuration
    ? Math.min(buffer.length, Math.round(targetDuration * sampleRate))
    : buffer.length

  const format = 1 // PCM
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = maxSamples * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  // RIFF identifier
  writeString(view, 0, "RIFF")
  // RIFF chunk length
  view.setUint32(4, 36 + dataSize, true)
  // RIFF type
  writeString(view, 8, "WAVE")

  // format chunk identifier
  writeString(view, 12, "fmt ")
  // format chunk length
  view.setUint32(16, 16, true)
  // sample format (raw PCM)
  view.setUint16(20, format, true)
  // channel count
  view.setUint16(22, numChannels, true)
  // sample rate
  view.setUint32(24, sampleRate, true)
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * blockAlign, true)
  // block align (numChannels * bytesPerSample)
  view.setUint16(32, blockAlign, true)
  // bits per sample
  view.setUint16(34, bitDepth, true)

  // data chunk identifier
  writeString(view, 36, "data")
  // data chunk length
  view.setUint32(40, dataSize, true)

  // Interleave channels & write 16-bit PCM
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  let offset = 44
  for (let i = 0; i < maxSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return arrayBuffer
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
