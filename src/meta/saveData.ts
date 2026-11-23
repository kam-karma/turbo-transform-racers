/**
 * The persisted game state (shape fixed by the stage-B contract) and a new player's save.
 * Treat SaveData as immutable: change it only through SaveStore.update with a new object.
 */
import { MOD_CATEGORIES, PERF_IDS, STARTER_CAR, defaultModId, type CarId, type ModCategory, type PerfId } from './catalog'
import type { CupId } from './cups'
import { START_GOLD } from './economy'

export type StarSet = [boolean, boolean, boolean]

export interface DailyTask {
  id: string
  progress: number
  goal: number
  done: boolean
  /** Reward taken (DAILY_TASK_GOLD). */
  claimed: boolean
}

/** Per-day limits for rewarded offers (spec §13). */
export interface SaveOffers {
  /** Day key the counters below belong to. */
  day: string
  /** "Try a locked car for one race" videos used today (limit CAR_TRIALS_PER_DAY). */
  carTrials: number
  /** Day key on which the "mod of the day" was last claimed. */
  dailyModDay: string
}

export interface SaveData {
  v: 1
  gold: number
  /** The car currently driven; always one of `owned`. */
  car: CarId
  owned: CarId[]
  /** Performance levels 0..5 per owned car. */
  perf: Record<CarId, Record<PerfId, number>>
  /** Equipped mod id per category, per owned car (free defaults when nothing bought). */
  mods: Record<CarId, Record<ModCategory, string>>
  /** Car-specific mods bought/unlocked per car (not trails/horns, not free defaults). */
  ownedMods: Record<CarId, string[]>
  /** Account-wide mods (trails, horns). */
  accountMods: string[]
  /** Videos watched towards a mod; key from `modProgressKey` in shop.ts. */
  modVideoProgress: Record<string, number>
  /** Best star set per race id. A race counts as finished once it has an entry. */
  stars: Record<string, StarSet>
  /** Best time in seconds per race id. */
  bestTimes: Record<string, number>
  bossBeaten: Partial<Record<CupId, boolean>>
  /** Finished races of any kind, ever. */
  racesDone: number
  chest: { readyAt: number }
  daily: { day: string; tasks: DailyTask[] }
  /** True until the first race is finished. */
  firstRun: boolean
  /** Optional extras (always filled by repairSave). */
  offers?: SaveOffers
  /** Boss losses in a row per cup: 3+ → offer the "easy boss" (spec §9.4). */
  bossFails?: Partial<Record<CupId, number>>
  /** Kurgu parts kept with a rewarded video: the next Dev Ev race starts with them (max 2). */
  kurguKeep?: string[]
}

export const SAVE_VERSION = 1

export function defaultPerf(): Record<PerfId, number> {
  return Object.fromEntries(PERF_IDS.map((p) => [p, 0])) as Record<PerfId, number>
}

export function defaultLook(): Record<ModCategory, string> {
  return Object.fromEntries(MOD_CATEGORIES.map((c) => [c, defaultModId(c)])) as Record<ModCategory, string>
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    gold: START_GOLD,
    car: STARTER_CAR,
    owned: [STARTER_CAR],
    perf: { [STARTER_CAR]: defaultPerf() },
    mods: { [STARTER_CAR]: defaultLook() },
    ownedMods: {},
    accountMods: [],
    modVideoProgress: {},
    stars: {},
    bestTimes: {},
    bossBeaten: {},
    racesDone: 0,
    chest: { readyAt: 0 },
    daily: { day: '', tasks: [] },
    firstRun: true,
    offers: { day: '', carTrials: 0, dailyModDay: '' },
    bossFails: {},
    kurguKeep: [],
  }
}
