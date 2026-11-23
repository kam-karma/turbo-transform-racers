import { describe, expect, it } from 'vitest'
import { RaceClock, standings } from './race'

describe('RaceClock countdown with 60 fps steps', () => {
  it('never shows 0 while still counting down, so modes see the GO moment once racing starts', () => {
    const c = new RaceClock()
    c.start()
    const seen: number[] = []
    for (let i = 0; i < 240 && c.phase === 'countdown'; i++) {
      seen.push(c.countdown)
      c.tick(1 / 60)
    }
    expect(c.phase).toBe('racing')
    expect(Math.min(...seen)).toBe(1)
  })
})

describe('standings', () => {
  it('ranks finishers by finish time, then everyone else by distance', () => {
    expect(standings([
      { id: 'a', s: 900, finishedAt: null },
      { id: 'b', s: 1000, finishedAt: 101 },
      { id: 'c', s: 950, finishedAt: null },
      { id: 'd', s: 1000, finishedAt: 99 },
    ])).toEqual(['d', 'b', 'c', 'a'])
  })
})

describe('RaceClock', () => {
  it('counts down 3 s from start, then races and keeps race time', () => {
    const c = new RaceClock()
    expect(c.phase).toBe('intro')
    c.tick(5)
    expect(c.phase).toBe('intro')
    c.start()
    expect(c.phase).toBe('countdown')
    expect(c.countdown).toBe(3)
    c.tick(1.2)
    expect(c.countdown).toBe(2)
    c.tick(1.81)
    expect(c.phase).toBe('racing')
    c.tick(0.5)
    expect(c.raceT).toBeCloseTo(0.5 + 0.01, 5)
    c.finish()
    expect(c.phase).toBe('finished')
  })
})
