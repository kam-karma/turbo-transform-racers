import { describe, expect, it } from 'vitest'
import type { FormId } from './forms'
import { DEFAULT_PARAMS, newRacer, stepRacer, type RaceInput, type RacerEvent, type RacerState } from './racer'
import { buildTrack } from './track'
import { pathTrack } from './trackPath'

// road 0-400 · water 400-700 · road 700-900 · ramp road 900-1000 · gap 1000-1070
// road 1070-1370 · climb 1370-1460 · road 1460-1660
const track = buildTrack(pathTrack('test', 'Test', [
  { len: 400, surface: 'road' },
  { len: 300, surface: 'water' },
  { len: 200, surface: 'road' },
  { len: 100, surface: 'road', pitchTo: 9, ramp: true },
  { len: 70, surface: 'gap', pitchTo: -6 },
  { len: 300, surface: 'road', pitchTo: 0 },
  { len: 90, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 200, surface: 'road', pitchTo: 0 },
]))
const V = DEFAULT_PARAMS.vmax

const GAS: RaceInput = { throttle: 1, brake: 0, steer: 0, form: null }

function drive(st: RacerState, seconds: number, input: (st: RacerState) => RaceInput = () => GAS, dt = 1 / 60): { st: RacerState; events: RacerEvent[] } {
  const events: RacerEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const r = stepRacer(st, input(st), DEFAULT_PARAMS, track, dt)
    st = r.st
    events.push(...r.events)
  }
  return { st, events }
}

const at = (s: number, speed: number, form: FormId = 'car'): RacerState => ({ ...newRacer(track, s, 0), speed, form })
const kinds = (e: RacerEvent[]): string[] => e.map((x) => x.kind)

