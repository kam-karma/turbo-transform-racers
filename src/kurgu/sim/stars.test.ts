import { describe, expect, it } from 'vitest'
import { challengeLabel, kurguStars, type KurguTally } from './stars'
import { mergeAlbum, parseAlbum } from './album'

const tally: KurguTally = { place: 1, hidden: true, combos: 1, gatesOk: 3, gatesTotal: 3, coins: 40, knocks: 0, smashes: 2, catches: 0 }

describe('Kurgu stars', () => {
  it('race stars: first place, hidden part, the track challenge (Turkish labels)', () => {
    const r = kurguStars({ kind: 'coins', n: 30 }, tally, false)
    expect(r.stars).toEqual([true, true, true])
    expect(r.labels).toEqual(['Birinci ol', 'Gizli parçayı bul', '30 para topla'])
    expect(kurguStars({ kind: 'coins', n: 30 }, { ...tally, place: 2, hidden: false, coins: 10 }, false).stars).toEqual([false, false, false])
  })

  it('each challenge kind checks its own tally', () => {
    expect(kurguStars({ kind: 'combo' }, { ...tally, combos: 0 }, false).stars[2]).toBe(false)
    expect(kurguStars({ kind: 'gates' }, { ...tally, gatesOk: 2 }, false).stars[2]).toBe(false)
    expect(kurguStars({ kind: 'noKnock' }, { ...tally, knocks: 1 }, false).stars[2]).toBe(false)
    expect(kurguStars({ kind: 'smash', n: 3 }, tally, false).stars[2]).toBe(false)
    expect(challengeLabel({ kind: 'smash', n: 3 })).toBe('3 engel kır')
  })

  it('boss stars: escape, never caught, every gate with its part', () => {
    const r = kurguStars({ kind: 'combo' }, { ...tally, catches: 1 }, true)
    expect(r.labels).toEqual(['Süpürgeden kaç', 'Hiç yakalanma', 'Üç kapıyı da parçayla geç'])
    expect(r.stars).toEqual([true, false, true])
  })
})

describe('combo album', () => {
  it('adds only new combos and repairs stored junk', () => {
    expect(mergeAlbum(['flight'], ['flight', 'ball'])).toEqual({ album: ['flight', 'ball'], added: ['ball'] })
    expect(parseAlbum(['ball', 'nope', 3, 'ball'])).toEqual(['ball'])
    expect(parseAlbum('x')).toEqual([])
  })
})
