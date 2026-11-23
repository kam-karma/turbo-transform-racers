/**
 * Unlock rules (spec §11.3, contract) and progress summaries for the menus.
 *  - Dönüşüm Bronz is open from the start.
 *  - Kurgu Bronz opens after 2 finished races.
 *  - Kaos Bronz opens after the Kurgu Bronz boss OR 12 stars.
 *  - A world's Gümüş opens after its Bronz boss; Altın after its Gümüş boss.
 *  - Inside a cup: race N+1 opens when race N is finished; the boss when all 5 are finished.
 */
import { CARS } from './catalog'
import { CUPS, TIERS, WORLD_INFO, cupById, cupsOfWorld, type CupDef, type CupId, type RaceDef, type WorldId } from './cups'
import { DEV_EV_RACES_GATE, NEON_STAR_GATE, worldGates } from './economy'
import type { SaveData } from './save'

export interface Goal {
  readonly kind: 'car' | 'cup' | 'boss'
  /** Short Turkish line for the "az kaldı" bar. */
  readonly label: string
  /** 0..1 */
  readonly progress: number
  /** Car id or cup id the goal points at. */
  readonly id: string
}

export interface CupProgress {
  readonly stars: number
  readonly maxStars: number
  /** Finished races in the cup, boss included. */
  readonly finished: number
  readonly races: number
  readonly bossBeaten: boolean
}

const RACES_BEFORE_BOSS = 5

export function totalStars(save: SaveData): number {
  let n = 0
  for (const set of Object.values(save.stars)) for (const s of set) if (s) n += 1
  return n
}

export function raceFinished(save: SaveData, raceId: string): boolean {
  return raceId in save.stars
}

function tierIndex(cup: CupDef): number {
  return TIERS.indexOf(cup.tier)
}

function previousCup(cup: CupDef): CupDef | undefined {
  return cupsOfWorld(cup.world)[tierIndex(cup) - 1]
}

export function cupUnlocked(save: SaveData, cupId: CupId): boolean {
  const cup = cupById(cupId)
  if (cup === undefined) return false
  const before = previousCup(cup)
  if (before !== undefined) return save.bossBeaten[before.id] === true && cupUnlocked(save, before.id)
  if (cup.world === 'adalar' || !worldGates()) return true
  if (cup.world === 'dev-ev') return save.racesDone >= DEV_EV_RACES_GATE
  return save.bossBeaten['dev-ev-bronz'] === true || totalStars(save) >= NEON_STAR_GATE
}

/** Turkish reason a cup is locked, or null when it is open. */
export function cupLockReason(save: SaveData, cupId: CupId): string | null {
  if (cupUnlocked(save, cupId)) return null
  const cup = cupById(cupId)
  if (cup === undefined) return 'Bu kupa bulunamadı'
  const before = previousCup(cup)
  if (before !== undefined) return `${before.name} boss'unu yen`
  if (cup.world === 'dev-ev') {
    const left = Math.max(1, DEV_EV_RACES_GATE - save.racesDone)
    return `${left} yarış daha bitir`
  }
  return `${WORLD_INFO['dev-ev'].bossName} boss'unu yen ya da ${NEON_STAR_GATE} yıldız topla`
}

function finishedInCup(save: SaveData, cup: CupDef): number {
  return cup.races.filter((r) => !r.boss && raceFinished(save, r.id)).length
}

export function raceUnlocked(save: SaveData, race: RaceDef): boolean {
  const cup = cupById(race.cup)
  if (cup === undefined || !cupUnlocked(save, cup.id)) return false
  if (race.boss) return finishedInCup(save, cup) >= RACES_BEFORE_BOSS
  if (race.index === 0) return true
  const prev = cup.races[race.index - 1]
  return prev !== undefined && raceFinished(save, prev.id)
}