describe('stepRacer', () => {
  it('does not change the state it was given', () => {
    const st = newRacer(track, 10, 0)
    const copy = JSON.stringify(st)
    stepRacer(st, GAS, DEFAULT_PARAMS, track, 1 / 60)
    expect(JSON.stringify(st)).toBe(copy)
  })

  it('reaches 85% of top speed within 6 s of full throttle on flat road', () => {
    const { st } = drive(newRacer(track, 0, 0), 6)
    expect(st.speed).toBeGreaterThanOrEqual(0.85 * V)
  })

  it('crawls through water as a car but races through it as a boat', () => {
    expect(drive(at(410, 0.9 * V, 'car'), 4).st.speed).toBeLessThanOrEqual(0.32 * V)
    expect(drive(at(410, 0.9 * V, 'boat'), 4).st.speed).toBeGreaterThanOrEqual(0.95 * V)
  })

  it('flags driving onto water in the wrong form once', () => {
    const { events } = drive(at(380, 0.9 * V, 'car'), 2)
    expect(kinds(events).filter((k) => k === 'wrongForm')).toHaveLength(1)
    expect(kinds(events)).toContain('splash')
  })

  it('gives a perfect switch, a turbo and a combo 0.2 s before the boundary', () => {
    const speed = 40
    let switched = false
    const { st, events } = drive(at(400 - speed * 0.25, speed), 0.3, (s) => {
      const ttb = (400 - s.s) / s.speed
      if (!switched && ttb <= 0.2) {
        switched = true
        return { ...GAS, form: 'boat' }
      }
      return GAS
    })
    expect(kinds(events)).toContain('perfect')
    expect(st.turbo).toBeGreaterThan(0)
    expect(st.combo).toBe(1)
  })

  it('gives at most one perfect per boundary, however often the form is flipped in the window', () => {
    const speed = 40
    let flip = 0
    const { st, events } = drive(at(400 - speed * 0.28, speed), 0.3, () => ({ ...GAS, form: flip++ % 2 === 0 ? 'boat' : 'car' }))
    expect(kinds(events).filter((k) => k === 'perfect')).toHaveLength(1)
    expect(st.perfects).toBe(1)
  })

  // Review C1: a perfect switch made while still on the old surface is not a wrong form.
  it('chains perfects through consecutive boundaries without a false wrong-form', () => {
    const lead = (s: RacerState, b: number): number => (b - s.s) / Math.max(s.speed, 1)
    // climb 1370-1460 is a short section (< 5 s): in as a climber, out as a car.
    const { st, events } = drive(at(1350, 30, 'car'), 8, (s) => {
      if (s.s < 1370 && lead(s, 1370) <= 0.2) return { ...GAS, form: 'climber' }
      if (s.s > 1370 && s.s < 1460 && lead(s, 1460) <= 0.2) return { ...GAS, form: 'car' }
      return GAS
    })
    expect(kinds(events).filter((k) => k === 'perfect')).toHaveLength(2)
    expect(kinds(events)).not.toContain('wrongForm')
    expect(st.combo).toBe(2)
  })

  // Review I4: switching early costs no speed (no turbo either).
  it('does not slow a car that switched early for the coming surface', () => {
    let switched = false
    const early = drive(at(370, 40, 'car'), 0.75, (s) => {
      if (!switched && (400 - s.s) / s.speed <= 0.6) switched = true
      return switched ? { ...GAS, form: 'boat' } : GAS
    }).st
    const none = drive(at(370, 40, 'car'), 0.75).st
    expect(early.speed).toBeGreaterThan(none.speed * 0.97)
    expect(early.turbo).toBe(0)
  })

  // Review C2: a glider against the barrier over a gap must still get across.
  it('crosses a gap as a glider even while steering into the barrier the whole way', () => {
    const { st, events } = drive(at(985, 30, 'glider'), 8, () => ({ ...GAS, steer: 1 }))
    expect(kinds(events)).not.toContain('fall')
    expect(st.s).toBeGreaterThan(1075)
  })

  it('crosses a gap as a glider even when entering it slowly', () => {
    const { st } = drive(at(995, 5, 'glider'), 8)
    expect(st.s).toBeGreaterThan(1075)
  })

  it('calls a switch long before the boundary early and one after it late', () => {
    const early = drive(at(300, 40), 0.1, () => ({ ...GAS, form: 'boat' }))
    expect(kinds(early.events)).toContain('early')
    expect(early.st.turbo).toBe(0)
    // Crosses the water boundary at 400 after 0.125 s, then switches.
    const late = drive(at(395, 40, 'car'), 0.2, (s) => (s.s > 401 ? { ...GAS, form: 'boat' } : GAS))
    expect(kinds(late.events)).toContain('late')
    expect(late.st.combo).toBe(0)
  })

  it('falls into a gap as a car and is put back on the road before it', () => {
    const { st, events } = drive(at(960, 40, 'car'), 4)
    expect(kinds(events)).toContain('fall')
    expect(kinds(events)).toContain('respawn')
    const r = events.findIndex((e) => e.kind === 'respawn')
    expect(r).toBeGreaterThan(-1)
    expect(st.s).toBeLessThan(1100)
  })

  it('glides over a gap as a glider and lands on the far side', () => {
    const { st, events } = drive(at(960, 40, 'car'), 4, (s) => ((1000 - s.s) / s.speed < 0.2 ? { ...GAS, form: 'glider' } : GAS))
    expect(kinds(events)).not.toContain('fall')
    expect(kinds(events)).toContain('land')
    expect(st.s).toBeGreaterThan(1070)
  })

  it('jumps off the ramp lip at speed', () => {
    const { events } = drive(at(930, 40, 'car'), 2.5)
    expect(kinds(events)).toContain('jump')
  })

  it('collects a coin it drives through', () => {
    const coinTrack = buildTrack(pathTrack('c', 'C', [{ len: 300, surface: 'road', coins: { n: 1, d: 0 } }]))
    let st = newRacer(coinTrack, 100, 0)
    st = { ...st, speed: 30 }
    const events: RacerEvent[] = []
    for (let i = 0; i < 240; i++) {
      const r = stepRacer(st, GAS, DEFAULT_PARAMS, coinTrack, 1 / 60)
      st = r.st
      events.push(...r.events)
    }
    expect(kinds(events).filter((k) => k === 'coin')).toHaveLength(1)
    expect(events.find((e) => e.kind === 'coin')?.value).toBe(0)
    expect(st.coins).toBe(1)
  })

  it('finishes at the end of the track and stops there', () => {
    const { st, events } = drive(at(1640, 40), 2)
    expect(st.finished).toBe(true)
    expect(kinds(events).filter((k) => k === 'finish')).toHaveLength(1)
    expect(st.s).toBeCloseTo(track.length, 3)
  })

  // Review Focus 1: a slow, uneven frame rate must not change where the car ends up.
  it('ends within 2% of the same place at 10 fps and at 60 fps', () => {
    const slow = drive(newRacer(track, 0, 0), 6, () => GAS, 0.1).st
    const fast = drive(newRacer(track, 0, 0), 6, () => GAS, 1 / 60).st
    expect(Math.abs(slow.s - fast.s) / fast.s).toBeLessThan(0.02)
  })

  // Review Focus 3: the wrong form on a climb is slow but never stuck.
  it('gets up the climb even as a car, within 60 s', () => {
    const { st } = drive(at(1350, 30, 'car'), 60)
    expect(st.s).toBeGreaterThan(1460)
  })

  it('climbs fast as a climber', () => {
    const { st } = drive(at(1360, 30, 'climber'), 6)
    expect(st.s).toBeGreaterThan(1460)
  })

  // Review Focus 4: holding full lock along a barrier keeps the car on the road and moving.
  it('stays on the road and keeps going while steering into the barrier for 20 s', () => {
    let maxD = 0
    let last = 0
    let st = newRacer(track, 0, 0)
    for (let i = 0; i < 20 * 60; i++) {
      st = stepRacer(st, { ...GAS, steer: 1 }, DEFAULT_PARAMS, track, 1 / 60).st
      maxD = Math.max(maxD, Math.abs(st.d))
      if (st.s >= 390) break
      last = st.s
    }
    expect(maxD).toBeLessThanOrEqual(track.frameAt(0).width / 2)
    expect(st.s).toBeGreaterThan(last - 1e-6)
    expect(st.s).toBeGreaterThan(100)
  })
})
