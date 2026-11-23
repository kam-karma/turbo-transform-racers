import { describe, expect, it } from 'vitest'
import { buildTrack } from './track'
import { formBoundaries, planTrackside, START_GATE_S } from './landmarksTrackside'
import { TRACKS } from './tracks/index'

describe.each(Object.keys(TRACKS))('trackside plan on %s', (id) => {
  const track = buildTrack(TRACKS[id])
  const plan = planTrackside(track)

  it('has a start gate ahead of the grid and a finish gate at the line', () => {
    expect(plan.gates.map((g) => g.kind)).toEqual(['start', 'finish'])
    expect(plan.gates[0].s).toBe(START_GATE_S)
    expect(track.length - plan.gates[1].s).toBeLessThan(10)
  })

  it('puts arches over road or water only, never close to a change of form', () => {
    expect(plan.arches.length).toBeGreaterThanOrEqual(6)
    const bounds = formBoundaries(track)
    for (const a of plan.arches) {
      expect(['road', 'ice', 'water']).toContain(track.surfaceAt(a.s))
      for (const b of bounds) expect(Math.abs(b.s - a.s)).toBeGreaterThanOrEqual(30)
    }
  })

  it('hangs a ring over every gap and at every boost pad', () => {
    const gaps = track.def.sections.filter((s) => s.surface === 'gap').length
    const glide = plan.rings.filter((r) => r.kind === 'glide')
    expect(glide.length).toBeGreaterThanOrEqual(gaps)
    for (const r of glide) expect(track.surfaceAt(r.s)).toBe('gap')
    for (const r of plan.rings.filter((x) => x.kind === 'boost')) expect(track.boostAt(r.s)).toBe(true)
  })

  it('announces every change of form with a sign ahead of it', () => {
    const all = formBoundaries(track)
    const bounds = all.filter((b, i) => b.s > 100 && (i === 0 || all[i - 1].s < b.s - 85))
    expect(plan.formSigns.map((f) => f.boundary)).toEqual(bounds.map((b) => b.s))
    expect(plan.formSigns.length).toBeGreaterThanOrEqual(4)
    // No other change of form between a sign and the change it announces.
    for (const f of plan.formSigns) expect(all.some((b) => b.s > f.s && b.s < f.boundary)).toBe(false)
    for (const f of plan.formSigns) expect(f.boundary - f.s).toBeGreaterThan(50)
  })

  it('keeps balconies on solid road, clear of gates and arches', () => {
    expect(plan.balconies.length).toBeGreaterThan(40)
    for (const b of plan.balconies) {
      expect(['road', 'ice']).toContain(track.surfaceAt(b.s))
      for (const g of plan.gates) expect(Math.abs(g.s - b.s)).toBeGreaterThanOrEqual(26)
      for (const a of plan.arches) expect(Math.abs(a.s - b.s)).toBeGreaterThanOrEqual(12)
    }
  })

  it('puts chevron boards on the outside of bends', () => {
    expect(plan.boards.length).toBeGreaterThanOrEqual(8)
    for (const b of plan.boards) expect(b.side).toBe(b.left ? -1 : 1)
  })

  it('thins roadside props on Low quality', () => {
    const low = planTrackside(track, 0.5)
    expect(low.balconies.length).toBeLessThan(plan.balconies.length * 0.7)
    expect(low.arches.length).toBe(plan.arches.length)
  })
})
