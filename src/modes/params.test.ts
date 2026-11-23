import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/racer'
import { paramsFromStats } from './params'

describe('paramsFromStats', () => {
  it('maps an average car (5/5/5) to the tuned A0 physics', () => {
    const p = paramsFromStats({ speed: 5, accel: 5, handling: 5 })
    expect(p.vmax).toBeCloseTo(DEFAULT_PARAMS.vmax, 0)
    expect(p.accel).toBeCloseTo(DEFAULT_PARAMS.accel, 0)
    expect(p.steerRate).toBeCloseTo(DEFAULT_PARAMS.steerRate, 1)
    expect(p.grip).toBeCloseTo(DEFAULT_PARAMS.grip, 1)
  })

  it('makes a faster car faster and a nimbler car steer quicker', () => {
    const slow = paramsFromStats({ speed: 3, accel: 3, handling: 3 })
    const fast = paramsFromStats({ speed: 9, accel: 9, handling: 9 })
    expect(fast.vmax).toBeGreaterThan(slow.vmax)
    expect(fast.accel).toBeGreaterThan(slow.accel)
    expect(fast.steerRate).toBeGreaterThan(slow.steerRate)
  })

  it('keeps upgraded stats beyond 10 within playable limits', () => {
    const p = paramsFromStats({ speed: 14, accel: 14, handling: 14 })
    expect(p.vmax).toBeLessThanOrEqual(52)
    expect(p.grip).toBeLessThanOrEqual(1.3)
  })
})
