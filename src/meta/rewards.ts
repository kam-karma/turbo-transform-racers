/**
 * Turns a finished race into the new save plus a breakdown for the results screen
 * (gold lines, new stars, things unlocked, next goal). Pure: pass `now` for the daily tasks.
 */
import { CARS, carById, modById, type CarId } from './catalog'
import { CUPS, cupById, raceById, type CupId } from './cups'
import { dayKey, ensureDaily, trackDaily } from './daily'
import { BOSS_FIRST_REWARD, BOSS_REPEAT_REWARD, STAR_GOLD, placeGold } from './economy'
import { cupUnlocked, nextGoal, raceUnlocked, type Goal } from './progress'
import type { SaveData, StarSet } from './save'
import { grantCar, grantMod } from './shop'

/** The free spoiler every player gets after the first race (spec §11.2: early unlocks). */
export const FIRST_RACE_GIFT = 'spoiler-kanatcik'

/** Special mods for bosses that do not give a car. Car prizes come from CarDef.unlock. */
const BOSS_MODS: Readonly<Partial<Record<CupId, string>>> = {
  'adalar-altin': 'trail-gokkusagi',
  'dev-ev-gumus': 'decal-vida',
  'dev-ev-altin': 'horn-robot',
  'neon-gumus': 'neon-lazer',
  'neon-altin': 'trail-ejderha',
}

export interface RaceResultInput {
  readonly place: number
  readonly coins: number
  readonly stars: readonly [boolean, boolean, boolean]
  readonly raceId: string
  readonly cupId: string
  readonly bossBeaten?: boolean
  /** Finish time in seconds (for best times). */
  readonly time?: number
}

export interface RewardLine {
  readonly kind: 'place' | 'coins' | 'stars' | 'boss' | 'gift'
  /** Turkish text for the results list, e.g. "1. sıra", "Yeni yıldız ×2". */
  readonly label: string
  readonly gold: number
}

export interface UnlockNote {
  readonly kind: 'car' | 'cup' | 'race' | 'mod'
  readonly id: string
  /** Turkish text, e.g. "Yeni araba: Roket". */
  readonly label: string
}

export interface RewardBreakdown {
  readonly lines: readonly RewardLine[]
  /** Total gold added by this race. */
  readonly gold: number
  /** Stars earned for the first time in this race. */
  readonly newStars: StarSet
  readonly newBest: boolean
  readonly unlocked: readonly UnlockNote[]
  /** Gold a "x2 ödül" video adds (race gold without the boss bonus). */
  readonly doubleable: number
  readonly doubled: boolean
  readonly goal: Goal
}

export function bossPrize(cup: CupId): { car?: CarId; mod?: string } {
  const car = CARS.find((c) => c.unlock?.cup === cup)?.id
  const mod = BOSS_MODS[cup]
  return { ...(car !== undefined ? { car } : {}), ...(mod !== undefined ? { mod } : {}) }
}

function cleanCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function bossStep(save: SaveData, cup: CupId, beaten: boolean, lines: RewardLine[], unlocked: UnlockNote[]): SaveData {
  const fails = save.bossFails ?? {}
  if (!beaten) return { ...save, bossFails: { ...fails, [cup]: (fails[cup] ?? 0) + 1 } }
  const first = save.bossBeaten[cup] !== true
  lines.push({ kind: 'boss', label: first ? 'Boss zaferi!' : 'Boss tekrar', gold: first ? BOSS_FIRST_REWARD : BOSS_REPEAT_REWARD })
  let next: SaveData = { ...save, bossBeaten: { ...save.bossBeaten, [cup]: true }, bossFails: { ...fails, [cup]: 0 } }
  if (!first) return next
  const prize = bossPrize(cup)
  if (prize.car !== undefined && !next.owned.includes(prize.car)) {
    next = grantCar(next, prize.car)
    unlocked.push({ kind: 'car', id: prize.car, label: `Yeni araba: ${carById(prize.car)?.name ?? prize.car}` })
  }
  if (prize.mod !== undefined) {
    next = grantMod(next, next.car, prize.mod)
    unlocked.push({ kind: 'mod', id: prize.mod, label: `Özel ödül: ${modById(prize.mod)?.name ?? prize.mod}` })
  }
  return next
}

