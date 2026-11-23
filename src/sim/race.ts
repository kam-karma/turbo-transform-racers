/** Race flow: the start countdown, the race clock and the running order. */

export type RacePhase = 'intro' | 'countdown' | 'racing' | 'finished'

export const COUNTDOWN_S = 3

export class RaceClock {
  phase: RacePhase = 'intro'
  /** Seconds left of the countdown (3, 2, 1 shown as whole numbers). */
  private left = 0
  /** Seconds since the green light. */
  raceT = 0

  /** 3, 2, 1 during the countdown (never 0: GO belongs to the first racing frame), else 0. */
  get countdown(): number {
    if (this.phase !== 'countdown') return 0
    return Math.max(1, Math.ceil(this.left - 1e-9))
  }

  start(): void {
    this.phase = 'countdown'
    this.left = COUNTDOWN_S
    this.raceT = 0
  }

  /** Advances by dt; returns the seconds of racing inside this tick (0 before the start). */
  tick(dt: number): number {
    if (this.phase === 'countdown') {
      this.left -= dt
      // Float steps (60 × 1/60) leave a sliver like 1e-15 behind: that is the green light too.
      if (this.left > 1e-6) return 0
      const over = -this.left
      this.left = 0
      this.phase = 'racing'
      this.raceT += over
      return over
    }
    if (this.phase === 'racing') {
      this.raceT += dt
      return dt
    }
    return 0
  }

  finish(): void {
    this.phase = 'finished'
  }
}

export interface StandingEntry {
  readonly id: string
  readonly s: number
  readonly finishedAt: number | null
}

/** Ids in race order: finishers by time, then the rest by distance covered. */
export function standings(entries: readonly StandingEntry[]): string[] {
  return [...entries]
    .sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt
      if (a.finishedAt !== null) return -1
      if (b.finishedAt !== null) return 1
      return b.s - a.s
    })
    .map((e) => e.id)
}
