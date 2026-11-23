import { describe, expect, it } from 'vitest'
import { runBot } from '../../sim/bot'
import { PILOTS } from '../../sim/pilots'
import { buildTrack } from '../../sim/track'
import { KAOS_CIRCUITS, KAOS_TRACKS, KAOS_TRACK_IDS } from './index'

const DEG = Math.PI / 180

describe('Kaos tracks', () => {
  it('has the six neon circuits', () => {
    expect(KAOS_TRACK_IDS).toEqual(['neon1', 'neon2', 'neon3', 'neon4', 'neon5', 'neon6'])
    expect(Object.keys(KAOS_TRACKS).sort()).toEqual([...KAOS_TRACK_IDS].sort())
    const names = new Set(KAOS_TRACK_IDS.map((id) => KAOS_TRACKS[id].name))
    expect(names.size).toBe(6)
  })

  for (const id of KAOS_TRACK_IDS) {
    describe(id, () => {
      const c = KAOS_CIRCUITS[id]
      const track = buildTrack(c.def)
      const lap = track.frames.filter((f) => f.s >= c.lapLen && f.s < 2 * c.lapLen)

      it('has 3 laps of a 1.1-1.6 km loop', () => {
        expect(c.laps).toBe(3)
        expect(c.lapLen).toBeGreaterThan(1100)
        expect(c.lapLen).toBeLessThan(1600)
      })

      it('keeps slopes and bends drivable', () => {
        for (const f of lap) {
          expect(Math.abs(f.pitch)).toBeLessThan(9 * DEG)
          // radius ≥ 28 m
          expect(Math.abs(f.curvH)).toBeLessThan(1 / 28)
        }
      })

      it('never runs into itself: where the loop crosses, one road is a bridge ≥ 10 m above', () => {
        const step = 4
        const pts = lap.filter((_, i) => i % step === 0)
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const along = Math.min(Math.abs(pts[i].s - pts[j].s), c.lapLen - Math.abs(pts[i].s - pts[j].s))
            if (along < 80) continue
            const flat = Math.hypot(pts[i].pos.x - pts[j].pos.x, pts[i].pos.z - pts[j].pos.z)
            if (flat < 18 + 6) expect(Math.abs(pts[i].pos.y - pts[j].pos.y)).toBeGreaterThanOrEqual(10)
          }
        }
      })

      it('a good pilot drives the 3 laps in 90-130 s', () => {
        const g = runBot(track, PILOTS[2].skill, 5, undefined, 0, 12)
        expect(g.time).toBeGreaterThan(90)
        expect(g.time).toBeLessThan(130)
      })
    })
  }
})
