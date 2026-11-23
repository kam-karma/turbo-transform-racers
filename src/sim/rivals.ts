/**
 * Which five ghosts race the player (spec §12.3): close races without rubber-banding.
 * The first race uses the slowest pilots, played a little slower, so it can be won (spec §6).
 */
export interface RivalCandidate {
  readonly id: string
  readonly time: number
}

export interface Rival {
  readonly id: string
  /** Playback time stretch: >1 plays the ghost slower. */
  readonly stretch: number
}

export const FIRST_RACE_STRETCH = 1.15
const COUNT = 5

export function pickRivals(ghosts: readonly RivalCandidate[], playerBest: number | null): Rival[] {
  const byTime = [...ghosts].sort((a, b) => a.time - b.time)
  if (playerBest === null) return byTime.slice(-COUNT).map((g) => ({ id: g.id, stretch: FIRST_RACE_STRETCH }))
  const slower = byTime.filter((g) => g.time > playerBest)
  const faster = byTime.filter((g) => g.time <= playerBest).reverse()
  const picked: RivalCandidate[] = [...slower.slice(0, 2), ...faster.slice(0, 2)]
  // One clearly faster rival to chase: the fastest one at least 4 s quicker, else the fastest left.
  const chase = faster.slice(2).find((g) => g.time <= playerBest - 4) ?? faster[2]
  if (chase !== undefined) picked.push(chase)
  for (const g of [...faster.slice(2), ...slower.slice(2)]) {
    if (picked.length >= COUNT) break
    if (!picked.includes(g)) picked.push(g)
  }
  return picked.slice(0, COUNT).map((g) => ({ id: g.id, stretch: 1 }))
}
