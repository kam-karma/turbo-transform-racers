import { describe, expect, it } from 'vitest'
import { pickStyle } from './carLookParts'
import { formArc } from '../ui/hudForms'

describe('pickStyle', () => {
  const styles = ['lip', 'classic', 'gt', 'twin'] as const
  it('maps catalog part ids to their style', () => {
    expect(pickStyle('spoiler-cift', styles)).toBe('twin')
    expect(pickStyle('spoiler-jet', styles)).toBe('gt')
  })
  it('matches style names inside unknown ids and hashes the rest stably', () => {
    expect(pickStyle('my-gt-wing', styles)).toBe('gt')
    const a = pickStyle('mystery-part', styles)
    expect(styles).toContain(a)
    expect(pickStyle('mystery-part', styles)).toBe(a)
  })
})

describe('formArc', () => {
  it('lays four buttons on a quarter arc from the bottom-right corner', () => {
    const pts = [0, 1, 2, 3].map((i) => formArc(i, 4))
    expect(pts[0]!.bottom).toBe(62)
    expect(pts[3]!.right).toBe(62)
    for (let i = 1; i < 4; i++) {
      expect(pts[i]!.right).toBeLessThan(pts[i - 1]!.right)
      expect(pts[i]!.bottom).toBeGreaterThan(pts[i - 1]!.bottom)
    }
  })
})
