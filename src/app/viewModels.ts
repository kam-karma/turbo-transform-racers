/**
 * Pure view-models for the menus: everything a screen shows, computed from the save and the
 * META data, with no DOM. Unit tested (viewModels.test.ts).
 */
import { CARS, MAX_PERF_LEVEL, PERF_IDS, PERF_NAMES, carById, effectiveStats, modsOf, type CarDef, type ModCategory, type ModDef, type PerfId } from '../meta/catalog'
import { TIERS, TIER_NAMES, WORLDS, WORLD_INFO, cupById, cupsOfWorld, raceById, type CupTier, type RaceDef, type WorldId } from '../meta/cups'
import { perfPrice } from '../meta/economy'
import { cupLockReason, cupProgress, cupUnlocked, nextRace, raceUnlocked, worldProgress } from '../meta/progress'
import type { SaveData } from '../meta/save'
import { equippedMods, modVideoCount, ownsCar, ownsMod, perfLevel } from '../meta/shop'

export interface TierBadge {
  readonly tier: CupTier
  readonly name: string
  readonly unlocked: boolean
  readonly bossBeaten: boolean
  readonly stars: number
  readonly maxStars: number
  readonly lockReason: string | null
}

export interface WorldCardVM {
  readonly world: WorldId
  readonly name: string
  readonly cupName: string
  readonly unlocked: boolean
  readonly lockReason: string | null
  readonly stars: number
  readonly maxStars: number
  readonly tiers: readonly TierBadge[]
  /** The world the YARIŞ button would play in. */
  readonly current: boolean
}

function tierBadges(save: SaveData, world: WorldId): TierBadge[] {
  return cupsOfWorld(world).map((cup) => {
    const p = cupProgress(save, cup.id)
    return { tier: cup.tier, name: TIER_NAMES[cup.tier], unlocked: cupUnlocked(save, cup.id), bossBeaten: p.bossBeaten, stars: p.stars, maxStars: p.maxStars, lockReason: cupLockReason(save, cup.id) }
  })
}

export function worldCards(save: SaveData): WorldCardVM[] {
  const next = nextRace(save)
  const nextWorld = next === null ? null : cupById(next.cup)?.world ?? null
  return WORLDS.map((world) => {
    const p = worldProgress(save, world)
    const info = WORLD_INFO[world]
    return {
      world,
      name: info.name,
      cupName: info.cupName,
      unlocked: p.unlocked,
      lockReason: cupLockReason(save, `${world}-bronz`),
      stars: p.stars,
      maxStars: p.maxStars,
      tiers: tierBadges(save, world),
      current: world === nextWorld,
    }
  })
}

export interface PlayButtonVM {
  readonly race: RaceDef | null
  /** "Şeker Adası · 1/5" or "Dev Balina Dalgası · Boss". */
  readonly subtitle: string
  /** "Bronz Dönüşüm Kupası". */
  readonly cupName: string
}

export function playButton(save: SaveData): PlayButtonVM {
  const race = nextRace(save)
  if (race === null) return { race: null, subtitle: '', cupName: '' }
  const cup = cupById(race.cup)
  const subtitle = race.boss ? `${cup === undefined ? race.name : WORLD_INFO[cup.world].bossName} · Boss` : `${race.name} · ${race.index + 1}/5`
  return { race, subtitle, cupName: cup?.name ?? '' }
}

export interface RaceNodeVM {
  readonly race: RaceDef
  readonly label: string
  readonly unlocked: boolean
  readonly finished: boolean
  readonly stars: readonly [boolean, boolean, boolean]
  readonly bestTime: number | null
  /** The next race to play in this cup (pulsing node). */
  readonly current: boolean
}

export interface CupMapVM {
  readonly world: WorldId
  readonly worldName: string
  readonly tier: CupTier
  readonly cupName: string
  readonly unlocked: boolean
  readonly lockReason: string | null
  readonly nodes: readonly RaceNodeVM[]
  readonly tabs: readonly TierBadge[]
  readonly stars: number
  readonly maxStars: number
  readonly bossName: string
}

const NO_STARS: readonly [boolean, boolean, boolean] = [false, false, false]

