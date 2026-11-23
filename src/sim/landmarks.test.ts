import { describe, expect, it } from 'vitest'
import { placeLandmarks } from './landmarks'
import { buildTrack } from './track'
import { ADALAR_1 } from './tracks/adalar1'
import { len, sub } from './vec'

const track = buildTrack(ADALAR_1)

describe('placeLandmarks', () => {
  const spots = placeLandmarks(track, 'candy', { count: 8, minSize: 24, maxSize: 60, seed: 4 })

  it('places the asked number of landmarks, only beside the asked theme', () => {
    expect(spots).toHaveLength(8)
    for (const p of spots) expect(track.themeAt(p.s)).toBe('candy')
  })

  it('keeps every landmark clear of the whole road (footprint never within 14 m of the centre line)', () => {
    for (const p of spots) {
      let nearest = Infinity
      for (let s = 0; s <= track.length; s += 4) nearest = Math.min(nearest, len(sub(track.frameAt(s).pos, p.pos)))
      expect(nearest - p.size * 0.5).toBeGreaterThan(14)
    }
  })

  it('sizes them within range and is deterministic', () => {
    for (const p of spots) {
      expect(p.size).toBeGreaterThanOrEqual(24)
      expect(p.size).toBeLessThanOrEqual(60)
    }
    expect(placeLandmarks(track, 'candy', { count: 8, minSize: 24, maxSize: 60, seed: 4 })).toEqual(spots)
  })
})
