import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { setWorldGates } from './economy'
import { FIRST_RACE_GIFT, applyDoubleReward, applyRaceResult, bossPrize, type RaceResultInput } from './rewards'
import { CUPS } from './cups'
import { CARS } from './catalog'
import { defaultSave, type SaveData } from './save'
import { ownsMod } from './shop'

const NOW = new Date(2026, 10, 23, 12).getTime()
const race = (over: Partial<RaceResultInput> = {}): RaceResultInput => ({
  place: 1,
  coins: 30,
  stars: [true, false, true],
  raceId: 'adalar-bronz-1',
  cupId: 'adalar-bronz',
  ...over,
})
const start = (): SaveData => ({ ...defaultSave(), gold: 0 })

// These tests describe the gated unlock pacing.
beforeEach(() => setWorldGates(true))
afterEach(() => setWorldGates(false))

describe('applyRaceResult', () => {
  it('pays place, coins and new stars and records the race', () => {
    const { save, breakdown } = applyRaceResult(start(), race({ time: 72.5 }), { now: NOW })
    expect(breakdown.gold).toBe(150 + 30 + 80)
    expect(save.gold).toBe(260)
    expect(breakdown.lines.map((l) => l.kind)).toEqual(['place', 'coins', 'stars', 'gift'])
    expect(breakdown.newStars).toEqual([true, false, true])
    expect(save.stars['adalar-bronz-1']).toEqual([true, false, true])
    expect(save.bestTimes['adalar-bronz-1']).toBe(72.5)
    expect(save.racesDone).toBe(1)
    expect(save.firstRun).toBe(false)
    expect(breakdown.newBest).toBe(true)
  })

  it('gives a free spoiler after the very first race', () => {
    const { save, breakdown } = applyRaceResult(start(), race(), { now: NOW })
    expect(ownsMod(save, 'kivilcim', FIRST_RACE_GIFT)).toBe(true)
    expect(breakdown.unlocked).toContainEqual(expect.objectContaining({ kind: 'mod', id: FIRST_RACE_GIFT }))
    const again = applyRaceResult(save, race({ raceId: 'adalar-bronz-2' }), { now: NOW })
    expect(again.breakdown.lines.some((l) => l.kind === 'gift')).toBe(false)
  })

  it('reports the next race and newly opened cups', () => {
    const one = applyRaceResult(start(), race(), { now: NOW })
    expect(one.breakdown.unlocked).toContainEqual(expect.objectContaining({ kind: 'race', id: 'adalar-bronz-2' }))
    const two = applyRaceResult(one.save, race({ raceId: 'adalar-bronz-2' }), { now: NOW })
    expect(two.breakdown.unlocked).toContainEqual(expect.objectContaining({ kind: 'cup', id: 'dev-ev-bronz' }))
  })

  it('pays stars only the first time they are earned', () => {
    const one = applyRaceResult(start(), race(), { now: NOW })
    const two = applyRaceResult(one.save, race({ stars: [true, true, false] }), { now: NOW })
    expect(two.breakdown.newStars).toEqual([false, true, false])
    expect(two.save.stars['adalar-bronz-1']).toEqual([true, true, true])
    expect(two.breakdown.gold).toBe(150 + 30 + 40)
  })

  it('keeps the best time', () => {
    const one = applyRaceResult(start(), race({ time: 70 }), { now: NOW })
    const slower = applyRaceResult(one.save, race({ time: 80 }), { now: NOW })
    expect(slower.save.bestTimes['adalar-bronz-1']).toBe(70)
    expect(slower.breakdown.newBest).toBe(false)
  })

  it('pays the boss win and its prize once, then the repeat reward', () => {
    const ready = { ...start(), racesDone: 5 }
    const boss = race({ raceId: 'adalar-bronz-boss', bossBeaten: true, place: 1, stars: [true, false, false] })
    const first = applyRaceResult(ready, boss, { now: NOW })
    expect(first.breakdown.lines.find((l) => l.kind === 'boss')?.gold).toBe(500)
    expect(first.save.bossBeaten['adalar-bronz']).toBe(true)
    const prize = bossPrize('adalar-bronz')
    expect(prize.car).toBeDefined()
    expect(first.save.owned).toContain(prize.car)
    expect(first.breakdown.unlocked).toContainEqual(expect.objectContaining({ kind: 'car', id: prize.car }))
    expect(first.breakdown.unlocked).toContainEqual(expect.objectContaining({ kind: 'cup', id: 'adalar-gumus' }))
    const again = applyRaceResult(first.save, boss, { now: NOW })
    expect(again.breakdown.lines.find((l) => l.kind === 'boss')?.gold).toBe(150)
    expect(again.breakdown.unlocked.filter((u) => u.kind === 'car' || u.kind === 'cup')).toEqual([])
    expect(again.save.owned.filter((c) => c === prize.car)).toHaveLength(1)
  })

  it('counts boss losses for the easy-boss offer and clears them on a win', () => {
    const lose = race({ raceId: 'adalar-bronz-boss', bossBeaten: false, place: 2 })
    let s = { ...start(), racesDone: 5 }
    for (let i = 0; i < 3; i += 1) s = applyRaceResult(s, lose, { now: NOW }).save
    expect(s.bossFails?.['adalar-bronz']).toBe(3)
    expect(s.bossBeaten['adalar-bronz']).toBeUndefined()
    s = applyRaceResult(s, { ...lose, bossBeaten: true }, { now: NOW }).save
    expect(s.bossFails?.['adalar-bronz']).toBe(0)
  })

  it('moves daily tasks along', () => {
    const { save } = applyRaceResult(start(), race(), { now: NOW })
    expect(save.daily.day).toBe('2026-11-23')
    expect(save.daily.tasks.some((t) => t.progress > 0)).toBe(true)
  })

  it('returns the next goal and does not touch the input save', () => {
    const s = start()
    const copy = JSON.stringify(s)
    const { breakdown } = applyRaceResult(s, race(), { now: NOW })
    expect(breakdown.goal.label.length).toBeGreaterThan(3)
    expect(JSON.stringify(s)).toBe(copy)
  })

  it('doubles the race gold once', () => {
    const r = applyRaceResult(start(), race(), { now: NOW })
    expect(r.breakdown.doubleable).toBe(260)
    const d = applyDoubleReward(r.save, r.breakdown)
    expect(d.save.gold).toBe(520)
    expect(d.breakdown.doubled).toBe(true)
    expect(applyDoubleReward(d.save, d.breakdown).save.gold).toBe(520)
  })

  it('still pays something for an unknown race id', () => {
    const r = applyRaceResult(start(), race({ raceId: 'test-track', stars: [true, true, true] }), { now: NOW })
    expect(r.breakdown.gold).toBe(180)
    expect(r.save.stars['test-track']).toBeUndefined()
  })
})

describe('bossPrize', () => {
  it('gives every boss either a car or a special mod', () => {
    for (const cup of CUPS) {
      const p = bossPrize(cup.id)
      expect(p.car !== undefined || p.mod !== undefined).toBe(true)
    }
    for (const car of CARS.filter((c) => c.unlock)) expect(bossPrize(car.unlock!.cup).car).toBe(car.id)
  })
})