/** The tier a world's map opens on: the highest unlocked one with something left to do. */
export function defaultTier(save: SaveData, world: WorldId): CupTier {
  const open = cupsOfWorld(world).filter((c) => cupUnlocked(save, c.id))
  const todo = open.find((c) => save.bossBeaten[c.id] !== true)
  return (todo ?? open[open.length - 1] ?? cupsOfWorld(world)[0]!).tier
}

export function cupMap(save: SaveData, world: WorldId, tier: CupTier): CupMapVM {
  const cup = cupsOfWorld(world).find((c) => c.tier === tier)!
  const p = cupProgress(save, cup.id)
  let currentSet = false
  const nodes = cup.races.map((race) => {
    const unlocked = raceUnlocked(save, race)
    const finished = race.boss ? save.bossBeaten[cup.id] === true : race.id in save.stars
    const current = !currentSet && unlocked && !finished
    if (current) currentSet = true
    return {
      race,
      label: race.boss ? 'BOSS' : String(race.index + 1),
      unlocked,
      finished,
      stars: save.stars[race.id] ?? NO_STARS,
      bestTime: save.bestTimes[race.id] ?? null,
      current,
    }
  })
  return {
    world,
    worldName: WORLD_INFO[world].name,
    tier,
    cupName: cup.name,
    unlocked: cupUnlocked(save, cup.id),
    lockReason: cupLockReason(save, cup.id),
    nodes,
    tabs: tierBadges(save, world),
    stars: p.stars,
    maxStars: p.maxStars,
    bossName: WORLD_INFO[world].bossName,
  }
}

/** Race position in its cup for the intro card: "Yarış 3/5" or "Boss". */
export function raceLabel(raceId: string): string {
  const r = raceById(raceId)
  if (r === undefined) return ''
  return r.boss ? 'Boss Yarışı' : `Yarış ${r.index + 1}/5`
}

export const TIER_ORDER = TIERS

// --- garage ---------------------------------------------------------------------------

export interface CarCardVM {
  readonly car: CarDef
  readonly owned: boolean
  readonly selected: boolean
  readonly canAfford: boolean
  /** Prize cars: "Bronz Dönüşüm Kupası boss'unu yen". */
  readonly lockText: string | null
  readonly stats: { readonly speed: number; readonly accel: number; readonly handling: number }
}

export function carCards(save: SaveData): CarCardVM[] {
  return CARS.map((car) => {
    const owned = ownsCar(save, car.id)
    const prize = car.unlock !== undefined && !owned ? cupById(car.unlock.cup) : undefined
    return {
      car,
      owned,
      selected: save.car === car.id,
      canAfford: save.gold >= car.price,
      lockText: prize === undefined ? null : `${prize.name} boss'unu yen`,
      stats: owned ? effectiveStats(car, save.perf[car.id] ?? {}) : car.stats,
    }
  })
}

export interface PerfRowVM {
  readonly perf: PerfId
  readonly name: string
  readonly level: number
  readonly max: number
  readonly price: number | null
  readonly canAfford: boolean
}

export function perfRows(save: SaveData, carId: string): PerfRowVM[] {
  return PERF_IDS.map((perf) => {
    const level = perfLevel(save, carId, perf)
    const price = level >= MAX_PERF_LEVEL ? null : perfPrice(level)
    return { perf, name: PERF_NAMES[perf], level, max: MAX_PERF_LEVEL, price, canAfford: price !== null && save.gold >= price }
  })
}

export interface ModItemVM {
  readonly mod: ModDef
  readonly owned: boolean
  readonly equipped: boolean
  readonly canAfford: boolean
  /** Videos watched so far (0..mod.videos). */
  readonly videos: number
}

export function modItems(save: SaveData, carId: string, cat: ModCategory): ModItemVM[] {
  const worn = equippedMods(save, carId)[cat]
  return modsOf(cat).map((mod) => ({
    mod,
    owned: ownsMod(save, carId, mod.id),
    equipped: worn.id === mod.id,
    canAfford: save.gold >= mod.price,
    videos: modVideoCount(save, carId, mod.id),
  }))
}

/** Stat bar fill 0..1 on a 1..12 scale (upgrades may pass 10). */
export const statFill = (v: number): number => Math.max(0.06, Math.min(1, v / 12))

export const carName = (id: string): string => carById(id)?.name ?? id
