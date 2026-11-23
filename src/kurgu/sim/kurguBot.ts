/**
 * Kurgu bot drivers: the Kupa Pilotları reading the gates ahead and steering into the pickup
 * lane with the part they need (a good pilot usually guesses right, a beginner grabs at
 * random), dodging toy obstacles and re-catching knocked-off parts. Their races become the
 * ghost rivals (spec §12.5), recorded with their part events.
 */
import type { BotSkill } from '../../sim/bot'
import { rng } from '../../sim/bot'
import { PILOTS } from '../../sim/pilots'
import { DEFAULT_PARAMS, type RaceInput, type RacerParams } from '../../sim/racer'
import type { GhostMeta } from '../../sim/ghost'
import type { KurguTrack } from './kurguTrack'
import { newKurgu, stepKurgu, type KurguState } from './kurguRacer'
import { KurguRecorder, type KurguGhost } from './kurguGhost'
import { hasPart, PART_DEFS, type PartId } from './parts'

export interface KurguSkill extends BotSkill {
  /** Chance to read the next gate and take the part it asks for. */
  readonly gateSense: number
}

export const kurguSkill = (pilotIndex: number): KurguSkill => {
  const i = Math.max(0, Math.min(PILOTS.length - 1, pilotIndex))
  const level = 1 - i / (PILOTS.length - 1)
  return { ...PILOTS[i].skill, gateSense: 0.3 + 0.65 * level }
}

export interface KurguBotMemory {
  row: number
  laneD: number | null
  noise: number
  noiseVel: number
  liftT: number
  chaseDrop: boolean
}

export const newKurguBotMemory = (): KurguBotMemory => ({ row: -1, laneD: null, noise: 0, noiseVel: 0, liftT: 0, chaseDrop: false })

const ROW_LOOK = 85
const OBS_LOOK = 42

function chooseLane(k: KurguState, kt: KurguTrack, skill: KurguSkill, rand: () => number, mem: KurguBotMemory): void {
  const row = kt.def.rows[k.nextRow]
  mem.row = k.nextRow
  mem.laneD = null
  if (row === undefined) return
  const gate = kt.def.gates.find((g) => g.s0 > row.s)
  const wanted: PartId[] = gate === undefined ? [] : gate.kind === 'water' ? ['float', 'propeller'] : [gate.need]
  if (gate !== undefined && rand() < skill.gateSense && !wanted.some((p) => hasPart(k.lo, p))) {
    const lane = row.lanes.find((l) => wanted.includes(l.part))
    if (lane !== undefined) {
      mem.laneD = lane.d
      return
    }
  }
  if (rand() < 0.2) return
  // Otherwise something new for an empty slot, else anything.
  const fresh = row.lanes.filter((l) => k.lo[PART_DEFS[l.part].slot] === null)
  const pool = fresh.length > 0 ? fresh : row.lanes
  mem.laneD = pool[Math.floor(rand() * pool.length) % pool.length].d
}

function targetD(k: KurguState, kt: KurguTrack, skill: KurguSkill, rand: () => number, mem: KurguBotMemory, dt: number): number {
  const r = k.r
  const ahead = kt.main.frameAt(r.s + 25)
  const half = ahead.width / 2 - 2.2
  let target = Math.max(-half, Math.min(half, ahead.curvH * 400))
  const row = kt.def.rows[k.nextRow]
  if (row !== undefined && row.s - r.s < ROW_LOOK) {
    if (mem.row !== k.nextRow) chooseLane(k, kt, skill, rand, mem)
    if (mem.laneD !== null) target = mem.laneD
  }
  const drop = k.drops[0]
  if (drop !== undefined && drop.s - r.s < 55) {
    if (!mem.chaseDrop && rand() < skill.gateSense) mem.chaseDrop = true
    if (mem.chaseDrop) target = drop.d
  } else mem.chaseDrop = false
  const crush = hasPart(k.lo, 'bigwheel') || hasPart(k.lo, 'drill') || hasPart(k.lo, 'bumper')
  for (let i = k.nextObs; !crush && i < kt.def.obstacles.length; i++) {
    const o = kt.def.obstacles[i]
    if (o.s - r.s > OBS_LOOK) break
    if (Math.abs(o.d - target) < o.r + 2.2) target = o.d + (target >= o.d ? 1 : -1) * (o.r + 3)
  }
  mem.noiseVel += ((rand() - 0.5) * 4 - mem.noiseVel * 0.8) * dt
  mem.noise = Math.max(-1, Math.min(1, mem.noise + mem.noiseVel * dt))
  target += mem.noise * skill.lineNoise * 0.5
  return Math.max(-half - 1, Math.min(half + 1, target))
}

export function kurguBotInput(k: KurguState, kt: KurguTrack, skill: KurguSkill, rand: () => number, mem: KurguBotMemory, dt = 1 / 60): RaceInput {
  if (mem.liftT > 0) mem.liftT -= dt
  else if (rand() < skill.throttleLift * dt) mem.liftT = 0.3 + 0.5 * rand()
  const err = targetD(k, kt, skill, rand, mem, dt) - k.r.d
  return { throttle: mem.liftT > 0 ? 0.4 : 1, brake: 0, steer: Math.max(-1, Math.min(1, err * 0.3 - k.r.yaw * 1.5)), form: null }
}

const MAX_RACE_S = 400

/** Drives a whole Kurgu race and returns it as a ghost with its part events. */
export function runKurguBot(kt: KurguTrack, skill: KurguSkill, seed: number, meta: Partial<GhostMeta> = {}, params: RacerParams = DEFAULT_PARAMS, startS = 0, startD = 0): KurguGhost {
  const rand = rng(seed)
  const mem = newKurguBotMemory()
  const p = { ...params, vmax: params.vmax * skill.power }
  const rec = new KurguRecorder()
  const dt = 1 / 30
  let k = newKurgu(kt, startS, startD)
  rec.push(k)
  while (!k.r.finished && k.r.time < MAX_RACE_S) {
    k = stepKurgu(k, kurguBotInput(k, kt, skill, rand, mem, dt), p, kt, dt).st
    rec.push(k)
  }
  return rec.finish({ id: `bot-${seed}`, pilot: '', car: '', color: 0xffffff, ...meta, time: k.r.time }, k.r)
}
