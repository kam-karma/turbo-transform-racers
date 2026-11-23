import { describe, expect, it } from 'vitest'
import { buildKurguTrack, mirrorKurgu } from '../sim/kurguTrack'
import { kurguSkill, runKurguBot } from '../sim/kurguBot'
import { layoutIssues } from '../sim/layout'
import { BOSS_CHECKPOINTS, KURGU_DEFS, KURGU_TRACKS, kurguDefFor } from './index'

const ids = ['devev1', 'devev2', 'devev3', 'devev4', 'devev5', 'devev6', 'devevboss']

describe('Kurgu tracks', () => {
  it('exports the six cup tracks and the boss track', () => {
    expect(Object.keys(KURGU_TRACKS).sort()).toEqual([...ids].sort())
    expect(kurguDefFor('devev3', 'mirror', false).id).toBe('devev3-m')
    expect(kurguDefFor('nope', 'normal', true).id).toBe('devevboss')
  })

  for (const id of ids) {
    describe(id, () => {
      const def = KURGU_DEFS[id]
      const kt = buildKurguTrack(def)

      it('is 3.5-4.3 km, starts and ends on road', () => {
        expect(kt.length).toBeGreaterThan(3500)
        expect(kt.length).toBeLessThan(4300)
        expect(kt.main.surfaceAt(0)).toBe('road')
        expect(kt.main.surfaceAt(kt.length - 1)).toBe('road')
      })

      it('fits its house, mirrored too', () => {
        expect(layoutIssues(kt)).toEqual([])
        expect(layoutIssues(buildKurguTrack(mirrorKurgu(def)))).toEqual([])
      })

      it('offers the part of every gate in a pickup row before it', () => {
        expect(def.gates.length).toBeGreaterThanOrEqual(3)
        for (const g of def.gates) {
          const before = def.rows.filter((r) => r.s < g.s0 - 40 && r.s > g.s0 - 900)
          expect(before.some((r) => r.lanes.some((l) => l.part === g.need)), `gate ${g.index} (${g.kind})`).toBe(true)
        }
      })

      it('keeps rows, obstacles and the hidden part off the gates and on the road', () => {
        for (const g of def.gates) {
          for (const x of [...def.rows, ...def.obstacles, def.hidden]) expect(x.s < g.s0 - 10 || x.s > g.s1 + 10).toBe(true)
        }
        for (const o of def.obstacles) expect(Math.abs(o.d)).toBeLessThan(6)
        expect(Math.abs(def.hidden.d)).toBeLessThan(6.2)
      })

      it('races in 85-150 s: the best pilot around 90-110 s, the weakest under 150 s', () => {
        const best = runKurguBot(kt, kurguSkill(0), 11).ghost.time
        const worst = runKurguBot(kt, kurguSkill(14), 12).ghost.time
        expect(best).toBeGreaterThan(80)
        expect(best).toBeLessThan(112)
        expect(worst).toBeLessThan(150)
        expect(worst).toBeGreaterThan(best)
      })
    })
  }

  it('the boss race has exactly three gates and a checkpoint before each', () => {
    const def = KURGU_DEFS.devevboss
    expect(def.gates).toHaveLength(3)
    expect(BOSS_CHECKPOINTS).toHaveLength(3)
    def.gates.forEach((g, i) => expect(BOSS_CHECKPOINTS[i]).toBeLessThan(g.s0))
  })
})
