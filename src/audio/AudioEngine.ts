// RAIJIN Web Audio API High-Performance Engine
import { DrumType } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sampleBuffers: Map<DrumType, AudioBuffer> = new Map();
  private isInitialized = false;
  private isMuted = false;
  private masterVolume = 0.85;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    this.ctx = new AudioContextClass({
      latencyHint: 'interactive'
    });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Pre-synthesize and decode high-fidelity acoustic drum samples into AudioBuffers
    await this.preloadAllDrumBuffers();

    this.isInitialized = true;
  }

  public async resume(): Promise<void> {
    if (!this.ctx) {
      await this.initialize();
    } else if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  public getBaseLatency(): number {
    if (!this.ctx) return 0;
    // reported in seconds, convert to ms
    const base = (this.ctx as unknown as { baseLatency?: number }).baseLatency || 0.005;
    return Math.round(base * 1000 * 10) / 10;
  }

  public getOutputLatency(): number {
    if (!this.ctx) return 0;
    const output = (this.ctx as unknown as { outputLatency?: number }).outputLatency || 0.01;
    return Math.round(output * 1000 * 10) / 10;
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  /**
   * Triggers a drum sample with normalized velocity (0..1)
   */
  public trigger(drumId: DrumType, velocity = 0.8): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const buffer = this.sampleBuffers.get(drumId);
    if (!buffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();

    // Musical velocity curve: exponential curve feels natural
    // Clamping velocity between 0.15 (ghost note) and 1.0 (accent)
    const clampedVelocity = Math.max(0.15, Math.min(1.0, velocity));
    const musicalGain = Math.pow(clampedVelocity, 1.4);

    gainNode.gain.setValueAtTime(musicalGain, now);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(now);
  }

  /**
   * Preloads or generates studio-grade acoustic drum samples into AudioBuffers.
   */
  private async preloadAllDrumBuffers(): Promise<void> {
    if (!this.ctx) return;

    const drumTypes: DrumType[] = [
      'snare',
      'kick',
      'hihat_closed',
      'hihat_open',
      'crash',
      'ride',
      'tom_high',
      'tom_low'
    ];

    for (const drum of drumTypes) {
      // Synthesize broadcast-quality acoustic drum AudioBuffer
      const buffer = this.synthesizeAcousticSample(drum, this.ctx);
      this.sampleBuffers.set(drum, buffer);
    }
  }

  /**
   * Studio acoustic physical modeling synthesis for drums.
   * Generates pure 44.1kHz/48kHz AudioBuffers with zero external network dependencies.
   */
  private synthesizeAcousticSample(type: DrumType, ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;

    switch (type) {
      case 'snare': {
        // Snare: 0.28s length, punchy transient tone (190Hz -> 105Hz) + snappy wire noise (1.5kHz-7kHz)
        const duration = 0.28;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          // Body tone: rapid pitch drop
          const freq = 190 * Math.exp(-t * 22) + 110;
          const body = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 18) * 0.7;

          // Wire noise: shaped white noise with high-frequency emphasis
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.75;
          const snap = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.4;

          const sample = (body + noise + snap) * 0.85;
          left[i] = sample;
          right[i] = sample * (1 + (Math.random() - 0.5) * 0.1); // subtle stereo air
        }
        return buffer;
      }

      case 'kick': {
        // Kick: 0.35s deep acoustic bass drum, 140Hz punch dropping to 48Hz sub
        const duration = 0.35;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const pitch = 140 * Math.exp(-t * 30) + 48;
          const phase = 2 * Math.PI * pitch * t;
          const body = Math.sin(phase) * Math.exp(-t * 8.5);
          // Subtle beater click transient
          const click = (Math.random() * 2 - 1) * Math.exp(-t * 180) * 0.35;

          const sample = (body * 0.95 + click) * 0.95;
          left[i] = sample;
          right[i] = sample;
        }
        return buffer;
      }

      case 'hihat_closed': {
        // Closed Hi-Hat: 0.055s crisp metallic sizzle
        const duration = 0.055;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          // Inharmonic metallic ring
          const metal =
            (Math.sin(2 * Math.PI * 3400 * t) +
              Math.sin(2 * Math.PI * 5200 * t) +
              Math.sin(2 * Math.PI * 7800 * t)) *
            0.2;
          const noise = (Math.random() * 2 - 1) * 0.8;
          const env = Math.exp(-t * 70);

          const sample = (metal + noise) * env * 0.7;
          left[i] = sample;
          right[i] = sample * (0.9 + Math.random() * 0.2);
        }
        return buffer;
      }

      case 'hihat_open': {
        // Open Hi-Hat: 0.45s sustained metallic wash
        const duration = 0.45;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const metal =
            (Math.sin(2 * Math.PI * 3100 * t) +
              Math.sin(2 * Math.PI * 4700 * t) +
              Math.sin(2 * Math.PI * 6900 * t) +
              Math.sin(2 * Math.PI * 8400 * t)) *
            0.2;
          const noise = (Math.random() * 2 - 1) * 0.8;
          const env = Math.exp(-t * 7);

          const sample = (metal + noise) * env * 0.65;
          left[i] = sample;
          right[i] = sample * (0.85 + Math.random() * 0.3);
        }
        return buffer;
      }

      case 'crash': {
        // Crash Cymbal: 1.25s big acoustic explosion and shimmer decay
        const duration = 1.25;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const metal =
            (Math.sin(2 * Math.PI * 680 * t) * 0.3 +
              Math.sin(2 * Math.PI * 1420 * t) * 0.25 +
              Math.sin(2 * Math.PI * 2940 * t) * 0.2 +
              Math.sin(2 * Math.PI * 4920 * t) * 0.2 +
              Math.sin(2 * Math.PI * 7300 * t) * 0.15) *
            Math.exp(-t * 3.5);
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * 0.8;
          const impact = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.5;

          left[i] = (metal + noise + impact) * 0.7;
          right[i] = (metal * 0.9 + (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * 0.8 + impact) * 0.7;
        }
        return buffer;
      }

      case 'ride': {
        // Ride Cymbal: 0.8s ping bell resonance with delicate wash
        const duration = 0.8;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          // Pure metallic ping at 680Hz + 2150Hz harmonic
          const ping =
            (Math.sin(2 * Math.PI * 680 * t) * 0.6 +
              Math.sin(2 * Math.PI * 2150 * t) * 0.35 +
              Math.sin(2 * Math.PI * 4320 * t) * 0.2) *
            Math.exp(-t * 4.8);
          const wash = (Math.random() * 2 - 1) * Math.exp(-t * 5.2) * 0.3;

          const sample = (ping + wash) * 0.75;
          left[i] = sample;
          right[i] = sample;
        }
        return buffer;
      }

      case 'tom_high': {
        // High Tom: 0.32s melodic drum resonant drop 175Hz -> 115Hz
        const duration = 0.32;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const pitch = 175 * Math.exp(-t * 12) + 115;
          const body = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 9.5);
          const strike = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.25;

          const sample = (body * 0.85 + strike) * 0.85;
          left[i] = sample;
          right[i] = sample;
        }
        return buffer;
      }

      case 'tom_low': {
        // Low Tom (Floor): 0.42s resonant floor tom drop 115Hz -> 72Hz
        const duration = 0.42;
        const length = Math.floor(sampleRate * duration);
        const buffer = ctx.createBuffer(2, length, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const pitch = 115 * Math.exp(-t * 9) + 72;
          const body = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 7);
          const strike = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.25;

          const sample = (body * 0.9 + strike) * 0.85;
          left[i] = sample;
          right[i] = sample;
        }
        return buffer;
      }
    }
  }

  public dispose(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
      this.isInitialized = false;
    }
  }
}

// Global audio singleton for zero re-allocation
export const audioEngine = new AudioEngine();
