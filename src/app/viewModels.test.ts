import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setWorldGates } from '../meta/economy'
import { defaultSave, type SaveData } from '../meta/save'
import { carCards, cupMap, defaultTier, modItems, perfRows, playButton, raceLabel, statFill, worldCards } from './viewModels'

const fresh = (): SaveData => defaultSave()
const done = (s: SaveData, ...ids: string[]): SaveData => ({
  ...s,
  racesDone: s.racesDone + ids.length,
  stars: { ...s.stars, ...Object.fromEntries(ids.map((id) => [id, [true, false, true] as [boolean, boolean, boolean]])) },
  bestTimes: { ...s.bestTimes, ...Object.fromEntries(ids.map((id) => [id, 88.4])) },
})

describe('worldCards', () => {
  beforeEach(() => setWorldGates(true))
  afterEach(() => setWorldGates(false))

  it('opens every world while the world gates are off (current setting)', () => {
    setWorldGates(false)
    expect(worldCards(fresh()).map((c) => c.unlocked)).toEqual([true, true, true])
  })

  it('opens only Uçan Adalar for a new player and marks it current', () => {
    const cards = worldCards(fresh())
    expect(cards.map((c) => c.world)).toEqual(['adalar', 'dev-ev', 'neon'])
    expect(cards.map((c) => c.unlocked)).toEqual([true, false, false])
    expect(cards[0]!.current).toBe(true)
    expect(cards[1]!.lockReason).toContain('yarış')
    expect(cards[0]!.tiers.map((t) => t.unlocked)).toEqual([true, false, false])
  })

  it('opens Dev Ev after two races and counts stars', () => {
    const s = done(fresh(), 'adalar-bronz-1', 'adalar-bronz-2')
    const cards = worldCards(s)
    expect(cards[1]!.unlocked).toBe(true)
    expect(cards[0]!.stars).toBe(4)
    expect(cards[0]!.maxStars).toBe(54)
  })
})

describe('playButton', () => {
  it('points at the first race for a new player', () => {
    const b = playButton(fresh())
    expect(b.race?.id).toBe('adalar-bronz-1')
    expect(b.subtitle).toMatch(/1\/5$/)
    expect(b.cupName).toContain('Bronz')
  })
})

describe('cupMap', () => {
  it('lists 5 races and a boss, with only the first open', () => {
    const m = cupMap(fresh(), 'adalar', 'bronz')
    expect(m.nodes).toHaveLength(6)
    expect(m.nodes.map((n) => n.unlocked)).toEqual([true, false, false, false, false, false])
    expect(m.nodes[0]!.current).toBe(true)
    expect(m.nodes[5]!.label).toBe('BOSS')
    expect(m.bossName.length).toBeGreaterThan(3)
  })

  it('carries stars and best times and moves the current marker', () => {
    const m = cupMap(done(fresh(), 'adalar-bronz-1'), 'adalar', 'bronz')
    expect(m.nodes[0]!.finished).toBe(true)
    expect(m.nodes[0]!.stars).toEqual([true, false, true])
    expect(m.nodes[0]!.bestTime).toBe(88.4)
    expect(m.nodes[1]!.current).toBe(true)
    expect(m.stars).toBe(2)
  })

  it('opens the boss after five races', () => {
    const ids = [1, 2, 3, 4, 5].map((i) => `adalar-bronz-${i}`)
    const m = cupMap(done(fresh(), ...ids), 'adalar', 'bronz')
    expect(m.nodes[5]!.unlocked).toBe(true)
    expect(m.nodes[5]!.current).toBe(true)
  })

  it('reports locked tiers with a reason', () => {
    const m = cupMap(fresh(), 'adalar', 'gumus')
    expect(m.unlocked).toBe(false)
    expect(m.lockReason).toContain('boss')
  })
})

describe('defaultTier', () => {
  it('is bronz until its boss is beaten', () => {
    expect(defaultTier(fresh(), 'adalar')).toBe('bronz')
    expect(defaultTier({ ...fresh(), bossBeaten: { 'adalar-bronz': true } }, 'adalar')).toBe('gumus')
  })
})

describe('raceLabel', () => {
  it('names race slots', () => {
    expect(raceLabel('adalar-bronz-3')).toBe('Yarış 3/5')
    expect(raceLabel('adalar-bronz-boss')).toBe('Boss Yarışı')
    expect(raceLabel('nope')).toBe('')
  })
})

describe('garage view-models', () => {
  it('shows 12 cars, the hero owned and selected, prize cars with a lock text', () => {
    const cards = carCards(fresh())
    expect(cards).toHaveLength(12)
    expect(cards[0]).toMatchObject({ owned: true, selected: true })
    const prize = cards.find((c) => c.car.unlock !== undefined)!
    expect(prize.owned).toBe(false)
    expect(prize.lockText).toContain('boss')
  })

  it('prices the next performance level', () => {
    const rows = perfRows({ ...fresh(), gold: 300 }, 'kivilcim')
    expect(rows.map((r) => r.perf)).toEqual(['engine', 'nitro', 'handling'])
    expect(rows[0]).toMatchObject({ level: 0, max: 5, price: 200, canAfford: true })
  })

  it('marks the equipped free paint and unowned paints', () => {
    const items = modItems(fresh(), 'kivilcim', 'paint')
    expect(items[0]).toMatchObject({ owned: true, equipped: true })
    expect(items.slice(1).every((i) => !i.owned && !i.equipped)).toBe(true)
  })

  it('fills stat bars on a 12-point scale', () => {
    expect(statFill(6)).toBe(0.5)
    expect(statFill(20)).toBe(1)
    expect(statFill(0)).toBe(0.06)
  })
})
