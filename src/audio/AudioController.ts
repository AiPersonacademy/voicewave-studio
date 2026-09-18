/**
 * src/audio/AudioController.ts
 *
 * High-performance audio controller singleton bridging the Web Audio graph (AudioEngine),
 * procedural speech synthesis (sampleVoices), audio file decoding, and live microphone capture.
 */

import { AudioEngine } from "./AudioEngine";
import { SyntheticVoiceGenerator, getSampleVoice } from "@/data/sampleVoices";
import { audioBufferToWav } from "@/utils/wavHelper";
import type { CalibratedBandEnergy } from "./types";

export interface LiveAudioData {
  low: number;
  mid: number;
  high: number;
  amplitude: number;
  isActive: boolean;
}

export interface AudioControllerCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onMicStateChange?: (isMicActive: boolean, error?: string) => void;
  onFrequencyBarsUpdate?: (bars: number[]) => void;
  onBandEnergyUpdate?: (energy: { low: number; mid: number; high: number; amplitude: number }) => void;
}

export class AudioController {
  private static instance: AudioController | null = null;

  public readonly liveAudioDataRef: { current: LiveAudioData } = {
    current: { low: 0, mid: 0, high: 0, amplitude: 0, isActive: false },
  };

  private engine: AudioEngine | null = null;
  private audio: HTMLAudioElement | null = null;
  private micStream: MediaStream | null = null;
  private currentObjectUrl: string | null = null;
  private predecodedBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private isMicActive = false;
  private isLooping = false;
  private volume = 1.0;

  private callbacks: AudioControllerCallbacks | null = null;
  private rafId: number | null = null;

  private constructor() {}

  public static getInstance(): AudioController {
    if (!AudioController.instance) {
      AudioController.instance = new AudioController();
    }
    return AudioController.instance;
  }

