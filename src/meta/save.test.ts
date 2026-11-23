import { describe, expect, it, vi } from 'vitest'
import { SAVE_KEY, SaveStore, defaultSave, repairSave, type StorageLike } from './save'
import { START_GOLD } from './economy'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('defaultSave', () => {
  it('starts a new player with the hero car and nothing else', () => {
    const s = defaultSave()
    expect(s.v).toBe(1)
    expect(s.gold).toBe(START_GOLD)
    expect(s.car).toBe('kivilcim')
    expect(s.owned).toEqual(['kivilcim'])
    expect(s.firstRun).toBe(true)
    expect(s.racesDone).toBe(0)
    expect(s.chest.readyAt).toBe(0)
    expect(s.mods.kivilcim?.paint).toBe('paint-fabrika')
    expect(s.perf.kivilcim).toEqual({ engine: 0, nitro: 0, handling: 0 })
  })

  it('returns a fresh object each time', () => {
    const a = defaultSave()
    a.owned.push('x')
    expect(defaultSave().owned).toEqual(['kivilcim'])
  })
})

describe('repairSave', () => {
  it('keeps up to two carried Kurgu parts as strings and drops junk', () => {
    expect(repairSave({ ...defaultSave(), kurguKeep: ['wing', 7, 'rocket', 'drill'] }).kurguKeep).toEqual(['wing', 'rocket'])
    expect(repairSave({ ...defaultSave(), kurguKeep: 'wing' }).kurguKeep).toEqual([])
    expect(defaultSave().kurguKeep).toEqual([])
  })

  it('turns anything that is not a save into a new save', () => {
    for (const junk of [null, undefined, 'x', 42, [], true]) expect(repairSave(junk)).toEqual(defaultSave())
  })

  it('keeps the good parts of a partial save', () => {
    const s = repairSave({ gold: 500, racesDone: 3 })
    expect(s.gold).toBe(500)
    expect(s.racesDone).toBe(3)
    expect(s.owned).toEqual(['kivilcim'])
  })

  it('fixes bad numbers', () => {
    expect(repairSave({ gold: -5 }).gold).toBe(0)
    expect(repairSave({ gold: 'abc' }).gold).toBe(START_GOLD)
    expect(repairSave({ gold: 12.7 }).gold).toBe(12)
    expect(repairSave({ gold: Number.POSITIVE_INFINITY }).gold).toBe(START_GOLD)
  })

  it('drops unknown cars, always keeps the hero, and drives an owned car', () => {
    const s = repairSave({ owned: ['zzz', 'kumbocegi', 'kumbocegi'], car: 'roket' })
    expect(s.owned).toEqual(['kivilcim', 'kumbocegi'])
    expect(s.car).toBe('kivilcim')
    expect(repairSave({ owned: ['kumbocegi'], car: 'kumbocegi' }).car).toBe('kumbocegi')
  })

  it('clamps performance levels and resets unknown equipped mods', () => {
    const s = repairSave({
      perf: { kivilcim: { engine: 9, nitro: -1, handling: 2.5 } },
      mods: { kivilcim: { paint: 'paint-yok-boyle', wheels: 'wheels-yildiz', spoiler: 'paint-kiraz' } },
      ownedMods: { kivilcim: ['wheels-yildiz', 'trail-kivilcim', 'bogus'] },
    })
    expect(s.perf.kivilcim).toEqual({ engine: 5, nitro: 0, handling: 2 })
    expect(s.mods.kivilcim?.paint).toBe('paint-fabrika')
    expect(s.mods.kivilcim?.wheels).toBe('wheels-yildiz')
    expect(s.mods.kivilcim?.spoiler).toBe('spoiler-yok')
    expect(s.ownedMods.kivilcim).toEqual(['wheels-yildiz'])
  })

  it('does not let a car wear a mod it does not own', () => {
    const s = repairSave({ mods: { kivilcim: { wheels: 'wheels-altin' } } })
    expect(s.mods.kivilcim?.wheels).toBe('wheels-standart')
  })

  it('keeps only well-formed stars, times and boss wins for known races', () => {
    const s = repairSave({
      stars: { 'adalar-bronz-1': [true, 0, 'x'], 'nope-1': [true, true, true], 'adalar-bronz-2': 'bad' },
      bestTimes: { 'adalar-bronz-1': 61.5, 'adalar-bronz-2': -3 },
      bossBeaten: { 'adalar-bronz': true, 'zzz-bronz': true },
    })
    expect(s.stars).toEqual({ 'adalar-bronz-1': [true, false, false] })
    expect(s.bestTimes).toEqual({ 'adalar-bronz-1': 61.5 })
    expect(s.bossBeaten).toEqual({ 'adalar-bronz': true })
  })

  it('repairs daily tasks and the chest', () => {
    const s = repairSave({
      chest: { readyAt: 'soon' },
      daily: { day: '2026-11-23', tasks: [{ id: 'yaris3', progress: 9, goal: 3, done: true, claimed: false }, { id: 5 }] },
    })
    expect(s.chest.readyAt).toBe(0)
    expect(s.daily.day).toBe('2026-11-23')
    expect(s.daily.tasks).toEqual([{ id: 'yaris3', progress: 3, goal: 3, done: true, claimed: false }])
  })

  it('reads a save from a newer version as best it can', () => {
    expect(repairSave({ v: 7, gold: 900 }).gold).toBe(900)
  })
})

