/**
 * Şok: smashing and bumping fill a meter; when it is full the player fires a ring-shaped
 * shock wave that races outwards from the car, throwing every rival it reaches into the air
 * and off its line, smashing props and (in the boss race) bouncing dragon blocks back.
 */
export const SHOCK_RADIUS = 24
/** m/s the ring expands at. */
export const SHOCK_SPEED = 60
/** Seconds the wave lives (expanding, then a short fade at full size). */
export const SHOCK_LIFE = SHOCK_RADIUS / SHOCK_SPEED + 0.25
const MAX_PUSH = 17
const MIN_PUSH = 8

export class ShockMeter {
  value = 0

  add(v: number): void {
    if (!(v > 0)) return
    this.value = Math.min(1, this.value + v)
  }

  get ready(): boolean {
    return this.value >= 1
  }

  /** Spends a full meter; false (and nothing spent) when it is not full. */
  fire(): boolean {
    if (!this.ready) return false
    this.value = 0
    return true
  }

  reset(): void {
    this.value = 0
  }
}

/** One wave, centred on the player while it lives. */
export class ShockWave {
  t = 0
  private readonly hit = new Set<string>()

  get radius(): number {
    return Math.min(SHOCK_RADIUS, this.t * SHOCK_SPEED)
  }

  get alive(): boolean {
    return this.t < SHOCK_LIFE
  }

  step(dt: number): void {
    this.t += Math.max(0, dt)
  }

  /** True the first time the ring has reached a target at `dist` metres. */
  reach(id: string, dist: number): boolean {
    if (dist > this.radius || this.hit.has(id)) return false
    this.hit.add(id)
    return true
  }
}

export interface ShockKnock {
  /** Lateral velocity (m/s, + = left). */
  readonly push: number
  readonly yawKick: number
  /** Upward speed for a hop (m/s). */
  readonly hop: number
  /** Share of speed kept. */
  readonly keep: number
}

/** How a car at (s, d) is thrown by a wave centred on (os, od). */
export function shockKnock(os: number, od: number, s: number, d: number): ShockKnock {
  const dist = Math.hypot(s - os, d - od)
  const k = Math.max(0, 1 - dist / SHOCK_RADIUS)
  const side = d - od > 0.3 ? 1 : d - od < -0.3 ? -1 : s >= os ? 1 : -1
  const push = side * (MIN_PUSH + (MAX_PUSH - MIN_PUSH) * k)
  return { push, yawKick: side * (0.5 + 0.5 * k), hop: 4 + 4 * k, keep: 0.75 - 0.2 * k }
}
