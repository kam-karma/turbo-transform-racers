import { describe, expect, it } from 'vitest'
import {
  CARS,
  MOD_CATEGORIES,
  MODS,
  PERF_PRICES,
  STARTER_CAR,
  carById,
  defaultModId,
  effectiveStats,
  modById,
  modsOf,
  paintHueShift,
  videosForPrice,
} from './catalog'
import { isCupId } from './cups'

const buyable = MODS.filter((m) => m.price > 0)

describe('cars', () => {
  it('has 12 cars with unique ids and names, the hero first and free', () => {
    expect(CARS).toHaveLength(12)
    expect(new Set(CARS.map((c) => c.id)).size).toBe(12)
    expect(new Set(CARS.map((c) => c.name)).size).toBe(12)
    const first = CARS[0]!
    expect(first.id).toBe('kivilcim')
    expect(first.id).toBe(STARTER_CAR)
    expect(first.name).toBe('Kıvılcım')
    expect(first.model).toBe('./models/hero.glb')
    expect(first.price).toBe(0)
    expect(first.unlock).toBeUndefined()
  })

  it('points every other car at its own model file', () => {
    for (const car of CARS.slice(1)) expect(car.model).toBe(`./models/car-${car.id}.glb`)
  })

  it('keeps stats on the 1..10 scale and gives every car a character and hue', () => {
    for (const car of CARS) {
      for (const v of [car.stats.speed, car.stats.accel, car.stats.handling]) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(10)
      }
      expect(car.character.length).toBeGreaterThan(10)
      expect(car.hue).toBeGreaterThanOrEqual(0)
      expect(car.hue).toBeLessThan(360)
    }
  })

  it('sells cars for 1,000-15,000 gold, and some only come from beating a boss', () => {
    const sold = CARS.slice(1).filter((c) => c.unlock === undefined)
    const prizes = CARS.filter((c) => c.unlock !== undefined)
    expect(sold.length).toBeGreaterThanOrEqual(6)
    expect(prizes.length).toBeGreaterThanOrEqual(3)
    for (const car of sold) {
      expect(car.price).toBeGreaterThanOrEqual(1000)
      expect(car.price).toBeLessThanOrEqual(15000)
    }
    expect(Math.max(...sold.map((c) => c.price))).toBe(15000)
    for (const car of prizes) {
      expect(isCupId(car.unlock!.cup)).toBe(true)
      expect(car.price).toBe(0)
    }
    expect(new Set(prizes.map((c) => c.unlock!.cup)).size).toBe(prizes.length)
  })

  it('looks cars up by id', () => {
    expect(carById('kivilcim')?.name).toBe('Kıvılcım')
    expect(carById('nope')).toBeUndefined()
  })

  it('adds performance levels onto the base stats', () => {
    const car = carById('kivilcim')!
    expect(effectiveStats(car, {})).toEqual(car.stats)
    const tuned = effectiveStats(car, { engine: 5, nitro: 1, handling: 0 })
    expect(tuned.speed).toBeCloseTo(car.stats.speed + 2)
    expect(tuned.accel).toBeCloseTo(car.stats.accel + 0.4)
    expect(tuned.handling).toBe(car.stats.handling)
  })
})

describe('mods', () => {
  it('has at least 60 mods for sale with unique ids and Turkish names', () => {
    expect(buyable.length).toBeGreaterThanOrEqual(60)
    expect(new Set(MODS.map((m) => m.id)).size).toBe(MODS.length)
    for (const m of MODS) {
      expect(m.name.trim().length).toBeGreaterThan(2)
      expect(m.id.startsWith(`${m.category}-`)).toBe(true)
    }
  })

  it('prices mods 150-2,500 and asks 1-3 videos by price band', () => {
    for (const m of buyable) {
      expect(m.price).toBeGreaterThanOrEqual(150)
      expect(m.price).toBeLessThanOrEqual(2500)
      expect(m.videos).toBe(videosForPrice(m.price))
    }
    expect(videosForPrice(150)).toBe(1)
    expect(videosForPrice(299)).toBe(1)
    expect(videosForPrice(300)).toBe(2)
    expect(videosForPrice(999)).toBe(2)
    expect(videosForPrice(1000)).toBe(3)
    expect(new Set(buyable.map((m) => m.videos))).toEqual(new Set([1, 2, 3]))
  })

  it('has exactly one free default per category and several choices in each', () => {
    for (const cat of MOD_CATEGORIES) {
      const free = modsOf(cat).filter((m) => m.price === 0)
      expect(free).toHaveLength(1)
      expect(free[0]!.videos).toBe(0)
      expect(defaultModId(cat)).toBe(free[0]!.id)
      expect(modsOf(cat).length).toBeGreaterThanOrEqual(7)
    }
  })

  it('makes only trails and horns account-wide', () => {
    for (const m of MODS) expect(m.accountWide).toBe(m.category === 'trail' || m.category === 'horn')
  })

  it('gives the UI values it can use directly', () => {
    const isHex = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff
    for (const m of MODS) {
      if (m.category === 'paint') {
        if (m.value.finish === 'factory') continue
        expect(isHex(m.value.color)).toBe(true)
        expect(typeof m.value.hue).toBe('number')
      }
      if (m.category === 'wheels') {
        expect(typeof m.value.part).toBe('string')
        expect(isHex(m.value.rim)).toBe(true)
      }
      if (m.category === 'spoiler' || m.category === 'decal') expect(typeof m.value.part).toBe('string')
      if (m.category === 'neon' && m.price > 0) {
        expect(isHex(m.value.color)).toBe(true)
        expect(typeof m.value.anim).toBe('string')
      }
      if (m.category === 'trail' && m.price > 0) {
        expect(typeof m.value.part).toBe('string')
        expect(isHex(m.value.color)).toBe(true)
      }
      if (m.category === 'horn') expect(typeof m.value.sound).toBe('string')
    }
  })

  it('works out the hue shift that turns a car into a paint colour', () => {
    const car = carById('kivilcim')!
    expect(paintHueShift(car, modById('paint-fabrika')!)).toBe(0)
    const shift = paintHueShift(car, modById('paint-okyanus')!)
    expect(shift).toBeGreaterThanOrEqual(-180)
    expect(shift).toBeLessThanOrEqual(180)
    expect((car.hue + shift + 360) % 360).toBeCloseTo(Number(modById('paint-okyanus')!.value.hue))
  })

  it('uses the spec performance prices', () => {
    expect(PERF_PRICES).toEqual([200, 400, 800, 1500, 2500])
  })
})
