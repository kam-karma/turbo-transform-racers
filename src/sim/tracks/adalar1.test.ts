import { describe, expect, it } from 'vitest'
import { FORM_FOR } from '../forms'
import { buildTrack } from '../track'
import { ADALAR_1 } from './adalar1'

describe('Uçan Adalar 1', () => {
  const track = buildTrack(ADALAR_1)

  it('is about 3.7 km long (a ~90-120 s race)', () => {
    expect(track.length).toBeGreaterThan(3600)
    expect(track.length).toBeLessThan(3900)
  })

  it('asks for every form at least once', () => {
    const needed = new Set(ADALAR_1.sections.map((s) => FORM_FOR[s.surface]))
    expect([...needed].sort()).toEqual(['boat', 'car', 'climber', 'glider'])
  })

  it('starts and ends on road', () => {
    expect(track.surfaceAt(0)).toBe('road')
    expect(track.surfaceAt(track.length - 1)).toBe('road')
  })

  it('has coins on the track and a theme everywhere', () => {
    expect(ADALAR_1.coins.length).toBeGreaterThan(40)
    for (const c of ADALAR_1.coins) expect(c.s).toBeLessThan(track.length)
    expect(track.themeAt(0)).toBe('candy')
  })
})
