/**
 * Arcade racer physics in track space (s along, d to the left, y above the road).
 *
 * The same pure step drives the player, the ghost-making bots and the tests. It runs in
 * fixed sub-steps so a slow or uneven frame rate never changes where the car ends up, and it
 * never mutates the state it is given.
 */
import { FORM_FOR, formSpeedMul, judgeSwitch, type FormId, type Surface } from './forms'
import type { Frame, Track } from './track'

export interface RaceInput {
  readonly throttle: number
  readonly brake: number
  /** -1 right … +1 left */
  readonly steer: number
  /** Form asked for this frame (null = keep the current one). */
  readonly form: FormId | null
}

export interface RacerParams {
  /** m/s top speed on the right surface, before turbo / boost / combo */
  readonly vmax: number
  /** m/s² pull at standstill */
  readonly accel: number
  /** 1/s how quickly the car's angle follows the steering */
  readonly steerRate: number
  /** 1 = normal; less slides further out in corners */
  readonly grip: number
}

export const DEFAULT_PARAMS: RacerParams = { vmax: 42, accel: 16, steerRate: 3.5, grip: 1 }

export interface RacerState {
  readonly s: number
  readonly d: number
  readonly y: number
  readonly vy: number
  /** rad between the car and the track direction, + = pointing left */
  readonly yaw: number
  readonly speed: number
  readonly form: FormId
  /** s left of the transform animation */
  readonly formT: number
  /** s left of the perfect-switch turbo */
  readonly turbo: number
  /** s left of a boost pad */
  readonly boost: number
  readonly combo: number
  readonly bestCombo: number
  readonly perfects: number
  readonly airborne: boolean
  readonly airT: number
  /** s left before a fallen car is put back (0 = racing) */
  readonly respawnT: number
  /** s since the last change of needed form was crossed (Infinity before the first) */
  readonly crossT: number
  readonly wrongFlagged: boolean
  /** s of the last boundary crossed (-1 before the first) */
  readonly lastBoundaryS: number
  /** s of the boundary whose switch was already judged: one verdict per boundary, so flipping forms cannot farm perfects */
  readonly judgedS: number
  readonly onWall: boolean
  readonly surface: Surface
  readonly coins: number
  /** index of the next coin in track.def.coins that can still be taken */
  readonly nextCoin: number
  readonly finished: boolean
  readonly time: number
}

export type RacerEventKind =
  | 'perfect' | 'early' | 'late' | 'wrongForm' | 'transform' | 'boost' | 'jump' | 'land' | 'splash' | 'wall' | 'fall' | 'respawn' | 'coin' | 'finish'

export interface RacerEvent {
  readonly kind: RacerEventKind
  readonly value?: number
}

export const FIXED_DT = 1 / 120
export const G = 9.81
const DEG = Math.PI / 180
const MAX_YAW = 75 * DEG
const STEER_YAW = 0.55
const WALL_MARGIN = 1
const FALL_Y = -14
const RESPAWN_S = 0.6
const GLIDE_Y = 1.2
const GLIDE_MIN_VY = -2.2
const TURBO_S = 1
const BOOST_S = 1.5
const TRANSFORM_S = 0.25
const LATE_S = 1
const WRONG_AFTER_S = 0.1
/** Switching to the coming surface's form this close to the boundary costs no speed (no turbo either). */
const PRE_SWITCH_S = 1
/** A glider keeps at least this share of top speed over a gap, so it can never hover in place. */
const GLIDE_MIN_SPEED = 0.5

export function newRacer(track: Track, s0: number, d0: number): RacerState {
  const surface = track.surfaceAt(s0)
  let nextCoin = 0
  while (nextCoin < track.def.coins.length && track.def.coins[nextCoin].s < s0) nextCoin++
  return {
    s: s0, d: d0, y: 0, vy: 0, yaw: 0, speed: 0, form: FORM_FOR[surface], formT: 0, turbo: 0, boost: 0,
    combo: 0, bestCombo: 0, perfects: 0, airborne: false, airT: 0, respawnT: 0, crossT: Infinity, wrongFlagged: false, lastBoundaryS: -1, judgedS: -1,
    onWall: false, surface, coins: 0, nextCoin, finished: false, time: 0,
  }
}

type Mut = { -readonly [K in keyof RacerState]: RacerState[K] }

