/**
 * Track variants (spec §8.4): one layout gives four races.
 * - reverse: the pieces driven back to front. The elevation profile is mirrored, but jumps
 *   and climbs keep their meaning: the piece before a gap becomes its take-off lip, and
 *   climbing walls still go up.
 * - mirror: every turn and coin line flipped left ↔ right.
 * - night: the same layout; only the world's sky and lighting change (see isNight).
 */
import type { TrackDef, ThemeId } from '../track'
import { pathTrack, type Piece } from '../trackPath'

export type TrackVariant = 'normal' | 'reverse' | 'night' | 'mirror'

export const VARIANTS: readonly TrackVariant[] = ['normal', 'reverse', 'night', 'mirror']

export const isNight = (v: TrackVariant): boolean => v === 'night'

/** Pitch (degrees) at the end of every piece, as pathTrack eases it. */
function endPitches(pieces: readonly Piece[]): number[] {
  let p = 0
  return pieces.map((pc) => (p = pc.pitchTo ?? p))
}

/** Theme in force on every piece (themes carry over until the next marked piece). */
function themesOf(pieces: readonly Piece[]): ThemeId[] {
  let t: ThemeId = pieces.find((p) => p.theme !== undefined)?.theme ?? 'candy'
  return pieces.map((pc) => (t = pc.theme ?? t))
}

export function reversePieces(pieces: readonly Piece[]): Piece[] {
  const ends = endPitches(pieces)
  const themes = themesOf(pieces)
  const n = pieces.length
  const out: Piece[] = []
  for (let i = n - 1; i >= 0; i--) {
    const src = pieces[i]
    const startPitch = i > 0 ? ends[i - 1] : 0
    // Driving a piece backwards runs its pitch from −end to −start.
    let pitchTo = -startPitch
    const prevSrc = pieces[i - 1] as Piece | undefined
    const nextSrc = pieces[i + 1] as Piece | undefined
    if (src.surface === 'climb') pitchTo = src.pitchTo ?? 30
    else if (prevSrc?.surface === 'climb') pitchTo = 0 // arriving at a wall: level out first
    else if (nextSrc?.surface === 'climb') pitchTo = 0 // over the crest: back to level
    // Plain pieces only ever level out or descend: climbing walls (which still rise when
    // reversed) and take-off lips supply the height, as in the forward layout.
    else pitchTo = -Math.abs(pitchTo)
    const ramp = src.surface !== 'gap' && prevSrc?.surface === 'gap'
    if (ramp) pitchTo = Math.max(pitchTo, 6)
    const theme = themes[i] !== themes[i + 1] || i === n - 1 ? themes[i] : undefined
    out.push({
      len: src.len,
      surface: src.surface,
      turn: src.turn === undefined ? undefined : -src.turn,
      pitchTo,
      width: src.width,
      boost: src.boost,
      ramp: ramp || undefined,
      coins: src.coins === undefined ? undefined : { n: src.coins.n, d: -src.coins.d },
      theme,
    })
  }
  // The reversed list starts on what was the finish straight: level, on road.
  if (out.length > 0) out[0] = { ...out[0], pitchTo: 0 }
  if (out.length > 0) out[out.length - 1] = { ...out[out.length - 1], pitchTo: 0 }
  return out
}

export function mirrorPieces(pieces: readonly Piece[]): Piece[] {
  return pieces.map((p) => ({
    ...p,
    turn: p.turn === undefined ? undefined : -p.turn,
    coins: p.coins === undefined ? undefined : { n: p.coins.n, d: -p.coins.d },
  }))
}

export function variantPieces(pieces: readonly Piece[], v: TrackVariant): readonly Piece[] {
  if (v === 'reverse') return reversePieces(pieces)
  if (v === 'mirror') return mirrorPieces(pieces)
  return pieces
}

/** The TrackDef of a variant. Ids stay unique per layout so ghosts and records do not mix. */
export function variantTrack(id: string, name: string, pieces: readonly Piece[], v: TrackVariant): TrackDef {
  const suffix = v === 'normal' || v === 'night' ? '' : `-${v}`
  return pathTrack(`${id}${suffix}`, name, variantPieces(pieces, v))
}
