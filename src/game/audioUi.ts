/**
 * Menu sounds and the garage horns, synthesised on the shared voice pool: short, bright,
 * toy-like cues so every tap and reward feels physical.
 */
import type { VoicePool } from './audioVoices'

export type UiCue = 'click' | 'back' | 'buy' | 'reward' | 'star' | 'coin' | 'whoosh' | 'error' | 'unlock' | 'tick'

const semi = (base: number, n: number): number => base * Math.pow(2, n / 12)
const C5 = 523.25

export function playUi(v: VoicePool, cue: UiCue): void {
  switch (cue) {
    case 'click':
      v.tone(1320, 0.05, 'triangle', 0.08, { to: 1760 })
      return
    case 'back':
      v.tone(990, 0.07, 'triangle', 0.07, { to: 660 })
      return
    case 'tick':
      v.tone(2400, 0.025, 'sine', 0.04)
      return
    case 'coin':
      v.tone(semi(C5, 7) * 2, 0.06, 'square', 0.04)
      v.tone(semi(C5, 12) * 2, 0.12, 'square', 0.04, { at: 0.06 })
      return
    case 'buy':
      for (const [i, n] of [0, 4, 7, 12].entries()) v.tone(semi(C5, n), 0.14, 'square', 0.045, { at: i * 0.05 })
      v.noise('bandpass', 3000, 0.25, 0.05, { to: 8000, at: 0.05 })
      return
    case 'star':
      v.tone(semi(C5, 19), 0.3, 'triangle', 0.09, { to: semi(C5, 24) })
      v.tone(semi(C5, 24), 0.4, 'sine', 0.06, { at: 0.08 })
      return
    case 'reward':
    case 'unlock':
      for (const [i, n] of [0, 4, 7, 12, 16, 19].entries()) v.tone(semi(C5, n), 0.3, 'triangle', 0.07, { at: i * 0.07, detune: i % 2 ? 5 : -5 })
      v.noise('highpass', 5000, 0.6, 0.04, { at: 0.2 })
      return
    case 'whoosh':
      v.noise('bandpass', 400, 0.35, 0.09, { to: 3000, q: 1.4 })
      return
    case 'error':
      v.tone(220, 0.12, 'square', 0.06)
      v.tone(185, 0.18, 'square', 0.06, { at: 0.12 })
      return
    default:
      return
  }
}

/** The horn mods (meta/mods.ts `horn-*` ids); pitch is a playback-rate multiplier. */
export function playHorn(v: VoicePool, id: string, pitch = 1): void {
  const p = Math.max(0.5, Math.min(2, pitch))
  switch (id) {
    case 'horn-ordek':
      for (const at of [0, 0.22]) {
        v.tone(520 * p, 0.16, 'sawtooth', 0.07, { at, to: 380 * p })
        v.noise('bandpass', 900 * p, 0.16, 0.05, { at, q: 6 })
      }
      return
    case 'horn-kedi':
      v.tone(700 * p, 0.55, 'triangle', 0.09, { to: 1100 * p, attack: 0.08 })
      v.tone(1100 * p, 0.25, 'sine', 0.05, { at: 0.35, to: 600 * p })
      return
    case 'horn-tren':
      for (const at of [0, 0.18, 0.36]) v.noise('bandpass', 1200 * p, 0.14, 0.12, { at, q: 1.5 })
      v.tone(440 * p, 0.7, 'square', 0.04, { at: 0.5 })
      v.tone(554 * p, 0.7, 'square', 0.04, { at: 0.5 })
      return
    case 'horn-gemi':
      v.tone(110 * p, 1.2, 'sawtooth', 0.1, { attack: 0.15 })
      v.tone(165 * p, 1.2, 'sawtooth', 0.06, { attack: 0.15 })
      return
    case 'horn-robot':
      for (const [i, n] of [12, 7, 16, 4].entries()) v.tone(semi(440 * p, n), 0.08, 'square', 0.05, { at: i * 0.09 })
      return
    case 'horn-dino':
      v.tone(180 * p, 0.9, 'sawtooth', 0.11, { to: 70 * p, attack: 0.05 })
      v.noise('lowpass', 900 * p, 0.9, 0.12, { to: 200, attack: 0.05 })
      return
    case 'horn-klasik':
    default:
      for (const at of [0, 0.2]) {
        v.tone(392 * p, 0.15, 'square', 0.07, { at })
        v.tone(494 * p, 0.15, 'square', 0.05, { at })
      }
      return
  }
}
