import { describe, expect, it } from 'vitest'
import { activeCombos, attach, COMBOS, emptyLoadout, hasPart, knockOff, PART_DEFS, PART_IDS, partsOf, rarestPart, SLOTS } from './parts'

describe('parts', () => {
  it('has nine toy parts over four slots, each with a Turkish name', () => {
    expect(PART_IDS).toHaveLength(9)
    expect(SLOTS).toEqual(['front', 'side', 'back', 'wheels'])
    for (const id of PART_IDS) {
      expect(SLOTS).toContain(PART_DEFS[id].slot)
      expect(PART_DEFS[id].name.length).toBeGreaterThan(2)
    }
    expect(PART_IDS.filter((id) => PART_DEFS[id].slot === 'front').sort()).toEqual(['bumper', 'drill', 'magnet'])
    expect(PART_IDS.filter((id) => PART_DEFS[id].slot === 'wheels').sort()).toEqual(['bigwheel', 'float', 'treads'])
  })

  it('starts bare and attaches a part into its slot without changing the input', () => {
    const lo = emptyLoadout()
    const r = attach(lo, 'wing', false)
    expect(lo.side).toBeNull()
    expect(r.loadout.side?.id).toBe('wing')
    expect(r.replaced).toBeNull()
    expect(hasPart(r.loadout, 'wing')).toBe(true)
  })

  it('replaces the part already in the slot', () => {
    const a = attach(emptyLoadout(), 'drill', false).loadout
    const r = attach(a, 'magnet', true)
    expect(r.replaced?.id).toBe('drill')
    expect(r.loadout.front).toMatchObject({ id: 'magnet', shiny: true })
  })

  it('knocks off the last attached part', () => {
    let lo = attach(emptyLoadout(), 'rocket', false).loadout
    lo = attach(lo, 'float', false).loadout
    lo = attach(lo, 'drill', false).loadout
    const k = knockOff(lo)
    expect(k.lost?.id).toBe('drill')
    expect(k.loadout.front).toBeNull()
    const k2 = knockOff(k.loadout)
    expect(k2.lost?.id).toBe('float')
    expect(knockOff(emptyLoadout()).lost).toBeNull()
  })

  it('finds combos: wing + rocket = flight, magnet + big wheel = rolling ball', () => {
    let lo = attach(emptyLoadout(), 'wing', false).loadout
    expect(activeCombos(lo)).toEqual([])
    lo = attach(lo, 'rocket', false).loadout
    expect(activeCombos(lo)).toContain('flight')
    lo = attach(lo, 'magnet', false).loadout
    lo = attach(lo, 'bigwheel', false).loadout
    expect(activeCombos(lo)).toEqual(expect.arrayContaining(['flight', 'ball']))
    expect(COMBOS.length).toBeGreaterThanOrEqual(5)
    expect(partsOf(lo).map((p) => p.id).sort()).toEqual(['bigwheel', 'magnet', 'rocket', 'wing'])
  })

  it('picks the rarest part for the keep-with-video offer (shiny beats rarity)', () => {
    expect(rarestPart([])).toBeNull()
    expect(rarestPart([{ id: 'bumper', shiny: false, order: 1 }])).toBeNull()
    expect(rarestPart([{ id: 'bumper', shiny: false, order: 1 }, { id: 'rocket', shiny: false, order: 2 }])?.id).toBe('rocket')
    expect(rarestPart([{ id: 'rocket', shiny: false, order: 1 }, { id: 'magnet', shiny: true, order: 2 }])?.id).toBe('magnet')
  })
})
