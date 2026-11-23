/**
 * Shared emit helpers for the effect bursts and trails: the two particle pools, the rings,
 * the car's current frame (position, forward, left, velocity) and a reusable EmitSpec filled
 * through small chained setters, so spawning code reads like a recipe and allocates nothing.
 */
import * as THREE from 'three'
import type { FormId } from '../sim/forms'
import { newSpec, type EmitSpec, type ParticlePool } from './fxParticles'
import type { RingPool } from './fxRings'

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a)

/** Linear RGB of a hex colour (sRGB in, as the design gives them). */
function lin(hex: string): readonly [number, number, number] {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

export const FORM_RGB: Readonly<Record<FormId, readonly [number, number, number]>> = {
  car: lin('#ffd23f'),
  boat: lin('#2ec5ff'),
  glider: lin('#ff6bd6'),
  climber: lin('#7dff5a'),
}

export const GOLD = lin('#ffc93a')
export const DUST = lin('#f1dcbc')
export const SNOW = lin('#eef7ff')
export const ROCK = lin('#e0925a')
export const FOAM = lin('#e8f8ff')
export const SMOKE = lin('#f4f2f0')

const hsl = new THREE.Color()

export class FxKit {
  readonly s: EmitSpec = newSpec()
  readonly pos = new THREE.Vector3()
  readonly fwd = new THREE.Vector3(0, 0, 1)
  readonly left = new THREE.Vector3(1, 0, 0)
  readonly up = new THREE.Vector3(0, 1, 0)
  readonly vel = new THREE.Vector3()
  /** Scratch colour filled by hue(). */
  readonly rgb = new Float32Array(3)
  private readonly point = new THREE.Vector3()

  constructor(readonly glow: ParticlePool, readonly puff: ParticlePool, readonly rings: RingPool, readonly scale: number) {}

  /** Burst size for this quality level, never zero. */
  n(count: number): number {
    return Math.max(1, Math.round(count * this.scale))
  }

  /** Spawn point: `base` plus offsets along the car's left / up / forward. */
  at(base: THREE.Vector3, side: number, lift: number, ahead: number): this {
    const s = this.s
    s.x = base.x + this.left.x * side + this.up.x * lift + this.fwd.x * ahead
    s.y = base.y + this.left.y * side + this.up.y * lift + this.fwd.y * ahead
    s.z = base.z + this.left.z * side + this.up.z * lift + this.fwd.z * ahead
    return this
  }

  /** The current spawn point as a vector (scratch, overwritten by the next call). */
  spawn(): THREE.Vector3 {
    return this.point.set(this.s.x, this.s.y, this.s.z)
  }

  /** Scatter the spawn point inside a cube of half-size r. */
  jitter(r: number): this {
    this.s.x += rnd(-r, r)
    this.s.y += rnd(-r, r)
    this.s.z += rnd(-r, r)
    return this
  }

  /**
   * Velocity: `inherit` × the car's velocity (so bursts travel with the car instead of being
   * left behind at 40 m/s) plus a push along left / up / forward and random spread.
   */
  v(inherit: number, side: number, lift: number, ahead: number, spread: number): this {
    const s = this.s
    s.vx = this.vel.x * inherit + this.left.x * side + this.up.x * lift + this.fwd.x * ahead + rnd(-spread, spread)
    s.vy = this.vel.y * inherit + this.left.y * side + this.up.y * lift + this.fwd.y * ahead + rnd(-spread, spread)
    s.vz = this.vel.z * inherit + this.left.z * side + this.up.z * lift + this.fwd.z * ahead + rnd(-spread, spread)
    return this
  }

  /** Pull the spawn point back along the car's path by `t` seconds (spreads a frame's trail). */
  back(t: number): this {
    this.s.x -= this.vel.x * t
    this.s.y -= this.vel.y * t
    this.s.z -= this.vel.z * t
    return this
  }

  /** Random direction on a sphere of radius `speed` (flattened by `flat` 0..1), plus inherit. */
  burstV(inherit: number, speed: number, upBias: number, flat = 0): this {
    let x = rnd(-1, 1)
    let y = rnd(-1, 1) * (1 - flat)
    let z = rnd(-1, 1)
    const l = Math.hypot(x, y, z) || 1
    const k = speed / l
    x *= k
    y = y * k + upBias
    z *= k
    const s = this.s
    s.vx = this.vel.x * inherit + x
    s.vy = this.vel.y * inherit + y
    s.vz = this.vel.z * inherit + z
    return this
  }

  col(r0: number, g0: number, b0: number, r1 = r0, g1 = g0, b1 = b0): this {
    const s = this.s
    s.r0 = r0; s.g0 = g0; s.b0 = b0
    s.r1 = r1; s.g1 = g1; s.b1 = b1
    return this
  }

  /** Same colour from a triple, scaled (for glow pushed past 1 into bloom). */
  tint(c: ArrayLike<number>, k0: number, k1 = k0): this {
    return this.col(c[0] * k0, c[1] * k0, c[2] * k0, c[0] * k1, c[1] * k1, c[2] * k1)
  }

  look(life: number, size0: number, size1: number, alpha: number, shape: number, gravity = 0, drag = 0): this {
    const s = this.s
    s.life = life
    s.size0 = size0
    s.size1 = size1
    s.alpha = alpha
    s.shape = shape
    s.gravity = gravity
    s.drag = drag
    s.rot = Math.random() * Math.PI * 2
    s.spin = 0
    return this
  }

  spin(rate: number): this {
    this.s.spin = rnd(-rate, rate)
    return this
  }

  /** Upright, unrotated (shaded puffs must keep their light side up). */
  upright(): this {
    this.s.rot = rnd(-0.25, 0.25)
    return this
  }

  glowOut(): void {
    this.glow.emit(this.s)
  }

  puffOut(): void {
    this.puff.emit(this.s)
  }

  /** Saturated rainbow colour into `rgb` (linear). */
  hue(h: number, light = 0.6): Float32Array {
    hsl.setHSL(((h % 1) + 1) % 1, 1, light)
    this.rgb[0] = hsl.r
    this.rgb[1] = hsl.g
    this.rgb[2] = hsl.b
    return this.rgb
  }
}
