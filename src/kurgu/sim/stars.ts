/**
 * The three star goals of a Kurgu race (spec §8.3, contract "Stars"): first place, the hidden
 * part, and the track's own challenge. The Robot Süpürge race has its own three.
 */
import type { Challenge } from './kurguTrack'

export interface KurguTally {
  readonly place: number
  readonly hidden: boolean
  readonly combos: number
  readonly gatesOk: number
  readonly gatesTotal: number
  readonly coins: number
  readonly knocks: number
  readonly smashes: number
  readonly catches: number
}

export type Stars = readonly [boolean, boolean, boolean]
export type StarLabels = readonly [string, string, string]

export function challengeLabel(c: Challenge): string {
  switch (c.kind) {
    case 'combo': return 'Bir kombo yap'
    case 'gates': return 'Tüm kapılardan parçayla geç'
    case 'coins': return `${c.n} para topla`
    case 'noKnock': return 'Hiç parça düşürme'
    case 'smash': return `${c.n} engel kır`
  }
}

function challengeMet(c: Challenge, t: KurguTally): boolean {
  switch (c.kind) {
    case 'combo': return t.combos > 0
    case 'gates': return t.gatesOk >= t.gatesTotal
    case 'coins': return t.coins >= c.n
    case 'noKnock': return t.knocks === 0
    case 'smash': return t.smashes >= c.n
  }
}

export function kurguStars(c: Challenge, t: KurguTally, boss: boolean): { stars: Stars; labels: StarLabels } {
  if (boss) {
    return {
      stars: [true, t.catches === 0, t.gatesOk >= t.gatesTotal],
      labels: ['Süpürgeden kaç', 'Hiç yakalanma', 'Üç kapıyı da parçayla geç'],
    }
  }
  return { stars: [t.place === 1, t.hidden, challengeMet(c, t)], labels: ['Birinci ol', 'Gizli parçayı bul', challengeLabel(c)] }
}
