import { describe, expect, it } from 'vitest'
import { buildTrack } from '../track'
import type { Piece } from '../trackPath'
import { ADALAR_1_PIECES } from './adalar1'
import { adalarTrack } from './index'
import { isNight, mirrorPieces, reversePieces, variantPieces, variantTrack } from './variants'

describe('mirror', () => {
  it('flips every turn and coin line', () => {
    const m = mirrorPieces(ADALAR_1_PIECES)
    m.forEach((p, i) => {
      expect((p.turn ?? 0) + (ADALAR_1_PIECES[i].turn ?? 0)).toBe(0)
      if (p.coins !== undefined) expect(p.coins.d).toBe(-(ADALAR_1_PIECES[i].coins?.d ?? 0))
    })
  })

  it('gives the mirror image of the layout', () => {
    const a = buildTrack(adalarTrack('adalar1'))
    const b = buildTrack(adalarTrack('adalar1', 'mirror'))
    expect(b.length).toBeCloseTo(a.length, 3)
    for (const s of [500, 1500, 3000]) {
      expect(b.frameAt(s).pos.x).toBeCloseTo(-a.frameAt(s).pos.x, 3)
      expect(b.frameAt(s).pos.z).toBeCloseTo(a.frameAt(s).pos.z, 3)
    }
  })
})

describe('reverse', () => {
  const r = reversePieces(ADALAR_1_PIECES)

  it('drives the pieces back to front with turns flipped', () => {
    expect(r.map((p) => p.surface)).toEqual([...ADALAR_1_PIECES].reverse().map((p) => p.surface))
    expect(r.map((p) => p.turn ?? 0)).toEqual([...ADALAR_1_PIECES].reverse().map((p) => 0 - (p.turn ?? 0)))
  })

  it('turns the piece before every gap into a rising take-off lip', () => {
    r.forEach((p, i) => {
      if (r[i + 1]?.surface === 'gap' && p.surface !== 'gap') {
        expect(p.ramp).toBe(true)
        expect(p.pitchTo ?? 0).toBeGreaterThanOrEqual(6)
      }
    })
  })

  it('keeps the themes of the pieces', () => {
    const fwd = buildTrack(adalarTrack('adalar1'))
    const rev = buildTrack(adalarTrack('adalar1', 'reverse'))
    // Mid-piece samples: theme at s in reverse = theme at (L - s) forward.
    for (const s of [100, 900, 1700, 2500, 3300]) expect(rev.themeAt(s)).toBe(fwd.themeAt(fwd.length - s))
  })

  it('does not change the piece list it is given', () => {
    const copy: Piece[] = ADALAR_1_PIECES.map((p) => ({ ...p }))
    reversePieces(ADALAR_1_PIECES)
    expect(ADALAR_1_PIECES).toEqual(copy)
  })
})

describe('variant tracks', () => {
  it('give reverse and mirror their own ids; night shares the normal layout', () => {
    expect(variantTrack('adalar1', 'X', ADALAR_1_PIECES, 'reverse').id).toBe('adalar1-reverse')
    expect(variantTrack('adalar1', 'X', ADALAR_1_PIECES, 'mirror').id).toBe('adalar1-mirror')
    expect(variantTrack('adalar1', 'X', ADALAR_1_PIECES, 'night').id).toBe('adalar1')
    expect(variantPieces(ADALAR_1_PIECES, 'night')).toBe(ADALAR_1_PIECES)
    expect(adalarTrack('adalar1', 'night')).toBe(adalarTrack('adalar1'))
  })

  it('night is only a lighting flag', () => {
    expect(isNight('night')).toBe(true)
    expect(isNight('reverse')).toBe(false)
  })

  it('rejects unknown tracks', () => {
    expect(() => adalarTrack('nope')).toThrow()
  })
})
