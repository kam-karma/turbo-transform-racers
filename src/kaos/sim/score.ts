/**
 * Kaos scoring (spec §9.3): final score = place points + destruction points. Stars: finish
 * first, reach the track's destruction goal, and the track's own challenge. Because two of
 * the three stars do not need first place, even the last car can earn stars as the best
 * wrecker. Boss stars are about beating the dragon, beating it early and beating it clean.
 */
import type { BreakKind } from './breakables'

export const PLACE_POINTS: readonly number[] = [500, 400, 320, 260, 210, 170]
/** Points for bumping a rival (per rival, at most once a second). */
export const BUMP_SCORE = 20
/** Points per rival thrown by a shock wave. */
export const SHOCK_SCORE = 40

export const placePoints = (place: number): number => PLACE_POINTS[Math.max(0, Math.min(PLACE_POINTS.length - 1, Math.round(place) - 1))]

export interface KaosStats {
  readonly place: number
  readonly of: number
  readonly destruction: number
  readonly botHits: number
  readonly shockHits: number
  readonly smashed: Readonly<Record<BreakKind, number>>
}

export type ChallengeKind = 'total' | 'shockHits' | 'glass' | 'botHits' | 'signs'

export interface Challenge {
  readonly kind: ChallengeKind
  readonly n: number
}

export interface KaosGoals {
  readonly destruction: number
  readonly challenge: Challenge
}

export const finalScore = (st: KaosStats): number => placePoints(st.place) + st.destruction

function challengeMet(st: KaosStats, c: Challenge): boolean {
  switch (c.kind) {
    case 'total': return finalScore(st) >= c.n
    case 'shockHits': return st.shockHits >= c.n
    case 'glass': return st.smashed.glass >= c.n
    case 'botHits': return st.botHits >= c.n
    case 'signs': return st.smashed.sign >= c.n
  }
}

export function challengeLabel(c: Challenge): string {
  switch (c.kind) {
    case 'total': return `Toplam ${c.n} puan yap`
    case 'shockHits': return `Şok dalgasıyla ${c.n} rakip savur`
    case 'glass': return `${c.n} cam bariyer kır`
    case 'botHits': return `Rakiplere ${c.n} kez çarp`
    case 'signs': return `${c.n} hologram tabela yık`
  }
}

export function kaosStars(st: KaosStats, g: KaosGoals): [boolean, boolean, boolean] {
  return [st.place === 1, st.destruction >= g.destruction, challengeMet(st, g.challenge)]
}

export function kaosStarLabels(g: KaosGoals): [string, string, string] {
  return ['1. ol', `${g.destruction} yıkım puanı topla`, challengeLabel(g.challenge)]
}

export interface BossStats {
  readonly beaten: boolean
  /** Lap the dragon fell in (1-based), or null. */
  readonly beatenLap: number | null
  readonly laps: number
  /** Blocks that landed on the player. */
  readonly crushes: number
}

export function bossStars(b: BossStats): [boolean, boolean, boolean] {
  return [b.beaten, b.beaten && b.beatenLap !== null && b.beatenLap < b.laps, b.beaten && b.crushes === 0]
}

export function bossStarLabels(laps: number): [string, string, string] {
  return ['Ejderhayı yen', `Ejderhayı ${laps}. tur başlamadan yen`, 'Hiç blok yemeden yen']
}
