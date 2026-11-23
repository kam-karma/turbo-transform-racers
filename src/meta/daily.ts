/**
 * Daily systems (spec §14.5, §13): 3 date-seeded tasks, the 4-hour chest, the "mod of the day"
 * video offer and the 3-a-day car trials. Time and randomness are passed in, so all of it is pure.
 *
 * App usage: at boot and when the day may have changed, `store.update(s => ensureDaily(s, dayKey(new Date())))`.
 * Race results already feed tasks through rewards.applyRaceResult.
 */
import { MODS, type CarId } from './catalog'
import { cupUnlocked, raceUnlocked } from './progress'
import { CUPS, type WorldId } from './cups'
import { CHEST_COOLDOWN_MS, CHEST_GOLD_MAX, CHEST_GOLD_MIN, CHEST_MOD_CHANCE, DAILY_TASK_GOLD } from './economy'
import { hashString, pickDistinct, seededRng } from './rng'
import type { DailyTask, SaveData, SaveOffers } from './save'
import { grantMod, ownsMod } from './shop'

export const DAILY_TASK_COUNT = 3
export const CAR_TRIALS_PER_DAY = 3

export interface DailyEvent {
  readonly kind: 'race'
  readonly place: number
  /** Stars achieved in this race (new or not). */
  readonly stars: number
  /** Gold coins collected on the track. */
  readonly coins: number
  readonly world: WorldId
  readonly boss?: boolean
}

interface TaskDef {
  readonly id: string
  readonly label: string
  readonly goal: number
  readonly count: (e: DailyEvent) => number
  readonly available?: (s: SaveData) => boolean
}

const finish = (): number => 1
const inWorld = (w: WorldId) => (e: DailyEvent): number => (e.world === w ? 1 : 0)

export const DAILY_POOL: readonly TaskDef[] = [
  { id: 'yaris3', label: '3 yarış bitir', goal: 3, count: finish },
  { id: 'yaris5', label: '5 yarış bitir', goal: 5, count: finish },
  { id: 'birinci1', label: 'Bir yarışı birinci bitir', goal: 1, count: (e) => (e.place === 1 ? 1 : 0) },
  { id: 'birinci3', label: '3 yarışı birinci bitir', goal: 3, count: (e) => (e.place === 1 ? 1 : 0) },
  { id: 'podyum3', label: '3 kez ilk üçe gir', goal: 3, count: (e) => (e.place <= 3 ? 1 : 0) },
  { id: 'yildiz3', label: '3 yıldız kazan', goal: 3, count: (e) => e.stars },
  { id: 'yildiz6', label: '6 yıldız kazan', goal: 6, count: (e) => e.stars },
  { id: 'altin100', label: 'Pistte 100 altın topla', goal: 100, count: (e) => e.coins },
  { id: 'altin250', label: 'Pistte 250 altın topla', goal: 250, count: (e) => e.coins },
  { id: 'adalar2', label: "Uçan Adalar'da 2 yarış bitir", goal: 2, count: inWorld('adalar') },
  {
    id: 'devev2',
    label: "Dev Ev'de 2 yarış bitir",
    goal: 2,
    count: inWorld('dev-ev'),
    available: (s) => cupUnlocked(s, 'dev-ev-bronz'),
  },
  {
    id: 'neon2',
    label: "Neon Şehir'de 2 yarış bitir",
    goal: 2,
    count: inWorld('neon'),
    available: (s) => cupUnlocked(s, 'neon-bronz'),
  },
  {
    id: 'boss1',
    label: 'Bir boss yarışı bitir',
    goal: 1,
    count: (e) => (e.boss === true ? 1 : 0),
    available: (s) => CUPS.some((c) => raceUnlocked(s, c.races[c.races.length - 1]!)),
  },
]

const TASK_BY_ID: ReadonlyMap<string, TaskDef> = new Map(DAILY_POOL.map((t) => [t.id, t]))

