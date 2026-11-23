/**
 * One-shot effect recipes, one per racer event. Every burst inherits part of the car's
 * velocity: at 40 m/s anything spawned at rest is behind the camera within a fifth of a second.
 */
import type * as THREE from 'three'
import type { FormId, Surface } from '../sim/forms'
import { DUST, FOAM, FORM_RGB, GOLD, ROCK, SMOKE, SNOW, rnd, type FxKit } from './fxKit'
import { SHAPE_CHIP, SHAPE_GLOW, SHAPE_PUFF, SHAPE_STAR } from './fxTextures'

/** Bright flash glow at a point, riding with the car. */
function flash(k: FxKit, at: THREE.Vector3, c: ArrayLike<number>, size: number, gain: number): void {
  k.at(at, 0, 0.5, 0).v(0.95, 0, 0, 0, 0).tint(c, gain, gain * 0.5).look(0.22, size, size * 1.8, 1, SHAPE_GLOW).glowOut()
}

/** Perfect switch: ring hoops + sparkle shower in the new form's colour; rainbow from combo 3. */
export function burstPerfect(k: FxKit, at: THREE.Vector3, combo: number, form: FormId): void {
  const c = Math.max(1, combo)
  const big = 1 + 0.22 * Math.min(c - 1, 6)
  const fc = FORM_RGB[form]
  k.rings.hoop(fc[0] * 1.3, fc[1] * 1.3, fc[2] * 1.3, 1.2, 5 * big, 0.5)
  if (c >= 2) k.rings.hoop(1.2, 1.2, 1.2, 1, 3.6 * big, 0.45, 0.07, 1.6)
  if (c >= 3) {
    const h = k.hue(c * 0.13)
    k.rings.hoop(h[0] * 1.3, h[1] * 1.3, h[2] * 1.3, 1, 6.5 * big, 0.6, 0.14, 2.6)
  }
  flash(k, at, fc, 3 * big, 1.6)
  const n = k.n(26 * big)
  for (let i = 0; i < n; i++) {
    const rgb = c >= 3 ? k.hue(i / n + c * 0.1) : i % 3 === 0 ? SNOW : fc
    k.at(at, rnd(-0.8, 0.8), rnd(0.2, 1.2), rnd(-1, 1))
      .burstV(0.9, rnd(4, 9) * big, 1.5)
      .tint(rgb, 1.6, 1.1)
      .look(rnd(0.5, 0.85), rnd(0.8, 1.3) * big, 0.2, 1, SHAPE_STAR, 3, 1.5)
      .spin(6)
    k.glowOut()
  }
}

export function burstCoin(k: FxKit, at: THREE.Vector3): void {
  flash(k, at, GOLD, 2.2, 1.6)
  const n = k.n(14)
  for (let i = 0; i < n; i++) {
    k.at(at, 0, 0.6, 0).jitter(0.3).burstV(0.85, rnd(2, 5), 2.5)
      .tint(GOLD, 1.7, 1.2).look(rnd(0.4, 0.65), rnd(0.6, 1), 0.15, 1, SHAPE_STAR, 4, 1).spin(5)
    k.glowOut()
  }
}

/** Landing: ring of dust (road), snow (ice) or rock grit (climb); water lands as a splash. */
export function burstLand(k: FxKit, at: THREE.Vector3, impact: number, surface: Surface): void {
  if (surface === 'water') {
    burstSplash(k, at, 10 + impact * 2)
    return
  }
  const str = Math.min(1.6, Math.max(0.35, impact / 7))
  const c = surface === 'ice' ? SNOW : surface === 'climb' ? ROCK : DUST
  const n = k.n(16 * str)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    k.at(at, ca * 1.2, 0.15, sa * 1.7)
      .v(0.35, ca * rnd(3, 5.5) * str, rnd(0.8, 1.8), sa * rnd(3, 5.5) * str, 0.4)
      .tint(c, 1, 0.95).look(rnd(0.6, 0.9), rnd(0.5, 0.7), rnd(1.2, 1.7) * str, 0.85, SHAPE_PUFF, -0.3, 2.5).upright()
    k.puffOut()
  }
  if (surface === 'ice') {
    for (let i = 0; i < k.n(12); i++) {
      k.at(at, rnd(-1.2, 1.2), 0, rnd(-1.5, 1.5)).burstV(0.4, rnd(2, 4), 3).tint(SNOW, 1.6, 1.1)
        .look(rnd(0.4, 0.7), rnd(0.35, 0.6), 0.08, 1, SHAPE_STAR, 6, 1).spin(4)
      k.glowOut()
    }
  }
}

