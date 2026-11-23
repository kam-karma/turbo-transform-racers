/**
 * The Kurgu race result: results rows, the three stars, and the extras the results screen
 * reads — above all `rarePart` (index into PART_IDS of the part to offer to keep with a
 * rewarded video, spec §9.2) and `rareShiny` (1 when it was a golden one).
 */
import type { RaceOutcome, ResultRow } from '../modes/types'
import type { KurguState } from './sim/kurguRacer'
import type { Challenge } from './sim/kurguTrack'
import { PART_IDS, rarestPart } from './sim/parts'
import { kurguStars } from './sim/stars'
import type { KurguRival } from './view/rivals'

export interface OutcomeInput {
  readonly k: KurguState
  readonly rivals: readonly KurguRival[]
  readonly challenge: Challenge
  readonly gatesTotal: number
  readonly boss: { readonly won: boolean; readonly catches: number } | null
  readonly newBest: boolean
  readonly newCombos: number
}

export function kurguOutcome(o: OutcomeInput): RaceOutcome {
  const { k, rivals, boss } = o
  const finishOf = (id: string): number => {
    if (id === 'you') return k.r.time
    const r = rivals.find((x) => x.kg.ghost.id === id)
    return r === undefined ? Infinity : r.kg.ghost.time * r.stretch
  }
  const ids = ['you', ...rivals.map((r) => r.kg.ghost.id)].sort((a, b) => finishOf(a) - finishOf(b))
  const you: ResultRow = { name: 'Sen', badge: '', time: k.r.time, you: true, pilot: false }
  const rows: ResultRow[] = boss !== null
    ? [you, { name: 'Robot Süpürge', badge: '', time: null, you: false, pilot: false }]
    : ids.map((id) => {
      if (id === 'you') return you
      const r = rivals.find((x) => x.kg.ghost.id === id) as KurguRival
      return { name: r.name, badge: r.badge, time: r.kg.ghost.time * r.stretch, you: false, pilot: r.pilot }
    })
  const place = boss !== null ? (boss.won ? 1 : 2) : ids.indexOf('you') + 1
  const { stars, labels } = kurguStars(o.challenge, {
    place, hidden: k.hidden, combos: k.combos.length, gatesOk: k.gatesOk, gatesTotal: o.gatesTotal,
    coins: k.r.coins, knocks: k.knocks, smashes: k.smashes, catches: boss?.catches ?? 0,
  }, boss !== null)
  const rare = rarestPart(k.ever)
  const extra: Record<string, number> = {
    combos: k.combos.length, newCombos: o.newCombos, gatesOk: k.gatesOk, gatesTotal: o.gatesTotal,
    knocks: k.knocks, smashes: k.smashes, hiddenFound: k.hidden ? 1 : 0, newBest: o.newBest ? 1 : 0, catches: boss?.catches ?? 0,
  }
  if (rare !== null) {
    extra.rarePart = PART_IDS.indexOf(rare.id)
    extra.rareShiny = rare.shiny ? 1 : 0
  }
  return {
    place, of: boss !== null ? 2 : ids.length, time: k.r.time, coins: k.r.coins, stars, starLabels: labels,
    bossBeaten: boss !== null ? boss.won : undefined, extra, rows,
  }
}
