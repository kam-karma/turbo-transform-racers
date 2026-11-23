import { describe, expect, it } from 'vitest'
import { nodePoints } from './cupMap'
import { resultTitle, rowInitial } from './resultsText'

describe('resultTitle', () => {
  it('celebrates podium places', () => {
    expect(resultTitle({ place: 1 }, false)).toEqual({ text: 'BİRİNCİ OLDUN!', icon: 'trophy-gold' })
    expect(resultTitle({ place: 3 }, false).icon).toBe('trophy-bronze')
    expect(resultTitle({ place: 5 }, false).text).toBe('5. oldun')
  })
  it('talks about the boss on boss races', () => {
    expect(resultTitle({ place: 1, bossBeaten: true }, true).text).toContain('BOSS')
    expect(resultTitle({ place: 1, bossBeaten: false }, true).icon).toBe('boss')
  })
})

describe('rowInitial', () => {
  it('takes the first letter, Turkish upper case, skipping symbols', () => {
    expect(rowInitial('ışık')).toBe('I')
    expect(rowInitial('iclal')).toBe('İ')
    expect(rowInitial('  ⭐ Zeynep')).toBe('Z')
    expect(rowInitial('')).toBe('?')
  })
})

describe('nodePoints', () => {
  it('spreads nodes left to right inside the map', () => {
    const pts = nodePoints(6)
    expect(pts).toHaveLength(6)
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.x).toBeGreaterThan(pts[i - 1]!.x)
    for (const p of pts) {
      expect(p.y).toBeGreaterThan(10)
      expect(p.y).toBeLessThan(90)
    }
  })
})
