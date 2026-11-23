/** The player's best run per track, kept in localStorage as an encoded ghost. */
import { decodeGhost, encodeGhost, type Ghost } from '../sim/ghost'

export interface PlayerBest {
  readonly ghost: Ghost
}

const key = (trackId: string): string => `kupa-avcilari-best-${trackId}-v1`

export function loadBest(trackId: string): PlayerBest | null {
  try {
    const text = localStorage.getItem(key(trackId))
    return text === null ? null : { ghost: { ...decodeGhost(text), id: 'you-best' } }
  } catch {
    return null
  }
}

export function saveBest(trackId: string, ghost: Ghost): void {
  try {
    localStorage.setItem(key(trackId), encodeGhost(ghost))
  } catch {
    // Storage full or blocked: the record simply is not kept.
  }
}
