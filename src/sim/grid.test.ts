import { describe, expect, it } from 'vitest'
import { GHOST_SLOTS, PLAYER_SLOT, ghostSlot } from './grid'

describe('grid', () => {
  it('puts the player in front and every ghost slot behind, within the road', () => {
    for (const g of GHOST_SLOTS) {
      expect(g.s).toBeLessThan(PLAYER_SLOT.s)
      expect(Math.abs(g.d)).toBeLessThanOrEqual(5)
    }
  })

  it('cycles slots for any pilot index', () => {
    expect(ghostSlot(0)).toEqual(GHOST_SLOTS[0])
    expect(ghostSlot(7)).toEqual(GHOST_SLOTS[2])
    expect(ghostSlot(-1)).toEqual(GHOST_SLOTS[4])
  })

  it('leaves room for two cars side by side (no two slots closer than 2 m)', () => {
    const all = [PLAYER_SLOT, ...GHOST_SLOTS]
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i].s - all[j].s, all[i].d - all[j].d)).toBeGreaterThanOrEqual(2)
    }
  })
})
