/**
 * Procedural background music (no files, nothing to download): a small step sequencer with a
 * look-ahead scheduler, playing a song per mood — a bouncy menu tune, and one race tune per
 * world (sunny islands in major, the toy house playful, the neon city as minor synthwave).
 * Notes are short-lived nodes on a music bus that ducks under the race effects.
 */

export type SongId = 'menu' | 'adalar' | 'dev-ev' | 'neon'

interface Song {
  readonly bpm: number
  /** Root of each bar's chord (semitones from A2 = 110 Hz) and its quality. */
  readonly bars: readonly (readonly [number, 'maj' | 'min'])[]
  /** Lead motif per bar: 16 steps, semitone above the chord root or null (rest). */
  readonly lead: readonly (number | null)[]
  readonly leadWave: OscillatorType
  readonly kick: readonly number[]
  readonly snare: readonly number[]
  readonly hat: readonly number[]
  /** Bass pattern: 16 steps, 0 = root, 12 = octave, null = rest. */
  readonly bass: readonly (number | null)[]
  readonly arp: boolean
  readonly vol: number
}

const _ = null
const FOUR = [0, 4, 8, 12]
const BACKBEAT = [4, 12]
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14]
const OFFBEATS = [2, 6, 10, 14]

const SONGS: Readonly<Record<SongId, Song>> = {
  menu: {
    bpm: 108,
    bars: [[3, 'maj'], [10, 'maj'], [12, 'min'], [8, 'maj']],
    lead: [12, _, 16, _, 19, _, 16, _, 14, _, 12, _, 11, _, 7, _],
    leadWave: 'triangle',
    kick: [0, 8, 10],
    snare: BACKBEAT,
    hat: EIGHTHS,
    bass: [0, _, _, 12, _, _, 0, _, 0, _, _, 12, _, 7, _, _],
    arp: true,
    vol: 0.16,
  },
  adalar: {
    bpm: 140,
    bars: [[3, 'maj'], [10, 'maj'], [12, 'min'], [8, 'maj']],
    lead: [19, _, 19, 21, _, 19, _, 16, _, 16, 14, _, 12, _, 14, _],
    leadWave: 'square',
    kick: FOUR,
    snare: BACKBEAT,
    hat: OFFBEATS,
    bass: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 0, 7, 12, _],
    arp: true,
    vol: 0.13,
  },
  'dev-ev': {
    bpm: 132,
    bars: [[5, 'maj'], [0, 'maj'], [2, 'min'], [10, 'maj']],
    lead: [12, 14, 16, _, 19, _, 16, _, 21, _, 19, 16, 14, _, 12, _],
    leadWave: 'sine',
    kick: [0, 6, 8],
    snare: BACKBEAT,
    hat: EIGHTHS,
    bass: [0, _, 7, _, 12, _, 7, _, 0, _, 7, _, 12, _, 7, _],
    arp: true,
    vol: 0.15,
  },
  neon: {
    bpm: 150,
    bars: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']],
    lead: [12, _, 15, _, 19, _, 15, 12, _, 10, _, 12, _, 15, 17, _],
    leadWave: 'sawtooth',
    kick: FOUR,
    snare: BACKBEAT,
    hat: [2, 3, 6, 7, 10, 11, 14, 15],
    bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12],
    arp: false,
    vol: 0.13,
  },
}

const A2 = 110
const LOOKAHEAD = 0.15
const TICK_MS = 50
const freq = (semi: number): number => A2 * Math.pow(2, semi / 12)

