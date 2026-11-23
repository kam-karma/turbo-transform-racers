/**
 * Short slow-motion moments (big jumps, the first perfect transform). Spec §8.2 caps them at
 * 0.4 s and half speed; a cooldown keeps them special.
 */
const MAX_SECONDS = 0.4
const MIN_SCALE = 0.5
const COOLDOWN = 2

export class TimeScale {
  private left = 0
  private scale = 1
  private sinceLast = Infinity

  /** Starts a slow-motion moment; false if one ran less than 2 s ago. */
  trigger(scale = MIN_SCALE, seconds = MAX_SECONDS): boolean {
    if (this.sinceLast < COOLDOWN) return false
    this.scale = Math.max(MIN_SCALE, Math.min(1, scale))
    this.left = Math.min(MAX_SECONDS, Math.max(0, seconds))
    this.sinceLast = 0
    return true
  }

  get slow(): boolean {
    return this.left > 0
  }

  /** Real seconds in, game seconds out. */
  step(realDt: number): number {
    this.sinceLast += realDt
    if (this.left <= 0) return realDt
    const slowPart = Math.min(this.left, realDt)
    this.left -= slowPart
    return slowPart * this.scale + (realDt - slowPart)
  }
}
