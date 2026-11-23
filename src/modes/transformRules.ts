/** Dönüşüm Kupası star rules (spec §14.2): win, the track task, and a perfect-switch task. */

export interface TransformResult {
  readonly boss: boolean
  readonly place: number
  readonly coins: number
  readonly totalCoins: number
  readonly perfects: number
  /** Boss races: how often the wave caught the player, and whether they escaped. */
  readonly catches: number
  readonly bossWon: boolean
}

export const PERFECT_GOAL = 3
const COIN_SHARE = 0.6

export const coinGoal = (totalCoins: number): number => Math.max(1, Math.round(totalCoins * COIN_SHARE))

export function transformStars(r: TransformResult): { stars: [boolean, boolean, boolean]; labels: [string, string, string] } {
  const perfect = r.perfects >= PERFECT_GOAL
  if (r.boss) {
    return {
      stars: [r.bossWon, r.bossWon && r.catches === 0, perfect],
      labels: ['Dev Balina Dalgası\'ndan kaç', 'Hiç yakalanmadan bitir', `${PERFECT_GOAL} mükemmel dönüşüm`],
    }
  }
  const goal = coinGoal(r.totalCoins)
  return {
    stars: [r.place === 1, r.coins >= goal, perfect],
    labels: ['Birinci bitir', `${goal} altın topla`, `${PERFECT_GOAL} mükemmel dönüşüm`],
  }
}
