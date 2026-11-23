/**
 * Kurgu ghosts: the shared 10 Hz ghost (sim/ghost.ts) plus what the parts add — when each
 * slot got or lost a part, and which gates were driven on the detour — so a replayed rival
 * shows the same toy parts and takes the same lanes (spec §12.1: "parça alma ya da kopma").
 */
import { decodeGhost, encodeGhost, GhostRecorder, type Ghost, type GhostMeta } from '../../sim/ghost'
import type { RacerState } from '../../sim/racer'
import type { KurguState } from './kurguRacer'
import { PART_IDS, SLOTS, type Loadout, type PartId, type Slot } from './parts'

export interface PartEvent {
  readonly t: number
  readonly slot: Slot
  readonly part: PartId | null
  readonly shiny: boolean
}

export interface KurguGhost {
  readonly ghost: Ghost
  readonly parts: readonly PartEvent[]
  /** Indices of the gates this racer drove on the detour. */
  readonly alts: readonly number[]
}

export type SlotView = Readonly<Record<Slot, { readonly id: PartId; readonly shiny: boolean } | null>>

export const EMPTY_SLOTS: SlotView = { front: null, side: null, back: null, wheels: null }

export class KurguRecorder {
  private readonly rec = new GhostRecorder()
  private readonly parts: PartEvent[] = []
  private readonly alts: number[] = []
  private prev: Loadout | null = null

  push(k: KurguState): void {
    this.rec.push(k.r)
    const lo = k.lo
    for (const slot of SLOTS) {
      const a = lo[slot]
      const b = this.prev?.[slot] ?? null
      if (a?.id !== b?.id || a?.order !== b?.order) this.parts.push({ t: k.r.time, slot, part: a?.id ?? null, shiny: a?.shiny ?? false })
    }
    this.prev = lo
    if (k.route?.alt === true && !this.alts.includes(k.route.gate)) this.alts.push(k.route.gate)
  }

  finish(meta: GhostMeta, last?: RacerState): KurguGhost {
    return { ghost: this.rec.finish(meta, last), parts: [...this.parts], alts: [...this.alts] }
  }
}

/** The parts a ghost wears at race time t. */
export function slotsAt(kg: KurguGhost, t: number): SlotView {
  const out: { -readonly [K in Slot]: SlotView[K] } = { ...EMPTY_SLOTS }
  for (const e of kg.parts) {
    if (e.t > t) break
    out[e.slot] = e.part === null ? null : { id: e.part, shiny: e.shiny }
  }
  return out
}

export function encodeKurguGhost(kg: KurguGhost): string {
  const parts = kg.parts.map((e) => [Math.round(e.t * 100), SLOTS.indexOf(e.slot), e.part === null ? -1 : PART_IDS.indexOf(e.part), e.shiny ? 1 : 0])
  return JSON.stringify({ g: encodeGhost(kg.ghost), p: parts, a: kg.alts })
}

export function decodeKurguGhost(text: string): KurguGhost {
  const o = JSON.parse(text) as { g?: unknown; p?: unknown; a?: unknown }
  if (typeof o.g !== 'string' || !Array.isArray(o.p) || !Array.isArray(o.a)) throw new Error('Bozuk Kurgu hayaleti')
  const parts: PartEvent[] = (o.p as number[][]).map(([t, slot, part, shiny]) => ({
    t: t / 100,
    slot: SLOTS[slot] ?? 'front',
    part: part < 0 ? null : PART_IDS[part] ?? null,
    shiny: shiny === 1,
  }))
  return { ghost: decodeGhost(o.g), parts, alts: (o.a as unknown[]).filter((x): x is number => typeof x === 'number') }
}
