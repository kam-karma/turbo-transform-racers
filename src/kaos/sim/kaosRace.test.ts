import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type RaceInput } from '../../sim/racer'
import { buildTrack } from '../../sim/track'
import { KAOS_CIRCUITS } from '../tracks/index'
import { layoutBreakables } from './breakables'
import { KaosRace, type KaosEvent } from './kaosRace'
import { pickKaosRivals } from './rivals'

const circuit = KAOS_CIRCUITS.neon1
const track = buildTrack(circuit.def)
const items = layoutBreakables(circuit.lapLen, circuit.spec.width, circuit.seed)
const IDLE: RaceInput = { throttle: 0, brake: 0, steer: 0, form: null }

const make = (boss = false, seed = 1): KaosRace => new KaosRace({
  circuit, track, items, seed,
  rivals: boss ? [] : pickKaosRivals('neon-bronz', 'neon-bronz-1', false),
  player: { params: DEFAULT_PARAMS, name: 'Sen', car: 'hero', color: 0xffd23f },
  boss: boss ? { maxHealth: 100, damage: 10, width: circuit.spec.width } : null,
})

/** Runs the whole race with the bot brain on the player car. */
function runAll(race: KaosRace, fireWhenReady = true): KaosEvent[] {
  const all: KaosEvent[] = []
  for (let i = 0; i < 60 * 200 && race.player.finishedAt === null; i++) {
    all.push(...race.step(1 / 60, IDLE, fireWhenReady && race.meter.ready, true))
  }
  return all
}

describe('KaosRace', () => {
  it('runs a full 3-lap race with five live rivals', () => {
    const race = make()
    expect(race.racers.length).toBe(6)
    const ev = runAll(race)
    expect(race.player.finishedAt).not.toBeNull()
    expect(race.time).toBeGreaterThan(80)
    expect(race.time).toBeLessThan(140)
    const laps = ev.filter((e) => e.kind === 'lap' && e.who === 0).map((e) => (e.kind === 'lap' ? e.n : 0))
    expect(laps).toEqual([2, 3])
    expect(ev.some((e) => e.kind === 'bump')).toBe(true)
    const st = race.stats()
    expect(st.place).toBeGreaterThanOrEqual(1)
    expect(st.place).toBeLessThanOrEqual(6)
  })

  it('is deterministic for a seed', () => {
    const a = make(false, 4)
    const b = make(false, 4)
    runAll(a)
    runAll(b)
    expect(a.time).toBe(b.time)
    expect(a.destruction).toBe(b.destruction)
  })

  it('scores and fills the meter when the player smashes props', () => {
    const race = make()
    const sign = items.find((i) => i.kind === 'sign')
    if (sign === undefined) throw new Error('no sign')
    race.player.st = { ...race.player.st, s: sign.s, d: sign.d, speed: 30 }
    const ev = race.step(1 / 60, IDLE, false)
    expect(ev.some((e) => e.kind === 'smash' && e.who === 0 && e.item === 'sign' && e.score > 0)).toBe(true)
    expect(race.destruction).toBeGreaterThan(0)
    expect(race.meter.value).toBeGreaterThan(0)
    expect(race.smashed.sign).toBe(1)
  })

  it('bots smash props too, but score nothing for the player', () => {
    const race = make()
    const sign = items.find((i) => i.kind === 'sign')
    if (sign === undefined) throw new Error('no sign')
    race.racers[3].st = { ...race.racers[3].st, s: sign.s, d: sign.d }
    const ev = race.step(1 / 60, IDLE, false)
    expect(ev.some((e) => e.kind === 'smash' && e.who === 3 && e.score === 0)).toBe(true)
    expect(race.destruction).toBe(0)
  })

  it('bumping a rival shoves it sideways and scores once per second', () => {
    const race = make()
    const p = race.player
    const bot = race.racers[1]
    p.st = { ...p.st, s: 400, d: 0, speed: 30 }
    bot.st = { ...bot.st, s: 400.3, d: 1.7, speed: 30 }
    const ev = race.step(1 / 60, IDLE, false)
    expect(ev.some((e) => e.kind === 'bump' && e.score > 0)).toBe(true)
    expect(bot.push).toBeGreaterThan(0)
    expect(Math.abs(bot.push)).toBeGreaterThan(Math.abs(p.push))
    expect(race.botHits).toBe(1)
    bot.st = { ...bot.st, s: p.st.s + 0.3, d: p.st.d + 1.7 }
    race.step(1 / 60, IDLE, false)
    expect(race.botHits).toBe(1)
  })

  it('a full meter fires a shock wave that throws nearby rivals into the air', () => {
    const race = make()
    const p = race.player
    p.st = { ...p.st, s: 600, d: 0, speed: 35 }
    race.racers[2].st = { ...race.racers[2].st, s: 610, d: 3, speed: 35 }
    race.racers[4].st = { ...race.racers[4].st, s: 900, d: 0, speed: 35 }
    race.meter.add(1)
    const ev: KaosEvent[] = []
    ev.push(...race.step(1 / 60, IDLE, true))
    for (let i = 0; i < 40; i++) ev.push(...race.step(1 / 60, IDLE, false))
    expect(ev.some((e) => e.kind === 'shock')).toBe(true)
    expect(ev.some((e) => e.kind === 'shockHit' && e.who === 2)).toBe(true)
    expect(ev.some((e) => e.kind === 'shockHit' && e.who === 4)).toBe(false)
    expect(race.meter.value).toBe(0)
    expect(race.shockHits).toBe(1)
    expect(p.st.turbo).toBeGreaterThan(0)
  })

  it('cannot fire with an empty meter', () => {
    const race = make()
    const ev = race.step(1 / 60, IDLE, true)
    expect(ev.some((e) => e.kind === 'shock')).toBe(false)
  })

  it('runs the boss race alone against the dragon, which a good driver can beat', () => {
    const race = make(true)
    expect(race.racers.length).toBe(1)
    expect(race.dragon).not.toBeNull()
    // Steer for the nearest sitting block: what a player would do.
    const all: KaosEvent[] = []
    for (let i = 0; i < 60 * 200 && race.player.finishedAt === null && !(race.dragon?.beaten ?? false); i++) {
      const p = race.player.st
      const target = race.dragon?.blocks.find((b) => b.phase !== 'returning' && b.s > p.s + 2 && b.s < p.s + 60)
      const steer = target === undefined ? -p.d * 0.1 : Math.max(-1, Math.min(1, (target.d - p.d) * 0.35 - p.yaw * 1.5))
      all.push(...race.step(1 / 60, { throttle: 1, brake: 0, steer, form: null }, race.meter.ready))
    }
    expect(all.some((e) => e.kind === 'dragon' && e.e.kind === 'damage')).toBe(true)
    expect(race.dragon?.beaten).toBe(true)
  })
})
