/**
 * A bot driver with tunable skill. It drives the same physics as the player and is used to
 * make the shipped ghosts (tools/make-ghosts) and, later, Kaos rivals.
 */
import { FORM_FOR } from './forms'
import { GhostRecorder, type Ghost } from './ghost'
import { DEFAULT_PARAMS, newRacer, stepRacer, type RaceInput, type RacerParams, type RacerState } from './racer'
import type { Track } from './track'

export interface BotSkill {
  /** Chance to switch form inside the perfect window. */
  readonly perfectChance: number
  /** Seconds before the boundary for a non-perfect early switch. */
  readonly earlyRange: readonly [number, number]
  /** Chance to switch only after the boundary (0.1-0.4 s late). */
  readonly lateChance: number
  /** Metres of slow wander around the racing line. */
  readonly lineNoise: number
  /** Chance per second of lifting off the throttle for a moment. */
  readonly throttleLift: number
  /** 0..1 how strongly coins pull the line. */
  readonly coinPull: number
  /** Top-speed multiplier (the pilot's car). */
  readonly power: number
}

export interface BotMemory {
  boundaryS: number
  /** Seconds before (+) or after (−) the boundary the bot will switch. */
  lead: number
  noise: number
  noiseVel: number
  liftT: number
}

export const newBotMemory = (): BotMemory => ({ boundaryS: -1, lead: 0, noise: 0, noiseVel: 0, liftT: 0 })

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function planSwitch(skill: BotSkill, rand: () => number): number {
  const r = rand()
  if (r < skill.perfectChance) return 0.05 + 0.22 * rand()
  if (r < skill.perfectChance + skill.lateChance) return -(0.1 + 0.3 * rand())
  const [a, b] = skill.earlyRange
  return a + (b - a) * rand()
}

function chooseForm(st: RacerState, track: Track, skill: BotSkill, rand: () => number, mem: BotMemory): RaceInput['form'] {
  const needNow = FORM_FOR[track.surfaceAt(st.s)]
  const next = track.nextBoundary(st.s)
  // Already switched early for the coming surface: hold it, do not flip back for the last metres.
  if (st.form !== needNow && next !== null && next.s === mem.boundaryS && st.form === FORM_FOR[next.surface]
    && (next.s - st.s) / Math.max(st.speed, 1) <= Math.max(mem.lead, 0) + 0.3) return null
  if (st.form !== needNow) {
    // Past a boundary in the wrong form: a planned late switch, or catching up at once.
    return mem.lead < 0 && st.crossT < -mem.lead ? null : needNow
  }
  if (next === null) return null
  if (next.s !== mem.boundaryS) {
    mem.boundaryS = next.s
    mem.lead = planSwitch(skill, rand)
  }
  const ttb = (next.s - st.s) / Math.max(st.speed, 1)
  return mem.lead >= 0 && ttb <= mem.lead ? FORM_FOR[next.surface] : null
}

function steerFor(st: RacerState, track: Track, skill: BotSkill, rand: () => number, mem: BotMemory, dt: number): number {
  const ahead = track.frameAt(st.s + 25)
  const half = ahead.width / 2 - 2.5
  let target = Math.max(-half, Math.min(half, ahead.curvH * 400))
  const coins = track.def.coins
  for (let i = st.nextCoin; i < coins.length && coins[i].s < st.s + 45; i++) {
    if (coins[i].s > st.s + 6) {
      target += (coins[i].d - target) * skill.coinPull
      break
    }
  }
  mem.noiseVel += ((rand() - 0.5) * 4 - mem.noiseVel * 0.8) * dt
  mem.noise += mem.noiseVel * dt
  mem.noise = Math.max(-1, Math.min(1, mem.noise))
  target += mem.noise * skill.lineNoise
  const err = target - st.d
  return Math.max(-1, Math.min(1, err * 0.3 - st.yaw * 1.5))
}

export function botInput(st: RacerState, track: Track, skill: BotSkill, rand: () => number, mem: BotMemory, dt = 1 / 60): RaceInput {
  if (mem.liftT > 0) mem.liftT -= dt
  else if (rand() < skill.throttleLift * dt) mem.liftT = 0.3 + 0.5 * rand()
  return {
    throttle: mem.liftT > 0 ? 0.4 : 1,
    brake: 0,
    steer: steerFor(st, track, skill, rand, mem, dt),
    form: chooseForm(st, track, skill, rand, mem),
  }
}

const MAX_RACE_S = 400

/** Drives a whole race and returns it as a ghost (meta fields filled by the caller). */
export function runBot(track: Track, skill: BotSkill, seed: number, params: RacerParams = DEFAULT_PARAMS, startD = 0, startS = 0): Ghost {
  const rand = rng(seed)
  const mem = newBotMemory()
  const p = { ...params, vmax: params.vmax * skill.power }
  const rec = new GhostRecorder()
  const dt = 1 / 60
  let st = newRacer(track, startS, startD)
  rec.push(st)
  while (!st.finished && st.time < MAX_RACE_S) {
    st = stepRacer(st, botInput(st, track, skill, rand, mem, dt), p, track, dt).st
    rec.push(st)
  }
  return rec.finish({ id: `bot-${seed}`, pilot: '', car: '', color: 0xffffff, time: st.time }, st)
}
