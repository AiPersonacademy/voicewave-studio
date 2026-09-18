/**
 * src/data/sampleVoices.ts
 *
 * Curated Voice Profiles & Procedural Human Speech Synthesizer for VoiceWave Studio.
 * Enables 100% offline, zero-network speech audio generation for testing and fallback.
 */

import type { SampleVoice, AudioBufferLike } from "@/audio/types";

export type { SampleVoice };

export const SAMPLE_VOICE_PROFILES: SampleVoice[] = [
  {
    id: "cupertino-siri",
    name: "Cupertino Siri",
    category: "assistant",
    speaker: "Female Virtual Assistant",
    description:
      "Crisp, warm, high-presence vocal profile characteristic of iOS 18 Apple Intelligence.",
    transcript:
      "Good morning. All systems are operational and ready for your command.",
    duration: 4.8,
    primaryColor: "#a855f7", // Violet
    tags: ["iOS 18", "Apple", "Crisp", "Warm Presence"],
    formants: {
      f0: 215,
      f1: 620,
      f2: 1850,
      f3: 2800,
    },
    cadence: {
      syllableRateHz: 4.2,
      pauseRatio: 0.28,
    },
    audioUrl: "/sample-voice.wav",
  },
  {
    id: "neutral-ai",
    name: "Neutral AI Assistant",
    category: "ai",
    speaker: "Balanced Neutral Voice",
    description:
      "Even-tempered, balanced dynamic response modeled after modern conversational LLM interfaces.",
    transcript:
      "I can help you visualize sound waves and animate voice user interfaces in real time.",
    duration: 5.2,
    primaryColor: "#3b82f6", // Blue
    tags: ["ChatGPT", "Gemini", "Balanced", "Conversational"],
    formants: {
      f0: 165,
      f1: 520,
      f2: 1540,
      f3: 2550,
    },
    cadence: {
      syllableRateHz: 3.8,
      pauseRatio: 0.22,
    },
    audioUrl: "/sample-voice.wav",
  },
  {
    id: "podcast-host",
    name: "Podcast Host",
    category: "broadcast",
    speaker: "Deep Resonant Baritone",
    description:
      "Close-proximity broadcast vocal with enhanced bass resonance and punchy dynamic presence.",
    transcript:
      "Welcome back to the studio. Today we're exploring the intersection of spatial audio and fluid optics.",
    duration: 6.5,
    primaryColor: "#f97316", // Amber / Orange
    tags: ["Broadcast", "Proximity Effect", "Deep Baritone", "Punchy Lows"],
    formants: {
      f0: 108,
      f1: 380,
      f2: 1120,
      f3: 2250,
    },
    cadence: {
      syllableRateHz: 3.2,
      pauseRatio: 0.32,
    },
    audioUrl: "/sample-voice.wav",
  },
  {
    id: "calm-meditation",
    name: "Calm Meditation",
    category: "wellness",
    speaker: "Soft Breath Guide",
    description:
      "Soothing, gentle cadence with prolonged pauses, soft transients, and tranquil harmonic envelope.",
    transcript:
      "Take a deep breath in... hold for a moment... and gently exhale.",
    duration: 7.6,
    primaryColor: "#10b981", // Emerald
    tags: ["Mindfulness", "Slow Cadence", "Gentle", "High Dynamic Range"],
    formants: {
      f0: 178,
      f1: 440,
      f2: 1320,
      f3: 2380,
    },
    cadence: {
      syllableRateHz: 2.1,
      pauseRatio: 0.48,
    },
    audioUrl: "/sample-voice.wav",
  },
  {
    id: "fast-cadence",
    name: "Fast Cadence Speech",
    category: "keynote",
    speaker: "Rapid Articulate Keynote",
    description:
      "Energetic, rapid-fire keynote delivery with pronounced plosives and high sibilant articulation.",
    transcript:
      "Three, two, one, launch! Next-generation graphics running at sixty frames per second with zero latency.",
    duration: 4.2,
    primaryColor: "#ec4899", // Pink
    tags: ["Keynote", "High Energy", "Rapid Fire", "Plosive Dynamics"],
    formants: {
      f0: 195,
      f1: 580,
      f2: 1720,
      f3: 3100,
    },
    cadence: {
      syllableRateHz: 5.6,
      pauseRatio: 0.15,
    },
    audioUrl: "/sample-voice.wav",
  },
];

export function getSampleVoice(id: string): SampleVoice {
  return (
    SAMPLE_VOICE_PROFILES.find((p) => p.id === id) || SAMPLE_VOICE_PROFILES[0]
  );
}

export function getAllSampleVoices(): SampleVoice[] {
  return SAMPLE_VOICE_PROFILES;
}

/**
 * Procedural Human Speech Synthesizer
 * Generates sample-accurate synthetic speech waveforms in-memory
 * without external audio assets or network requests.
 */
