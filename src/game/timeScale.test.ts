import { describe, expect, it } from 'vitest'
import { TimeScale } from './timeScale'

describe('TimeScale', () => {
  it('runs at normal speed until triggered', () => {
    expect(new TimeScale().step(0.016)).toBeCloseTo(0.016)
  })

  it('slows to half speed for 0.4 s of real time, then returns to normal', () => {
    const ts = new TimeScale()
    expect(ts.trigger()).toBe(true)
    ts.step(0.1)
    expect(ts.step(0.1)).toBeCloseTo(0.05)
    ts.step(0.25)
    expect(ts.step(0.1)).toBeCloseTo(0.1)
  })

  it('never slows more than 0.4 s and ignores a new trigger within 2 s', () => {
    const ts = new TimeScale()
    ts.trigger(0.5, 3)
    ts.step(0.5)
    expect(ts.step(0.1)).toBeCloseTo(0.1)
    expect(ts.trigger()).toBe(false)
    ts.step(2)
    expect(ts.trigger()).toBe(true)
  })

  it('never slows below half speed', () => {
    const ts = new TimeScale()
    ts.trigger(0.1)
    ts.step(0.1)
    expect(ts.step(0.1)).toBeCloseTo(0.05)
  })
})