/** Entering water: a crown of droplets, foam puffs and a flat white shock wave. */
export function burstSplash(k: FxKit, at: THREE.Vector3, speed: number): void {
  const str = Math.min(1.6, Math.max(0.5, speed / 25))
  k.at(at, 0, -0.3, 0)
  k.rings.wave(k.spawn(), 1, 1.1, 1.2, 1.5, 6 * str, 0.6)
  const n = k.n(36 * str)
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2)
    k.at(at, Math.cos(a) * 1.1, -0.2, Math.sin(a) * 1.6)
      .v(0.55, Math.cos(a) * rnd(2, 5), rnd(4, 9) * str, Math.sin(a) * rnd(2, 5), 0.6)
      .tint(FOAM, 1.15, 1).look(rnd(0.6, 1), rnd(0.25, 0.45), rnd(0.15, 0.3), 0.95, SHAPE_GLOW, 16, 0.4)
    k.puffOut()
  }
  for (let i = 0; i < k.n(10 * str); i++) {
    const side = i % 2 === 0 ? 1 : -1
    k.at(at, side * rnd(1.2, 2), 0.3, rnd(-2, 1)).v(0.6, side * rnd(1.5, 3), rnd(1.5, 3), rnd(-2, 0), 0.5)
      .tint(FOAM, 1.1, 1).look(rnd(0.5, 0.8), 0.5, rnd(1.1, 1.5) * str, 0.9, SHAPE_PUFF, 3, 2).upright()
    k.puffOut()
  }
}

/** Scraping a rail: a fan of hot sparks thrown off the side that touched (`side` +1 left). */
export function burstWall(k: FxKit, at: THREE.Vector3, side: number, speed: number, count: number): void {
  const str = Math.min(1.5, Math.max(0.4, speed / 30))
  if (count > 6) k.at(at, side * 1, 0.3, 0.6).v(0.9, 0, 0, 0, 0).col(2, 1.5, 0.6, 1.2, 0.4, 0.05).look(0.15, 2, 2.8, 1, SHAPE_GLOW).glowOut()
  const n = k.n(count * str)
  for (let i = 0; i < n; i++) {
    k.at(at, side * 0.95, rnd(0, 0.5), rnd(-0.6, 1.4))
      .v(0.75, side * rnd(1.5, 6), rnd(1.5, 6), -rnd(2, 6), 1.2)
      .col(2, 1.7, 0.6, 1.6, 0.45, 0.05).look(rnd(0.25, 0.5), rnd(0.22, 0.38), 0.05, 1, i % 4 === 0 ? SHAPE_STAR : SHAPE_GLOW, 20, 0.5)
    k.glowOut()
  }
}

/** Back on the track: a big cartoon poof with a few twinkles. */
export function burstRespawn(k: FxKit, at: THREE.Vector3): void {
  for (let i = 0; i < k.n(20); i++) {
    k.at(at, 0, 0.6, 0).jitter(0.6).burstV(0.6, rnd(2.5, 5), 0.8)
      .tint(SMOKE, 1.05, 1).look(rnd(0.6, 0.95), rnd(0.8, 1.2), rnd(2.2, 3.2), 1, SHAPE_PUFF, -0.5, 3).upright()
    k.puffOut()
  }
  for (let i = 0; i < k.n(12); i++) {
    const h = k.hue(i / 12)
    k.at(at, 0, 0.8, 0).burstV(0.6, rnd(3, 6), 1.5).tint(h, 1.6, 1.1).look(rnd(0.4, 0.7), 0.9, 0.15, 1, SHAPE_STAR, 2, 1).spin(5)
    k.glowOut()
  }
}

/** Falling off: a puff of cloud where the car vanished. */
export function burstFall(k: FxKit, at: THREE.Vector3): void {
  for (let i = 0; i < k.n(10); i++) {
    k.at(at, 0, 0, 0).jitter(1).burstV(0.2, rnd(1.5, 3), 0.5).tint(SMOKE, 1, 1)
      .look(rnd(0.6, 0.9), 1, rnd(2.5, 3.5), 0.9, SHAPE_PUFF, -0.5, 2).upright()
    k.puffOut()
  }
}

