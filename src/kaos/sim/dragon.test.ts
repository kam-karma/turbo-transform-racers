import { describe, expect, it } from 'vitest'
import { rng } from '../../sim/bot'
import { Dragon, FALL_T, OPEN_DELAY, RETURN_T, SIT_T, type DragonEvent } from './dragon'

const cfg = { maxHealth: 100, damage: 10, width: 18 }
const player = (s: number, d = 0) => ({ s, d, speed: 35, yaw: 0, mass: 1.6 })

/** Steps the dragon with the player parked far away until `pred` holds. */
function runUntil(dr: Dragon, p: ReturnType<typeof player>, pred: (ev: DragonEvent[]) => boolean, max = 30): DragonEvent[] {
  for (let t = 0; t < max; t += 1 / 60) {
    const ev: DragonEvent[] = []
    dr.step(1 / 60, p, ev)
    if (pred(ev)) return ev
  }
  throw new Error('condition never met')
}

describe('Dragon', () => {
  it('starts throwing after the opening delay, landing blocks on the road ahead', () => {
    const dr = new Dragon(cfg, rng(1))
    const ev: DragonEvent[] = []
    dr.step(OPEN_DELAY - 0.1, player(100), ev)
    expect(ev.filter((e) => e.kind === 'throw')).toEqual([])
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'throw'))
    const b = dr.blocks[0]
    expect(b.s).toBeGreaterThan(100 + 30)
    expect(Math.abs(b.d)).toBeLessThanOrEqual(cfg.width / 2 - 1.5)
    expect(b.phase).toBe('falling')
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'land'), FALL_T + 0.2)
    expect(dr.blocks[0].phase).toBe('sitting')
  })

  it('a block driven through flies back and hurts the dragon', () => {
    const dr = new Dragon(cfg, rng(2))
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'land'))
    const b = dr.blocks[0]
    const ev: DragonEvent[] = []
    dr.step(1 / 60, player(b.s, b.d), ev)
    expect(ev.some((e) => e.kind === 'bounce' && e.id === b.id)).toBe(true)
    expect(dr.health).toBe(100)
    runUntil(dr, player(b.s + 500), (e) => e.some((x) => x.kind === 'damage'), RETURN_T + 0.2)
    expect(dr.health).toBe(90)
  })

  it('a block landing on the player crushes the run (and is gone)', () => {
    const dr = new Dragon(cfg, rng(3))
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'throw'))
    const b = dr.blocks[0]
    const ev = runUntil(dr, player(b.s, b.d), (e) => e.some((x) => x.kind === 'crush'), FALL_T + 0.2)
    const crush = ev.find((e) => e.kind === 'crush')
    expect(crush !== undefined && 'id' in crush ? crush.id : -1).toBe(b.id)
    expect(dr.blocks.find((x) => x.id === b.id)).toBeUndefined()
  })

  it('sitting blocks fade away when nobody hits them', () => {
    const dr = new Dragon(cfg, rng(4))
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'land'))
    const id = dr.blocks[0].id
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'expire' && x.id === id), SIT_T + 0.5)
  })

  it('a shock wave bounces every block in reach, falling or sitting', () => {
    const dr = new Dragon(cfg, rng(5))
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'land'))
    runUntil(dr, player(100), (e) => e.some((x) => x.kind === 'throw'))
    const ids = dr.blocks.map((b) => b.id)
    const ev: DragonEvent[] = []
    const n = dr.bounceWithin(dr.blocks[0].s, 0, 200, ev)
    expect(n).toBe(ids.length)
    expect(dr.blocks.every((b) => b.phase === 'returning')).toBe(true)
  })

  it('enough hits beat it; a beaten dragon throws nothing more', () => {
    const dr = new Dragon(cfg, rng(6))
    const seen = new Set<string>()
    let p = player(100)
    for (let i = 0; i < 60 * 120 && !dr.beaten; i++) {
      const ev: DragonEvent[] = []
      const sitting = dr.blocks.find((b) => b.phase === 'sitting')
      if (sitting !== undefined) p = player(sitting.s, sitting.d)
      dr.step(1 / 60, p, ev)
      for (const e of ev) seen.add(e.kind)
    }
    expect(dr.beaten).toBe(true)
    expect(dr.health).toBe(0)
    expect(seen.has('beaten')).toBe(true)
    expect(seen.has('enrage')).toBe(true)
    const ev: DragonEvent[] = []
    for (let i = 0; i < 600; i++) dr.step(1 / 60, p, ev)
    expect(ev.some((e) => e.kind === 'throw')).toBe(false)
  })

  it('throws bigger volleys as it gets angry', () => {
    const calm = new Dragon(cfg, rng(7))
    const angry = new Dragon({ ...cfg, maxHealth: 100 }, rng(7))
    angry.health = 20
    const count = (dr: Dragon): number => {
      let n = 0
      for (let i = 0; i < 60 * 12; i++) {
        const ev: DragonEvent[] = []
        dr.step(1 / 60, player(100 + i * 0.5), ev)
        n += ev.filter((e) => e.kind === 'throw').length
      }
      return n
    }
    expect(count(angry)).toBeGreaterThan(count(calm) * 1.8)
  })
})