function newUnlocks(before: SaveData, after: SaveData, raceId: string): UnlockNote[] {
  const out: UnlockNote[] = []
  for (const cup of CUPS) {
    if (!cupUnlocked(before, cup.id) && cupUnlocked(after, cup.id)) out.push({ kind: 'cup', id: cup.id, label: `Yeni kupa: ${cup.name}` })
  }
  const race = raceById(raceId)
  const cup = race === undefined ? undefined : cupById(race.cup)
  for (const r of cup?.races ?? []) {
    if (!raceUnlocked(before, r) && raceUnlocked(after, r)) {
      out.push({ kind: 'race', id: r.id, label: r.boss ? `Boss açıldı: ${r.name.replace('Boss: ', '')}` : `Yeni yarış: ${r.name}` })
    }
  }
  return out
}

/** Applies a finished race. Unknown race ids still pay place + coins (no stars or progress). */
export function applyRaceResult(
  save: SaveData,
  input: RaceResultInput,
  opts: { now?: number } = {},
): { save: SaveData; breakdown: RewardBreakdown } {
  const race = raceById(input.raceId)
  const cup = race === undefined ? undefined : cupById(race.cup)
  const isBoss = race?.boss === true
  const lines: RewardLine[] = []
  const unlocked: UnlockNote[] = []

  const prevStars: StarSet = save.stars[input.raceId] ?? [false, false, false]
  // Stars only count on real cup races; a test track still pays place + coins.
  const got = input.stars.map((s) => s === true && race !== undefined) as StarSet
  const newStars = got.map((s, i) => s && !prevStars[i]) as StarSet
  const newCount = newStars.filter(Boolean).length

  if (!isBoss) lines.push({ kind: 'place', label: `${Math.max(1, Math.floor(input.place) || 1)}. sıra`, gold: placeGold(input.place) })
  const coins = cleanCount(input.coins)
  if (coins > 0) lines.push({ kind: 'coins', label: 'Toplanan altın', gold: coins })
  if (newCount > 0) lines.push({ kind: 'stars', label: `Yeni yıldız ×${newCount}`, gold: newCount * STAR_GOLD })
  const doubleable = lines.reduce((n, l) => n + l.gold, 0)

  let next: SaveData = { ...save, racesDone: save.racesDone + 1, firstRun: false }
  if (race !== undefined) {
    const merged = got.map((s, i) => s || prevStars[i]) as StarSet
    next = { ...next, stars: { ...next.stars, [race.id]: merged } }
  }
  const time = input.time
  const oldBest = save.bestTimes[input.raceId]
  const newBest = race !== undefined && time !== undefined && Number.isFinite(time) && time > 0 && (oldBest === undefined || time < oldBest)
  if (newBest) next = { ...next, bestTimes: { ...next.bestTimes, [input.raceId]: time } }

  if (isBoss && cup !== undefined) next = bossStep(next, cup.id, input.bossBeaten === true, lines, unlocked)

  if (save.racesDone === 0) {
    next = grantMod(next, next.car, FIRST_RACE_GIFT)
    lines.push({ kind: 'gift', label: 'Hediye: Kanatçık spoiler', gold: 0 })
    unlocked.push({ kind: 'mod', id: FIRST_RACE_GIFT, label: `Hediye: ${modById(FIRST_RACE_GIFT)?.name ?? 'Spoiler'}` })
  }

  const gold = lines.reduce((n, l) => n + l.gold, 0)
  next = { ...next, gold: next.gold + gold }
  if (cup !== undefined) {
    next = ensureDaily(next, dayKey(new Date(opts.now ?? Date.now())))
    const starCount = got.filter(Boolean).length
    next = trackDaily(next, { kind: 'race', place: input.place, stars: starCount, coins, world: cup.world, boss: isBoss })
  }
  unlocked.push(...newUnlocks(save, next, input.raceId))

  return {
    save: next,
    breakdown: { lines, gold, newStars, newBest, unlocked, doubleable, doubled: false, goal: nextGoal(next) },
  }
}

/** Adds the "x2 ödül" video bonus once per breakdown. */
export function applyDoubleReward(save: SaveData, breakdown: RewardBreakdown): { save: SaveData; breakdown: RewardBreakdown } {
  if (breakdown.doubled || breakdown.doubleable <= 0) return { save, breakdown }
  return { save: { ...save, gold: save.gold + breakdown.doubleable }, breakdown: { ...breakdown, doubled: true } }
}