function switchForm(m: Mut, form: FormId, track: Track, events: RacerEvent[]): void {
  if (form === m.form) return
  m.form = form
  m.formT = TRANSFORM_S
  events.push({ kind: 'transform' })
  const next = track.nextBoundary(m.s)
  let verdict: ReturnType<typeof judgeSwitch> = 'none'
  if (next !== null && FORM_FOR[next.surface] === form && m.judgedS !== next.s) {
    verdict = judgeSwitch((next.s - m.s) / Math.max(m.speed, 1), form, next.surface)
    if (verdict !== 'none') m.judgedS = next.s
  } else if (form === FORM_FOR[track.surfaceAt(m.s)] && m.crossT <= LATE_S && m.judgedS !== m.lastBoundaryS) {
    verdict = 'late'
    m.judgedS = m.lastBoundaryS
  }
  if (verdict === 'perfect') {
    m.turbo = TURBO_S
    m.combo++
    m.perfects++
    m.bestCombo = Math.max(m.bestCombo, m.combo)
    events.push({ kind: 'perfect', value: m.combo })
  } else if (verdict === 'late') {
    m.combo = 0
    events.push({ kind: 'late' })
  } else if (verdict === 'early') {
    events.push({ kind: 'early' })
  }
}

function respawn(m: Mut, p: RacerParams, track: Track, events: RacerEvent[]): void {
  const needed = FORM_FOR[track.surfaceAt(m.s)]
  m.s = track.respawnS(m.s)
  m.d = 0
  m.y = 0
  m.vy = 0
  m.yaw = 0
  m.airborne = false
  m.form = needed
  m.formT = TRANSFORM_S
  m.speed = 0.6 * p.vmax
  m.surface = track.surfaceAt(m.s)
  events.push({ kind: 'respawn' })
}

/** True when the car already wears the form the next surface needs and the boundary is close. */
function preSwitched(m: Mut, track: Track): boolean {
  const next = track.nextBoundary(m.s)
  return next !== null && m.form === FORM_FOR[next.surface] && (next.s - m.s) / Math.max(m.speed, 1) <= PRE_SWITCH_S
}

function speedStep(m: Mut, inp: RaceInput, p: RacerParams, f: Frame, h: number, pre: boolean): void {
  const mul = f.surface === 'gap' || pre ? 1 : formSpeedMul(m.form, f.surface)
  const vEff = p.vmax * mul * (1 + (m.turbo > 0 ? 0.35 : 0) + (m.boost > 0 ? 0.3 : 0) + 0.05 * Math.min(m.combo, 3))
  if (m.airborne || f.surface === 'gap') {
    m.speed = Math.max(0, m.speed - 0.02 * m.speed * h)
    if (f.surface === 'gap' && m.form === 'glider') {
      const min = GLIDE_MIN_SPEED * p.vmax
      if (m.speed < min) m.speed += (min - m.speed) * Math.min(1, 2 * h)
    }
    return
  }
  const climbing = m.form === 'climber' && f.surface === 'climb'
  let a = m.speed > vEff ? -(m.speed - vEff) * 1.5 : inp.throttle * p.accel * (1 - m.speed / vEff) * (m.turbo > 0 ? 1.6 : 1)
  a -= inp.brake * 22 + (1 - inp.throttle) * (0.6 + 0.04 * m.speed)
  if (!climbing) a -= G * Math.sin(f.pitch)
  m.speed = Math.max(0, m.speed + a * h)
}

function steerStep(m: Mut, inp: RaceInput, p: RacerParams, f: Frame, h: number): void {
  const ice = f.surface === 'ice'
  const k = p.steerRate * (ice ? 0.35 : 1) * (m.airborne ? 0.3 : 1)
  const steer = Math.max(-1, Math.min(1, Number.isFinite(inp.steer) ? inp.steer : 0))
  m.yaw += (steer * STEER_YAW - m.yaw) * Math.min(1, k * h)
  m.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, m.yaw))
  const drift = m.airborne ? 0 : -f.curvH * m.speed * m.speed * (ice ? 0.22 : 0.12) / p.grip
  m.d += (m.speed * Math.sin(m.yaw) + drift) * h
  m.s += m.speed * Math.cos(m.yaw) * h
}

function wallStep(m: Mut, f: Frame, h: number, events: RacerEvent[]): void {
  const limit = f.width / 2 - WALL_MARGIN
  if (Math.abs(m.d) <= limit) {
    m.onWall = false
    return
  }
  m.d = Math.sign(m.d) * limit
  if (!m.onWall) {
    events.push({ kind: 'wall', value: m.speed })
    m.speed *= 0.92
    m.yaw *= -0.3
  }
  // Scraping slows a car on the ground; in the air it would only stall a glider over a gap.
  if (!m.airborne) m.speed *= 1 - 0.5 * h
  m.onWall = true
}

