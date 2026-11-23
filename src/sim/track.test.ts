import { describe, expect, it } from 'vitest'
import { buildTrack, type TrackDef } from './track'
import { pathTrack } from './trackPath'
import { len, sub } from './vec'

const def: TrackDef = pathTrack('t', 'Test', [
  { len: 200, surface: 'road', boost: true },
  { len: 100, surface: 'water', turn: 60 },
  { len: 100, surface: 'road', pitchTo: 10 },
  { len: 50, surface: 'gap', pitchTo: -15 },
  { len: 150, surface: 'ice', pitchTo: 0, turn: -90 },
  { len: 80, surface: 'climb', pitchTo: 28 },
  { len: 120, surface: 'road', pitchTo: 0 },
])

describe('pathTrack', () => {
  it('lays out sections back to back from the piece list', () => {
    expect(def.sections.map((s) => s.len)).toEqual([200, 100, 100, 50, 150, 80, 120])
    expect(def.points.length).toBeGreaterThan(100)
  })
})

describe('buildTrack', () => {
  const track = buildTrack(def)

  it('is as long as the control polyline (±1%)', () => {
    let poly = 0
    for (let i = 1; i < def.points.length; i++) poly += len(sub(def.points[i], def.points[i - 1]))
    expect(Math.abs(track.length - poly) / poly).toBeLessThan(0.01)
    expect(Math.abs(track.length - 800) / 800).toBeLessThan(0.01)
  })

  it('has unit tangents and an orthonormal frame', () => {
    for (const s of [0, 123.4, 400, track.length]) {
      const f = track.frameAt(s)
      expect(len(f.t)).toBeCloseTo(1, 5)
      expect(len(f.up)).toBeCloseTo(1, 5)
      expect(len(f.left)).toBeCloseTo(1, 5)
    }
  })

  it('reads the surface of each section', () => {
    expect(track.surfaceAt(10)).toBe('road')
    expect(track.surfaceAt(250)).toBe('water')
    expect(track.surfaceAt(420)).toBe('gap')
    expect(track.surfaceAt(650)).toBe('climb')
    expect(track.surfaceAt(700)).toBe('road')
    expect(track.surfaceAt(99999)).toBe('road')
  })

  it('finds the next change of needed form, skipping road to ice', () => {
    expect(track.nextBoundary(10)).toEqual({ s: 200, surface: 'water' })
    expect(track.nextBoundary(250)).toEqual({ s: 300, surface: 'road' })
    expect(track.nextBoundary(460)).toEqual({ s: 600, surface: 'climb' })
    expect(track.nextBoundary(790)).toBeNull()
  })

  it('reports boost pads only where the section has them', () => {
    expect(track.boostAt(5)).toBe(true)
    expect(track.boostAt(29)).toBe(true)
    expect(track.boostAt(80)).toBe(false)
    expect(track.boostAt(250)).toBe(false)
  })

  it('respawns a fall in a gap on the road before it, at least 10 m into that road', () => {
    const s = track.respawnS(420)
    expect(s).toBeGreaterThanOrEqual(310)
    expect(s).toBeLessThan(400)
  })

  it('climbs: the climb section pitches up steeply', () => {
    expect(track.frameAt(670).pitch).toBeGreaterThan((20 * Math.PI) / 180)
  })
})
