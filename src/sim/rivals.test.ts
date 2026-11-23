import { describe, expect, it } from 'vitest'
import { FIRST_RACE_STRETCH, pickRivals } from './rivals'

const times = [85, 87, 90, 94, 93, 94, 93, 96, 99, 102, 100, 106, 108, 112, 113]
const ghosts = times.map((time, i) => ({ id: `p${i}`, time }))

describe('pickRivals', () => {
  it('picks the five slowest pilots, slowed down, for the very first race', () => {
    const r = pickRivals(ghosts, null)
    expect(r.map((x) => x.id).sort()).toEqual(['p11', 'p12', 'p13', 'p14', 'p9'].sort())
    for (const x of r) expect(x.stretch).toBe(FIRST_RACE_STRETCH)
    expect(FIRST_RACE_STRETCH).toBeGreaterThan(1)
  })

  it('surrounds the player: two a bit slower, two a bit faster, one clearly faster', () => {
    const r = pickRivals(ghosts, 101)
    const t = r.map((x) => ghosts.find((g) => g.id === x.id)!.time)
    expect(r).toHaveLength(5)
    expect(t.filter((x) => x > 101)).toHaveLength(2)
    expect(t.filter((x) => x < 101)).toHaveLength(3)
    expect(Math.min(...t)).toBeLessThanOrEqual(97)
    for (const x of r) expect(x.stretch).toBe(1)
  })

  it('still fills five places when the player beats everyone', () => {
    const r = pickRivals(ghosts, 60)
    expect(r).toHaveLength(5)
    expect(new Set(r.map((x) => x.id)).size).toBe(5)
  })

  it('still fills five places when the player is slower than everyone', () => {
    expect(pickRivals(ghosts, 200)).toHaveLength(5)
  })
})
