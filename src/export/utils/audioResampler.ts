/**
 * src/export/utils/audioResampler.ts
 *
 * Hardware-accelerated and software-fallback Audio Resampler & 16-bit PCM WAV Encoder.
 * Conforms to PROJECT.md §Multi-Engine Export Pipeline.
 */

import type { AudioBufferLike } from "@/audio/types";

/**
 * Resamples an AudioBuffer or AudioBufferLike to targetSampleRate (e.g. 48000 for Opus, 44100 for WAV)
 * using OfflineAudioContext Sinc bandlimited interpolation with a deterministic
 * software fallback for headless test environments.
 */
export async function resampleAudioBuffer(
  source: AudioBuffer | AudioBufferLike,
  targetSampleRate: number,
  targetDuration?: number
): Promise<AudioBuffer | AudioBufferLike> {
  const duration = targetDuration ? Math.min(targetDuration, source.duration) : source.duration;

  if (source.sampleRate === targetSampleRate && (!targetDuration || targetDuration >= source.duration)) {
    return source;
  }

  const OfflineCtxClass =
    typeof OfflineAudioContext !== "undefined"
      ? OfflineAudioContext
      : (globalThis as any).webkitOfflineAudioContext;

  const targetLength = Math.max(1, Math.ceil(duration * targetSampleRate));
  const numChannels = Math.min(2, Math.max(1, source.numberOfChannels));
  const isRealAudioBuffer =
    typeof AudioBuffer !== "undefined" && source instanceof AudioBuffer;

  if (OfflineCtxClass && isRealAudioBuffer) {
    try {
      const offlineCtx = new OfflineCtxClass(numChannels, targetLength, targetSampleRate);
      const srcNode = offlineCtx.createBufferSource();
      srcNode.buffer = source;
      srcNode.connect(offlineCtx.destination);
      srcNode.start(0);
      return await offlineCtx.startRendering();
    } catch {
      // Fall through to software resampler if offline rendering encounters issues
    }
  }

  // Software resampling fallback (Bandlimited Linear Interpolation)
  const channelData: Float32Array[] = [];
  const ratio = source.sampleRate / targetSampleRate;

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = source.getChannelData(ch);
    const outData = new Float32Array(targetLength);

    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio;
      const indexFloor = Math.floor(srcIndex);
      const indexCeil = Math.min(srcData.length - 1, indexFloor + 1);
      const fraction = srcIndex - indexFloor;

      const s0 = srcData[indexFloor] ?? 0;
      const s1 = srcData[indexCeil] ?? 0;
      outData[i] = s0 + fraction * (s1 - s0);
    }
    channelData.push(outData);
  }

  if (typeof AudioBuffer !== "undefined") {
    try {
      const resampled = new AudioBuffer({
        length: targetLength,
        numberOfChannels: numChannels,
        sampleRate: targetSampleRate,
      });
      for (let ch = 0; ch < numChannels; ch++) {
        resampled.getChannelData(ch).set(channelData[ch]);
      }
      return resampled;
    } catch {
      // Fall through to AudioBufferLike
    }
  }

  // Fallback AudioBufferLike object
  return {
    length: targetLength,
    numberOfChannels: numChannels,
    sampleRate: targetSampleRate,
    duration: targetLength / targetSampleRate,
    getChannelData: (ch: number) => channelData[ch] || new Float32Array(targetLength),
    copyFromChannel: (dest: Float32Array, ch: number) => dest.set(channelData[ch]),
    copyToChannel: (src: Float32Array, ch: number) => channelData[ch].set(src),
  };
}

/**
 * Encodes an AudioBuffer or AudioBufferLike to a standard 16-bit PCM uncompressed RIFF WAV byte array (Uint8Array).
 */
export function audioBufferToWav(buffer: AudioBuffer | AudioBufferLike, targetDuration?: number): Uint8Array {
  const numChannels = Math.max(1, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const maxSamples = targetDuration
    ? Math.min(buffer.length, Math.round(targetDuration * sampleRate))
    : buffer.length;

  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = maxSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(v: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // 1. RIFF Chunk Header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // 2. fmt Sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, format, true); // AudioFormat 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // 3. data Sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // 4. PCM Interleaved Sample Data
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < maxSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] ?? 0));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
}

/**
 * Resamples an AudioBuffer or AudioBufferLike to targetRate and encodes as a 16-bit PCM WAV byte array.
 */
export async function resampleAudioToWav(
  source: AudioBuffer | AudioBufferLike,
  targetRate = 44100,
  duration?: number
): Promise<Uint8Array> {
  const resampled = await resampleAudioBuffer(source, targetRate, duration);
  return audioBufferToWav(resampled, duration);
}
