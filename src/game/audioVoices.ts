/**
 * Pooled one-shot voices for sound effects. Every oscillator and noise source is created once
 * and runs for the whole session behind a gain held at zero; a "note" only schedules frequency
 * and gain envelopes on a free voice. So a two-minute race creates no nodes at all after
 * start(), and nothing can leak.
 */

export interface ToneOpts {
  /** seconds from now */
  readonly at?: number
  /** end frequency of an exponential glide */
  readonly to?: number
  readonly attack?: number
  /** vibrato-free detune in cents for a fatter unison when two voices play */
  readonly detune?: number
}

export interface NoiseOpts {
  readonly at?: number
  /** filter cutoff glide target */
  readonly to?: number
  readonly q?: number
  readonly attack?: number
}

interface Voice {
  readonly gain: GainNode
  busyUntil: number
}

interface ToneVoice extends Voice {
  readonly osc: OscillatorNode
}

interface NoiseVoice extends Voice {
  readonly filter: BiquadFilterNode
}

const SILENT = 0.0001

/** A second of white noise, shared by every noise user (engine wind/water included). */
export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const len = ctx.sampleRate
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

export class VoicePool {
  private readonly tones: ToneVoice[] = []
  private readonly noises: NoiseVoice[] = []

  constructor(private readonly ctx: AudioContext, out: AudioNode, noise: AudioBuffer, toneCount = 20, noiseCount = 5) {
    for (let i = 0; i < toneCount; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain).connect(out)
      osc.start()
      this.tones.push({ osc, gain, busyUntil: 0 })
    }
    for (let i = 0; i < noiseCount; i++) {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      // Each source starts at a different offset so simultaneous bursts do not phase.
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter).connect(gain).connect(out)
      src.start(0, (i * 0.193) % 1)
      this.noises.push({ filter, gain, busyUntil: 0 })
    }
  }

  /** The voice that frees up first (steals the oldest when all are busy). */
  private pick<T extends Voice>(list: readonly T[], t: number): T {
    let best = list[0]
    for (const v of list) {
      if (v.busyUntil <= t) return v
      if (v.busyUntil < best.busyUntil) best = v
    }
    return best
  }

  private envelope(g: AudioParam, t: number, vol: number, attack: number, dur: number): void {
    g.cancelScheduledValues(t)
    g.setValueAtTime(SILENT, t)
    g.linearRampToValueAtTime(vol, t + attack)
    g.exponentialRampToValueAtTime(SILENT, t + Math.max(dur, attack + 0.01))
    g.setValueAtTime(0, t + dur + 0.005)
  }

  tone(freq: number, dur: number, type: OscillatorType, vol: number, o: ToneOpts = {}): void {
    const t = this.ctx.currentTime + (o.at ?? 0)
    const v = this.pick(this.tones, t)
    v.busyUntil = t + dur + 0.01
    if (v.osc.type !== type) v.osc.type = type
    v.osc.detune.setValueAtTime(o.detune ?? 0, t)
    const f = v.osc.frequency
    f.cancelScheduledValues(t)
    f.setValueAtTime(freq, t)
    if (o.to !== undefined) f.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur)
    this.envelope(v.gain.gain, t, vol, o.attack ?? 0.006, dur)
  }

  noise(type: BiquadFilterType, freq: number, dur: number, vol: number, o: NoiseOpts = {}): void {
    const t = this.ctx.currentTime + (o.at ?? 0)
    const v = this.pick(this.noises, t)
    v.busyUntil = t + dur + 0.01
    if (v.filter.type !== type) v.filter.type = type
    v.filter.Q.setValueAtTime(o.q ?? 1, t)
    const f = v.filter.frequency
    f.cancelScheduledValues(t)
    f.setValueAtTime(freq, t)
    if (o.to !== undefined) f.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur)
    this.envelope(v.gain.gain, t, vol, o.attack ?? 0.01, dur)
  }
}
