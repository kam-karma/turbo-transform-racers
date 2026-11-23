import { describe, expect, it } from 'vitest'
import { TouchTracker, touchSteer } from './touchMath'

describe('touchSteer', () => {
  const W = 1000

  it('ignores tiny movements inside the dead zone', () => {
    expect(touchSteer(200, 215, W)).toBe(0)
    expect(touchSteer(200, 185, W)).toBe(0)
  })

  it('steers right when the finger moves right, left when it moves left (+1 = left)', () => {
    expect(touchSteer(200, 290, W)).toBeLessThan(0)
    expect(touchSteer(200, 110, W)).toBeGreaterThan(0)
  })

  it('reaches full lock at 18% of the screen width and clamps beyond', () => {
    expect(touchSteer(200, 380, W)).toBeCloseTo(-1)
    expect(touchSteer(200, 900, W)).toBe(-1)
    expect(touchSteer(500, 0, W)).toBe(1)
  })
})

describe('TouchTracker (Review Focus 5: several fingers)', () => {
  const W = 1000

  it('a finger on the left half gives gas and steers by dragging', () => {
    const t = new TouchTracker()
    t.down(1, 200, W)
    expect(t.state()).toEqual({ gas: true, steer: 0 })
    t.move(1, 380)
    expect(t.state().steer).toBeCloseTo(-1)
  })

  it('a finger on the right half does not drive (it is for form buttons)', () => {
    const t = new TouchTracker()
    t.down(2, 800, W)
    expect(t.state()).toEqual({ gas: false, steer: 0 })
  })

  it('a right-hand finger does not disturb the driving finger', () => {
    const t = new TouchTracker()
    t.down(1, 200, W)
    t.move(1, 110)
    const before = t.state()
    t.down(2, 850, W)
    t.move(2, 600)
    t.up(2)
    expect(t.state()).toEqual(before)
  })

  it('lifting the driving finger stops the gas and centres the steering', () => {
    const t = new TouchTracker()
    t.down(1, 200, W)
    t.move(1, 300)
    t.up(1)
    expect(t.state()).toEqual({ gas: false, steer: 0 })
  })

  it('a second left finger takes over when the first lifts', () => {
    const t = new TouchTracker()
    t.down(1, 200, W)
    t.down(3, 300, W)
    t.up(1)
    expect(t.state().gas).toBe(true)
  })
})
