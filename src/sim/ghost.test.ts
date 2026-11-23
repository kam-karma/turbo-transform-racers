import { describe, expect, it } from 'vitest'
import { GhostRecorder, decodeGhost, encodeGhost, sampleGhost, type Ghost } from './ghost'
import { newRacer } from './racer'
import { buildTrack } from './track'
import { pathTrack } from './trackPath'

const track = buildTrack(pathTrack('g', 'G', [{ len: 500, surface: 'road' }, { len: 200, surface: 'water' }]))

function fakeGhost(): Ghost {
  const rec = new GhostRecorder()
  let st = newRacer(track, 0, 0)
  for (let i = 0; i <= 60; i++) {
    const t = i / 30
    st = { ...st, s: 20 * t + 0.0123, d: Math.sin(t) * 3.217, y: t > 1 ? 0.8 : 0, yaw: 0.1 * t, time: t, form: t > 1.5 ? 'boat' : 'car', turbo: t > 1 ? 0.5 : 0 }
    rec.push(st)
  }
  return rec.finish({ id: 'p1', pilot: 'Kaptan Volt', car: 'rt40', color: 0xff3366, time: 2 })
}

describe('ghost', () => {
  it('records at 10 Hz', () => {
    const g = fakeGhost()
    expect(g.hz).toBe(10)
    expect(g.samples).toHaveLength(21)
    expect(g.samples[10].t).toBeCloseTo(1, 5)
  })

  it('round-trips through the compact encoding (s ±0.05 m, d ±0.01 m)', () => {
    const g = fakeGhost()
    const back = decodeGhost(encodeGhost(g))
    expect(back.pilot).toBe('Kaptan Volt')
    expect(back.color).toBe(0xff3366)
    expect(back.samples).toHaveLength(g.samples.length)
    g.samples.forEach((a, i) => {
      const b = back.samples[i]
      expect(Math.abs(a.s - b.s)).toBeLessThanOrEqual(0.05)
      expect(Math.abs(a.d - b.d)).toBeLessThanOrEqual(0.01)
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(0.02)
      expect(b.form).toBe(a.form)
      expect(b.fx).toBe(a.fx)
    })
  })

  it('marks turbo in the effect bits', () => {
    const g = fakeGhost()
    expect(g.samples[5].fx & 1).toBe(0)
    expect(g.samples[15].fx & 1).toBe(1)
  })

  it('interpolates between samples and holds the last one after the end', () => {
    const g = fakeGhost()
    const mid = sampleGhost(g, 0.55)
    expect(mid.s).toBeCloseTo(20 * 0.55 + 0.0123, 1)
    expect(sampleGhost(g, 99).s).toBeCloseTo(g.samples[g.samples.length - 1].s, 5)
    expect(sampleGhost(g, -1).s).toBeCloseTo(g.samples[0].s, 5)
    expect(sampleGhost(g, 1.9).form).toBe('boat')
  })

  it('rejects garbage instead of crashing', () => {
    expect(() => decodeGhost('{"nope":1}')).toThrow()
  })
})
