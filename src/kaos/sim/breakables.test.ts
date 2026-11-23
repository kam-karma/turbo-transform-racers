import { describe, expect, it } from 'vitest'
import { BreakField, layoutBreakables, REBUILD_S, START_CLEAR, END_CLEAR } from './breakables'

describe('layoutBreakables', () => {
  const items = layoutBreakables(1300, 18, 7)

  it('is deterministic for a seed', () => {
    expect(layoutBreakables(1300, 18, 7)).toEqual(items)
    expect(layoutBreakables(1300, 18, 8)).not.toEqual(items)
  })

  it('fills a lap with all three kinds', () => {
    expect(items.length).toBeGreaterThanOrEqual(30)
    const kinds = new Set(items.map((i) => i.kind))
    expect(kinds).toEqual(new Set(['block', 'sign', 'glass']))
    expect(items.map((i) => i.id)).toEqual(items.map((_, k) => k))
  })

  it('keeps everything on the road and off the start grid', () => {
    for (const it of items) {
      expect(Math.abs(it.d) + it.halfW).toBeLessThanOrEqual(18 / 2 - 0.9)
      expect(it.s).toBeGreaterThanOrEqual(START_CLEAR)
      expect(it.s).toBeLessThanOrEqual(1300 - END_CLEAR)
    }
  })

  it('always leaves a car-wide way through every cluster', () => {
    const clusters = new Map<number, typeof items>()
    for (const it of items) {
      const key = it.cluster * 1000 + Math.round(it.s / 4)
      clusters.set(key, [...(clusters.get(key) ?? []), it])
    }
    for (const group of clusters.values()) {
      // per row of the cluster, scan the road across in 0.25 m steps for a 2.6 m gap free of any item of the cluster
      let run = 0
      let best = 0
      for (let d = -8.1; d <= 8.1; d += 0.25) {
        const blocked = group.some((g) => Math.abs(g.d - d) < g.halfW)
        run = blocked ? 0 : run + 0.25
        best = Math.max(best, run)
      }
      expect(best).toBeGreaterThanOrEqual(2.6)
    }
  })
})

describe('BreakField', () => {
  const items = layoutBreakables(1300, 18, 3)
  const target = items.find((i) => i.kind === 'sign') ?? items[0]
  const car = (s: number, d: number) => ({ s, d, speed: 30, yaw: 0, mass: 1 })

  it('smashes an item a car drives into, once', () => {
    const f = new BreakField(items)
    expect(f.hits(car(target.s, target.d), 0)).toEqual([target.id])
    expect(f.isBroken(target.id)).toBe(true)
    expect(f.hits(car(target.s, target.d), 0.1)).toEqual([])
  })

  it('misses items out of reach', () => {
    const f = new BreakField(items)
    expect(f.hits(car(target.s - 10, target.d), 0)).toEqual([])
  })

  it('rebuilds smashed items after a while (hologram rebuild)', () => {
    const f = new BreakField(items)
    f.hits(car(target.s, target.d), 5)
    expect(f.rebuild(5 + REBUILD_S - 0.1)).toEqual([])
    expect(f.rebuild(5 + REBUILD_S + 0.1)).toEqual([target.id])
    expect(f.isBroken(target.id)).toBe(false)
  })

  it('smashes everything within a radius (shock wave)', () => {
    const f = new BreakField(items)
    const ids = f.within(target.s, target.d, 12, 1)
    expect(ids).toContain(target.id)
    for (const id of ids) {
      const it = items[id]
      expect(Math.hypot(it.s - target.s, it.d - target.d)).toBeLessThanOrEqual(12)
    }
    expect(f.within(target.s, target.d, 12, 1.1)).toEqual([])
  })

  it('reset makes every item whole again', () => {
    const f = new BreakField(items)
    f.hits(car(target.s, target.d), 0)
    f.reset()
    expect(f.isBroken(target.id)).toBe(false)
  })
})
