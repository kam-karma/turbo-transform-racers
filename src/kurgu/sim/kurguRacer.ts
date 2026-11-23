/**
 * One Kurgu racer: the shared arcade racer (sim/racer.ts, used as-is) wrapped with the toy
 * parts. Parts never touch the racer's code; they change what it is stepped with:
 *  - the form: wing ⇒ 'glider' over a gap, float wheels ⇒ 'boat' on water, treads ⇒ 'climber';
 *  - the track: without the part a gate is driven on the detour copy (`alt`), slower;
 *  - the params (top speed / pull), and small state edits for rockets, flight, hits and coins.
 * Pure and immutable like the racer: the given state is never changed.
 */
import type { FormId } from '../../sim/forms'
import { newRacer, stepRacer, type RaceInput, type RacerEvent, type RacerEventKind, type RacerParams, type RacerState } from '../../sim/racer'
import type { GateDef, KurguTrack } from './kurguTrack'
import { activeCombos, attach, hasCombo, hasPart, knockOff, type Attached, type ComboId, type Loadout, emptyLoadout, type PartId } from './parts'

export interface DroppedPart { readonly s: number; readonly d: number; readonly part: PartId; readonly shiny: boolean }

export interface KurguState {
  readonly r: RacerState
  readonly lo: Loadout
  /** The gate being driven and whether on its detour. */
  readonly route: { readonly gate: number; readonly alt: boolean } | null
  readonly nextGate: number
  readonly nextRow: number
  readonly nextObs: number
  readonly nextRamp: number
  /** s left of the wing + rocket flight. */
  readonly flightT: number
  readonly drops: readonly DroppedPart[]
  /** Combos made this race, in order. */
  readonly combos: readonly ComboId[]
  /** Every part attached this race (for the rare-part offer). */
  readonly ever: readonly Attached[]
  readonly gatesOk: number
  readonly gatesAlt: number
  readonly knocks: number
  readonly smashes: number
  readonly hidden: boolean
}

export type KurguEventKind = RacerEventKind | 'pickup' | 'knock' | 'hit' | 'bump' | 'smash' | 'combo' | 'gate' | 'detour' | 'wallBreak' | 'rocket' | 'flight' | 'hidden'

export interface KurguEvent {
  readonly kind: KurguEventKind
  readonly value?: number
  readonly part?: PartId
  readonly shiny?: boolean
  readonly combo?: ComboId
  readonly gate?: number
  /** Coin pulled in by the magnet (the view flies it to the car). */
  readonly magnet?: boolean
  /** Index of the obstacle hit, bumped or smashed. */
  readonly obstacle?: number
}

/** Top-speed share on a detour lane ("uzun yol"). */
export const ALT_SPEED = 0.6
export const PICK_R = 2.4
const FLY_Y = 6.5
const FLIGHT_S = 2.6
const HIT_KEEP = 0.45
const DROP_AHEAD = 18
const HIDDEN_R = 2.6
const SILENT: ReadonlySet<RacerEventKind> = new Set(['perfect', 'early', 'late', 'wrongForm', 'transform'])

export function newKurgu(kt: KurguTrack, s0: number, d0: number, startParts: readonly PartId[] = []): KurguState {
  let lo = emptyLoadout()
  const ever: Attached[] = []
  for (const p of startParts) {
    lo = attach(lo, p, false).loadout
    ever.push({ id: p, shiny: false, order: lo.seq })
  }
  return fresh(kt, newRacer(kt.main, s0, d0), lo, { combos: activeCombos(lo), ever })
}

function fresh(kt: KurguTrack, r: RacerState, lo: Loadout, keep: Partial<KurguState>): KurguState {
  const s = r.s
  const d = kt.def
  const first = <T>(xs: readonly T[], f: (x: T) => boolean): number => {
    const i = xs.findIndex(f)
    return i < 0 ? xs.length : i
  }
  return {
    r, lo, route: null, flightT: 0, drops: [], combos: [], ever: [], gatesOk: 0, gatesAlt: 0, knocks: 0, smashes: 0, hidden: false,
    ...keep,
    nextGate: first(d.gates, (g) => g.s1 > s),
    nextRow: first(d.rows, (x) => x.s > s),
    nextObs: first(d.obstacles, (o) => o.s > s),
    nextRamp: first(d.ramps, (x) => x > s),
  }
}

/** Puts the racer back at s (boss catch, respawn) keeping its parts and race tallies. */
export function resetKurguTo(k: KurguState, kt: KurguTrack, s: number, speed: number): KurguState {
  const r: RacerState = { ...newRacer(kt.main, s, 0), speed, coins: k.r.coins, time: k.r.time }
  let nextCoin = 0
  while (nextCoin < kt.def.coins.length && kt.def.coins[nextCoin].s < s) nextCoin++
  const { r: _r, lo: _lo, ...keep } = k
  return fresh(kt, { ...r, nextCoin }, k.lo, { ...keep, route: null, flightT: 0, drops: [] })
}

