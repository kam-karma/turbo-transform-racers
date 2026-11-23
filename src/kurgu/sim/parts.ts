/**
 * Kurgu Kupası toy parts: four slots on the car, nine parts, the combos two parts make
 * together, and the rarity used for the results' "garaja götür" (keep the part) offer.
 * Pure data and immutable helpers; no Three.js.
 */
export type Slot = 'front' | 'side' | 'back' | 'wheels'
export type PartId = 'drill' | 'bumper' | 'magnet' | 'wing' | 'rocket' | 'propeller' | 'bigwheel' | 'float' | 'treads'

export const SLOTS: readonly Slot[] = ['front', 'side', 'back', 'wheels']

export interface PartDef {
  readonly id: PartId
  readonly slot: Slot
  /** Player-facing Turkish name. */
  readonly name: string
  /** One-line Turkish description of what it does. */
  readonly does: string
  /** 1 common … 3 rare. A shiny (golden) pickup always counts as the rarest. */
  readonly rarity: 1 | 2 | 3
  /** Accent colour for HUD and pickup bubble (CSS hex). */
  readonly color: string
}

export const PART_DEFS: Readonly<Record<PartId, PartDef>> = {
  drill: { id: 'drill', slot: 'front', name: 'Kalemtıraş Matkap', does: 'Oyuncak duvarları deler', rarity: 2, color: '#ff8a3d' },
  bumper: { id: 'bumper', slot: 'front', name: 'Silgi Tampon', does: 'Çarpınca yavaşlamazsın', rarity: 1, color: '#ff7eb6' },
  magnet: { id: 'magnet', slot: 'front', name: 'Ataş Mıknatıs', does: 'Paraları çeker', rarity: 1, color: '#ff4d5e' },
  wing: { id: 'wing', slot: 'side', name: 'Blok Kanat', does: 'Boşlukların üstünden süzülür', rarity: 2, color: '#4fc3ff' },
  rocket: { id: 'rocket', slot: 'back', name: 'Kalem Roket', does: 'Rampadan uçurur', rarity: 3, color: '#ffcf3a' },
  propeller: { id: 'propeller', slot: 'back', name: 'Oyuncak Pervane', does: 'Suda iter', rarity: 2, color: '#62e3b1' },
  bigwheel: { id: 'bigwheel', slot: 'wheels', name: 'Makara Dev Tekerlek', does: 'Engelleri ezer, halıda hızlı', rarity: 1, color: '#b58cff' },
  float: { id: 'float', slot: 'wheels', name: 'Şamandıra Tekerlek', does: 'Suda yüzer', rarity: 1, color: '#3ad1e8' },
  treads: { id: 'treads', slot: 'wheels', name: 'Paletli Tekerlek', does: 'Dik duvarlara tırmanır', rarity: 2, color: '#9be15d' },
}

export const PART_IDS: readonly PartId[] = ['drill', 'bumper', 'magnet', 'wing', 'rocket', 'propeller', 'bigwheel', 'float', 'treads']

export interface Attached {
  readonly id: PartId
  /** Golden pickup: rare, offered at the results. */
  readonly shiny: boolean
  /** Attach order, for "the last attached part falls off first". */
  readonly order: number
}

export type Loadout = Readonly<Record<Slot, Attached | null>> & { readonly seq: number }

export const emptyLoadout = (): Loadout => ({ front: null, side: null, back: null, wheels: null, seq: 0 })

export function attach(lo: Loadout, id: PartId, shiny: boolean): { loadout: Loadout; replaced: Attached | null } {
  const slot = PART_DEFS[id].slot
  const seq = lo.seq + 1
  return { loadout: { ...lo, [slot]: { id, shiny, order: seq }, seq }, replaced: lo[slot] }
}

export function knockOff(lo: Loadout): { loadout: Loadout; lost: Attached | null } {
  let slot: Slot | null = null
  for (const s of SLOTS) {
    const a = lo[s]
    if (a !== null && (slot === null || a.order > (lo[slot]?.order ?? -1))) slot = s
  }
  if (slot === null) return { loadout: lo, lost: null }
  return { loadout: { ...lo, [slot]: null }, lost: lo[slot] }
}

export const hasPart = (lo: Loadout, id: PartId): boolean => lo[PART_DEFS[id].slot]?.id === id

export const partsOf = (lo: Loadout): Attached[] => SLOTS.map((s) => lo[s]).filter((a): a is Attached => a !== null)

export type ComboId = 'flight' | 'ball' | 'driller' | 'speedboat' | 'miner' | 'tank'

export interface ComboDef {
  readonly id: ComboId
  readonly parts: readonly [PartId, PartId]
  readonly name: string
  readonly does: string
}

export const COMBOS: readonly ComboDef[] = [
  { id: 'flight', parts: ['wing', 'rocket'], name: 'Kısa Uçuş', does: 'Rampadan havalanıp uçarsın' },
  { id: 'ball', parts: ['magnet', 'bigwheel'], name: 'Yuvarlanan Çöp Topu', does: 'Bütün paraları süpürürsün' },
  { id: 'driller', parts: ['drill', 'rocket'], name: 'Delici Füze', does: 'Duvar kırınca turbo' },
  { id: 'speedboat', parts: ['float', 'propeller'], name: 'Sürat Teknesi', does: 'Suda uçarcasına gidersin' },
  { id: 'miner', parts: ['drill', 'treads'], name: 'Madenci', does: 'Tırmanışta turbo' },
  { id: 'tank', parts: ['bumper', 'bigwheel'], name: 'Oyuncak Tank', does: 'Engel çarpınca hızlanırsın' },
]

export const comboDef = (id: ComboId): ComboDef => COMBOS.find((c) => c.id === id) as ComboDef

export const activeCombos = (lo: Loadout): ComboId[] => COMBOS.filter((c) => hasPart(lo, c.parts[0]) && hasPart(lo, c.parts[1])).map((c) => c.id)

export const hasCombo = (lo: Loadout, id: ComboId): boolean => {
  const c = comboDef(id)
  return hasPart(lo, c.parts[0]) && hasPart(lo, c.parts[1])
}

/** The part worth offering to keep: shiny first, then the highest rarity (≥ 2); null if none. */
export function rarestPart(parts: readonly Attached[]): Attached | null {
  let best: Attached | null = null
  let bestScore = 1
  for (const p of parts) {
    const score = p.shiny ? 10 + PART_DEFS[p.id].rarity : PART_DEFS[p.id].rarity
    if (score > bestScore) {
      best = p
      bestScore = score
    }
  }
  return best
}
