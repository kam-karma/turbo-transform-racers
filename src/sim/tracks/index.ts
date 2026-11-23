/**
 * Uçan Adalar tracks by id. Other worlds keep their tracks in their own folders and export
 * their own maps; `TRACKS` here holds the six Dönüşüm (Adalar) layouts.
 */
import type { TrackDef } from '../track'
import type { Piece } from '../trackPath'
import { ADALAR_1, ADALAR_1_PIECES } from './adalar1'
import { ADALAR_2, ADALAR_2_PIECES } from './adalar2'
import { ADALAR_3, ADALAR_3_PIECES } from './adalar3'
import { ADALAR_4, ADALAR_4_PIECES } from './adalar4'
import { ADALAR_5, ADALAR_5_PIECES } from './adalar5'
import { ADALAR_6, ADALAR_6_PIECES } from './adalar6'
import { variantTrack, type TrackVariant } from './variants'

export const TRACKS: Readonly<Record<string, TrackDef>> = {
  adalar1: ADALAR_1,
  adalar2: ADALAR_2,
  adalar3: ADALAR_3,
  adalar4: ADALAR_4,
  adalar5: ADALAR_5,
  adalar6: ADALAR_6,
}

/** The piece lists the variants are derived from. */
export const ADALAR_PIECES: Readonly<Record<string, readonly Piece[]>> = {
  adalar1: ADALAR_1_PIECES,
  adalar2: ADALAR_2_PIECES,
  adalar3: ADALAR_3_PIECES,
  adalar4: ADALAR_4_PIECES,
  adalar5: ADALAR_5_PIECES,
  adalar6: ADALAR_6_PIECES,
}

/** A track in a variant ('night' keeps the normal layout; ask isNight() for the lighting). */
export function adalarTrack(id: string, variant: TrackVariant = 'normal'): TrackDef {
  const base = TRACKS[id]
  const pieces = ADALAR_PIECES[id]
  if (base === undefined || pieces === undefined) throw new Error(`Unknown Adalar track: ${id}`)
  if (variant === 'normal' || variant === 'night') return base
  return variantTrack(id, base.name, pieces, variant)
}

export { isNight, VARIANTS, type TrackVariant } from './variants'
