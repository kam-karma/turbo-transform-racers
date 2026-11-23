import { describe, expect, it } from 'vitest'
import { FORM_FOR, PERFECT_WINDOW, formSpeedMul, judgeSwitch } from './forms'

describe('forms', () => {
  it('maps each surface to the form it needs', () => {
    expect(FORM_FOR).toEqual({ road: 'car', ice: 'car', water: 'boat', gap: 'glider', climb: 'climber' })
  })

  it('runs full speed only in the right form', () => {
    expect(formSpeedMul('car', 'road')).toBe(1)
    expect(formSpeedMul('boat', 'water')).toBeCloseTo(1.05)
    expect(formSpeedMul('car', 'water')).toBeCloseTo(0.3)
    expect(formSpeedMul('boat', 'road')).toBeCloseTo(0.4)
    expect(formSpeedMul('glider', 'road')).toBeCloseTo(0.55)
    expect(formSpeedMul('climber', 'climb')).toBe(1)
    expect(formSpeedMul('car', 'climb')).toBeCloseTo(0.25)
  })

  it('has a 0.3 s perfect window', () => {
    expect(PERFECT_WINDOW).toBe(0.3)
  })

  it('judges a switch inside the window before the boundary as perfect', () => {
    expect(judgeSwitch(0.2, 'boat', 'water')).toBe('perfect')
    expect(judgeSwitch(0, 'boat', 'water')).toBe('perfect')
    expect(judgeSwitch(0.3, 'boat', 'water')).toBe('perfect')
  })

  it('judges earlier switches as early and switches after the boundary as late', () => {
    expect(judgeSwitch(0.31, 'boat', 'water')).toBe('early')
    expect(judgeSwitch(-0.1, 'boat', 'water')).toBe('late')
  })

  it('gives no verdict for the wrong form', () => {
    expect(judgeSwitch(0.2, 'glider', 'water')).toBe('none')
  })
})
