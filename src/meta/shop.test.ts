import { describe, expect, it } from 'vitest'
import {
  buyCar,
  buyMod,
  buyPerf,
  equipMod,
  equippedMods,
  modVideoCount,
  ownsMod,
  perfLevel,
  selectCar,
  watchModVideo,
} from './shop'
import { modById } from './catalog'
import { defaultSave, type SaveData } from './save'

const rich = (gold = 100_000): SaveData => ({ ...defaultSave(), gold })

describe('cars', () => {
  it('buys a car when there is enough gold', () => {
    const r = buyCar(rich(1500), 'kumbocegi')
    expect(r.ok).toBe(true)
    expect(r.save.gold).toBe(500)
    expect(r.save.owned).toContain('kumbocegi')
    expect(r.save.perf.kumbocegi).toEqual({ engine: 0, nitro: 0, handling: 0 })
    expect(r.save.mods.kumbocegi?.paint).toBe('paint-fabrika')
  })

  it('refuses without gold, twice, for prize cars and unknown ids', () => {
    expect(buyCar(rich(10), 'kumbocegi')).toMatchObject({ ok: false, reason: 'gold' })
    const once = buyCar(rich(), 'kumbocegi').save
    expect(buyCar(once, 'kumbocegi')).toMatchObject({ ok: false, reason: 'owned' })
    expect(buyCar(rich(), 'roket')).toMatchObject({ ok: false, reason: 'locked' })
    expect(buyCar(rich(), 'zzz')).toMatchObject({ ok: false, reason: 'unknown' })
  })

  it('selects only owned cars', () => {
    expect(selectCar(defaultSave(), 'kumbocegi').ok).toBe(false)
    const owned = buyCar(rich(), 'kumbocegi').save
    expect(selectCar(owned, 'kumbocegi').save.car).toBe('kumbocegi')
  })
})

describe('performance', () => {
  it('buys levels in order at the spec prices up to 5', () => {
    let s = rich(10_000)
    const paid: number[] = []
    for (let i = 0; i < 5; i += 1) {
      const r = buyPerf(s, 'kivilcim', 'engine')
      expect(r.ok).toBe(true)
      paid.push(s.gold - r.save.gold)
      s = r.save
    }
    expect(paid).toEqual([200, 400, 800, 1500, 2500])
    expect(perfLevel(s, 'kivilcim', 'engine')).toBe(5)
    expect(buyPerf(s, 'kivilcim', 'engine')).toMatchObject({ ok: false, reason: 'max' })
  })

  it('refuses for cars not owned or without gold', () => {
    expect(buyPerf(rich(), 'kumbocegi', 'nitro')).toMatchObject({ ok: false, reason: 'locked' })
    expect(buyPerf(rich(100), 'kivilcim', 'nitro')).toMatchObject({ ok: false, reason: 'gold' })
  })
})

describe('mods', () => {
  it('owns the free defaults from the start', () => {
    expect(ownsMod(defaultSave(), 'kivilcim', 'paint-fabrika')).toBe(true)
    expect(ownsMod(defaultSave(), 'kivilcim', 'paint-kiraz')).toBe(false)
    expect(equippedMods(defaultSave(), 'kivilcim').paint.id).toBe('paint-fabrika')
  })

  it('buys a car mod for that car only', () => {
    const r = buyMod(rich(1000), 'kivilcim', 'paint-kiraz')
    expect(r.ok).toBe(true)
    expect(r.save.gold).toBe(1000 - modById('paint-kiraz')!.price)
    const two = buyCar(r.save, 'kumbocegi')
    expect(ownsMod(two.save, 'kivilcim', 'paint-kiraz')).toBe(true)
    expect(ownsMod(two.save, 'kumbocegi', 'paint-kiraz')).toBe(false)
    expect(buyMod(r.save, 'kivilcim', 'paint-kiraz')).toMatchObject({ ok: false, reason: 'owned' })
  })

  it('buys trails and horns once for every car', () => {
    const r = buyMod(rich(), 'kivilcim', 'trail-kivilcim')
    expect(r.save.accountMods).toContain('trail-kivilcim')
    const withCar = buyCar(r.save, 'kumbocegi').save
    expect(ownsMod(withCar, 'kumbocegi', 'trail-kivilcim')).toBe(true)
  })

  it('unlocks a mod after its last video and keeps progress in between', () => {
    const id = 'spoiler-spor'
    expect(modById(id)!.videos).toBe(2)
    const one = watchModVideo(defaultSave(), 'kivilcim', id)
    expect(one).toMatchObject({ ok: true, progress: 1, unlocked: false })
    expect(modVideoCount(one.save, 'kivilcim', id)).toBe(1)
    expect(ownsMod(one.save, 'kivilcim', id)).toBe(false)
    const two = watchModVideo(one.save, 'kivilcim', id)
    expect(two).toMatchObject({ ok: true, progress: 2, unlocked: true })
    expect(ownsMod(two.save, 'kivilcim', id)).toBe(true)
    expect(watchModVideo(two.save, 'kivilcim', id).ok).toBe(false)
  })

  it('equips only owned mods into the right slot', () => {
    expect(equipMod(defaultSave(), 'kivilcim', 'paint-kiraz').ok).toBe(false)
    const owned = buyMod(rich(), 'kivilcim', 'paint-kiraz').save
    const eq = equipMod(owned, 'kivilcim', 'paint-kiraz')
    expect(eq.ok).toBe(true)
    expect(eq.save.mods.kivilcim?.paint).toBe('paint-kiraz')
    expect(equippedMods(eq.save, 'kivilcim').paint.id).toBe('paint-kiraz')
    expect(equipMod(eq.save, 'kivilcim', 'paint-fabrika').save.mods.kivilcim?.paint).toBe('paint-fabrika')
  })

  it('does not change the save it was given', () => {
    const s = rich()
    const copy = JSON.stringify(s)
    buyMod(s, 'kivilcim', 'trail-kivilcim')
    buyPerf(s, 'kivilcim', 'engine')
    buyCar(s, 'kumbocegi')
    watchModVideo(s, 'kivilcim', 'paint-kiraz')
    expect(JSON.stringify(s)).toBe(copy)
  })
})
