/**
 * The combo album (spec §9.2): every combo the player has made at least once, kept across
 * races. Pure merge/repair plus a tiny localStorage wrapper the garage can read.
 */
import { COMBOS, type ComboId } from './parts'

export const ALBUM_KEY = 'kupa-avcilari-kurgu-album-v1'

const IDS = new Set<string>(COMBOS.map((c) => c.id))

export function parseAlbum(raw: unknown): ComboId[] {
  if (!Array.isArray(raw)) return []
  const out: ComboId[] = []
  for (const x of raw) if (typeof x === 'string' && IDS.has(x) && !out.includes(x as ComboId)) out.push(x as ComboId)
  return out
}

export function mergeAlbum(album: readonly ComboId[], seen: readonly ComboId[]): { album: ComboId[]; added: ComboId[] } {
  const added = seen.filter((c, i) => !album.includes(c) && seen.indexOf(c) === i)
  return { album: [...album, ...added], added }
}

export function loadAlbum(storage: Storage | null = globalThis.localStorage ?? null): ComboId[] {
  try {
    return parseAlbum(JSON.parse(storage?.getItem(ALBUM_KEY) ?? '[]'))
  } catch {
    return []
  }
}

/** Adds the combos seen this race; returns the ones that are new to the album. */
export function recordCombos(seen: readonly ComboId[], storage: Storage | null = globalThis.localStorage ?? null): ComboId[] {
  const r = mergeAlbum(loadAlbum(storage), seen)
  try {
    if (r.added.length > 0) storage?.setItem(ALBUM_KEY, JSON.stringify(r.album))
  } catch (error) {
    console.warn('Combo album could not be saved:', error)
  }
  return r.added
}
