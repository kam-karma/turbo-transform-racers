/**
 * Economy numbers from spec §11.1 (to be tuned by play). One currency: gold (altın).
 */
import { PERF_PRICES } from './catalog'

/** Gold for finishing 1st..6th; any place below 6th pays the last value. */
export const PLACE_GOLD: readonly number[] = [150, 120, 100, 80, 65, 50]
/** Gold for each star the first time it is earned. */
export const STAR_GOLD = 40
export const BOSS_FIRST_REWARD = 500
export const BOSS_REPEAT_REWARD = 150
export const DAILY_TASK_GOLD = 100
export const CHEST_GOLD_MIN = 100
export const CHEST_GOLD_MAX = 300
/** Chance the daily chest also drops a cheap mod. */
export const CHEST_MOD_CHANCE = 0.3
export const CHEST_COOLDOWN_MS = 4 * 60 * 60 * 1000
/** Form levels (boat / glider / climber), 5 each — Dönüşüm cup. */
export const FORM_PRICES: readonly number[] = [150, 300, 600, 1200, 2000]
export const START_GOLD = 100
/** Kurgu Bronz opens after this many finished races. */
/**
 * World gates (Dev Ev after 2 races, Neon after the Kurgu boss or 12 stars). Off for now so
 * every world can be played from the start; turn on with `setWorldGates(true)` (or flip the
 * default) once the unlock pacing is decided.
 */
let worldGatesOn = false
export const worldGates = (): boolean => worldGatesOn
export function setWorldGates(on: boolean): void {
  worldGatesOn = on
}

export const DEV_EV_RACES_GATE = 2
/** Kaos Bronz opens with this many stars (or the Kurgu Bronz boss). */
export const NEON_STAR_GATE = 12

const count = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

export function placeGold(place: number): number {
  const last = PLACE_GOLD.length - 1
  if (!Number.isFinite(place)) return PLACE_GOLD[last]!
  const i = Math.min(last, Math.max(0, Math.floor(place) - 1))
  return PLACE_GOLD[i]!
}

/** Gold for a finished (non-boss) race: place + collected coins + 40 per new star. */
export function raceReward(place: number, coins: number, newStars: number): number {
  return placeGold(place) + count(coins) + count(newStars) * STAR_GOLD
}

/** Price of the next performance level from `level` (0..4), or null when already at max. */
export function perfPrice(level: number): number | null {
  return PERF_PRICES[Math.max(0, Math.floor(level))] ?? null
}
