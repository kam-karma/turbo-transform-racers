/**
 * One Kaos race in track space: the player and five live bots on a closed circuit, car
 * contacts, destructible props, the Şok meter and wave, lap counting, scoring, and (in the
 * boss race) the dragon. Pure logic, no Three.js: the mode turns its events into a show.
 *
 * Every racer is driven by the shared arcade physics (stepRacer, never edited); knocks are
 * layered on top as a decaying sideways push, yaw kicks, speed changes and hops.
 */
import { botInput, newBotMemory, rng, type BotMemory, type BotSkill } from '../../sim/bot'
import { PILOTS } from '../../sim/pilots'
import { standings } from '../../sim/race'
import { newRacer, stepRacer, type RaceInput, type RacerEvent, type RacerParams, type RacerState } from '../../sim/racer'
import type { Track } from '../../sim/track'
import { BREAK_KEEP, BREAK_METER, BREAK_SCORE, BreakField, type BreakableDef, type BreakKind } from './breakables'
import { lapOf, lapS, type Circuit } from './circuit'
import { collide, type Body, type Kick } from './contacts'
import { Dragon, type DragonConfig, type DragonEvent } from './dragon'
import type { KaosRival } from './rivals'
import { BUMP_SCORE, SHOCK_SCORE, type KaosStats } from './score'
import { ShockMeter, ShockWave, shockKnock } from './shock'

export interface RacerInfo {
  readonly id: string
  readonly name: string
  readonly badge: string
  readonly color: number
  readonly car: string
  readonly you: boolean
}

export interface KaosRacer {
  readonly info: RacerInfo
  st: RacerState
  readonly params: RacerParams
  readonly mass: number
  /** Lateral push (m/s, + = left), decays. */
  push: number
  lap: number
  /** Race time this racer crossed the line, or null. */
  finishedAt: number | null
  readonly skill: BotSkill
  readonly mem: BotMemory
  readonly rand: () => number
}

export type KaosEvent =
  | { readonly kind: 'racer'; readonly who: number; readonly e: RacerEvent }
  | { readonly kind: 'smash'; readonly who: number; readonly id: number; readonly item: BreakKind; readonly score: number; readonly byShock: boolean }
  | { readonly kind: 'rebuild'; readonly id: number }
  | { readonly kind: 'bump'; readonly a: number; readonly b: number; readonly force: number; readonly score: number }
  | { readonly kind: 'shock' }
  | { readonly kind: 'shockHit'; readonly who: number; readonly score: number }
  | { readonly kind: 'meterFull' }
  | { readonly kind: 'lap'; readonly who: number; readonly n: number }
  | { readonly kind: 'finish'; readonly who: number; readonly place: number }
  | { readonly kind: 'dragon'; readonly e: DragonEvent }

export interface KaosRaceConfig {
  readonly circuit: Circuit
  readonly track: Track
  readonly items: readonly BreakableDef[]
  readonly rivals: readonly KaosRival[]
  readonly player: { readonly params: RacerParams; readonly name: string; readonly car: string; readonly color: number }
  readonly boss: DragonConfig | null
  readonly seed: number
}

export const PLAYER_MASS = 1.6
export const BOT_MASS = 1
/** Starting grid: the player in the pack, three bots ahead, two alongside. */
export const KAOS_GRID = { player: { s: 12, d: 0 }, bots: [{ s: 26, d: -4.5 }, { s: 26, d: 4.5 }, { s: 19, d: 0 }, { s: 12, d: -5 }, { s: 12, d: 5 }] } as const
const PUSH_DECAY = 3.2
const WALL_MARGIN = 1
const MAX_YAW = (70 * Math.PI) / 180
const BUMP_METER = 0.1
const BOUNCE_METER = 0.12
const BUMP_COOLDOWN = 1
const CRUSH_KEEP = 0.45
/** The best pilot drives the player's car after the finish line (and in tests). */
const AUTO_SKILL = PILOTS[1].skill

export class KaosRace {
  readonly racers: KaosRacer[] = []
  readonly field: BreakField
  readonly meter = new ShockMeter()
  wave: ShockWave | null = null
  dragon: Dragon | null = null
  time = 0
  destruction = 0
  botHits = 0
  shockHits = 0
  smashed: Record<BreakKind, number> = { block: 0, sign: 0, glass: 0 }
  private lastBump: number[] = []
  private finishOrder: number[] = []

  constructor(readonly cfg: KaosRaceConfig) {
    this.field = new BreakField(cfg.items, cfg.circuit.lapLen)
    this.reset()
  }

  get track(): Track {
    return this.cfg.track
  }

  get player(): KaosRacer {
    return this.racers[0]
  }

  get length(): number {
    return this.cfg.track.length
  }

