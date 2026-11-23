import { describe, expect, it } from 'vitest'
import { collide, overlaps, CAR_HALF_L, CAR_HALF_W, type Body } from './contacts'

const body = (s: number, d: number, speed: number, mass = 1, yaw = 0): Body => ({ s, d, speed, yaw, mass })

describe('overlaps', () => {
  it('is a track-space box test against a box at (s, d) with half sizes', () => {
    expect(overlaps(body(100, 0, 0), 100 + CAR_HALF_L + 0.4, 0, 0.5, 0.5)).toBe(true)
    expect(overlaps(body(100, 0, 0), 100 + CAR_HALF_L + 0.6, 0, 0.5, 0.5)).toBe(false)
    expect(overlaps(body(100, 0, 0), 100, CAR_HALF_W + 1.1, 1, 1)).toBe(false)
  })
})

describe('collide', () => {
  it('returns null when the cars do not touch', () => {
    expect(collide(body(100, 0, 30), body(100, 2 * CAR_HALF_W + 0.1, 30))).toBeNull()
    expect(collide(body(100, 0, 30), body(100 + 2 * CAR_HALF_L + 0.1, 0, 30))).toBeNull()
  })

  it('pushes cars side by side apart sideways, the lighter one further', () => {
    const r = collide(body(100, 0, 30, 1.6), body(100.5, 1.6, 30, 1))
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.side).toBe(true)
    expect(r.a.push).toBeLessThan(0)
    expect(r.b.push).toBeGreaterThan(0)
    expect(Math.abs(r.b.push)).toBeGreaterThan(Math.abs(r.a.push))
    // separated after the shift
    expect((1.6 + r.b.dd) - (0 + r.a.dd)).toBeGreaterThanOrEqual(2 * CAR_HALF_W - 1e-9)
  })

  it('a harder side hit pushes harder', () => {
    const soft = collide(body(100, 0, 30), body(100, 1.8, 30))
    const hard = collide(body(100, 0, 30, 1, 0.4), body(100, 1.8, 30))
    expect(soft).not.toBeNull()
    expect(hard).not.toBeNull()
    if (soft === null || hard === null) return
    expect(Math.abs(hard.b.push)).toBeGreaterThan(Math.abs(soft.b.push))
    expect(hard.force).toBeGreaterThan(soft.force)
  })

  it('a rear-end hit slows the car behind, speeds up the one in front and separates them', () => {
    const r = collide(body(100, 0, 40), body(103, 0.3, 25))
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.side).toBe(false)
    expect(r.a.dSpeed).toBeLessThan(0)
    expect(r.b.dSpeed).toBeGreaterThan(0)
    const momentum = 40 + 25
    const after = 40 + r.a.dSpeed + 25 + r.b.dSpeed
    expect(Math.abs(after - momentum)).toBeLessThan(1e-6)
    expect((103 + r.b.ds) - (100 + r.a.ds)).toBeGreaterThanOrEqual(2 * CAR_HALF_L - 1e-9)
  })

  it('is symmetric in which car is passed first', () => {
    const r1 = collide(body(100, 0, 30), body(100.5, 1.6, 30))
    const r2 = collide(body(100.5, 1.6, 30), body(100, 0, 30))
    expect(r1?.a.push).toBeCloseTo(r2?.b.push ?? NaN)
  })
})
