import { describe, expect, it } from 'vitest'
import { kurguOutcome } from '../outcome'
import { kurguSkill, runKurguBot } from './kurguBot'
import { decodeKurguGhost, encodeKurguGhost, slotsAt } from './kurguGhost'
import { buildKurguTrack, kurguTrack, type KPiece } from './kurguTrack'
import { newKurgu } from './kurguRacer'
import { PART_IDS } from './parts'

const pieces: KPiece[] = [
  { len: 200, surface: 'road', row: 'wing|drill|treads', zone: 'cocuk', coins: { n: 6, d: 0 } },
  { len: 60, surface: 'gap' },
  { len: 260, surface: 'road', row: 'float|magnet|bumper', obs: [[160, 0, 'block']], hidden: { at: 40, d: -5.5, part: 'rocket' } },
  { len: 120, surface: 'water' },
  { len: 300, surface: 'road' },
]
const kt = buildKurguTrack(kurguTrack('g', 'Test', pieces, { kind: 'gates' }))

describe('Kurgu bots and ghosts', () => {
  it('a sharp pilot takes the parts its gates need and records them', () => {
    const g = runKurguBot(kt, kurguSkill(0), 3)
    expect(g.ghost.samples.length).toBeGreaterThan(100)
    const parts = g.parts.map((e) => e.part)
    expect(parts).toContain('wing')
    expect(parts).toContain('float')
    expect(g.alts).toEqual([])
    const mid = slotsAt(g, g.ghost.time)
    expect(mid.side?.id).toBe('wing')
  })

  it('is deterministic per seed', () => {
    expect(runKurguBot(kt, kurguSkill(5), 9).ghost.time).toBe(runKurguBot(kt, kurguSkill(5), 9).ghost.time)
  })

  it('round-trips through its text encoding', () => {
    const g = runKurguBot(kt, kurguSkill(14), 4)
    const back = decodeKurguGhost(encodeKurguGhost(g))
    expect(back.alts).toEqual(g.alts)
    expect(back.parts.map((e) => e.part)).toEqual(g.parts.map((e) => e.part))
    expect(back.ghost.samples.length).toBe(g.ghost.samples.length)
    expect(() => decodeKurguGhost('{"g":1}')).toThrow()
  })
})

describe('Kurgu outcome', () => {
  it('reports place, stars and the rare part to keep', () => {
    const k0 = newKurgu(kt, 0, 0, ['rocket', 'magnet'])
    const k = { ...k0, r: { ...k0.r, time: 50, finished: true }, gatesOk: 2 }
    const o = kurguOutcome({ k, rivals: [], challenge: { kind: 'gates' }, gatesTotal: 2, boss: null, newBest: true, newCombos: 0 })
    expect(o.place).toBe(1)
    expect(o.stars).toEqual([true, false, true])
    expect(o.extra?.rarePart).toBe(PART_IDS.indexOf('rocket'))
    expect(o.rows[0].you).toBe(true)
  })

  it('boss races list the vacuum and count the escape', () => {
    const k = newKurgu(kt, 0, 0)
    const o = kurguOutcome({ k, rivals: [], challenge: { kind: 'gates' }, gatesTotal: 3, boss: { won: true, catches: 2 }, newBest: false, newCombos: 0 })
    expect(o.bossBeaten).toBe(true)
    expect(o.rows.map((r) => r.name)).toEqual(['Sen', 'Robot Süpürge'])
    expect(o.stars).toEqual([true, false, false])
    expect(o.extra?.rarePart).toBeUndefined()
  })
})