  reset(): void {
    const c = this.cfg
    this.racers.length = 0
    const g = KAOS_GRID
    this.racers.push(this.makeRacer({ id: 'you', name: 'Sen', badge: '', color: c.player.color, car: c.player.car, you: true }, c.player.params, PLAYER_MASS, g.player, AUTO_SKILL, 1))
    c.rivals.forEach((r, i) => {
      const slot = g.bots[i % g.bots.length]
      const params = { ...c.player.params, vmax: c.player.params.vmax * r.power }
      this.racers.push(this.makeRacer({ id: r.pilot.id, name: r.pilot.name, badge: r.pilot.badge, color: r.pilot.color, car: r.car, you: false }, params, BOT_MASS, slot, r.pilot.skill, i + 2))
    })
    this.field.reset()
    this.meter.reset()
    this.wave = null
    this.dragon = c.boss === null ? null : new Dragon(c.boss, rng(c.seed * 31 + 7))
    this.time = 0
    this.destruction = 0
    this.botHits = 0
    this.shockHits = 0
    this.smashed = { block: 0, sign: 0, glass: 0 }
    this.lastBump = this.racers.map(() => -Infinity)
    this.finishOrder = []
  }

  private makeRacer(info: RacerInfo, params: RacerParams, mass: number, slot: { s: number; d: number }, skill: BotSkill, k: number): KaosRacer {
    return {
      info, params, mass, skill, st: newRacer(this.cfg.track, slot.s, slot.d), push: 0, lap: 1, finishedAt: null,
      mem: newBotMemory(), rand: rng(this.cfg.seed * 101 + k),
    }
  }

  /** Advances the race by dt seconds of racing. `auto` lets the bot brain drive the player. */
  step(dt: number, input: RaceInput, fire: boolean, auto = false): KaosEvent[] {
    const ev: KaosEvent[] = []
    if (!(dt > 0)) return ev
    this.time += dt
    this.racers.forEach((r, i) => this.drive(r, i, i === 0 && !auto && r.finishedAt === null ? input : null, dt, ev))
    this.contacts(ev)
    this.smashing(ev)
    for (const id of this.field.rebuild(this.time)) ev.push({ kind: 'rebuild', id })
    if (fire) this.fire(ev)
    this.shock(dt, ev)
    this.boss(dt, ev)
    return ev
  }

  private drive(r: KaosRacer, i: number, input: RaceInput | null, dt: number, ev: KaosEvent[]): void {
    const track = this.cfg.track
    const raw = input ?? botInput(r.st, track, r.skill, r.rand, r.mem, dt)
    const res = stepRacer(r.st, { ...raw, form: null }, r.params, track, dt)
    let st = res.st
    for (const e of res.events) {
      if (e.kind === 'finish') continue
      ev.push({ kind: 'racer', who: i, e })
    }
    if (r.push !== 0) {
      const lim = track.frameAt(st.s).width / 2 - WALL_MARGIN
      let d = st.d + r.push * dt
      if (Math.abs(d) > lim) {
        d = Math.sign(d) * lim
        if (Math.sign(r.push) === Math.sign(d)) r.push *= -0.25
      }
      st = { ...st, d }
      r.push *= Math.exp(-PUSH_DECAY * dt)
      if (Math.abs(r.push) < 0.05) r.push = 0
    }
    if (st.finished) st = this.crossLine(r, i, st, ev)
    const lap = lapOf(st.s, this.cfg.circuit.lapLen, this.cfg.circuit.laps)
    if (r.finishedAt === null && lap > r.lap) {
      r.lap = lap
      ev.push({ kind: 'lap', who: i, n: lap })
    }
    r.st = st
  }

  /** Records the finish and sends the car round again on the last lap (same place on screen). */
  private crossLine(r: KaosRacer, i: number, st: RacerState, ev: KaosEvent[]): RacerState {
    if (r.finishedAt === null) {
      r.finishedAt = this.time
      this.finishOrder.push(i)
      ev.push({ kind: 'finish', who: i, place: this.finishOrder.length })
      if (i === 0) ev.push({ kind: 'racer', who: 0, e: { kind: 'finish', value: this.time } })
    }
    return { ...st, s: st.s - this.cfg.circuit.lapLen, finished: false, nextCoin: this.cfg.track.def.coins.length }
  }

  private body(r: KaosRacer): Body {
    return { s: r.st.s, d: r.st.d, speed: r.st.speed, yaw: r.st.yaw, mass: r.mass }
  }

