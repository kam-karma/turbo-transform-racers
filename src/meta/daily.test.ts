import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { setWorldGates } from './economy'
import {
  CAR_TRIALS_PER_DAY,
  DAILY_POOL,
  canTryCar,
  chestState,
  claimDailyMod,
  claimTask,
  dailyModOffer,
  dayKey,
  ensureDaily,
  formatDuration,
  openChest,
  rollDailyTasks,
  taskLabel,
  trackDaily,
  useCarTrial,
} from './daily'
import { CHEST_COOLDOWN_MS, DAILY_TASK_GOLD } from './economy'
import { modById } from './catalog'
import { defaultSave, type SaveData } from './save'

const DAY = '2026-11-23'
const fixedRng = (v: number) => (): number => v

// These tests describe the gated unlock pacing.
beforeEach(() => setWorldGates(true))
afterEach(() => setWorldGates(false))

describe('daily tasks', () => {
  it('formats local dates as day keys', () => {
    expect(dayKey(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23')
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('rolls 3 different tasks, the same ones all day', () => {
    const a = rollDailyTasks(DAY, defaultSave())
    expect(a).toHaveLength(3)
    expect(new Set(a.map((t) => t.id)).size).toBe(3)
    expect(rollDailyTasks(DAY, defaultSave())).toEqual(a)
    for (const t of a) {
      expect(t).toMatchObject({ progress: 0, done: false, claimed: false })
      expect(taskLabel(t.id).length).toBeGreaterThan(5)
    }
  })

  it('changes tasks from day to day', () => {
    const sets = new Set<string>()
    for (let d = 1; d <= 14; d += 1) {
      const day = `2026-12-${String(d).padStart(2, '0')}`
      sets.add(rollDailyTasks(day, defaultSave()).map((t) => t.id).join(','))
    }
    expect(sets.size).toBeGreaterThan(4)
  })

  it('never asks a new player to race in a world that is still locked', () => {
    for (let d = 1; d <= 28; d += 1) {
      const ids = rollDailyTasks(`2027-02-${String(d).padStart(2, '0')}`, defaultSave()).map((t) => t.id)
      expect(ids).not.toContain('devev2')
      expect(ids).not.toContain('neon2')
    }
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(10)
  })

  it('renews tasks on a new day and keeps them on the same day', () => {
    const s = ensureDaily(defaultSave(), DAY)
    expect(s.daily.day).toBe(DAY)
    expect(s.daily.tasks).toHaveLength(3)
    const progressed: SaveData = { ...s, daily: { ...s.daily, tasks: s.daily.tasks.map((t) => ({ ...t, progress: 1 })) } }
    expect(ensureDaily(progressed, DAY)).toBe(progressed)
    expect(ensureDaily(progressed, '2026-11-24').daily.tasks.every((t) => t.progress === 0)).toBe(true)
  })

  it('counts race events towards matching tasks and stops at the goal', () => {
    const base = defaultSave()
    const s: SaveData = {
      ...base,
      daily: {
        day: DAY,
        tasks: [
          { id: 'yaris3', progress: 2, goal: 3, done: false, claimed: false },
          { id: 'birinci1', progress: 0, goal: 1, done: false, claimed: false },
          { id: 'altin100', progress: 90, goal: 100, done: false, claimed: false },
        ],
      },
    }
    const after = trackDaily(s, { kind: 'race', place: 2, stars: 1, coins: 40, world: 'adalar' })
    expect(after.daily.tasks.map((t) => [t.progress, t.done])).toEqual([
      [3, true],
      [0, false],
      [100, true],
    ])
    expect(s.daily.tasks[0]!.progress).toBe(2)
  })

  it('pays a finished task once', () => {
    const s: SaveData = {
      ...defaultSave(),
      gold: 0,
      daily: { day: DAY, tasks: [{ id: 'yaris3', progress: 3, goal: 3, done: true, claimed: false }] },
    }
    const once = claimTask(s, 'yaris3')
    expect(once.gold).toBe(DAILY_TASK_GOLD)
    expect(claimTask(once, 'yaris3').gold).toBe(DAILY_TASK_GOLD)
    const notDone: SaveData = { ...s, daily: { day: DAY, tasks: [{ ...s.daily.tasks[0]!, done: false, progress: 1 }] } }
    expect(claimTask(notDone, 'yaris3').gold).toBe(0)
  })
})

describe('daily chest', () => {
  it('is ready at first and then waits 4 hours', () => {
    const now = 1_000_000
    expect(chestState(defaultSave(), now)).toEqual({ ready: true, msLeft: 0 })
    const r = openChest(defaultSave(), now, fixedRng(0.99))
    expect(r.ok).toBe(true)
    expect(r.gold).toBeGreaterThanOrEqual(100)
    expect(r.gold).toBeLessThanOrEqual(300)
    expect(r.save.gold).toBe(defaultSave().gold + r.gold)
    expect(r.save.chest.readyAt).toBe(now + CHEST_COOLDOWN_MS)
    expect(chestState(r.save, now + 1000)).toEqual({ ready: false, msLeft: CHEST_COOLDOWN_MS - 1000 })
  })

  it('stays shut early unless a video opens it', () => {
    const now = 5_000
    const waiting: SaveData = { ...defaultSave(), chest: { readyAt: now + 60_000 } }
    expect(openChest(waiting, now, fixedRng(0.5)).ok).toBe(false)
    const video = openChest(waiting, now, fixedRng(0.5), { video: true })
    expect(video.ok).toBe(true)
    expect(video.save.chest.readyAt).toBe(now + CHEST_COOLDOWN_MS)
  })

  it('sometimes drops a cheap mod for the current car', () => {
    const lucky = openChest(defaultSave(), 0, fixedRng(0.01))
    expect(lucky.mod).toBeDefined()
    const mod = modById(lucky.mod!)!
    expect(mod.price).toBeGreaterThan(0)
    const owned = mod.accountWide ? lucky.save.accountMods : lucky.save.ownedMods.kivilcim
    expect(owned).toContain(mod.id)
    expect(openChest(defaultSave(), 0, fixedRng(0.99)).mod).toBeUndefined()
  })

  it('formats waiting time in Turkish', () => {
    expect(formatDuration(3 * 3600_000 + 12 * 60_000)).toBe('3 sa 12 dk')
    expect(formatDuration(12 * 60_000 + 5000)).toBe('12 dk')
    expect(formatDuration(45_000)).toBe('45 sn')
    expect(formatDuration(-5)).toBe('0 sn')
  })
})

describe('offers', () => {
  it('offers one mod a day for the current car and lets it be claimed once', () => {
    const s = defaultSave()
    const id = dailyModOffer(s, DAY)!
    expect(id).toBe(dailyModOffer(s, DAY))
    expect(modById(id)!.price).toBeGreaterThan(0)
    const claimed = claimDailyMod(s, DAY)
    expect(claimed.ok).toBe(true)
    expect(claimDailyMod(claimed.save, DAY).ok).toBe(false)
    expect(dailyModOffer(claimed.save, DAY)).toBeNull()
  })

  it('allows 3 one-race car trials a day', () => {
    let s = defaultSave()
    for (let i = 0; i < CAR_TRIALS_PER_DAY; i += 1) {
      expect(canTryCar(s, DAY)).toBe(true)
      s = useCarTrial(s, DAY)
    }
    expect(canTryCar(s, DAY)).toBe(false)
    expect(canTryCar(s, '2026-11-24')).toBe(true)
  })
})
