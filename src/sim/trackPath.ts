/**
 * Builds a TrackDef from a list of pieces ("200 m of road turning 30° left while rising to
 * 8°"), so section boundaries line up exactly with the geometry that carries them.
 */
import type { Surface } from './forms'
import type { CoinDef, ThemeId, TrackDef, TrackSection } from './track'
import { v3, type V3 } from './vec'

export interface Piece {
  readonly len: number
  readonly surface: Surface
  /** Degrees of heading change over the piece; + = left. */
  readonly turn?: number
  /** Pitch in degrees reached at the end of the piece (eased from the previous one). */
  readonly pitchTo?: number
  readonly width?: number
  /** Boost pad over the first 30 m of the piece. */
  readonly boost?: boolean
  /** Lip of a jump at the end of the piece (only a marker for the visuals). */
  readonly ramp?: boolean
  /** A line of coins down the piece: count and lateral offset (+ = left). */
  readonly coins?: { readonly n: number; readonly d: number }
  readonly theme?: ThemeId
}

const STEP = 4
const DEG = Math.PI / 180

const ease = (t: number): number => t * t * (3 - 2 * t)

export function pathTrack(id: string, name: string, pieces: readonly Piece[], start: V3 = v3(0, 0, 0)): TrackDef {
  const points: V3[] = [start]
  const sections: TrackSection[] = []
  const coins: CoinDef[] = []
  const themes: { from: number; theme: ThemeId }[] = []
  let p = start
  let heading = 0
  let pitch = 0
  let s0 = 0
  for (const piece of pieces) {
    const n = Math.max(1, Math.round(piece.len / STEP))
    const ds = piece.len / n
    const pitchFrom = pitch
    const pitchTo = (piece.pitchTo ?? pitch / DEG) * DEG
    const dh = ((piece.turn ?? 0) * DEG) / n
    for (let i = 1; i <= n; i++) {
      heading += dh / 2
      pitch = pitchFrom + (pitchTo - pitchFrom) * ease(i / n)
      const c = Math.cos(pitch)
      p = v3(p.x + Math.sin(heading) * c * ds, p.y + Math.sin(pitch) * ds, p.z + Math.cos(heading) * c * ds)
      heading += dh / 2
      points.push(p)
    }
    sections.push({ len: piece.len, surface: piece.surface, width: piece.width, boost: piece.boost ? [[0, 30]] : undefined, ramp: piece.ramp })
    if (piece.coins !== undefined) {
      for (let k = 0; k < piece.coins.n; k++) coins.push({ s: s0 + ((k + 1) * piece.len) / (piece.coins.n + 1), d: piece.coins.d })
    }
    if (piece.theme !== undefined) themes.push({ from: s0, theme: piece.theme })
    s0 += piece.len
  }
  return { id, name, points, sections, coins, themes }
}
