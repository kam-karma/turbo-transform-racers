import { describe, expect, it } from 'vitest'
import { ShockMeter, ShockWave, shockKnock, SHOCK_RADIUS, SHOCK_LIFE } from './shock'

describe('ShockMeter', () => {
  it('fills up to 1 and fires only when full', () => {
    const m = new ShockMeter()
    m.add(0.6)
    expect(m.ready).toBe(false)
    expect(m.fire()).toBe(false)
    m.add(0.6)
    expect(m.value).toBe(1)
    expect(m.ready).toBe(true)
    expect(m.fire()).toBe(true)
    expect(m.value).toBe(0)
  })

  it('ignores negative and non-finite amounts', () => {
    const m = new ShockMeter()
    m.add(-1)
    m.add(Number.NaN)
    expect(m.value).toBe(0)
  })
})

describe('ShockWave', () => {
  it('grows to its full radius and then dies', () => {
    const w = new ShockWave()
    expect(w.radius).toBe(0)
    w.step(0.1)
    expect(w.radius).toBeGreaterThan(0)
    expect(w.radius).toBeLessThan(SHOCK_RADIUS)
    w.step(SHOCK_LIFE)
    expect(w.radius).toBe(SHOCK_RADIUS)
    expect(w.alive).toBe(false)
  })

  it('hits each target once, when the ring reaches it', () => {
    const w = new ShockWave()
    w.step(0.05)
    expect(w.reach('bot1', 20)).toBe(false)
    w.step(0.4)
    expect(w.reach('bot1', 20)).toBe(true)
    expect(w.reach('bot1', 20)).toBe(false)
    expect(w.reach('bot2', SHOCK_RADIUS + 1)).toBe(false)
  })
})

describe('shockKnock', () => {
  it('throws a target away from the centre, harder when close', () => {
    const near = shockKnock(0, 0, 3, 2)
    const far = shockKnock(0, 0, 3, 18)
    expect(near.push).toBeGreaterThan(0)
    expect(far.push).toBeGreaterThan(0)
    expect(near.push).toBeGreaterThan(far.push)
    expect(shockKnock(0, 0, 3, -2).push).toBeLessThan(0)
    expect(near.hop).toBeGreaterThan(0)
    expect(near.keep).toBeLessThan(1)
  })

  it('picks a side even for a target dead ahead', () => {
    expect(Math.abs(shockKnock(0, 0, 10, 0).push)).toBeGreaterThan(5)
  })
})
