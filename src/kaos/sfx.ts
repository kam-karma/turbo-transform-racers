/**
 * Kaos sound effects, synthesised (no files): glass and neon smashes, bumps, the Şok blast,
 * the "meter ready" chime, lap jingles and the dragon's roar, hits and fall. The engine and
 * shared race sounds stay with RaceAudio; this adds the Kaos layer on its own small graph.
 */
export type SmashKind = 'block' | 'sign' | 'glass'

export class KaosSfx {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private noise: AudioBuffer | null = null

  constructor(private readonly enabled: () => boolean) {}

  private live(): AudioContext | null {
    if (!this.enabled()) return null
    if (this.ctx === null) {
      if (typeof AudioContext === 'undefined') return null
      try {
        const ctx = new AudioContext()
        const out = ctx.createGain()
        out.gain.value = 0.45
        const lim = ctx.createDynamicsCompressor()
        lim.threshold.value = -12
        lim.ratio.value = 8
        out.connect(lim).connect(ctx.destination)
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
        this.ctx = ctx
        this.out = out
        this.noise = buf
      } catch (error) {
        console.error('Kaos sound could not start:', error)
        return null
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined)
    return this.ctx
  }

  /** Pauses / resumes with the race. */
  suspend(on: boolean): void {
    if (this.ctx === null) return
    void (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined)
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, o: { at?: number; to?: number; attack?: number } = {}): void {
    const ctx = this.live()
    if (ctx === null || this.out === null) return
    const t = ctx.currentTime + (o.at ?? 0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f, t)
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.out)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  private hiss(type: BiquadFilterType, f: number, dur: number, vol: number, o: { at?: number; to?: number; q?: number } = {}): void {
    const ctx = this.live()
    if (ctx === null || this.out === null || this.noise === null) return
    const t = ctx.currentTime + (o.at ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const flt = ctx.createBiquadFilter()
    flt.type = type
    flt.frequency.setValueAtTime(f, t)
    if (o.to !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur)
    flt.Q.value = o.q ?? 1
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(flt).connect(g).connect(this.out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }

  smash(kind: SmashKind): void {
    if (kind === 'glass') {
      this.hiss('highpass', 3500, 0.35, 0.35, { to: 7000 })
      for (let i = 0; i < 4; i++) this.tone(2400 + Math.random() * 2600, 0.12, 'sine', 0.06, { at: i * 0.03 })
      return
    }
    if (kind === 'sign') {
      // hologram crackle: a falling buzz and digital chirps
      this.tone(880, 0.3, 'sawtooth', 0.06, { to: 110 })
      this.hiss('bandpass', 2000, 0.25, 0.25, { to: 300, q: 4 })
      for (let i = 0; i < 3; i++) this.tone(1200 + i * 500, 0.04, 'square', 0.04, { at: 0.05 + i * 0.05 })
      return
    }
    this.hiss('bandpass', 900, 0.22, 0.4, { to: 200, q: 1.2 })
    this.tone(220, 0.18, 'triangle', 0.14, { to: 70 })
    this.tone(1500 + Math.random() * 600, 0.1, 'sine', 0.05)
  }

  bump(force: number): void {
    const k = Math.min(1.3, 0.4 + force / 12)
    this.tone(90, 0.2, 'square', 0.1 * k, { to: 45 })
    this.hiss('lowpass', 1800, 0.18, 0.3 * k, { to: 200 })
  }

  shock(): void {
    this.tone(55, 0.9, 'sine', 0.35, { to: 30 })
    this.tone(160, 0.6, 'sawtooth', 0.08, { to: 40 })
    this.hiss('lowpass', 6000, 0.8, 0.5, { to: 120 })
    this.hiss('bandpass', 400, 0.6, 0.2, { to: 4000, q: 2, at: 0.02 })
  }

  ready(): void {
    ;[0, 4, 7, 12].forEach((s, i) => this.tone(660 * Math.pow(2, s / 12), 0.22, 'triangle', 0.08, { at: i * 0.06 }))
  }

  lap(last: boolean): void {
    const notes = last ? [0, 4, 7, 12, 16] : [0, 7, 12]
    notes.forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.18, 'square', 0.05, { at: i * 0.08 }))
  }

  rebuild(): void {
    this.tone(300, 0.35, 'sine', 0.025, { to: 900, attack: 0.1 })
  }

  roar(): void {
    this.tone(70, 1.1, 'sawtooth', 0.12, { to: 50, attack: 0.15 })
    this.tone(105, 1.0, 'sawtooth', 0.08, { to: 62, attack: 0.2 })
    this.hiss('bandpass', 500, 1.1, 0.35, { to: 220, q: 1.5 })
  }

  throwBlock(): void {
    this.hiss('bandpass', 600, 0.5, 0.15, { to: 2200, q: 3 })
  }

  dragonHit(): void {
    this.tone(980, 0.25, 'square', 0.06, { to: 300 })
    this.tone(140, 0.35, 'sine', 0.25, { to: 50 })
    this.hiss('highpass', 2500, 0.3, 0.25)
  }

  bounce(): void {
    this.tone(500, 0.18, 'triangle', 0.12, { to: 1600 })
  }

  crush(): void {
    this.tone(70, 0.5, 'square', 0.15, { to: 35 })
    this.hiss('lowpass', 1200, 0.5, 0.45, { to: 100 })
  }

  victory(): void {
    ;[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.35, 'triangle', 0.09, { at: i * 0.09 }))
    this.hiss('highpass', 3000, 1.4, 0.15, { at: 0.2 })
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
  }
}