  public setCallbacks(callbacks: AudioControllerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getAudioEngine(): AudioEngine | null {
    if (typeof window === "undefined" && typeof (globalThis as any).window === "undefined") {
      return null;
    }
    if (!this.engine) {
      try {
        this.engine = new AudioEngine({ fftSize: 512 });
      } catch {
        return null;
      }
    }
    return this.engine;
  }

  public async resume(): Promise<void> {
    const engine = this.getAudioEngine();
    if (engine) {
      await engine.resume();
    }
  }

  /**
   * Loads a procedural synthetic voice, produces WAV blob URL, and binds to audio graph.
   */
  public async loadSyntheticVoice(voiceId: string): Promise<{
    url: string;
    duration: number;
    buffer: AudioBuffer;
    name: string;
  }> {
    const engine = this.getAudioEngine();
    if (!engine) {
      throw new Error("AudioEngine is not available in this environment");
    }
    await engine.resume();

    this.teardownCurrentAudio();

    const profile = getSampleVoice(voiceId);
    const synthBuf = SyntheticVoiceGenerator.generate(profile.id, engine.sampleRate);

    // Create native AudioBuffer
    const audioBuffer = engine.rawContext.createBuffer(
      1,
      synthBuf.length,
      synthBuf.sampleRate
    );
    const channelData = synthBuf.getChannelData(0);
    audioBuffer.copyToChannel(new Float32Array(channelData as unknown as ArrayLike<number>), 0);
    this.predecodedBuffer = audioBuffer;

    // Convert to WAV ArrayBuffer & create blob URL
    const wavArrayBuf = audioBufferToWav(audioBuffer);
    const blob = new Blob([wavArrayBuf], { type: "audio/wav" });
    const blobUrl = URL.createObjectURL(blob);
    this.currentObjectUrl = blobUrl;

    this.createAudioElement(blobUrl);

    return {
      url: blobUrl,
      duration: audioBuffer.duration,
      buffer: audioBuffer,
      name: profile.name,
    };
  }

  /**
   * Loads a user uploaded audio file (WAV, MP3, M4A, OGG), decodes into AudioBuffer and connects.
   */
  public async loadAudioFile(file: File): Promise<{
    url: string;
    duration: number;
    buffer: AudioBuffer;
    name: string;
  }> {
    const engine = this.getAudioEngine();
    if (!engine) {
      throw new Error("AudioEngine is not available in this environment");
    }
    await engine.resume();

    this.teardownCurrentAudio();

    const objectUrl = URL.createObjectURL(file);
    this.currentObjectUrl = objectUrl;

    // Decode AudioBuffer for offline export & precise duration
    const arrayBuf = await file.arrayBuffer();
    const audioBuffer = await engine.rawContext.decodeAudioData(arrayBuf.slice(0));
    this.predecodedBuffer = audioBuffer;

    this.createAudioElement(objectUrl);

    return {
      url: objectUrl,
      duration: audioBuffer.duration,
      buffer: audioBuffer,
      name: file.name,
    };
  }

  /**
   * Toggles live microphone input with acoustic feedback protection.
   */
  public async toggleMicrophone(): Promise<{ isMicActive: boolean; error?: string }> {
    const engine = this.getAudioEngine();
    if (engine) {
      await engine.resume();
    }

    if (this.isMicActive) {
      this.stopMicrophone();
      return { isMicActive: false };
    }

    // Pause media element playback to avoid collision
    this.pause();

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia is not supported in this environment");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      if (engine) {
        engine.connectMediaStream(stream);
      }
      this.isMicActive = true;
      this.callbacks?.onMicStateChange?.(true);
      this.startAnalysisLoop();

      return { isMicActive: true };
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      const errMsg =
        e?.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow microphone permissions in browser settings."
          : `Microphone error: ${e?.message || "Unknown error"}`;
      this.callbacks?.onMicStateChange?.(false, errMsg);
      return { isMicActive: false, error: errMsg };
    }
  }

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.isMicActive = false;
    this.callbacks?.onMicStateChange?.(false);
    if (!this.isPlaying) {
      this.stopAnalysisLoop();
    }
  }

  public async play(): Promise<void> {
    if (!this.audio) return;
    await this.resume();

    if (this.isMicActive) {
      this.stopMicrophone();
    }

    await this.audio.play();
    this.isPlaying = true;
    this.callbacks?.onPlaybackStateChange?.(true);
    this.startAnalysisLoop();
  }

  public pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.isPlaying = false;
    this.callbacks?.onPlaybackStateChange?.(false);
    if (!this.isMicActive) {
      this.stopAnalysisLoop();
    }
  }

  public async togglePlay(): Promise<void> {
    if (this.isPlaying) {
      this.pause();
    } else {
      await this.play();
    }
  }

  public seek(seconds: number): void {
    if (this.audio && Number.isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
      this.callbacks?.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
    }
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    if (this.engine) {
      this.engine.setVolume(this.volume);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setLooping(loop: boolean): void {
    this.isLooping = loop;
    if (this.audio) {
      this.audio.loop = loop;
    }
  }

  public getIsLooping(): boolean {
    return this.isLooping;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsMicActive(): boolean {
    return this.isMicActive;
  }

  public sampleFrame(forcedDt?: number): {
    rawEnergy: CalibratedBandEnergy;
    raw: CalibratedBandEnergy;
    smoothed: CalibratedBandEnergy;
    previewBars: Float32Array;
  } {
    const engine = this.getAudioEngine();
    if (!engine) {
      const zero = { low: 0, mid: 0, high: 0, amplitude: 0, isActive: false };
      return { rawEnergy: zero, raw: zero, smoothed: zero, previewBars: new Float32Array(16) };
    }
    const frame = engine.sampleFrame(forcedDt);
    const activeNow = this.isPlaying || this.isMicActive;
    const effectiveActive = activeNow ? (frame.smoothed.isActive || frame.smoothed.amplitude > 0.01) : false;
    this.liveAudioDataRef.current = {
      low: frame.smoothed.low,
      mid: frame.smoothed.mid,
      high: frame.smoothed.high,
      amplitude: frame.smoothed.amplitude,
      isActive: effectiveActive,
    };
    return {
      rawEnergy: frame.rawEnergy,
      raw: frame.rawEnergy,
      smoothed: frame.smoothed,
      previewBars: frame.previewBars,
    };
  }

  public getAudioBuffer(): AudioBuffer | null {
    return this.predecodedBuffer;
  }

  public getAudioStream(): MediaStream | null {
    return this.getMediaStream();
  }

  public getAudioContext(): AudioContext | null {
    return this.engine ? this.engine.rawContext : null;
  }

  public getMediaStream(): MediaStream | null {
    return this.engine ? this.engine.getMediaStream() : null;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.audio;
  }

  private createAudioElement(url: string): void {
    if (typeof Audio === "undefined") return;

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.volume = this.volume;
    audio.loop = this.isLooping;

    audio.addEventListener("loadedmetadata", () => {
      this.callbacks?.onTimeUpdate?.(0, audio.duration || 0);
    });

    audio.addEventListener("timeupdate", () => {
      this.callbacks?.onTimeUpdate?.(audio.currentTime, audio.duration || 0);
    });

    audio.addEventListener("ended", () => {
      if (!this.isLooping) {
        this.isPlaying = false;
        this.callbacks?.onPlaybackStateChange?.(false);
        if (!this.isMicActive) {
          this.stopAnalysisLoop();
        }
      }
    });

    const engine = this.getAudioEngine();
    if (engine) {
      engine.connectAudioElement(audio);
    }
    this.audio = audio;
  }

  private teardownCurrentAudio(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.isPlaying = false;
    this.callbacks?.onPlaybackStateChange?.(false);
  }

  private startAnalysisLoop(): void {
    if (this.rafId !== null || typeof requestAnimationFrame === "undefined") return;

    let lastBarUpdate = 0;
    const loop = () => {
      if (!this.isPlaying && !this.isMicActive) {
        this.rafId = null;
        return;
      }

      if (this.engine) {
        const frame = this.engine.sampleFrame();
        const activeNow = this.isPlaying || this.isMicActive;
        const effectiveActive = activeNow ? (frame.smoothed.isActive || frame.smoothed.amplitude > 0.01) : false;

        // Synchronous zero-latency update on each animation frame
        this.liveAudioDataRef.current = {
          low: frame.smoothed.low,
          mid: frame.smoothed.mid,
          high: frame.smoothed.high,
          amplitude: frame.smoothed.amplitude,
          isActive: effectiveActive,
        };

        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        // Throttle UI preview bar and band energy updates to ~30 FPS
        if (now - lastBarUpdate > 33) {
          this.callbacks?.onFrequencyBarsUpdate?.(Array.from(frame.previewBars));
          this.callbacks?.onBandEnergyUpdate?.({
            low: frame.smoothed.low,
            mid: frame.smoothed.mid,
            high: frame.smoothed.high,
            amplitude: frame.smoothed.amplitude,
          });
          lastBarUpdate = now;
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private stopAnalysisLoop(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.engine) {
      this.engine.reset();
    }
    this.liveAudioDataRef.current = {
      low: 0,
      mid: 0,
      high: 0,
      amplitude: 0,
      isActive: false,
    };
    this.callbacks?.onFrequencyBarsUpdate?.(new Array(16).fill(0));
    this.callbacks?.onBandEnergyUpdate?.({ low: 0, mid: 0, high: 0, amplitude: 0 });
  }

  public destroy(): void {
    this.stopAnalysisLoop();
    this.stopMicrophone();
    this.teardownCurrentAudio();
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    AudioController.instance = null;
  }
}

export const audioController = AudioController.getInstance();
