/**
 * Turns anything read from storage into a valid SaveData. Never throws: bad fields fall back to
 * defaults one by one, so a half-broken save keeps everything that is still good.
 */
import { CARS, MOD_CATEGORIES, PERF_IDS, MAX_PERF_LEVEL, STARTER_CAR, carById, modById, type CarId, type ModCategory, type PerfId } from './catalog'
import { CUPS, isCupId, raceById, type CupId } from './cups'
import { defaultLook, defaultPerf, defaultSave, type DailyTask, type SaveData, type SaveOffers, type StarSet } from './saveData'

type Obj = Record<string, unknown>

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const obj = (x: unknown): Obj => (isObj(x) ? x : {})
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function int(x: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return fallback
  return Math.min(max, Math.max(min, Math.floor(x)))
}

const day = (x: unknown): string => (typeof x === 'string' && DAY_RE.test(x) ? x : '')

function owned(raw: unknown): CarId[] {
  const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && carById(x) !== undefined) : []
  return [STARTER_CAR, ...new Set(ids.filter((id) => id !== STARTER_CAR))]
}

function perfOf(raw: unknown): Record<PerfId, number> {
  const src = obj(raw)
  const out = defaultPerf()
  for (const p of PERF_IDS) out[p] = int(src[p], 0, 0, MAX_PERF_LEVEL)
  return out
}

function carModList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ok = raw.filter((id): id is string => {
    const m = typeof id === 'string' ? modById(id) : undefined
    return m !== undefined && !m.accountWide && m.price > 0
  })
  return [...new Set(ok)]
}

function accountMods(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ok = raw.filter((id): id is string => typeof id === 'string' && modById(id)?.accountWide === true)
  return [...new Set(ok)]
}

function look(raw: unknown, carMods: readonly string[], account: readonly string[]): Record<ModCategory, string> {
  const src = obj(raw)
  const out = defaultLook()
  for (const cat of MOD_CATEGORIES) {
    const id = src[cat]
    const mod = typeof id === 'string' ? modById(id) : undefined
    if (mod === undefined || mod.category !== cat) continue
    const has = mod.price === 0 || (mod.accountWide ? account.includes(mod.id) : carMods.includes(mod.id))
    if (has) out[cat] = mod.id
  }
  return out
}

function stars(raw: unknown): Record<string, StarSet> {
  const out: Record<string, StarSet> = {}
  for (const [id, v] of Object.entries(obj(raw))) {
    if (raceById(id) === undefined || !Array.isArray(v)) continue
    out[id] = [v[0] === true, v[1] === true, v[2] === true]
  }
  return out
}

function bestTimes(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(obj(raw))) {
    if (raceById(id) !== undefined && typeof v === 'number' && Number.isFinite(v) && v > 0) out[id] = v
  }
  return out
}

function cupFlags(raw: unknown): Partial<Record<CupId, boolean>> {
  const src = obj(raw)
  const out: Partial<Record<CupId, boolean>> = {}
  for (const cup of CUPS) if (src[cup.id] === true) out[cup.id] = true
  return out
}

function cupCounts(raw: unknown): Partial<Record<CupId, number>> {
  const out: Partial<Record<CupId, number>> = {}
  for (const [id, v] of Object.entries(obj(raw))) if (isCupId(id)) out[id] = int(v, 0)
  return out
}

function videoProgress(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, v] of Object.entries(obj(raw))) {
    const n = int(v, 0, 0, 3)
    if (n > 0) out[key] = n
  }
  return out
}

function task(raw: unknown): DailyTask | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null
  const goal = int(raw.goal, 1, 1)
  const progress = int(raw.progress, 0, 0, goal)
  const done = raw.done === true || progress >= goal
  return { id: raw.id, progress, goal, done, claimed: done && raw.claimed === true }
}

function daily(raw: unknown): SaveData['daily'] {
  const src = obj(raw)
  const tasks = Array.isArray(src.tasks) ? src.tasks.map(task).filter((t): t is DailyTask => t !== null) : []
  return { day: day(src.day), tasks: tasks.slice(0, 6) }
}

function offers(raw: unknown): SaveOffers {
  const src = obj(raw)
  return { day: day(src.day), carTrials: int(src.carTrials, 0, 0, 99), dailyModDay: day(src.dailyModDay) }
}

function repairUnsafe(raw: unknown): SaveData {
  if (!isObj(raw)) return defaultSave()
  const base = defaultSave()
  const cars = owned(raw.owned)
  const account = accountMods(raw.accountMods)
  const rawOwnedMods = obj(raw.ownedMods)
  const ownedMods: Record<CarId, string[]> = {}
  for (const car of CARS) {
    const list = carModList(rawOwnedMods[car.id])
    if (list.length > 0) ownedMods[car.id] = list
  }
  const rawPerf = obj(raw.perf)
  const rawMods = obj(raw.mods)
  const perf: SaveData['perf'] = {}
  const mods: SaveData['mods'] = {}
  for (const car of cars) {
    perf[car] = perfOf(rawPerf[car])
    mods[car] = look(rawMods[car], ownedMods[car] ?? [], account)
  }
  const racesDone = int(raw.racesDone, 0)
  const car = typeof raw.car === 'string' && cars.includes(raw.car) ? raw.car : STARTER_CAR
  return {
    v: 1,
    gold: int(raw.gold, base.gold),
    car,
    owned: cars,
    perf,
    mods,
    ownedMods,
    accountMods: account,
    modVideoProgress: videoProgress(raw.modVideoProgress),
    stars: stars(raw.stars),
    bestTimes: bestTimes(raw.bestTimes),
    bossBeaten: cupFlags(raw.bossBeaten),
    racesDone,
    chest: { readyAt: int(obj(raw.chest).readyAt, 0) },
    daily: daily(raw.daily),
    firstRun: typeof raw.firstRun === 'boolean' ? raw.firstRun : racesDone === 0,
    offers: offers(raw.offers),
    bossFails: cupCounts(raw.bossFails),
    kurguKeep: Array.isArray(raw.kurguKeep) ? raw.kurguKeep.filter((x): x is string => typeof x === 'string').slice(0, 2) : [],
  }
}

/** Any value → a valid save. Unknown future versions are read field by field, best effort. */
export function repairSave(raw: unknown): SaveData {
  try {
    return repairUnsafe(raw)
  } catch (error) {
    console.error('Save could not be repaired, starting fresh:', error)
    return defaultSave()
  }
}