describe('SaveStore', () => {
  it('starts fresh on empty storage and writes updates', () => {
    const storage = memoryStorage()
    const store = new SaveStore(storage)
    expect(store.get()).toEqual(defaultSave())
    const next = store.update((s) => ({ ...s, gold: s.gold + 50 }))
    expect(next.gold).toBe(START_GOLD + 50)
    expect(JSON.parse(storage.data.get(SAVE_KEY)!).gold).toBe(START_GOLD + 50)
    expect(new SaveStore(storage).get().gold).toBe(START_GOLD + 50)
  })

  it('never mutates the save it handed out', () => {
    const store = new SaveStore(memoryStorage())
    const before = store.get()
    store.update((s) => ({ ...s, gold: 999 }))
    expect(before.gold).toBe(START_GOLD)
  })

  it('repairs whatever an update returns', () => {
    const store = new SaveStore(memoryStorage())
    const next = store.update((s) => ({ ...s, gold: -40 }))
    expect(next.gold).toBe(0)
  })

  it('survives corrupt JSON and keeps a copy of it', () => {
    const storage = memoryStorage({ [SAVE_KEY]: '{"gold": 12' })
    const store = new SaveStore(storage)
    expect(store.get()).toEqual(defaultSave())
    expect(storage.data.get(`${SAVE_KEY}-bozuk`)).toBe('{"gold": 12')
  })

  it('never throws when storage is blocked', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const store = new SaveStore(broken)
    expect(store.get()).toEqual(defaultSave())
    expect(store.update((s) => ({ ...s, gold: 7 })).gold).toBe(7)
    expect(() => store.reset()).not.toThrow()
    errors.mockRestore()
  })

  it('keeps the old save when an update function throws', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = new SaveStore(memoryStorage())
    const s = store.update(() => {
      throw new Error('bug')
    })
    expect(s).toEqual(defaultSave())
    errors.mockRestore()
  })

  it('works with no storage at all', () => {
    const store = new SaveStore(null)
    expect(store.update((s) => ({ ...s, gold: 3 })).gold).toBe(3)
  })

  it('resets to a new save and tells listeners about changes', () => {
    const storage = memoryStorage()
    const store = new SaveStore(storage)
    const seen: number[] = []
    const stop = store.subscribe((s) => seen.push(s.gold))
    store.update((s) => ({ ...s, gold: 10 }))
    store.reset()
    stop()
    store.update((s) => ({ ...s, gold: 20 }))
    expect(seen).toEqual([10, START_GOLD])
    expect(store.get().gold).toBe(20)
  })
})
