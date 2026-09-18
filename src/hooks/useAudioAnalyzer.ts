/**
 * src/hooks/useAudioAnalyzer.ts
 *
 * Unified React audio analyzer hook powered by the new AudioEngine and DualPoleFollower.
 * Preserves 100% backward-compatibility with the existing hook interface
 * while replacing the legacy FFT bin-slicing with true 3-band biquad sidechain isolation.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { AudioEngine } from "@/audio/AudioEngine";
import type { UserDynamicsParams } from "@/audio/types";

export interface AudioFrequencyData {
  low: number; // 0 to 1 (Bass energy: < 280 Hz)
  mid: number; // 0 to 1 (Vocal formants: 280 Hz - 3200 Hz)
  high: number; // 0 to 1 (Treble / Sibilance: > 3200 Hz)
  amplitude: number; // 0 to 1 (Broadband RMS volume)
  rawFrequencies: number[]; // 16-bar preview bars for UI
}

export interface LiveAudioData {
  low: number;
  mid: number;
  high: number;
  amplitude: number;
  isActive: boolean;
}

export function useAudioAnalyzer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const [frequencyData, setFrequencyData] = useState<AudioFrequencyData>({
    low: 0,
    mid: 0,
    high: 0,
    amplitude: 0,
    rawFrequencies: new Array(16).fill(0),
  });

  // Synchronous zero-latency live audio data ref for direct shader access
  const liveAudioDataRef = useRef<LiveAudioData>({
    low: 0,
    mid: 0,
    high: 0,
    amplitude: 0,
    isActive: false,
  });

  const isPlayingRef = useRef(false);
  const isMicActiveRef = useRef(false);

  // AudioEngine instance
  const engineRef = useRef<AudioEngine | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const currentSourceRef = useRef<File | string | null>(null);

  // Initialize AudioEngine lazily on first user interaction
  const initEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine({ fftSize: 512 });
    }
    engineRef.current.resume();
    return engineRef.current;
  }, []);

  // Frame analysis loop using AudioEngine's 3-band biquad + dual-pole ballistics
  const startAnalyzing = useCallback(() => {
    if (animationFrameRef.current) return;

    const updateFrequencies = () => {
      if (!engineRef.current) return;

      const engine = engineRef.current;
      const { smoothed, previewBars } = engine.sampleFrame();

      const activeNow = isPlayingRef.current || isMicActiveRef.current;
      const effectiveActive = activeNow ? (smoothed.isActive || smoothed.amplitude > 0.01) : false;

      // Update synchronous zero-latency ref for WebGL rendering
      liveAudioDataRef.current = {
        low: smoothed.low,
        mid: smoothed.mid,
        high: smoothed.high,
        amplitude: smoothed.amplitude,
        isActive: effectiveActive,
      };

      // Update React state for UI readouts and preview bars
      setFrequencyData({
        low: smoothed.low,
        mid: smoothed.mid,
        high: smoothed.high,
        amplitude: smoothed.amplitude,
        rawFrequencies: Array.from(previewBars),
      });

      animationFrameRef.current = requestAnimationFrame(updateFrequencies);
    };

    animationFrameRef.current = requestAnimationFrame(updateFrequencies);
  }, []);

  const stopAnalyzing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (engineRef.current) {
      engineRef.current.reset();
    }
    liveAudioDataRef.current = {
      low: 0,
      mid: 0,
      high: 0,
      amplitude: 0,
      isActive: false,
    };
    setFrequencyData({
      low: 0,
      mid: 0,
      high: 0,
      amplitude: 0,
      rawFrequencies: new Array(16).fill(0),
    });
  }, []);

  // Load an audio file (File or URL string)
  const loadAudio = useCallback(
    (source: File | string, name?: string) => {
      const engine = initEngine();

      // Stop microphone if running
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        isMicActiveRef.current = false;
        setIsMicActive(false);
      }

      // Cleanup existing audio element
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
      }

      const audioUrl =
        typeof source === "string" ? source : URL.createObjectURL(source);
      const fileName =
        name ||
        (typeof source === "string"
          ? source.split("/").pop() || "Audio File"
          : source.name);

      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.volume = volume;

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        setCurrentTime(0);
      });

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener("ended", () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        stopAnalyzing();
      });

      try {
        engine.connectAudioElement(audio);
      } catch (err) {
        console.warn("Could not connect audio element to engine:", err);
      }

      audioElementRef.current = audio;
      setAudioName(fileName);
      setAudioSrc(audioUrl);
      isPlayingRef.current = false;
      setIsPlaying(false);

      currentSourceRef.current = source;
      audioBufferRef.current = null;

      // Pre-decode AudioBuffer for instant Turbo Offline Export
      (async () => {
        try {
          let arrayBuf: ArrayBuffer;
          if (source instanceof File) {
            arrayBuf = await source.arrayBuffer();
          } else {
            const res = await fetch(source);
            arrayBuf = await res.arrayBuffer();
          }
          const decoded = await engine.rawContext.decodeAudioData(
            arrayBuf.slice(0)
          );
          audioBufferRef.current = decoded;
        } catch (e) {
          console.warn("Could not pre-decode audio for offline export:", e);
        }
      })();
    },
    [initEngine, stopAnalyzing, volume]
  );

  // Play / Pause
  const play = useCallback(async () => {
    if (!audioElementRef.current) return;
    initEngine();
    await audioElementRef.current.play();
    isPlayingRef.current = true;
    setIsPlaying(true);
    startAnalyzing();
  }, [initEngine, startAnalyzing]);

  const pause = useCallback(() => {
    if (!audioElementRef.current) return;
    audioElementRef.current.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
    stopAnalyzing();
  }, [stopAnalyzing]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback((time: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((newVol: number) => {
    setVolume(newVol);
    if (audioElementRef.current) {
      audioElementRef.current.volume = newVol;
    }
    if (engineRef.current) {
      engineRef.current.setVolume(newVol);
    }
  }, []);

  // Live Microphone Stream
  const toggleMic = useCallback(async () => {
    const engine = initEngine();

    if (isMicActive) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
      isMicActiveRef.current = false;
      setIsMicActive(false);
      stopAnalyzing();
    } else {
      try {
        if (audioElementRef.current && isPlaying) {
          audioElementRef.current.pause();
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        micStreamRef.current = stream;
        engine.connectMediaStream(stream);
        isMicActiveRef.current = true;
        setIsMicActive(true);
        setAudioName("Live Microphone Input");
        startAnalyzing();
      } catch (err) {
        console.error("Microphone access denied or error:", err);
      }
    }
  }, [initEngine, isMicActive, isPlaying, startAnalyzing, stopAnalyzing]);

  // Update dynamic ballistics parameters
  const updateDynamics = useCallback((params: UserDynamicsParams) => {
    if (engineRef.current) {
      engineRef.current.updateDynamics(params);
    }
  }, []);

  // Get audio stream for recording with canvas stream during WebM export
  const getAudioStream = useCallback((): MediaStream | null => {
    return engineRef.current?.getMediaStream() ?? null;
  }, []);

  // Get audio element for duration, ended listener, and seek
  const getAudioElement = useCallback((): HTMLAudioElement | null => {
    return audioElementRef.current;
  }, []);

  // Get pre-decoded AudioBuffer (or decode on-demand) for Offline Export
  const getAudioBuffer = useCallback(async (): Promise<AudioBuffer | null> => {
    if (audioBufferRef.current) return audioBufferRef.current;
    if (!currentSourceRef.current) return null;
    try {
      const engine = initEngine();
      const src = currentSourceRef.current;
      let arrayBuf: ArrayBuffer;
      if (src instanceof File) {
        arrayBuf = await src.arrayBuffer();
      } else {
        const res = await fetch(src);
        arrayBuf = await res.arrayBuffer();
      }
      const decoded = await engine.rawContext.decodeAudioData(arrayBuf.slice(0));
      audioBufferRef.current = decoded;
      return decoded;
    } catch (err) {
      console.error("Failed to decode audio data for offline export:", err);
      return null;
    }
  }, [initEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  return {
    isPlaying,
    isMicActive,
    currentTime,
    duration,
    volume,
    audioName,
    audioSrc,
    frequencyData,
    liveAudioDataRef,
    getAudioStream,
    getAudioElement,
    getAudioBuffer,
    loadAudio,
    play,
    pause,
    togglePlay,
    seek,
    setVolume: handleVolumeChange,
    toggleMic,
    updateDynamics,
  };
}