export function cupProgress(save: SaveData, cupId: CupId): CupProgress {
  const cup = cupById(cupId)
  const races = cup?.races ?? []
  let stars = 0
  let finished = 0
  for (const r of races) {
    const set = save.stars[r.id]
    if (set === undefined) continue
    finished += 1
    stars += set.filter(Boolean).length
  }
  return { stars, maxStars: races.length * 3, finished, races: races.length, bossBeaten: save.bossBeaten[cupId] === true }
}

export function worldProgress(save: SaveData, world: WorldId): CupProgress & { readonly unlocked: boolean } {
  const parts = cupsOfWorld(world).map((c) => cupProgress(save, c.id))
  const sum = (f: (p: CupProgress) => number): number => parts.reduce((n, p) => n + f(p), 0)
  return {
    stars: sum((p) => p.stars),
    maxStars: sum((p) => p.maxStars),
    finished: sum((p) => p.finished),
    races: sum((p) => p.races),
    bossBeaten: parts.every((p) => p.bossBeaten),
    unlocked: cupUnlocked(save, `${world}-bronz`),
  }
}

/**
 * What the big "YARIŞ" button plays: the first open race not yet finished (boss included),
 * walking cups in ladder order; if everything open is finished, the last open race.
 */
export function nextRace(save: SaveData): RaceDef | null {
  let lastOpen: RaceDef | null = null
  const order = TIERS.flatMap((tier) => CUPS.filter((c) => c.tier === tier))
  for (const cup of order) {
    if (!cupUnlocked(save, cup.id)) continue
    for (const race of cup.races) {
      if (!raceUnlocked(save, race)) continue
      const done = race.boss ? save.bossBeaten[cup.id] === true : raceFinished(save, race.id)
      if (!done) return race
      lastOpen = race
    }
  }
  return lastOpen
}

function carGoal(save: SaveData): Goal | null {
  const next = CARS.filter((c) => c.unlock === undefined && c.price > 0 && !save.owned.includes(c.id)).sort(
    (a, b) => a.price - b.price,
  )[0]
  if (next === undefined) return null
  const progress = Math.min(1, save.gold / next.price)
  const label = progress >= 1 ? `${next.name} seni bekliyor!` : `${next.name}: %${Math.floor(progress * 100)}`
  return { kind: 'car', label, progress, id: next.id }
}

function bossGoals(save: SaveData): Goal[] {
  return CUPS.filter((c) => cupUnlocked(save, c.id) && save.bossBeaten[c.id] !== true).map((cup) => {
    const done = finishedInCup(save, cup)
    const left = RACES_BEFORE_BOSS - done
    const label = left <= 0 ? `${WORLD_INFO[cup.world].bossName} seni bekliyor!` : `Boss'a ${left} yarış kaldı`
    return { kind: 'boss', label, progress: Math.min(1, done / RACES_BEFORE_BOSS), id: cup.id }
  })
}

function cupGoals(save: SaveData): Goal[] {
  const out: Goal[] = []
  if (!cupUnlocked(save, 'dev-ev-bronz')) {
    const left = DEV_EV_RACES_GATE - save.racesDone
    out.push({
      kind: 'cup',
      label: `${WORLD_INFO['dev-ev'].name}'e ${left} yarış kaldı`,
      progress: Math.min(1, save.racesDone / DEV_EV_RACES_GATE),
      id: 'dev-ev-bronz',
    })
  }
  if (!cupUnlocked(save, 'neon-bronz')) {
    const stars = totalStars(save)
    out.push({
      kind: 'cup',
      label: `${WORLD_INFO.neon.name}'e ${NEON_STAR_GATE - stars} yıldız kaldı`,
      progress: Math.min(1, stars / NEON_STAR_GATE),
      id: 'neon-bronz',
    })
  }
  return out
}

/** The closest goal for the "az kaldı" bar on results and home screens. */
export function nextGoal(save: SaveData): Goal {
  const all = [carGoal(save), ...bossGoals(save), ...cupGoals(save)].filter((g): g is Goal => g !== null)
  const best = all.sort((a, b) => b.progress - a.progress)[0]
  return best ?? { kind: 'car', label: 'Her şeyi açtın, şampiyon!', progress: 1, id: '' }
}
