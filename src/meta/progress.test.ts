import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setWorldGates } from './economy'
import { cupById, raceById } from './cups'
import {
  cupLockReason,
  cupProgress,
  cupUnlocked,
  nextGoal,
  nextRace,
  raceFinished,
  raceUnlocked,
  totalStars,
  worldProgress,
} from './progress'
import { defaultSave, type SaveData } from './save'

type Stars = [boolean, boolean, boolean]
const NONE: Stars = [false, false, false]
const ALL: Stars = [true, true, true]

function finished(save: SaveData, ids: readonly string[], stars: Stars = NONE): SaveData {
  const extra = Object.fromEntries(ids.map((id) => [id, stars]))
  return { ...save, stars: { ...save.stars, ...extra }, racesDone: save.racesDone + ids.length }
}

const cupRaces = (cup: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${cup}-${i + 1}`)

// Most tests describe the gated unlock pacing.
beforeEach(() => setWorldGates(true))
afterEach(() => setWorldGates(false))

describe('cup unlocks', () => {
  it('opens every world Bronz cup while the world gates are off', () => {
    setWorldGates(false)
    const s = defaultSave()
    expect(cupUnlocked(s, 'dev-ev-bronz')).toBe(true)
    expect(cupUnlocked(s, 'neon-bronz')).toBe(true)
    expect(cupUnlocked(s, 'dev-ev-gumus')).toBe(false)
  })

  it('opens only Dönüşüm Bronz for a new player', () => {
    const s = defaultSave()
    expect(cupUnlocked(s, 'adalar-bronz')).toBe(true)
    expect(cupUnlocked(s, 'dev-ev-bronz')).toBe(false)
    expect(cupUnlocked(s, 'neon-bronz')).toBe(false)
    expect(cupUnlocked(s, 'adalar-gumus')).toBe(false)
  })

  it('opens Kurgu Bronz after 2 finished races', () => {
    expect(cupUnlocked({ ...defaultSave(), racesDone: 1 }, 'dev-ev-bronz')).toBe(false)
    expect(cupUnlocked({ ...defaultSave(), racesDone: 2 }, 'dev-ev-bronz')).toBe(true)
  })

  it('opens Kaos Bronz after the Kurgu Bronz boss or 12 stars', () => {
    const boss = { ...defaultSave(), racesDone: 6, bossBeaten: { 'dev-ev-bronz': true } }
    expect(cupUnlocked(boss, 'neon-bronz')).toBe(true)
    const stars = finished(defaultSave(), cupRaces('adalar-bronz', 4), ALL)
    expect(totalStars(stars)).toBe(12)
    expect(cupUnlocked(stars, 'neon-bronz')).toBe(true)
    const eleven = { ...stars, stars: { ...stars.stars, 'adalar-bronz-4': [true, true, false] as Stars } }
    expect(cupUnlocked(eleven, 'neon-bronz')).toBe(false)
  })

  it('opens gümüş after the bronz boss and altın after the gümüş boss of the same world', () => {
    const s = { ...defaultSave(), bossBeaten: { 'adalar-bronz': true } }
    expect(cupUnlocked(s, 'adalar-gumus')).toBe(true)
    expect(cupUnlocked(s, 'dev-ev-gumus')).toBe(false)
    expect(cupUnlocked(s, 'adalar-altin')).toBe(false)
    expect(cupUnlocked({ ...s, bossBeaten: { ...s.bossBeaten, 'adalar-gumus': true } }, 'adalar-altin')).toBe(true)
  })

  it('explains in Turkish why a cup is locked', () => {
    expect(cupLockReason(defaultSave(), 'adalar-bronz')).toBeNull()
    expect(cupLockReason({ ...defaultSave(), racesDone: 1 }, 'dev-ev-bronz')).toMatch(/1 yarış/)
    expect(cupLockReason(defaultSave(), 'neon-bronz')).toMatch(/12 yıldız/)
    expect(cupLockReason(defaultSave(), 'adalar-gumus')).toMatch(/boss/i)
  })
})

describe('race unlocks', () => {
  it('opens races one after another and the boss after all five', () => {
    let s = defaultSave()
    const cup = cupById('adalar-bronz')!
    expect(raceUnlocked(s, cup.races[0]!)).toBe(true)
    expect(raceUnlocked(s, cup.races[1]!)).toBe(false)
    s = finished(s, ['adalar-bronz-1'])
    expect(raceFinished(s, 'adalar-bronz-1')).toBe(true)
    expect(raceUnlocked(s, cup.races[1]!)).toBe(true)
    expect(raceUnlocked(s, cup.races[5]!)).toBe(false)
    s = finished(s, cupRaces('adalar-bronz', 5).slice(1))
    expect(raceUnlocked(s, cup.races[5]!)).toBe(true)
  })

  it('keeps races of a locked cup shut', () => {
    expect(raceUnlocked(defaultSave(), raceById('neon-bronz-1')!)).toBe(false)
  })

  it('finds the next race to play', () => {
    expect(nextRace(defaultSave())?.id).toBe('adalar-bronz-1')
    expect(nextRace(finished(defaultSave(), ['adalar-bronz-1']))?.id).toBe('adalar-bronz-2')
    const all = finished(defaultSave(), cupRaces('adalar-bronz', 5))
    expect(nextRace(all)?.id).toBe('adalar-bronz-boss')
  })
})

describe('stars and progress', () => {
  it('counts stars across races', () => {
    const s = finished(finished(defaultSave(), ['adalar-bronz-1'], [true, false, true]), ['adalar-bronz-2'], ALL)
    expect(totalStars(s)).toBe(5)
    const p = cupProgress(s, 'adalar-bronz')
    expect(p).toMatchObject({ stars: 5, maxStars: 18, finished: 2, races: 6, bossBeaten: false })
    expect(worldProgress(s, 'adalar')).toMatchObject({ stars: 5, maxStars: 54 })
  })
})

describe('nextGoal', () => {
  it('always gives a goal with progress 0..1 and a label', () => {
    const g = nextGoal(defaultSave())
    expect(g.progress).toBeGreaterThanOrEqual(0)
    expect(g.progress).toBeLessThanOrEqual(1)
    expect(g.label.length).toBeGreaterThan(3)
  })

  it('points at the boss when the cup is nearly done', () => {
    const s = { ...finished(defaultSave(), cupRaces('adalar-bronz', 4)), gold: 0 }
    const g = nextGoal(s)
    expect(g.kind).toBe('boss')
    expect(g.progress).toBeCloseTo(0.8)
    expect(g.label).toMatch(/1 yarış/)
  })

  it('points at the next car when the player has almost enough gold', () => {
    const s = { ...finished(defaultSave(), cupRaces('adalar-bronz', 4)), gold: 950 }
    const g = nextGoal(s)
    expect(g.kind).toBe('car')
    expect(g.progress).toBeCloseTo(0.95)
    expect(g.label).toMatch(/Kum Böceği/)
  })

  it('points at a locked cup when it is the closest thing', () => {
    const s = { ...finished(defaultSave(), cupRaces('adalar-bronz', 1)), gold: 0, racesDone: 1 }
    const g = nextGoal(s)
    expect(g.kind).toBe('cup')
    expect(g.progress).toBeCloseTo(0.5)
  })
})
