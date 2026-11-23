/**
 * Garage transactions as pure functions: each returns a new save (never mutates the input).
 * Use with SaveStore: `const r = buyCar(store.get(), id); if (r.ok) store.update(() => r.save)`.
 */
import {
  MAX_PERF_LEVEL,
  carById,
  effectiveStats,
  modById,
  type CarId,
  type CarStats,
  type ModCategory,
  type ModDef,
  type PerfId,
} from './catalog'
import { perfPrice } from './economy'
import { defaultLook, defaultPerf, type SaveData } from './save'

export type ShopFail = 'gold' | 'owned' | 'locked' | 'unknown' | 'max'

export interface ShopResult {
  readonly ok: boolean
  /** Why it failed: not enough gold, already owned, car/prize locked, bad id, already max level. */
  readonly reason?: ShopFail
  /** The new save on success, the unchanged save on failure. */
  readonly save: SaveData
}

export interface VideoResult extends ShopResult {
  /** Videos watched towards the mod after this one. */
  readonly progress: number
  /** True when this video completed the mod. */
  readonly unlocked: boolean
}

const fail = (save: SaveData, reason: ShopFail): ShopResult => ({ ok: false, reason, save })
const okay = (save: SaveData): ShopResult => ({ ok: true, save })

/** Key in `modVideoProgress`: account-wide mods count once, car mods per car. */
export function modProgressKey(carId: CarId, mod: ModDef): string {
  return mod.accountWide ? mod.id : `${carId}:${mod.id}`
}

export function ownsCar(save: SaveData, carId: CarId): boolean {
  return save.owned.includes(carId)
}

/** Adds a car with factory perf and look (boss prizes, purchases). No-op when already owned. */
export function grantCar(save: SaveData, carId: CarId): SaveData {
  if (ownsCar(save, carId) || carById(carId) === undefined) return save
  return {
    ...save,
    owned: [...save.owned, carId],
    perf: { ...save.perf, [carId]: save.perf[carId] ?? defaultPerf() },
    mods: { ...save.mods, [carId]: save.mods[carId] ?? defaultLook() },
  }
}

export function buyCar(save: SaveData, carId: CarId): ShopResult {
  const car = carById(carId)
  if (car === undefined) return fail(save, 'unknown')
  if (ownsCar(save, carId)) return fail(save, 'owned')
  if (car.unlock !== undefined || car.price <= 0) return fail(save, 'locked')
  if (save.gold < car.price) return fail(save, 'gold')
  return okay({ ...grantCar(save, carId), gold: save.gold - car.price })
}

export function selectCar(save: SaveData, carId: CarId): ShopResult {
  if (!ownsCar(save, carId)) return fail(save, 'locked')
  return okay({ ...save, car: carId })
}

export function perfLevel(save: SaveData, carId: CarId, perf: PerfId): number {
  return save.perf[carId]?.[perf] ?? 0
}

/** Stats of a car with the player's upgrades applied (base stats if the car is unknown/not owned). */
export function carStats(save: SaveData, carId: CarId): CarStats | null {
  const car = carById(carId)
  return car === undefined ? null : effectiveStats(car, save.perf[carId] ?? {})
}

export function buyPerf(save: SaveData, carId: CarId, perf: PerfId): ShopResult {
  if (!ownsCar(save, carId)) return fail(save, 'locked')
  const level = perfLevel(save, carId, perf)
  const price = perfPrice(level)
  if (level >= MAX_PERF_LEVEL || price === null) return fail(save, 'max')
  if (save.gold < price) return fail(save, 'gold')
  const levels = { ...(save.perf[carId] ?? defaultPerf()), [perf]: level + 1 }
  return okay({ ...save, gold: save.gold - price, perf: { ...save.perf, [carId]: levels } })
}

export function ownsMod(save: SaveData, carId: CarId, modId: string): boolean {
  const mod = modById(modId)
  if (mod === undefined) return false
  if (mod.price === 0) return true
  if (mod.accountWide) return save.accountMods.includes(modId)
  return save.ownedMods[carId]?.includes(modId) ?? false
}

/** Gives a mod (gold already handled by the caller). Clears its video progress. */
export function grantMod(save: SaveData, carId: CarId, modId: string): SaveData {
  const mod = modById(modId)
  if (mod === undefined || ownsMod(save, carId, modId)) return save
  const key = modProgressKey(carId, mod)
  const { [key]: _done, ...progress } = save.modVideoProgress
  if (mod.accountWide) return { ...save, accountMods: [...save.accountMods, modId], modVideoProgress: progress }
  const list = [...(save.ownedMods[carId] ?? []), modId]
  return { ...save, ownedMods: { ...save.ownedMods, [carId]: list }, modVideoProgress: progress }
}

export function buyMod(save: SaveData, carId: CarId, modId: string): ShopResult {
  const mod = modById(modId)
  if (mod === undefined) return fail(save, 'unknown')
  if (!ownsCar(save, carId)) return fail(save, 'locked')
  if (ownsMod(save, carId, modId)) return fail(save, 'owned')
  if (save.gold < mod.price) return fail(save, 'gold')
  return okay({ ...grantMod(save, carId, modId), gold: save.gold - mod.price })
}

/** Videos already watched towards a mod (0..videos-1 while locked). */
export function modVideoCount(save: SaveData, carId: CarId, modId: string): number {
  const mod = modById(modId)
  return mod === undefined ? 0 : (save.modVideoProgress[modProgressKey(carId, mod)] ?? 0)
}

/**
 * Credits one watched rewarded video towards a mod ("2 / 3 video"); the last one unlocks it.
 * Call only after adFlow.rewarded(...) resolved true.
 */
export function watchModVideo(save: SaveData, carId: CarId, modId: string): VideoResult {
  const mod = modById(modId)
  const no = (reason: ShopFail): VideoResult => ({ ok: false, reason, save, progress: 0, unlocked: false })
  if (mod === undefined || mod.videos === 0) return no('unknown')
  if (!ownsCar(save, carId)) return no('locked')
  if (ownsMod(save, carId, modId)) return no('owned')
  const progress = modVideoCount(save, carId, modId) + 1
  if (progress >= mod.videos) return { ok: true, save: grantMod(save, carId, modId), progress, unlocked: true }
  const key = modProgressKey(carId, mod)
  return { ok: true, save: { ...save, modVideoProgress: { ...save.modVideoProgress, [key]: progress } }, progress, unlocked: false }
}

export function equipMod(save: SaveData, carId: CarId, modId: string): ShopResult {
  const mod = modById(modId)
  if (mod === undefined) return fail(save, 'unknown')
  if (!ownsCar(save, carId) || !ownsMod(save, carId, modId)) return fail(save, 'locked')
  const look = { ...(save.mods[carId] ?? defaultLook()), [mod.category]: modId }
  return okay({ ...save, mods: { ...save.mods, [carId]: look } })
}

/** The mod worn in every category (free defaults where nothing is equipped). */
export function equippedMods(save: SaveData, carId: CarId): Record<ModCategory, ModDef> {
  const look = save.mods[carId] ?? defaultLook()
  const fallback = defaultLook()
  const out = {} as Record<ModCategory, ModDef>
  for (const [cat, id] of Object.entries(look) as [ModCategory, string][]) {
    out[cat] = modById(id) ?? modById(fallback[cat])!
  }
  return out
}
