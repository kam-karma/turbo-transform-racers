/**
 * The continuous layer: a cartoon engine (two detuned oscillators through a low-pass, pitch
 * by speed) whose timbre changes with the form, plus water swish, wind and a turbo whine.
 * Built once in start(); update() only glides parameters.
 */
import type { FormId } from '../sim/forms'
import type { RacerState } from '../sim/racer'

interface Timbre {
  readonly a: OscillatorType
  readonly b: OscillatorType
  /** pitch multiplier */
  readonly pitch: number
  /** second oscillator ratio: a sub-octave growl or a near-unison buzz */
  readonly ratio: number
  /** low-pass cutoff base and per m/s */
  readonly cut: number
  readonly cutPerMs: number
  readonly vol: number
  /** amplitude chop depth (0..0.5): the climber's clank */
  readonly chop: number
}

const TIMBRE: Readonly<Record<FormId, Timbre>> = {
  car: { a: 'sawtooth', b: 'square', pitch: 1, ratio: 0.502, cut: 380, cutPerMs: 26, vol: 0.075, chop: 0 },
  // Deeper, muffled outboard motor.
  boat: { a: 'sawtooth', b: 'triangle', pitch: 0.68, ratio: 0.499, cut: 260, cutPerMs: 14, vol: 0.085, chop: 0.08 },
  // Light buzzy propeller, quieter so the wind carries the flight.
  glider: { a: 'triangle', b: 'sawtooth', pitch: 1.45, ratio: 1.006, cut: 900, cutPerMs: 20, vol: 0.04, chop: 0 },
  // Slow, chunky tracks: low square growl chopped like clanking treads.
  climber: { a: 'square', b: 'sawtooth', pitch: 0.58, ratio: 0.497, cut: 520, cutPerMs: 22, vol: 0.07, chop: 0.42 },
}

const SMOOTH = 0.06

export class EngineSound {
  private readonly oscA: OscillatorNode
  private readonly oscB: OscillatorNode
  private readonly gainB: GainNode
  private readonly chopper: GainNode
  private readonly lfo: OscillatorNode
  private readonly lfoDepth: GainNode
  private readonly filter: BiquadFilterNode
  private readonly level: GainNode
  private readonly water: GainNode
  private readonly waterFilter: BiquadFilterNode
  private readonly wind: GainNode
  private readonly windFilter: BiquadFilterNode
  private readonly whine: OscillatorNode
  private readonly whineGain: GainNode
  private form: FormId | null = null

  constructor(private readonly ctx: AudioContext, out: AudioNode, noise: AudioBuffer) {
    this.oscA = ctx.createOscillator()
    this.oscB = ctx.createOscillator()
    this.gainB = ctx.createGain()
    this.gainB.gain.value = 0.6
    this.chopper = ctx.createGain()
    this.lfo = ctx.createOscillator()
    this.lfo.type = 'square'
    this.lfoDepth = ctx.createGain()
    this.lfoDepth.gain.value = 0
    this.lfo.connect(this.lfoDepth).connect(this.chopper.gain)
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.Q.value = 4
    this.level = ctx.createGain()
    this.level.gain.value = 0
    this.oscA.connect(this.chopper)
    this.oscB.connect(this.gainB).connect(this.chopper)
    this.chopper.connect(this.filter).connect(this.level).connect(out)

    this.waterFilter = ctx.createBiquadFilter()
    this.waterFilter.type = 'bandpass'
    this.waterFilter.Q.value = 0.9
    this.water = ctx.createGain()
    this.water.gain.value = 0
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.Q.value = 0.6
    this.wind = ctx.createGain()
    this.wind.gain.value = 0
    for (const [f, g, off] of [[this.waterFilter, this.water, 0.31], [this.windFilter, this.wind, 0.67]] as const) {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      src.connect(f).connect(g).connect(out)
      src.start(0, off)
    }

    this.whine = ctx.createOscillator()
    this.whine.type = 'sine'
    this.whineGain = ctx.createGain()
    this.whineGain.gain.value = 0
    this.whine.connect(this.whineGain).connect(out)

    const t = ctx.currentTime
    for (const o of [this.oscA, this.oscB, this.lfo, this.whine]) o.start(t)
    this.setForm('car')
  }

  private setForm(form: FormId): void {
    if (form === this.form) return
    this.form = form
    const tb = TIMBRE[form]
    this.oscA.type = tb.a
    this.oscB.type = tb.b
    const t = this.ctx.currentTime
    // The chopper swings between 1 - 2·depth and 1 around its base.
    this.chopper.gain.setTargetAtTime(1 - tb.chop, t, 0.05)
    this.lfoDepth.gain.setTargetAtTime(tb.chop, t, 0.05)
  }

  /** Fades every layer out (menus between races). */
  silence(): void {
    const t = this.ctx.currentTime
    for (const g of [this.level, this.water, this.wind, this.whineGain]) g.gain.setTargetAtTime(0, t, 0.1)
  }

  update(st: RacerState, throttle: number): void {
    const t = this.ctx.currentTime
    this.setForm(st.form)
    const tb = TIMBRE[st.form]
    const thr = Math.max(0, Math.min(1, Number.isFinite(throttle) ? throttle : 0))
    const v = Math.max(0, st.speed)
    const hot = st.turbo > 0 || st.boost > 0
    // Revs: speed sets the base; throttle and free-spinning in the air add on top. A sawtooth
    // gear shape keeps it from sounding like a siren on a long straight.
    const gear = (v % 14) / 14
    let f = (48 + v * 1.7 + gear * 16 + thr * 14) * tb.pitch
    if (st.airborne) f *= 1.18
    if (hot) f *= 1.08
    const idle = st.respawnT > 0 || st.finished
    if (idle) f = 50 * tb.pitch
    this.oscA.frequency.setTargetAtTime(f, t, SMOOTH)
    this.oscB.frequency.setTargetAtTime(f * tb.ratio, t, SMOOTH)
    this.lfo.frequency.setTargetAtTime(4 + v * 0.45, t, SMOOTH)
    const cut = tb.cut + v * tb.cutPerMs + thr * 500 + (hot ? 900 : 0)
    this.filter.frequency.setTargetAtTime(Math.min(cut, 6000), t, SMOOTH)
    const vol = idle ? tb.vol * 0.4 : tb.vol * (0.65 + 0.35 * thr) * (st.form === 'glider' && st.airborne ? 0.7 : 1)
    this.level.gain.setTargetAtTime(vol, t, 0.08)

    const inWater = st.surface === 'water' && !st.airborne && !idle
    const water = inWater ? (st.form === 'boat' ? 0.03 + v * 0.0016 : 0.05) : 0
    this.water.gain.setTargetAtTime(water, t, 0.1)
    this.waterFilter.frequency.setTargetAtTime(inWater && st.form === 'boat' ? 500 + v * 18 : 380, t, 0.1)

    const air = st.airborne && !idle
    const wind = (air ? (st.form === 'glider' ? 0.05 + v * 0.0018 : 0.03) : 0) + Math.max(0, v - 32) * 0.0012
    this.wind.gain.setTargetAtTime(Math.min(0.14, wind), t, 0.15)
    this.windFilter.frequency.setTargetAtTime(700 + v * 30, t, 0.15)

    // Turbo / boost: a bright rising whine on top of the engine.
    this.whine.frequency.setTargetAtTime(hot ? 900 + v * 22 : 600, t, 0.12)
    this.whineGain.gain.setTargetAtTime(hot && !idle ? 0.018 : 0, t, 0.08)
  }
}