  private kick(r: KaosRacer, k: Kick): void {
    const yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, r.st.yaw + k.yawKick))
    r.st = { ...r.st, s: r.st.s + k.ds, d: r.st.d + k.dd, speed: Math.max(0, r.st.speed + k.dSpeed), yaw }
    r.push += k.push
  }

  private contacts(ev: KaosEvent[]): void {
    const rs = this.racers
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        // Racers that already finished are on their cool-down lap: no more fights.
        if (rs[i].finishedAt !== null || rs[j].finishedAt !== null || rs[i].st.respawnT > 0 || rs[j].st.respawnT > 0) continue
        const c = collide(this.body(rs[i]), this.body(rs[j]))
        if (c === null) continue
        this.kick(rs[i], c.a)
        this.kick(rs[j], c.b)
        let score = 0
        const other = i === 0 ? j : -1
        if (other > 0 && this.time - this.lastBump[other] >= BUMP_COOLDOWN && c.force > 2) {
          this.lastBump[other] = this.time
          score = BUMP_SCORE
          this.botHits++
          this.destruction += score
          this.addMeter(BUMP_METER, ev)
        }
        ev.push({ kind: 'bump', a: i, b: j, force: c.force, score })
      }
    }
  }

  private smashing(ev: KaosEvent[]): void {
    const L = this.cfg.circuit.lapLen
    this.racers.forEach((r, i) => {
      if (r.st.respawnT > 0 || r.st.y > 2.5) return
      const ids = this.field.hits({ ...this.body(r), s: lapS(r.st.s, L) }, this.time)
      for (const id of ids) {
        const item = this.cfg.items[id].kind
        r.st = { ...r.st, speed: r.st.speed * BREAK_KEEP[item] }
        ev.push({ kind: 'smash', who: i, id, item, score: i === 0 ? this.score(item, ev) : 0, byShock: false })
      }
    })
  }

  private score(item: BreakKind, ev: KaosEvent[]): number {
    this.smashed = { ...this.smashed, [item]: this.smashed[item] + 1 }
    this.destruction += BREAK_SCORE[item]
    this.addMeter(BREAK_METER[item], ev)
    return BREAK_SCORE[item]
  }

  private addMeter(v: number, ev: KaosEvent[]): void {
    const was = this.meter.ready
    this.meter.add(v)
    if (!was && this.meter.ready) ev.push({ kind: 'meterFull' })
  }

  private fire(ev: KaosEvent[]): void {
    const p = this.player
    if (p.st.respawnT > 0 || !this.meter.fire()) return
    this.wave = new ShockWave()
    p.st = { ...p.st, turbo: Math.max(p.st.turbo, 1) }
    ev.push({ kind: 'shock' })
  }

  private shock(dt: number, ev: KaosEvent[]): void {
    const w = this.wave
    if (w === null) return
    w.step(dt)
    const p = this.player.st
    const L = this.cfg.circuit.lapLen
    for (const id of this.field.within(lapS(p.s, L), p.d, w.radius, this.time)) {
      const item = this.cfg.items[id].kind
      ev.push({ kind: 'smash', who: 0, id, item, score: this.score(item, ev), byShock: true })
    }
    this.racers.forEach((r, i) => {
      if (i === 0 || r.finishedAt !== null || r.st.respawnT > 0) return
      if (!w.reach(r.info.id, Math.hypot(r.st.s - p.s, r.st.d - p.d))) return
      const k = shockKnock(p.s, p.d, r.st.s, r.st.d)
      r.push += k.push
      const yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, r.st.yaw + k.yawKick))
      r.st = { ...r.st, yaw, speed: r.st.speed * k.keep, airborne: true, vy: Math.max(r.st.vy, k.hop), airT: 0 }
      this.shockHits++
      this.destruction += SHOCK_SCORE
      ev.push({ kind: 'shockHit', who: i, score: SHOCK_SCORE })
    })
    if (this.dragon !== null) {
      const dev: DragonEvent[] = []
      this.dragon.bounceWithin(p.s, p.d, w.radius, dev)
      for (const e of dev) ev.push({ kind: 'dragon', e })
    }
    if (!w.alive) this.wave = null
  }

  private boss(dt: number, ev: KaosEvent[]): void {
    const dr = this.dragon
    if (dr === null) return
    const p = this.player
    const dev: DragonEvent[] = []
    dr.step(dt, this.body(p), dev)
    for (const e of dev) {
      if (e.kind === 'crush') {
        const side = p.rand() < 0.5 ? -1 : 1
        p.st = { ...p.st, speed: p.st.speed * CRUSH_KEEP, yaw: Math.max(-MAX_YAW, Math.min(MAX_YAW, p.st.yaw + side * 0.5)) }
        p.push += side * 5
      }
      if (e.kind === 'bounce' && !e.byShock) this.addMeter(BOUNCE_METER, ev)
      ev.push({ kind: 'dragon', e })
    }
  }

  /** Racer indices in race order. */
  order(): number[] {
    const ids = standings(this.racers.map((r, i) => ({ id: String(i), s: r.finishedAt === null ? r.st.s : Infinity, finishedAt: r.finishedAt })))
    return ids.map(Number)
  }

  /** The player's place (1-based). */
  place(): number {
    return this.order().indexOf(0) + 1
  }

  /** A finish time for every racer: real for finishers, projected from pace for the rest. */
  finishTime(i: number): number {
    const r = this.racers[i]
    if (r.finishedAt !== null) return r.finishedAt
    const pace = Math.max(18, r.st.s / Math.max(this.time, 1))
    return this.time + (this.length - r.st.s) / pace
  }

  stats(): KaosStats {
    const finish = this.racers.map((_, i) => ({ i, t: this.finishTime(i) })).sort((a, b) => a.t - b.t)
    const place = finish.findIndex((x) => x.i === 0) + 1
    return { place, of: this.racers.length, destruction: this.destruction, botHits: this.botHits, shockHits: this.shockHits, smashed: this.smashed }
  }
}
