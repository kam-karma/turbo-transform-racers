import { describe, expect, it } from 'vitest'
import { FORM_FOR } from '../forms'
import { buildTrack, type Track } from '../track'
import { adalarTrack, TRACKS } from './index'
import type { TrackVariant } from './variants'

const LAYOUTS: TrackVariant[] = ['normal', 'reverse', 'mirror']

/** Smallest clearance between two stretches of road more than 80 m apart along s. */
function crossings(track: Track): { s1: number; s2: number; h: number; v: number }[] {
  const pts = []
  for (let s = 0; s <= track.length; s += 8) pts.push({ s, p: track.frameAt(s).pos })
  const bad: { s1: number; s2: number; h: number; v: number }[] = []
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[j].s - pts[i].s < 90) continue
      const a = pts[i].p
      const b = pts[j].p
      const h = Math.hypot(a.x - b.x, a.z - b.z)
      const v = Math.abs(a.y - b.y)
      if (h < 34 && v < 14) bad.push({ s1: pts[i].s, s2: pts[j].s, h, v })
    }
  }
  return bad
}

describe.each(Object.keys(TRACKS))('Adalar track %s', (id) => {
  describe.each(LAYOUTS)('%s', (variant) => {
    const def = adalarTrack(id, variant)
    const track = buildTrack(def)

    it('is 3.4-4 km long', () => {
      expect(track.length).toBeGreaterThan(3400)
      expect(track.length).toBeLessThan(4000)
    })

    it('asks for all four forms and uses all four island themes', () => {
      expect(new Set(def.sections.map((s) => FORM_FOR[s.surface])).size).toBe(4)
      const themes = new Set<string>()
      for (let s = 0; s < track.length; s += 20) themes.add(track.themeAt(s))
      expect(themes.size).toBe(4)
    })

    it('starts and ends on level road', () => {
      expect(track.surfaceAt(5)).toBe('road')
      expect(track.surfaceAt(track.length - 5)).toBe('road')
      expect(Math.abs(track.frameAt(30).pitch)).toBeLessThan(0.05)
    })

    it('climbing walls go up', () => {
      let acc = 0
      def.sections.forEach((sec) => {
        if (sec.surface === 'climb') expect(track.frameAt(acc + sec.len * 0.7).pitch).toBeGreaterThan(0.25)
        acc += sec.len
      })
    })

    it('road never gets steep outside the climbing walls', () => {
      for (let s = 0; s < track.length; s += 4) {
        if (track.surfaceAt(s) === 'road' || track.surfaceAt(s) === 'ice' || track.surfaceAt(s) === 'water') {
          const pitchDeg = (track.frameAt(s).pitch * 180) / Math.PI
          // Right after a wall the crest eases down from the climb angle.
          const nearClimb = [-1, 1].some((k) => [20, 40, 60, 80, 100, 120].some((ds) => track.surfaceAt(s + k * ds) === 'climb'))
          if (!nearClimb) expect(Math.abs(pitchDeg)).toBeLessThan(16)
        }
      }
    })

    it('stays between the cloud sea and the sky', () => {
      let lo = Infinity
      let hi = -Infinity
      for (const f of track.frames) {
        lo = Math.min(lo, f.pos.y)
        hi = Math.max(hi, f.pos.y)
      }
      expect(lo).toBeGreaterThan(-100)
      expect(hi).toBeLessThan(120)
    })

    it('never runs into itself (crossings are bridges at least 14 m apart)', () => {
      expect(crossings(track)).toEqual([])
    })

    it('has plenty of coins, all on the track', () => {
      expect(def.coins.length).toBeGreaterThan(40)
      for (const c of def.coins) expect(c.s).toBeLessThan(track.length)
    })
  })
})

describe('layouts are distinct', () => {
  it('no two tracks share their section sequence', () => {
    const keys = Object.values(TRACKS).map((d) => d.sections.map((s) => `${s.surface}${s.len}`).join(','))
    expect(new Set(keys).size).toBe(keys.length)
  })
})