const formFor = (g: GateDef, alt: boolean): FormId => {
  if (g.kind === 'climb') return 'climber'
  if (alt) return 'car'
  return g.kind === 'gap' ? 'glider' : g.kind === 'water' ? 'boat' : 'car'
}

function canPass(g: GateDef, lo: Loadout, flightT: number): boolean {
  if (hasPart(lo, g.need)) return true
  if (g.kind === 'water') return hasPart(lo, 'propeller')
  return (g.kind === 'gap' || g.kind === 'wall') && flightT > 0.6
}

function paramsFor(base: RacerParams, k: KurguState, kt: KurguTrack, gate: GateDef | null): RacerParams {
  let vmax = base.vmax
  let accel = base.accel
  const lo = k.lo
  if (gate !== null && k.route?.alt === true) vmax *= ALT_SPEED
  else if (gate?.kind === 'water') {
    if (hasCombo(lo, 'speedboat')) vmax *= 1.2
    else if (!hasPart(lo, 'float')) vmax *= 0.85
  } else if (gate?.kind === 'climb' && hasCombo(lo, 'miner')) vmax *= 1.15
  const zone = kt.zoneAt(k.r.s)
  if (hasPart(lo, 'bigwheel') && (zone === 'cocuk' || zone === 'bahce')) vmax *= 1.08
  if (hasPart(lo, 'rocket')) accel *= 1.1
  return { ...base, vmax, accel }
}

type Mut = { -readonly [K in keyof KurguState]: KurguState[K] }

function takePart(m: Mut, part: PartId, shiny: boolean, ev: KurguEvent[]): void {
  const before = new Set(activeCombos(m.lo))
  const res = attach(m.lo, part, shiny)
  m.lo = res.loadout
  m.ever = [...m.ever, { id: part, shiny, order: res.loadout.seq }]
  ev.push({ kind: 'pickup', part, shiny, value: res.replaced === null ? 0 : 1 })
  for (const c of activeCombos(m.lo)) {
    if (before.has(c)) continue
    if (!m.combos.includes(c)) m.combos = [...m.combos, c]
    ev.push({ kind: 'combo', combo: c })
  }
}

function magnetPull(m: Mut, kt: KurguTrack, ev: KurguEvent[]): void {
  const radius = hasCombo(m.lo, 'ball') ? 7.5 : hasPart(m.lo, 'magnet') ? 4.8 : 0
  const coins = kt.def.coins
  let r = m.r
  const g = m.route === null ? null : kt.def.gates[m.route.gate]
  if (g !== null && m.route?.alt === true && r.s >= g.s0 - 1) {
    // The detour lane runs away from the coins laid on the main lane.
    let i = r.nextCoin
    while (i < coins.length && coins[i].s < g.s1) i++
    if (i !== r.nextCoin) m.r = r = { ...r, nextCoin: i }
  }
  if (radius === 0) return
  let i = r.nextCoin
  let got = 0
  while (i < coins.length && coins[i].s <= r.s + 2.5) {
    if (Math.abs(coins[i].d - r.d) < radius && Math.abs(r.y) < 5) {
      got++
      ev.push({ kind: 'coin', value: i, magnet: true })
    }
    i++
  }
  if (i !== r.nextCoin) m.r = { ...r, nextCoin: i, coins: r.coins + got }
}

function decideGate(m: Mut, kt: KurguTrack, ev: KurguEvent[]): void {
  const r = m.r
  if (m.route !== null && r.s >= kt.def.gates[m.route.gate].s1) m.route = null
  if (m.route !== null || m.nextGate >= kt.def.gates.length) return
  const g = kt.def.gates[m.nextGate]
  if (r.s < g.s0 - Math.max(12, r.speed * 0.8)) return
  const ok = canPass(g, m.lo, m.flightT)
  m.route = { gate: g.index, alt: !ok }
  m.nextGate++
  if (ok) m.gatesOk++
  else m.gatesAlt++
  ev.push({ kind: ok ? 'gate' : 'detour', gate: g.index, part: g.need })
}

function pickups(m: Mut, kt: KurguTrack, s0: number, ev: KurguEvent[]): void {
  const rows = kt.def.rows
  const r = m.r
  while (m.nextRow < rows.length && rows[m.nextRow].s <= r.s) {
    const row = rows[m.nextRow++]
    if (row.s < s0 - 1 || Math.abs(r.y) > 3.5) continue
    const lane = row.lanes.find((l) => Math.abs(l.d - r.d) < PICK_R)
    if (lane !== undefined) takePart(m, lane.part, lane.shiny, ev)
  }
  const keep: DroppedPart[] = []
  for (const dp of m.drops) {
    if (dp.s > r.s) keep.push(dp)
    else if (dp.s > s0 - 1 && Math.abs(dp.d - r.d) < PICK_R + 0.4 && Math.abs(r.y) < 3.5) takePart(m, dp.part, dp.shiny, ev)
  }
  if (keep.length !== m.drops.length) m.drops = keep
  const h = kt.def.hidden
  if (!m.hidden && h.s > s0 - 1 && h.s <= r.s && Math.abs(h.d - r.d) < HIDDEN_R) {
    m.hidden = true
    ev.push({ kind: 'hidden', part: h.part })
    takePart(m, h.part, true, ev)
  }
}