/** Local calendar day as 'YYYY-MM-DD'. */
export function dayKey(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function taskLabel(id: string): string {
  return TASK_BY_ID.get(id)?.label ?? 'Görev'
}

/** The day's 3 tasks, seeded by the date; tasks for still-locked worlds are left out. */
export function rollDailyTasks(day: string, save: SaveData): DailyTask[] {
  const open = DAILY_POOL.filter((t) => t.available?.(save) ?? true)
  return pickDistinct(open, DAILY_TASK_COUNT, seededRng(hashString(`gorev:${day}`))).map((t) => ({
    id: t.id,
    progress: 0,
    goal: t.goal,
    done: false,
    claimed: false,
  }))
}

/** Renews the tasks when the day changed; returns the same save object otherwise. */
export function ensureDaily(save: SaveData, day: string): SaveData {
  if (save.daily.day === day) return save
  return { ...save, daily: { day, tasks: rollDailyTasks(day, save) } }
}

/** Advances matching unfinished tasks by a race event. */
export function trackDaily(save: SaveData, event: DailyEvent): SaveData {
  const tasks = save.daily.tasks.map((t) => {
    const def = TASK_BY_ID.get(t.id)
    if (def === undefined || t.done) return t
    const add = Math.max(0, Math.floor(def.count(event)))
    if (add === 0) return t
    const progress = Math.min(t.goal, t.progress + add)
    return { ...t, progress, done: progress >= t.goal }
  })
  return { ...save, daily: { ...save.daily, tasks } }
}

/** Pays DAILY_TASK_GOLD for a finished, unclaimed task; otherwise returns the save unchanged. */
export function claimTask(save: SaveData, taskId: string): SaveData {
  const task = save.daily.tasks.find((t) => t.id === taskId)
  if (task === undefined || !task.done || task.claimed) return save
  const tasks = save.daily.tasks.map((t) => (t.id === taskId ? { ...t, claimed: true } : t))
  return { ...save, gold: save.gold + DAILY_TASK_GOLD, daily: { ...save.daily, tasks } }
}

// ── Daily chest ─────────────────────────────────────────────────────────────

export interface ChestState {
  readonly ready: boolean
  readonly msLeft: number
}

export interface ChestOpen {
  readonly ok: boolean
  readonly save: SaveData
  readonly gold: number
  /** A cheap mod dropped for the current car (or account-wide), if lucky. */
  readonly mod?: string
}

export function chestState(save: SaveData, now: number): ChestState {
  const msLeft = Math.max(0, save.chest.readyAt - now)
  return { ready: msLeft === 0, msLeft }
}

/**
 * Opens the chest: 100-300 gold and a 30 % chance of a cheap mod, then 4 hours of waiting.
 * `video: true` opens it early ("hemen aç" after a rewarded video, once per chest).
 */
export function openChest(save: SaveData, now: number, rng: () => number = Math.random, opts: { video?: boolean } = {}): ChestOpen {
  if (!chestState(save, now).ready && opts.video !== true) return { ok: false, save, gold: 0 }
  const gold = CHEST_GOLD_MIN + Math.floor(rng() * (CHEST_GOLD_MAX - CHEST_GOLD_MIN + 1))
  let next: SaveData = { ...save, gold: save.gold + gold, chest: { readyAt: now + CHEST_COOLDOWN_MS } }
  let mod: string | undefined
  if (rng() < CHEST_MOD_CHANCE) {
    const pool = MODS.filter((m) => m.price > 0 && m.videos === 1 && !ownsMod(save, save.car, m.id))
    const pick = pool[Math.floor(rng() * pool.length)]
    if (pick !== undefined) {
      mod = pick.id
      next = grantMod(next, save.car, pick.id)
    }
  }
  return mod === undefined ? { ok: true, save: next, gold } : { ok: true, save: next, gold, mod }
}

/** "3 sa 12 dk", "12 dk", "45 sn". */
export function formatDuration(ms: number): string {
  const secs = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return m > 0 ? `${h} sa ${m} dk` : `${h} sa`
  if (m > 0) return `${m} dk`
  return `${secs} sn`
}

// ── Rewarded offers with daily limits ───────────────────────────────────────

function offersFor(save: SaveData, day: string): SaveOffers {
  const o = save.offers ?? { day: '', carTrials: 0, dailyModDay: '' }
  return o.day === day ? o : { ...o, day, carTrials: 0 }
}

/** Today's free-by-video mod for the current car, or null once claimed (or nothing left). */
export function dailyModOffer(save: SaveData, day: string): string | null {
  if (offersFor(save, day).dailyModDay === day) return null
  const car: CarId = save.car
  const pool = MODS.filter((m) => m.price > 0 && !ownsMod(save, car, m.id))
  if (pool.length === 0) return null
  const rng = seededRng(hashString(`mod:${day}:${car}`))
  return pool[Math.floor(rng() * pool.length)]!.id
}

/** Gives today's mod (call after the rewarded video was watched). */
export function claimDailyMod(save: SaveData, day: string): { ok: boolean; save: SaveData; mod?: string } {
  const mod = dailyModOffer(save, day)
  if (mod === null) return { ok: false, save }
  const offers = { ...offersFor(save, day), dailyModDay: day }
  return { ok: true, save: { ...grantMod(save, save.car, mod), offers }, mod }
}

export function canTryCar(save: SaveData, day: string): boolean {
  return offersFor(save, day).carTrials < CAR_TRIALS_PER_DAY
}

/** Counts one "try a locked car for a race" video. */
export function useCarTrial(save: SaveData, day: string): SaveData {
  const o = offersFor(save, day)
  return { ...save, offers: { ...o, carTrials: o.carTrials + 1 } }
}