export class Music {
  private readonly bus: GainNode
  private readonly delay: DelayNode
  private song: Song | null = null
  private songId: SongId | null = null
  private step = 0
  private nextT = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly ctx: AudioContext, out: AudioNode, private readonly noise: AudioBuffer) {
    this.bus = ctx.createGain()
    this.bus.gain.value = 0
    this.bus.connect(out)
    // A short echo on the lead gives the cheap synths some space.
    this.delay = ctx.createDelay(1)
    const fb = ctx.createGain()
    fb.gain.value = 0.28
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    this.delay.connect(fb).connect(this.delay)
    this.delay.connect(wet).connect(this.bus)
  }

  play(id: SongId | null): void {
    if (id === this.songId) return
    this.songId = id
    const t = this.ctx.currentTime
    if (id === null) {
      this.bus.gain.setTargetAtTime(0, t, 0.3)
      if (this.timer !== null) clearInterval(this.timer)
      this.timer = null
      this.song = null
      return
    }
    const song = SONGS[id]
    this.song = song
    this.delay.delayTime.value = (60 / song.bpm) * 0.75
    this.bus.gain.cancelScheduledValues(t)
    this.bus.gain.setValueAtTime(0, t)
    this.bus.gain.linearRampToValueAtTime(song.vol, t + 1.2)
    this.step = 0
    this.nextT = t + 0.08
    if (this.timer === null) this.timer = setInterval(() => this.schedule(), TICK_MS)
  }

  private schedule(): void {
    const song = this.song
    if (song === null || this.ctx.state !== 'running') return
    const stepDur = 60 / song.bpm / 4
    // After a long suspend (ads, hidden tab) skip ahead instead of firing a burst of notes.
    if (this.nextT < this.ctx.currentTime - 0.2) this.nextT = this.ctx.currentTime + 0.05
    while (this.nextT < this.ctx.currentTime + LOOKAHEAD) {
      this.playStep(song, this.step, this.nextT, stepDur)
      this.nextT += stepDur
      this.step = (this.step + 1) % (16 * song.bars.length)
    }
  }

  private playStep(song: Song, step: number, t: number, sd: number): void {
    const bar = Math.floor(step / 16)
    const s = step % 16
    const [root, quality] = song.bars[bar]
    const third = quality === 'maj' ? 4 : 3
    if (song.kick.includes(s)) this.kick(t)
    if (song.snare.includes(s)) this.snare(t)
    if (song.hat.includes(s)) this.hat(t, s % 4 === 2 ? 0.05 : 0.03)
    const b = song.bass[s]
    if (b !== null && b !== undefined) this.note(freq(root - 12 + b), t, sd * 1.6, 'triangle', 0.22, 900)
    if (s === 0) for (const n of [0, third, 7]) this.note(freq(root + 12 + n), t, sd * 15, 'sawtooth', 0.025, 1400, 0.08)
    if (song.arp && s % 2 === 1) {
      const arp = [0, third, 7, 12][(s >> 1) % 4]
      this.note(freq(root + 24 + arp), t, sd * 0.9, 'triangle', 0.035, 3000)
    }
    // The lead rests every other bar so the tune breathes.
    const l = song.lead[s]
    if (bar % 2 === 0 && l !== null && l !== undefined) this.note(freq(root + 12 + l), t, sd * 1.8, song.leadWave, song.leadWave === 'sine' ? 0.09 : 0.045, 2600, 0.005, true)
  }

  private note(f: number, t: number, dur: number, type: OscillatorType, vol: number, cut: number, attack = 0.005, echo = false): void {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = cut
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(flt).connect(g).connect(this.bus)
    if (echo) g.connect(this.delay)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(this.bus)
    o.start(t)
    o.stop(t + 0.25)
  }

  private noiseHit(t: number, type: BiquadFilterType, f: number, dur: number, vol: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const flt = this.ctx.createBiquadFilter()
    flt.type = type
    flt.frequency.value = f
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(flt).connect(g).connect(this.bus)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  private snare(t: number): void {
    this.noiseHit(t, 'bandpass', 1800, 0.16, 0.22)
    this.note(220, t, 0.08, 'triangle', 0.08, 2000, 0.002)
  }

  private hat(t: number, vol: number): void {
    this.noiseHit(t, 'highpass', 7000, 0.05, vol * 2)
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }
}