function obstacles(m: Mut, kt: KurguTrack, ev: KurguEvent[]): void {
  const obs = kt.def.obstacles
  while (m.nextObs < obs.length && obs[m.nextObs].s <= m.r.s) {
    const o = obs[m.nextObs++]
    const r = m.r
    if (Math.abs(o.d - r.d) > o.r + 1.1 || r.y > o.h) continue
    if (hasPart(m.lo, 'bigwheel') || hasPart(m.lo, 'drill')) {
      m.smashes++
      ev.push({ kind: 'smash', obstacle: m.nextObs - 1 })
      if (hasCombo(m.lo, 'tank')) m.r = { ...m.r, boost: 1.5 }
    } else if (hasPart(m.lo, 'bumper')) {
      m.smashes++
      m.r = { ...r, speed: r.speed * 0.94 }
      ev.push({ kind: 'bump', obstacle: m.nextObs - 1 })
      if (hasCombo(m.lo, 'tank')) m.r = { ...m.r, boost: 1.5 }
    } else {
      m.r = { ...r, speed: r.speed * HIT_KEEP, yaw: -r.yaw * 0.5 }
      ev.push({ kind: 'hit', value: r.speed, obstacle: m.nextObs - 1 })
      const k = knockOff(m.lo)
      if (k.lost !== null) {
        m.lo = k.loadout
        m.knocks++
        // It bounces off ahead into the other lane: catch it again, or leave it.
        const d = r.d >= 0 ? -3.4 : 3.4
        m.drops = [...m.drops, { s: o.s + DROP_AHEAD + r.speed * 0.3, d, part: k.lost.id, shiny: k.lost.shiny }]
        ev.push({ kind: 'knock', part: k.lost.id })
      }
    }
  }
}

function ramps(m: Mut, kt: KurguTrack, ev: KurguEvent[]): void {
  const lips = kt.def.ramps
  while (m.nextRamp < lips.length && lips[m.nextRamp] <= m.r.s) {
    m.nextRamp++
    if (!hasPart(m.lo, 'rocket')) continue
    const r = m.r
    if (hasCombo(m.lo, 'flight')) {
      m.flightT = FLIGHT_S
      ev.push({ kind: 'flight' })
    } else {
      ev.push({ kind: 'rocket' })
    }
    m.r = { ...r, boost: 1.5, airborne: true, vy: Math.max(r.vy, 0) + 5.5, y: Math.max(r.y, 0.05) }
  }
}

function fly(m: Mut, p: RacerParams, dt: number): void {
  if (m.flightT <= 0) return
  m.flightT = Math.max(0, m.flightT - dt)
  const r = m.r
  const y = r.y + (FLY_Y - r.y) * Math.min(1, 2.5 * dt)
  m.r = { ...r, airborne: true, y, vy: m.flightT > 0 ? 0 : -1, speed: Math.max(r.speed, p.vmax * 1.15) }
}

export function stepKurgu(k: KurguState, inp: RaceInput, base: RacerParams, kt: KurguTrack, dt: number): { st: KurguState; events: KurguEvent[] } {
  const events: KurguEvent[] = []
  if (k.r.finished || !(dt > 0)) return { st: k, events }
  const m: Mut = { ...k }
  decideGate(m, kt, events)
  const gate = m.route === null ? null : kt.def.gates[m.route.gate]
  const form = gate === null ? 'car' : formFor(gate, m.route?.alt === true)
  const track = m.route?.alt === true ? kt.alt : kt.main
  const params = paramsFor(base, m, kt, gate)
  magnetPull(m, kt, events)
  const s0 = m.r.s
  const speed0 = m.r.speed
  const res = stepRacer(m.r, { ...inp, form: form !== m.r.form ? form : null }, params, track, dt)
  // Kurgu has no perfect-switch turbo or combo: forms are the parts' business.
  m.r = { ...res.st, turbo: 0, combo: 0, bestCombo: 0, perfects: 0 }
  for (const e of res.events) {
    if (SILENT.has(e.kind)) continue
    if (e.kind === 'wall' && hasPart(m.lo, 'bumper')) m.r = { ...m.r, speed: Math.max(m.r.speed, speed0 * 0.99) }
    events.push(e as RacerEvent)
  }
  if (gate?.kind === 'wall' && m.route?.alt === false && s0 < gate.s0 + 2 && m.r.s >= gate.s0 + 2) {
    m.smashes++
    events.push({ kind: 'wallBreak', gate: gate.index })
    if (hasCombo(m.lo, 'driller')) m.r = { ...m.r, boost: 1.5 }
  }
  pickups(m, kt, s0, events)
  obstacles(m, kt, events)
  ramps(m, kt, events)
  fly(m, params, dt)
  return { st: m, events }
}
