/**
 * The garage "İz Efekti" mods in a race: a stream of particles behind the car, styled per
 * trail (sparks, bubbles, star dust, light ribbon, hearts, rainbow, dragon fire). Emission
 * scales with speed, so standing still leaves no trail.
 */
import * as THREE from 'three'
import type { RacerState } from '../sim/racer'
import { rnd, type FxKit } from './fxKit'
import { SHAPE_GLOW, SHAPE_PUFF, SHAPE_STAR } from './fxTextures'

export interface TrailMod {
  /** 'trail-<id>' from meta/mods.ts. */
  readonly part: string
  readonly color: number
  readonly color2: number
}

interface Style {
  readonly rate: number
  readonly shape: number
  readonly life: [number, number]
  readonly size: [number, number]
  readonly gravity: number
  readonly gain: number
  readonly spread: number
}

const STYLES: Readonly<Record<string, Style>> = {
  'trail-kivilcim': { rate: 70, shape: SHAPE_STAR, life: [0.3, 0.55], size: [0.28, 0.05], gravity: 6, gain: 1.8, spread: 1.6 },
  'trail-baloncuk': { rate: 26, shape: SHAPE_PUFF, life: [0.7, 1.1], size: [0.25, 0.55], gravity: -1.5, gain: 1.1, spread: 0.6 },
  'trail-yildiz': { rate: 45, shape: SHAPE_STAR, life: [0.6, 0.9], size: [0.45, 0.1], gravity: -0.4, gain: 1.7, spread: 0.7 },
  'trail-isik': { rate: 90, shape: SHAPE_GLOW, life: [0.35, 0.5], size: [0.55, 0.2], gravity: 0, gain: 2, spread: 0.05 },
  'trail-kalp': { rate: 30, shape: SHAPE_STAR, life: [0.7, 1], size: [0.5, 0.2], gravity: -1, gain: 1.6, spread: 0.5 },
  'trail-gokkusagi': { rate: 90, shape: SHAPE_GLOW, life: [0.45, 0.6], size: [0.6, 0.25], gravity: 0, gain: 1.9, spread: 0.08 },
  'trail-ejderha': { rate: 85, shape: SHAPE_GLOW, life: [0.25, 0.45], size: [0.75, 0.15], gravity: -2.5, gain: 1.9, spread: 0.35 },
}

const toLinear = (hex: number): [number, number, number] => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

export class ModTrail {
  private acc = 0
  private t = 0
  private readonly c1: [number, number, number]
  private readonly c2: [number, number, number]
  private readonly style: Style | null

  constructor(private readonly k: FxKit, mod: TrailMod) {
    this.style = STYLES[mod.part] ?? null
    this.c1 = toLinear(mod.color)
    this.c2 = toLinear(mod.color2)
  }

  update(dt: number, st: RacerState): void {
    const s = this.style
    if (s === null || st.respawnT > 0 || st.finished && st.speed < 1) return
    this.t += dt
    const f = Math.min(1, Math.max(0, (st.speed - 6) / 30))
    const a = this.acc + s.rate * f * this.k.scale * dt
    const n = Math.min(30, Math.floor(a))
    this.acc = a - n
    const k = this.k
    for (let i = 0; i < n; i++) {
      const second = i % 2 === 1
      k.at(k.pos, rnd(-s.spread, s.spread) * 0.5, 0.35 + rnd(0, 0.3), -2.1).back(Math.random() * dt)
        .v(0.25, rnd(-s.spread, s.spread), rnd(-0.2, 0.6) + (s.gravity < 0 ? 0.5 : 0), -rnd(0.5, 2), 0.3)
      if (STYLES['trail-gokkusagi'] === s) k.tint(k.hue(this.t * 0.6 + i * 0.03), s.gain, s.gain * 0.8)
      else k.tint(second ? this.c2 : this.c1, s.gain, s.gain * 0.75)
      k.look(rnd(s.life[0], s.life[1]), s.size[0] * rnd(0.8, 1.2), s.size[1], 1, s.shape, s.gravity, 0.8)
      if (s.shape === SHAPE_STAR) k.spin(4)
      k.glowOut()
    }
  }
}