export class SyntheticVoiceGenerator {
  /**
   * Synthesizes an AudioBufferLike containing a full procedural voice simulation
   */
  public static generate(
    profileId: string,
    sampleRate = 48000
  ): AudioBufferLike {
    const profile = getSampleVoice(profileId);
    const duration = profile.duration;
    const totalSamples = Math.round(duration * sampleRate);
    const pcm = new Float32Array(totalSamples);

    const { f0, f1, f2, f3 } = profile.formants;
    const { syllableRateHz, pauseRatio } = profile.cadence;

    // Resonator bandwidths (Hz)
    const bw1 = 80;
    const bw2 = 110;
    const bw3 = 140;

    // Precalculate 2-pole IIR resonator coefficients
    const calcCoeffs = (freq: number, bw: number) => {
      const r = Math.exp((-Math.PI * bw) / sampleRate);
      const theta = (2 * Math.PI * freq) / sampleRate;
      return {
        b0: 1 - r,
        a1: -2 * r * Math.cos(theta),
        a2: r * r,
      };
    };

    const c1 = calcCoeffs(f1, bw1);
    const c2 = calcCoeffs(f2, bw2);
    const c3 = calcCoeffs(f3, bw3);

    let r1_y1 = 0, r1_y2 = 0;
    let r2_y1 = 0, r2_y2 = 0;
    let r3_y1 = 0, r3_y2 = 0;

    // Glottal excitation state
    let glottalPhase = 0;
    let noiseState = 0x12345678; // Deterministic pseudo-random seed

    const nextNoise = (): number => {
      noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
      return noiseState * (2.0 / 0xffffffff) - 1.0;
    };

    const fastTanh = (x: number): number => {
      if (x < -3) return -1;
      if (x > 3) return 1;
      const x2 = x * x;
      return (x * (27 + x2)) / (27 + 9 * x2);
    };

    // Precompute raised-cosine LUT for syllable envelope
    const cosLut = new Float32Array(256);
    for (let k = 0; k < 256; k++) {
      cosLut[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / 256);
    }

    const syllablePeriod = sampleRate / syllableRateHz;
    let phraseEnv = 0.0;
    let pitchMod = 1.0;

    for (let i = 0; i < totalSamples; i++) {
      // Update slow macro modulations once every 32 samples
      if ((i & 31) === 0) {
        const t = i / sampleRate;
        phraseEnv = Math.sin((Math.PI * t) / duration);
        pitchMod =
          1.0 +
          0.08 * Math.sin(2 * Math.PI * 1.8 * t) +
          0.03 * Math.sin(2 * Math.PI * 4.5 * t);
      }

      const syllablePhase = (i % syllablePeriod) / syllablePeriod;
      const t = i / sampleRate;

      // Pause gating
      if (syllablePhase < pauseRatio || t < 0.15 || t > duration - 0.25) {
        pcm[i] = nextNoise() * 0.0005;
        continue;
      }

      // Syllable micro-envelope via LUT
      const activePhase = (syllablePhase - pauseRatio) / (1.0 - pauseRatio);
      const lutIdx = (activePhase * 255) | 0;
      const syllableEnv = cosLut[lutIdx & 255];
      const instantF0 = f0 * pitchMod;

      glottalPhase += instantF0 / sampleRate;
      if (glottalPhase >= 1.0) glottalPhase -= 1.0;

      let glottalSource = 0;
      if (glottalPhase < 0.6) {
        const tn = glottalPhase / 0.6;
        glottalSource = 3 * tn * tn - 2 * tn * tn * tn;
      }
      glottalSource += nextNoise() * 0.08;

      // Inlined 2-pole resonators
      const y1 = c1.b0 * glottalSource - c1.a1 * r1_y1 - c1.a2 * r1_y2;
      r1_y2 = r1_y1;
      r1_y1 = y1;

      const y2 = c2.b0 * glottalSource - c2.a1 * r2_y1 - c2.a2 * r2_y2;
      r2_y2 = r2_y1;
      r2_y1 = y2;

      const y3 = c3.b0 * glottalSource - c3.a1 * r3_y1 - c3.a2 * r3_y2;
      r3_y2 = r3_y1;
      r3_y1 = y3;

      const vocalSignal = y1 * 1.0 + y2 * 0.65 + y3 * 0.35;

      let sibilance = 0;
      if (syllablePhase > 0.82 || syllablePhase < pauseRatio + 0.1) {
        sibilance = nextNoise() * 0.32;
      }

      const rawSample =
        (vocalSignal * 0.8 + sibilance) * syllableEnv * phraseEnv * 0.75;
      pcm[i] = fastTanh(rawSample * 1.4);
    }

    return {
      numberOfChannels: 1,
      sampleRate,
      length: totalSamples,
      duration,
      getChannelData: (c: number) => {
        if (c !== 0) throw new Error("Synthetic speech is mono");
        return pcm;
      },
    };
  }
}
