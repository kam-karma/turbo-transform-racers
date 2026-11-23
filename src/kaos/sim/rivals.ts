/**
 * Which Kupa Pilotları race in a Kaos race. Higher cup tiers bring better pilots; the very
 * first race of a player brings gentler ones. Kaos bots drive live physics (they collide),
 * so their pace is their pilot's car power times a tier factor.
 */
import { rng } from '../../sim/bot'
import { PILOTS, type Pilot } from '../../sim/pilots'

export interface KaosRival {
  readonly pilot: Pilot
  /** Multiplier on the player's top speed. */
  readonly power: number
  /** Car model id for ctx.modelFor. */
  readonly car: string
}

const CARS = ['r40', 'r245', 'rt40'] as const
/** Pilot index windows per tier (0 = best pilot). */
const WINDOW: readonly (readonly [number, number])[] = [[6, 14], [3, 11], [0, 8]]
const TIER_POWER = [0.97, 1, 1.03] as const

export function tierOf(cupId: string): 0 | 1 | 2 {
  if (cupId.endsWith('altin')) return 2
  if (cupId.endsWith('gumus')) return 1
  return 0
}

const hash = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function pickKaosRivals(cupId: string, raceId: string, firstRace: boolean, count = 5): KaosRival[] {
  const tier = tierOf(cupId)
  const [lo, hi] = WINDOW[tier]
  const pool = PILOTS.slice(lo, hi + 1)
  const r = rng(hash(raceId))
  const shuffled = pool.map((p) => ({ p, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.p)
  return shuffled.slice(0, count).map((pilot, i) => ({
    pilot,
    power: pilot.skill.power * TIER_POWER[tier] * (firstRace ? 0.93 : 1),
    car: CARS[i % CARS.length],
  }))
}
