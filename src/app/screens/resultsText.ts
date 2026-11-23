/** Pure text helpers for the results screen (unit tested). */
import type { RaceOutcome } from '../../modes/types'

export function resultTitle(o: Pick<RaceOutcome, 'place' | 'bossBeaten'>, boss: boolean): { text: string; icon: string } {
  if (boss) return o.bossBeaten === true ? { text: "BOSS'U YENDİN!", icon: 'trophy-gold' } : { text: 'Az kaldı! Bir daha dene', icon: 'boss' }
  switch (o.place) {
    case 1: return { text: 'BİRİNCİ OLDUN!', icon: 'trophy-gold' }
    case 2: return { text: 'İKİNCİ OLDUN!', icon: 'trophy-silver' }
    case 3: return { text: 'ÜÇÜNCÜ OLDUN!', icon: 'trophy-bronze' }
    default: return { text: `${Math.max(1, Math.round(o.place))}. oldun`, icon: 'flag' }
  }
}

/** First letter of a racer name for the podium avatar ("Senin rekorun" → "S"). */
export function rowInitial(name: string): string {
  const letter = [...name.trim()].find((ch) => /\p{L}|\p{N}/u.test(ch))
  return letter === undefined ? '?' : letter.toLocaleUpperCase('tr')
}