function verticalStep(m: Mut, f: Frame, h: number, events: RacerEvent[]): void {
  if (f.surface === 'gap') {
    if (!m.airborne && m.speed > 20) events.push({ kind: 'jump', value: m.speed })
    m.airborne = true
    if (m.form === 'glider') {
      m.vy += ((GLIDE_Y - m.y) * 3 - m.vy * 2) * h
      m.vy = Math.max(m.vy, GLIDE_MIN_VY)
    } else {
      m.vy -= 2.5 * G * h
    }
    m.y += m.vy * h
    m.airT += h
    return
  }
  const ay = -G * Math.cos(f.pitch) - m.speed * m.speed * f.curvV
  if (!m.airborne) {
    if (ay > 0.5 && m.speed > 12) {
      m.airborne = true
      m.vy = 0
      m.airT = 0
      if (m.speed > 20) events.push({ kind: 'jump', value: m.speed })
    } else {
      m.y = 0
      m.vy = 0
      return
    }
  }
  m.vy += ay * h
  m.y += m.vy * h
  m.airT += h
  if (m.y <= 0) {
    events.push({ kind: 'land', value: -m.vy })
    m.y = 0
    m.vy = 0
    m.airborne = false
    m.airT = 0
  }
}

function coinStep(m: Mut, track: Track, events: RacerEvent[]): void {
  const coins = track.def.coins
  while (m.nextCoin < coins.length && coins[m.nextCoin].s <= m.s + 1.5) {
    const c = coins[m.nextCoin]
    if (Math.abs(c.d - m.d) < 1.3 && Math.abs(m.y) < 2.5) {
      m.coins++
      // value = index in track.def.coins, so the view can hide exactly that coin
      events.push({ kind: 'coin', value: m.nextCoin })
    }
    m.nextCoin++
  }
}

function boundaryStep(m: Mut, track: Track, sBefore: number, h: number, events: RacerEvent[]): void {
  const next = track.nextBoundary(sBefore)
  const crossBefore = m.crossT
  if (next !== null && m.s >= next.s) {
    m.crossT = 0
    m.wrongFlagged = false
    m.lastBoundaryS = next.s
  } else {
    m.crossT += h
  }
  const surface = track.surfaceAt(m.s)
  if (surface === 'water' && m.surface !== 'water') events.push({ kind: 'splash', value: m.speed })
  m.surface = surface
  // Judged once, just after crossing: a later switch for the coming surface is not a wrong form.
  if (!m.wrongFlagged && crossBefore < WRONG_AFTER_S && m.crossT >= WRONG_AFTER_S && m.form !== FORM_FOR[surface] && !preSwitched(m, track)) {
    m.wrongFlagged = true
    m.combo = 0
    events.push({ kind: 'wrongForm' })
  }
}

function subStep(m: Mut, inp: RaceInput, p: RacerParams, track: Track, h: number, events: RacerEvent[]): void {
  m.time += h
  if (m.respawnT > 0) {
    m.respawnT -= h
    if (m.respawnT <= 0) {
      m.respawnT = 0
      respawn(m, p, track, events)
    }
    return
  }
  m.turbo = Math.max(0, m.turbo - h)
  m.boost = Math.max(0, m.boost - h)
  m.formT = Math.max(0, m.formT - h)
  const f = track.frameAt(m.s)
  if (!m.airborne && track.boostAt(m.s) && m.boost < BOOST_S - 0.2) {
    if (m.boost === 0) events.push({ kind: 'boost' })
    m.boost = BOOST_S
  }
  speedStep(m, inp, p, f, h, preSwitched(m, track))
  const sBefore = m.s
  steerStep(m, inp, p, f, h)
  wallStep(m, f, h, events)
  verticalStep(m, f, h, events)
  if (m.y < FALL_Y) {
    events.push({ kind: 'fall' })
    m.respawnT = RESPAWN_S
    m.combo = 0
    return
  }
  boundaryStep(m, track, sBefore, h, events)
  coinStep(m, track, events)
  if (m.s >= track.length) {
    m.s = track.length
    m.finished = true
    events.push({ kind: 'finish', value: m.time })
  }
}

export function stepRacer(st: RacerState, inp: RaceInput, p: RacerParams, track: Track, dt: number): { st: RacerState; events: RacerEvent[] } {
  const events: RacerEvent[] = []
  if (st.finished || !(dt > 0)) return { st, events }
  const m: Mut = { ...st }
  if (inp.form !== null && m.respawnT === 0) switchForm(m, inp.form, track, events)
  const frame = Math.min(dt, 0.1)
  const n = Math.max(1, Math.ceil(frame / FIXED_DT - 1e-9))
  const h = frame / n
  for (let i = 0; i < n && !m.finished; i++) subStep(m, inp, p, track, h, events)
  return { st: m, events }
}