/** Form change: a puff of pastel smoke in the new form's colour plus twinkles ("pop!"). */
export function burstTransform(k: FxKit, at: THREE.Vector3, form: FormId): void {
  const c = FORM_RGB[form]
  for (let i = 0; i < k.n(12); i++) {
    k.at(at, rnd(-1, 1), rnd(0, 0.8), rnd(-1.6, 1.6)).burstV(0.92, rnd(1.5, 3.5), 0.6)
      .col(0.6 + c[0] * 0.5, 0.6 + c[1] * 0.5, 0.6 + c[2] * 0.5, 1, 1, 1)
      .look(rnd(0.35, 0.55), rnd(0.5, 0.8), rnd(1.4, 2), 0.9, SHAPE_PUFF, -0.5, 3).upright()
    k.puffOut()
  }
  for (let i = 0; i < k.n(8); i++) {
    k.at(at, 0, 0.6, 0).jitter(0.8).burstV(0.92, rnd(3, 5), 1).tint(c, 1.6, 1.1)
      .look(rnd(0.3, 0.5), 0.8, 0.15, 1, SHAPE_STAR, 0, 2).spin(6)
    k.glowOut()
  }
}

/** Boost pad: an electric-blue hoop and streaks flung backwards. */
export function burstBoost(k: FxKit, at: THREE.Vector3): void {
  k.rings.hoop(0.3, 0.9, 1.6, 1.5, 4.5, 0.4, 0, 0.2)
  for (let i = 0; i < k.n(18); i++) {
    k.at(at, rnd(-1, 1), rnd(0, 1), -1.5).v(0.8, rnd(-2, 2), rnd(0, 2), -rnd(4, 10), 0.5)
      .col(0.6, 1.3, 1.8, 0.1, 0.4, 1.4).look(rnd(0.25, 0.45), rnd(0.4, 0.7), 0.1, 1, SHAPE_GLOW, 0, 1)
    k.glowOut()
  }
}

/** Wrong form: a sad grey cough of smoke. */
export function burstWrong(k: FxKit, at: THREE.Vector3): void {
  for (let i = 0; i < k.n(9); i++) {
    k.at(at, rnd(-0.6, 0.6), 0.6, -1.6).v(0.7, rnd(-1, 1), rnd(1, 2.5), -rnd(0, 2), 0.4)
      .col(0.45, 0.45, 0.5, 0.75, 0.75, 0.78).look(rnd(0.6, 0.9), 0.5, rnd(1.4, 2), 0.8, SHAPE_PUFF, -1, 2).upright()
    k.puffOut()
  }
}

/** Early switch: a tiny white twinkle so the press still feels acknowledged. */
export function burstEarly(k: FxKit, at: THREE.Vector3): void {
  for (let i = 0; i < k.n(5); i++) {
    k.at(at, 0, 0.8, 0).jitter(0.5).burstV(0.95, rnd(1, 2.5), 0.5).col(1.5, 1.5, 1.6, 1, 1, 1.1)
      .look(0.3, 0.55, 0.1, 1, SHAPE_STAR, 0, 2).spin(4)
    k.glowOut()
  }
}

/** Take-off: a kick of dust from the rear wheels. */
export function burstJump(k: FxKit, at: THREE.Vector3): void {
  for (let i = 0; i < k.n(8); i++) {
    k.at(at, rnd(-0.9, 0.9), 0.1, -1.4).v(0.3, rnd(-1.5, 1.5), rnd(0.8, 2), -rnd(1, 3), 0.4)
      .tint(DUST, 1, 0.95).look(rnd(0.5, 0.7), 0.5, rnd(1.4, 2), 0.7, SHAPE_PUFF, -0.3, 2.5).upright()
    k.puffOut()
  }
}

/** Finish line: a gold hoop and a confetti storm that drifts down around the car. */
export function burstFinish(k: FxKit, at: THREE.Vector3): void {
  k.rings.hoop(1.4, 1.1, 0.3, 1, 9, 0.8, 0, 1)
  k.rings.hoop(1.2, 1.2, 1.2, 1, 6, 0.7, 0.15, 2)
  for (let i = 0; i < k.n(130); i++) {
    const h = k.hue(Math.random(), 0.5)
    k.at(at, 0, 2.5, 2).jitter(1).burstV(0.55, rnd(5, 12), 5)
      .tint(h, 1, 0.9).look(rnd(1.8, 2.8), rnd(0.25, 0.4), rnd(0.25, 0.4), 1, SHAPE_CHIP, 5, 1.6).spin(12)
    k.puffOut()
  }
}
