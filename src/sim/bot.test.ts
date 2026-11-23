import { describe, expect, it } from 'vitest'
import { botInput, newBotMemory, rng, runBot } from './bot'
import { DEFAULT_PARAMS, newRacer, stepRacer } from './racer'
import { PILOTS } from './pilots'
import { buildTrack } from './track'
import { ADALAR_1 } from './tracks/adalar1'

const track = buildTrack(ADALAR_1)
const best = PILOTS[0]
const worst = PILOTS[PILOTS.length - 1]

describe('bot driver', () => {
  it('the best pilot finishes Uçan Adalar 1 in under 160 s', () => {
    const g = runBot(track, best.skill, 1)
    expect(g.time).toBeLessThan(160)
    expect(g.samples[g.samples.length - 1].s).toBeCloseTo(track.length, 0)
  })

  it('the weakest pilot is slower but never gets stuck (under 240 s)', () => {
    const fast = runBot(track, best.skill, 2)
    const slow = runBot(track, worst.skill, 2)
    expect(slow.time).toBeLessThan(240)
    expect(slow.time).toBeGreaterThan(fast.time)
  })

  it('changes form about once per boundary, never flip-flopping', () => {
    let boundaries = 0
    for (let b = track.nextBoundary(0); b !== null; b = track.nextBoundary(b.s + 0.01)) boundaries++
    const rand = rng(3)
    const mem = newBotMemory()
    let st = newRacer(track, 0, 0)
    let transforms = 0
    while (!st.finished && st.time < 300) {
      const r = stepRacer(st, botInput(st, track, best.skill, rand, mem), DEFAULT_PARAMS, track, 1 / 60)
      st = r.st
      transforms += r.events.filter((e) => e.kind === 'transform').length
    }
    expect(boundaries).toBeGreaterThan(5)
    expect(transforms).toBeLessThanOrEqual(boundaries + 2)
  })

  it('is deterministic for a seed', () => {
    expect(runBot(track, best.skill, 7).time).toBe(runBot(track, best.skill, 7).time)
  })
})

describe('pilots', () => {
  it('has 15 named Kupa Pilotları with badges, ordered best first', () => {
    expect(PILOTS).toHaveLength(15)
    expect(new Set(PILOTS.map((p) => p.name)).size).toBe(15)
    for (const p of PILOTS) expect(p.badge.length).toBeGreaterThan(0)
    expect(PILOTS[0].skill.perfectChance).toBeGreaterThan(PILOTS[14].skill.perfectChance)
  })
})
