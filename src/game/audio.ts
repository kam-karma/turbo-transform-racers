/**
 * Race sound, synthesised with WebAudio (no files): the engine layer plus one-shot effects
 * for every racer event, countdown and finish. Every method is safe before start() (it does
 * nothing), and all nodes are built once in start() and reused.
 */
import type { RacerEvent, RacerState } from '../sim/racer'
import { EngineSound } from './audioEngine'
import { Music, type SongId } from './audioMusic'
import { playHorn, playUi, type UiCue } from './audioUi'
import { VoicePool, makeNoise } from './audioVoices'

const MASTER = 0.5
/** Equal-tempered semitone steps from a base frequency. */
const semi = (base: number, n: number): number => base * Math.pow(2, n / 12)
const C5 = 523.25

export class RaceAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voices: VoicePool | null = null
  private engine: EngineSound | null = null
  private music: Music | null = null
  private song: SongId | null = null
  private muted = false
  private suspended = false
  private coinStreak = 0
  private lastCoin = -10

  /** Call from a user gesture (browsers keep audio locked until then). */
  start(): void {
    if (this.ctx !== null) {
      if (!this.suspended && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined)
      return
    }
    if (typeof AudioContext === 'undefined') return
    try {
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : MASTER
      // Gentle limiter: a pile-up of bursts (landing + splash + coins) must never clip.
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -10
      limiter.knee.value = 8
      limiter.ratio.value = 6
      limiter.attack.value = 0.003
      limiter.release.value = 0.2
      master.connect(limiter).connect(ctx.destination)
      const noise = makeNoise(ctx)
      // Effects sit above the always-on engine so every action clearly "pops".
      const fxBus = ctx.createGain()
      fxBus.gain.value = 1.5
      fxBus.connect(master)
      this.voices = new VoicePool(ctx, fxBus, noise)
      this.engine = new EngineSound(ctx, master, noise)
      this.music = new Music(ctx, master, noise)
      this.music.play(this.song)
      this.ctx = ctx
      this.master = master
      if (this.suspended) void ctx.suspend().catch(() => undefined)
      else if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    } catch (error) {
      console.error('Race audio could not start:', error)
      this.ctx = null
      this.master = null
      this.voices = null
      this.engine = null
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.ctx !== null && this.master !== null) this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.05)
  }

  /** Ads / hidden tab: the whole graph stops (time freezes) and picks up where it left off. */
  suspend(on: boolean): void {
    this.suspended = on
    if (this.ctx === null) return
    void (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined)
  }

  /** Background music: a song id, or null for silence. Remembered until audio can start. */
  playMusic(song: SongId | null): void {
    this.song = song
    this.music?.play(song)
  }

  /** Menus: the engine and its wind/water layers fall silent. */
  idle(): void {
    this.engine?.silence()
  }

  ui(cue: UiCue): void {
    const v = this.live()
    if (v !== null) playUi(v, cue)
  }

  horn(id: string, pitch = 1): void {
    const v = this.live()
    if (v !== null) playHorn(v, id, pitch)
  }

  update(st: RacerState, throttle: number): void {
    if (this.engine === null || this.ctx === null || this.ctx.state !== 'running') return
    this.engine.update(st, throttle)
  }

  /** The voice pool when sound can play now; null before start or while suspended. */
  private live(): VoicePool | null {
    return this.ctx !== null && this.ctx.state === 'running' ? this.voices : null
  }

  countdown(n: number): void {
    const v = this.live()
    if (v === null) return
    if (n > 0) {
      v.tone(587, 0.18, 'square', 0.07)
      v.tone(587, 0.22, 'triangle', 0.14)
      return
    }
    // GO: a bright major chord with a whoosh under it.
    for (const [i, f] of [880, 1108.7, 1318.5, 1760].entries()) {
      v.tone(f, 0.75, 'triangle', 0.1, { detune: i % 2 === 0 ? 4 : -4 })
    }
    v.tone(440, 0.6, 'square', 0.04)
    v.noise('bandpass', 500, 0.5, 0.12, { to: 4000, q: 1.2 })
  }

  onEvent(e: RacerEvent): void {
    const v = this.live()
    if (v === null || this.ctx === null) return
    const val = e.value ?? 0
    switch (e.kind) {
      case 'perfect': return this.perfect(v, Math.max(1, val))
      case 'early':
        return v.tone(2100, 0.05, 'sine', 0.06)
      case 'late':
        return v.tone(420, 0.16, 'triangle', 0.08, { to: 300 })
      case 'wrongForm':
        // Two detuned low squares beat against each other: a clear "nope" buzz.
        v.tone(110, 0.38, 'square', 0.07, { to: 82 })
        return v.tone(116, 0.38, 'square', 0.06, { to: 86 })
      case 'transform':
        // "Vınn": a rising saw sweep with an airy filtered-noise sweep on top.
        v.tone(220, 0.26, 'sawtooth', 0.05, { to: 900 })
        return v.noise('bandpass', 700, 0.26, 0.12, { to: 3800, q: 2.5 })
      case 'boost':
        v.noise('bandpass', 350, 0.55, 0.2, { to: 4500, q: 1.3 })
        return v.tone(380, 0.45, 'sine', 0.06, { to: 1300 })
      case 'jump':
        v.tone(260, 0.2, 'sine', 0.1, { to: 560 })
        return v.noise('highpass', 1500, 0.35, 0.05, { to: 3000, attack: 0.08 })
      case 'land': return this.land(v, val)
      case 'splash': {
        const k = Math.min(1.4, 0.5 + val / 30)
        v.noise('lowpass', 3200, 0.6, 0.28 * k, { to: 280 })
        v.noise('bandpass', 1400, 0.32, 0.12 * k, { at: 0.05, to: 500, q: 1.5 })
        return v.tone(180, 0.18, 'sine', 0.12 * k, { to: 70 })
      }
      case 'wall': {
        const k = Math.min(1.3, 0.5 + val / 40)
        v.noise('bandpass', 1500, 0.2, 0.26 * k, { to: 700, q: 1.4 })
        v.tone(95, 0.14, 'square', 0.08 * k, { to: 55 })
        return v.tone(1900, 0.18, 'sine', 0.03 * k, { to: 1700 })
      }
      case 'coin': return this.coin(v)
      case 'fall':
        return v.tone(950, 0.75, 'sine', 0.08, { to: 140 })
      case 'respawn':
        v.tone(300, 0.12, 'sine', 0.12, { to: 900 })
        v.noise('bandpass', 900, 0.18, 0.08, { to: 2500, q: 1 })
        return v.tone(1568, 0.25, 'triangle', 0.06, { at: 0.09 })
      case 'finish': return this.fanfare(v)
    }
  }

  /** Rising arpeggio; each combo step lifts it two semitones and adds a top note from ×3. */
  private perfect(v: VoicePool, combo: number): void {
    const base = semi(C5, Math.min(combo - 1, 9) * 2)
    const steps = combo >= 3 ? [0, 4, 7, 12, 16] : [0, 4, 7, 12]
    steps.forEach((s, i) => {
      const at = i * 0.055
      v.tone(semi(base, s), 0.2 + (i === steps.length - 1 ? 0.25 : 0), 'triangle', 0.11, { at })
      v.tone(semi(base, s + 12), 0.12, 'sine', 0.04, { at })
    })
    v.noise('highpass', 1200, 0.45, 0.07, { to: 6000, attack: 0.05 })
  }

  private land(v: VoicePool, impact: number): void {
    const k = Math.min(1.4, Math.max(0.35, impact / 7))
    v.tone(150, 0.24, 'sine', 0.26 * k, { to: 42 })
    v.noise('lowpass', 500, 0.16, 0.16 * k, { to: 90 })
  }

  /** Classic two-note "ting"; quick runs of coins climb in pitch. */
  private coin(v: VoicePool): void {
    const now = this.ctx?.currentTime ?? 0
    this.coinStreak = now - this.lastCoin < 0.7 ? Math.min(this.coinStreak + 1, 7) : 0
    this.lastCoin = now
    const b = semi(987.8, this.coinStreak)
    v.tone(b, 0.07, 'square', 0.035)
    v.tone(b, 0.07, 'sine', 0.09)
    v.tone(semi(b, 5), 0.32, 'square', 0.03, { at: 0.065 })
    v.tone(semi(b, 5), 0.38, 'sine', 0.1, { at: 0.065 })
  }

  private fanfare(v: VoicePool): void {
    const run = [-5, 0, 4, 7]
    run.forEach((s, i) => {
      v.tone(semi(C5, s), 0.14, 'square', 0.05, { at: i * 0.11 })
      v.tone(semi(C5, s), 0.16, 'triangle', 0.1, { at: i * 0.11 })
    })
    const chord = [0, 4, 7, 12]
    chord.forEach((s, i) => {
      v.tone(semi(C5, s), 1.3, 'triangle', 0.09, { at: 0.46, attack: 0.02, detune: i % 2 === 0 ? 5 : -5 })
    })
    v.tone(semi(C5, -12), 1.2, 'square', 0.035, { at: 0.46 })
    for (let i = 0; i < 5; i++) v.tone(semi(C5, 24 + [0, 4, 7, 12, 7][i]), 0.18, 'sine', 0.04, { at: 0.6 + i * 0.09 })
  }
}
