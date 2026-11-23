import { describe, expect, it } from 'vitest'
import { CUPS, TIERS, WORLDS, WORLD_INFO, cupById, cupsOfWorld, isCupId, raceById, trackPrefix } from './cups'

describe('cups', () => {
  it('has 9 cups: every world in bronz, gümüş and altın', () => {
    expect(CUPS).toHaveLength(9)
    for (const world of WORLDS) for (const tier of TIERS) expect(cupById(`${world}-${tier}`)).toBeDefined()
    expect(cupsOfWorld('adalar').map((c) => c.tier)).toEqual(['bronz', 'gumus', 'altin'])
  })

  it('maps worlds to cup modes', () => {
    expect(cupById('adalar-bronz')!.mode).toBe('transform')
    expect(cupById('dev-ev-gumus')!.mode).toBe('build')
    expect(cupById('neon-altin')!.mode).toBe('chaos')
    for (const w of WORLDS) expect(WORLD_INFO[w].name.length).toBeGreaterThan(2)
  })

  it('puts 5 races and a boss last in every cup', () => {
    const ids = new Set<string>()
    for (const cup of CUPS) {
      expect(cup.races).toHaveLength(6)
      cup.races.forEach((race, i) => {
        expect(race.index).toBe(i)
        expect(race.cup).toBe(cup.id)
        expect(race.boss).toBe(i === 5)
        expect(race.name.length).toBeGreaterThan(2)
        ids.add(race.id)
      })
      expect(cup.name).toMatch(/Kupası/)
    }
    expect(ids.size).toBe(54)
  })

  it("uses the world's own six tracks, each pairing only once per world", () => {
    for (const world of WORLDS) {
      const prefix = trackPrefix(world)
      const races = cupsOfWorld(world).flatMap((c) => c.races)
      const tracks = new Set(races.map((r) => r.trackId))
      expect(tracks).toEqual(new Set([1, 2, 3, 4, 5, 6].map((n) => `${prefix}${n}`)))
      const pairs = new Set(races.map((r) => `${r.trackId}/${r.variant}`))
      expect(pairs.size).toBe(races.length)
    }
    expect(trackPrefix('dev-ev')).toBe('devev')
  })

  it('makes bronz plain, gümüş reversed/mirrored and altın add night', () => {
    for (const world of WORLDS) {
      const [bronz, gumus, altin] = cupsOfWorld(world)
      expect(bronz!.races.every((r) => r.variant === 'normal')).toBe(true)
      const gv = new Set(gumus!.races.map((r) => r.variant))
      expect(gv.has('reverse') && gv.has('mirror')).toBe(true)
      expect(altin!.races.some((r) => r.variant === 'night')).toBe(true)
    }
  })

  it('looks races and cups up by id', () => {
    const race = raceById('adalar-bronz-1')!
    expect(race.trackId).toBe('adalar1')
    expect(raceById('neon-altin-boss')!.boss).toBe(true)
    expect(raceById('nope')).toBeUndefined()
    expect(isCupId('neon-gumus')).toBe(true)
    expect(isCupId('neon-plastik')).toBe(false)
  })
})
