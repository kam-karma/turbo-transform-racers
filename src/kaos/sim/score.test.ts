import { describe, expect, it } from 'vitest'
import { bossStarLabels, bossStars, challengeLabel, finalScore, kaosStarLabels, kaosStars, placePoints, type KaosStats } from './score'

const stats = (over: Partial<KaosStats> = {}): KaosStats => ({
  place: 3, of: 6, destruction: 300, botHits: 2, shockHits: 1, smashed: { block: 10, sign: 4, glass: 6 }, ...over,
})

describe('kaos score', () => {
  it('gives more place points for better places, clamped to the grid', () => {
    expect(placePoints(1)).toBeGreaterThan(placePoints(2))
    expect(placePoints(6)).toBeGreaterThan(0)
    expect(placePoints(9)).toBe(placePoints(6))
    expect(placePoints(0)).toBe(placePoints(1))
  })

  it('adds destruction to the place points', () => {
    expect(finalScore(stats())).toBe(placePoints(3) + 300)
  })

  it('lets the last car win the wrecking stars', () => {
    const s = kaosStars(stats({ place: 6, destruction: 700, shockHits: 3 }), { destruction: 600, challenge: { kind: 'shockHits', n: 3 } })
    expect(s).toEqual([false, true, true])
  })

  it('checks each challenge kind', () => {
    const st = stats()
    const g = (kind: 'total' | 'glass' | 'botHits' | 'signs', n: number) => kaosStars(st, { destruction: 9999, challenge: { kind, n } })[2]
    expect(g('total', placePoints(3) + 300)).toBe(true)
    expect(g('total', placePoints(3) + 301)).toBe(false)
    expect(g('glass', 6)).toBe(true)
    expect(g('glass', 7)).toBe(false)
    expect(g('botHits', 2)).toBe(true)
    expect(g('signs', 5)).toBe(false)
  })

  it('labels stars in Turkish', () => {
    expect(kaosStarLabels({ destruction: 500, challenge: { kind: 'glass', n: 8 } })).toEqual(['1. ol', '500 yıkım puanı topla', '8 cam bariyer kır'])
    expect(challengeLabel({ kind: 'shockHits', n: 3 })).toContain('Şok')
  })
})

describe('boss stars', () => {
  it('needs a win for every star', () => {
    expect(bossStars({ beaten: false, beatenLap: null, laps: 3, crushes: 0 })).toEqual([false, false, false])
    expect(bossStars({ beaten: true, beatenLap: 3, laps: 3, crushes: 2 })).toEqual([true, false, false])
    expect(bossStars({ beaten: true, beatenLap: 2, laps: 3, crushes: 0 })).toEqual([true, true, true])
    expect(bossStarLabels(3)[1]).toBe('Ejderhayı 3. tur başlamadan yen')
  })
})
