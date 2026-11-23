import { describe, expect, it } from 'vitest'
import { coinGoal, transformStars } from './transformRules'

describe('transformStars', () => {
  const base = { boss: false, place: 1, coins: 30, totalCoins: 40, perfects: 3, catches: 0, bossWon: false }

  it('gives all three stars for a win with enough coins and three perfect switches', () => {
    expect(transformStars(base).stars).toEqual([true, true, true])
  })

  it('withholds the win star below first place', () => {
    expect(transformStars({ ...base, place: 2 }).stars[0]).toBe(false)
  })

  it('needs about 60% of the coins for the coin star', () => {
    expect(coinGoal(40)).toBe(24)
    expect(transformStars({ ...base, coins: 23 }).stars[1]).toBe(false)
    expect(transformStars({ ...base, coins: 24 }).stars[1]).toBe(true)
  })

  it('needs three perfect switches for the task star', () => {
    expect(transformStars({ ...base, perfects: 2 }).stars[2]).toBe(false)
  })

  it('rates a boss race on escaping, escaping clean and perfects', () => {
    const won = transformStars({ ...base, boss: true, bossWon: true, catches: 0 })
    expect(won.stars).toEqual([true, true, true])
    expect(won.labels[0]).toMatch(/Balina/)
    const caught = transformStars({ ...base, boss: true, bossWon: true, catches: 1 })
    expect(caught.stars).toEqual([true, false, true])
    const lost = transformStars({ ...base, boss: true, bossWon: false })
    expect(lost.stars[0]).toBe(false)
  })
})

describe('tierPace', () => {
  it('makes the whale faster in later cups', async () => {
    const { tierPace } = await import('./transformBoss')
    expect(tierPace('adalar-bronz')).toBe(0)
    expect(tierPace('adalar-gumus')).toBeGreaterThan(0)
    expect(tierPace('adalar-altin')).toBeGreaterThan(tierPace('adalar-gumus'))
  })
})
