import { describe, expect, it } from 'vitest'
import { buildTrack } from '../../sim/track'
import { buildCircuit, lapOf, lapS, type CircuitSpec } from './circuit'

const OVAL: CircuitSpec = {
  id: 'oval', name: 'Test Ovali', laps: 3, width: 18,
  pts: [[0, 0, 0], [120, 0, 0], [240, 0, 0], [320, 80, 0], [240, 160, 0], [120, 160, 0], [0, 160, 0], [-80, 80, 0]],
  boosts: [0.1, 0.6],
  coins: [{ u: 0.3, n: 5, d: 2 }],
}

describe('buildCircuit', () => {
  const c = buildCircuit(OVAL)
  const track = buildTrack(c.def)

  it('unrolls the loop into the requested number of laps', () => {
    expect(c.laps).toBe(3)
    expect(Math.abs(track.length - c.lapLen * 3)).toBeLessThan(2)
    expect(c.lapLen).toBeGreaterThan(700)
    expect(c.lapLen).toBeLessThan(1050)
  })

  it('closes: every lap passes the start line in the same place and direction', () => {
    const a = track.toWorld(c.lapLen, 0, 0)
    const b = track.toWorld(2 * c.lapLen, 0, 0)
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.6)
    const s0 = track.toWorld(0, 0, 0)
    expect(Math.hypot(a.x - s0.x, a.z - s0.z)).toBeLessThan(1.5)
    const t1 = track.frameAt(c.lapLen - 2).t
    const t2 = track.frameAt(c.lapLen + 2).t
    expect(t1.x * t2.x + t1.y * t2.y + t1.z * t2.z).toBeGreaterThan(0.99)
  })

  it('lays the same lap again: positions repeat lap after lap', () => {
    for (const u of [0.13, 0.5, 0.77]) {
      const p = track.toWorld(c.lapLen * (1 + u), 0, 0)
      const q = track.toWorld(c.lapLen * (2 + u), 0, 0)
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(0.8)
    }
  })

  it('repeats boosts and coins every lap at the same lap position', () => {
    expect(c.def.coins.length).toBe(15)
    const firstLap = c.def.coins.slice(0, 5).map((x) => lapS(x.s, c.lapLen))
    const thirdLap = c.def.coins.slice(10).map((x) => lapS(x.s, c.lapLen))
    firstLap.forEach((s, i) => expect(Math.abs(s - thirdLap[i])).toBeLessThan(1))
    const boostLaps = [0, 1, 2].map((k) => track.boostAt(c.lapLen * (k + 0.1) + 5))
    expect(boostLaps).toEqual([true, true, true])
    expect(track.boostAt(c.lapLen * 1.3)).toBe(false)
  })

  it('uses the circuit width everywhere', () => {
    expect(track.frameAt(c.lapLen * 1.5).width).toBe(18)
    expect(track.surfaceAt(c.lapLen * 2.9)).toBe('road')
  })
})

describe('lap helpers', () => {
  it('counts laps from 1 and caps at the last lap', () => {
    expect(lapOf(0, 1000, 3)).toBe(1)
    expect(lapOf(999, 1000, 3)).toBe(1)
    expect(lapOf(1000, 1000, 3)).toBe(2)
    expect(lapOf(2500, 1000, 3)).toBe(3)
    expect(lapOf(3000, 1000, 3)).toBe(3)
    expect(lapOf(-5, 1000, 3)).toBe(1)
  })

  it('wraps a distance into the lap', () => {
    expect(lapS(1250, 1000)).toBeCloseTo(250)
    expect(lapS(-10, 1000)).toBeCloseTo(990)
  })
})
