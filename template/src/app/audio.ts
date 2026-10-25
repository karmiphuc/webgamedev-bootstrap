// Opt-in sound. Browsers only allow audio after a user gesture, and players
// on phones expect silence by default. Effects follow gameplay events and
// the number of simultaneous voices is capped.
// Replace the synth blips with licensed samples when you have them
// (record them in public/assets/provenance.json).

import type { StepEvent } from "../sim/sim";

const MAX_VOICES = 6;

export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private voices = 0;

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled && !this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.enabled = false;
      }
    }
    void this.ctx?.resume();
    return this.enabled;
  }

  play(events: readonly StepEvent[]): void {
    if (!this.enabled || !this.ctx) return;
    for (const ev of events) {
      if (ev.type === "hit") this.blip(ev.from === 1 ? 520 : 180, 0.05);
      else if (ev.type === "death") this.blip(90, 0.12);
    }
  }

  private blip(freq: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || this.voices >= MAX_VOICES) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    this.voices++;
    osc.onended = () => {
      this.voices--;
      osc.disconnect();
      gain.disconnect();
    };
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
