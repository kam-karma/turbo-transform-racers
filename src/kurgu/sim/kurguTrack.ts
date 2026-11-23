/**
 * A Kurgu Kupası track: a normal TrackDef (so the shared racer drives it) plus what the Dev Ev
 * cup adds on top — house zones, rows of part pickups in lanes, gates that ask for a part,
 * toy obstacles, the hidden part, ramp lips, furniture anchors and the star challenge.
 *
 * Every gate has a detour ("uzun yol"): the same stretch of track, driven slower on a lane
 * beside or below the main one. The racer steps on `alt`, a copy of the track whose gate
 * surfaces are made drivable, so s and d stay valid on both routes.
 */
import type { Surface } from '../../sim/forms'
import { buildTrack, type Track, type TrackDef } from '../../sim/track'
import { pathTrack, type Piece } from '../../sim/trackPath'
import { v3, type V3 } from '../../sim/vec'
import { PART_IDS, type PartId } from './parts'

export type ZoneId = 'cocuk' | 'mutfak' | 'banyo' | 'bahce' | 'garaj'
export type GateKind = 'gap' | 'water' | 'climb' | 'wall'
export type ObstacleKind = 'block' | 'ball' | 'domino' | 'soap' | 'duck' | 'can' | 'bolt' | 'pebble'
/** Furniture or big toys the road rests on (placed by the world under that piece). */
export type AnchorKind = 'bed' | 'desk' | 'books' | 'shelf' | 'counter' | 'table' | 'sink' | 'tub' | 'pot' | 'toolbox' | 'box' | 'bench'

export const ZONE_NAMES: Readonly<Record<ZoneId, string>> = {
  cocuk: 'Çocuk Odası', mutfak: 'Mutfak', banyo: 'Banyo', bahce: 'Bahçe', garaj: 'Garaj',
}

export const GATE_NEED: Readonly<Record<GateKind, PartId>> = { gap: 'wing', water: 'float', climb: 'treads', wall: 'drill' }
export const GATE_SURFACE: Readonly<Record<GateKind, Surface>> = { gap: 'gap', water: 'water', climb: 'climb', wall: 'road' }

export interface PickupLane { readonly d: number; readonly part: PartId; readonly shiny: boolean }
export interface PickupRow { readonly s: number; readonly lanes: readonly PickupLane[] }
export interface GateDef {
  readonly index: number
  readonly s0: number
  readonly s1: number
  readonly kind: GateKind
  readonly need: PartId
  /** Detour lane offset at full ease: sideways (+ left, metres) and down (metres). */
  readonly alt: { readonly side: number; readonly down: number }
}
export interface ObstacleDef { readonly s: number; readonly d: number; readonly r: number; readonly h: number; readonly kind: ObstacleKind }
export interface HiddenPart { readonly s: number; readonly d: number; readonly part: PartId }
export interface Anchor { readonly s0: number; readonly s1: number; readonly kind: AnchorKind }
export type Challenge =
  | { readonly kind: 'combo' }
  | { readonly kind: 'gates' }
  | { readonly kind: 'coins'; readonly n: number }
  | { readonly kind: 'noKnock' }
  | { readonly kind: 'smash'; readonly n: number }

export interface KurguTrackDef extends TrackDef {
  readonly zones: readonly { readonly from: number; readonly zone: ZoneId }[]
  readonly rows: readonly PickupRow[]
  readonly gates: readonly GateDef[]
  readonly obstacles: readonly ObstacleDef[]
  readonly hidden: HiddenPart
  readonly ramps: readonly number[]
  readonly anchors: readonly Anchor[]
  readonly challenge: Challenge
}

export interface KPiece extends Piece {
  readonly zone?: ZoneId
  /** A breakable toy wall across this (road) piece: a drill gate. */
  readonly wall?: boolean
  /** Pickup lanes left → right, e.g. 'wing|drill|magnet*' (* = shiny), placed `rowAt` m in. */
  readonly row?: string
  readonly rowAt?: number
  /** Obstacles: [metres into the piece, d, kind]. */
  readonly obs?: readonly (readonly [number, number, ObstacleKind])[]
  readonly hidden?: { readonly at: number; readonly d: number; readonly part: PartId }
  readonly under?: AnchorKind
  /** Override of the detour offset for a gate piece. */
  readonly alt?: { readonly side?: number; readonly down?: number }
}

const OBSTACLE_SIZE: Readonly<Record<ObstacleKind, { r: number; h: number }>> = {
  block: { r: 1.6, h: 2.6 }, ball: { r: 1.5, h: 3 }, domino: { r: 1.2, h: 4 }, soap: { r: 1.6, h: 1.6 },
  duck: { r: 1.6, h: 3 }, can: { r: 1.5, h: 3.4 }, bolt: { r: 1.3, h: 1.6 }, pebble: { r: 1.5, h: 1.8 },
}

const LANES: Readonly<Record<number, readonly number[]>> = { 1: [0], 2: [3.6, -3.6], 3: [4.6, 0, -4.6] }

function parseRow(row: string, s: number): PickupRow {
  const names = row.split('|').map((x) => x.trim())
  const ds = LANES[names.length] ?? LANES[3]
  // Lanes are written left → right as seen from the car: + d is left.
  const lanes = names.map((n, i) => {
    const shiny = n.endsWith('*')
    const id = (shiny ? n.slice(0, -1) : n) as PartId
    if (!PART_IDS.includes(id)) throw new Error(`Unknown part "${n}"`)
    return { d: ds[i], part: id, shiny }
  })
  return { s, lanes }
}

function gateKind(p: KPiece): GateKind | null {
  if (p.wall === true) return 'wall'
  if (p.surface === 'gap' || p.surface === 'water' || p.surface === 'climb') return p.surface
  return null
}

const DEFAULT_ALT: Readonly<Record<GateKind, { side: number; down: number }>> = {
  gap: { side: 0, down: 9 }, water: { side: 17, down: 0 }, climb: { side: 17, down: 0 }, wall: { side: 16, down: 0 },
}

export function kurguTrack(id: string, name: string, pieces: readonly KPiece[], challenge: Challenge, start: V3 = v3(0, 1.6, 0)): KurguTrackDef {
  const base = pathTrack(id, name, pieces, start)
  const zones: { from: number; zone: ZoneId }[] = []
  const rows: PickupRow[] = []
  const gates: GateDef[] = []
  const obstacles: ObstacleDef[] = []
  const ramps: number[] = []
  const anchors: Anchor[] = []
  let hidden: HiddenPart | null = null
  let s0 = 0
  for (const p of pieces) {
    if (p.zone !== undefined) zones.push({ from: s0, zone: p.zone })
    if (p.row !== undefined) rows.push(parseRow(p.row, s0 + (p.rowAt ?? Math.min(20, p.len / 2))))
    const kind = gateKind(p)
    if (kind !== null) {
      const alt = { ...DEFAULT_ALT[kind], ...p.alt }
      gates.push({ index: gates.length, s0, s1: s0 + p.len, kind, need: GATE_NEED[kind], alt })
    }
    for (const [at, d, k] of p.obs ?? []) obstacles.push({ s: s0 + at, d, kind: k, ...OBSTACLE_SIZE[k] })
    if (p.hidden !== undefined) hidden = { s: s0 + p.hidden.at, d: p.hidden.d, part: p.hidden.part }
    if (p.ramp === true) ramps.push(s0 + p.len)
    if (p.under !== undefined) anchors.push({ s0, s1: s0 + p.len, kind: p.under })
    s0 += p.len
  }
  if (hidden === null) throw new Error(`Track ${id} has no hidden part`)
  obstacles.sort((a, b) => a.s - b.s)
  // Nothing on the grid: the chase camera starts there.
  const coins = base.coins.filter((c) => c.s > COIN_FREE_START)
  return { ...base, coins, zones, rows, gates, obstacles, hidden, ramps, anchors, challenge }
}

/** Mirror image (variant 'mirror'): x flips, so every lateral offset flips with it. */
export function mirrorKurgu(def: KurguTrackDef): KurguTrackDef {
  return {
    ...def,
    id: `${def.id}-m`,
    points: def.points.map((p) => v3(-p.x, p.y, p.z)),
    coins: def.coins.map((c) => ({ ...c, d: -c.d })),
    rows: def.rows.map((r) => ({ ...r, lanes: r.lanes.map((l) => ({ ...l, d: -l.d })) })),
    gates: def.gates.map((g) => ({ ...g, alt: { ...g.alt, side: -g.alt.side } })),
    obstacles: def.obstacles.map((o) => ({ ...o, d: -o.d })),
    hidden: { ...def.hidden, d: -def.hidden.d },
  }
}

export interface KurguTrack {
  readonly def: KurguTrackDef
  /** The track with the gates as built (gap, water, climb). */
  readonly main: Track
  /** Same geometry; gap and water gates made of road (the detour lanes). */
  readonly alt: Track
  readonly length: number
  zoneAt(s: number): ZoneId
  /** The gate whose stretch contains s, or null. */
  gateAt(s: number): GateDef | null
  /** 0..1 how far the detour lane has swung away from the main lane at s (eased in and out). */
  altBlend(gate: GateDef, s: number): number
  /** First pickup row at or after s. */
  rowIndexAfter(s: number): number
}

const EASE_M = 22
/** Metres from the start kept free of coins. */
export const COIN_FREE_START = 45

export function buildKurguTrack(def: KurguTrackDef): KurguTrack {
  const main = buildTrack(def)
  const altDef: TrackDef = {
    ...def,
    sections: def.sections.map((sec) => (sec.surface === 'gap' || sec.surface === 'water' ? { ...sec, surface: 'road' as const } : sec)),
  }
  const alt = buildTrack(altDef)
  const smooth = (u: number): number => {
    const c = Math.max(0, Math.min(1, u))
    return c * c * (3 - 2 * c)
  }
  return {
    def,
    main,
    alt,
    length: main.length,
    zoneAt: (s) => {
      let z: ZoneId = def.zones[0]?.zone ?? 'cocuk'
      for (const x of def.zones) if (x.from <= s) z = x.zone
      return z
    },
    gateAt: (s) => def.gates.find((g) => s >= g.s0 && s < g.s1) ?? null,
    altBlend: (g, s) => {
      // The detour leaves before the gate and comes back after it.
      const e = Math.min(EASE_M, (g.s1 - g.s0) / 2 + 8)
      return Math.min(smooth((s - (g.s0 - e)) / e), smooth((g.s1 + e - s) / e))
    },
    rowIndexAfter: (s) => {
      const i = def.rows.findIndex((r) => r.s >= s)
      return i < 0 ? def.rows.length : i
    },
  }
}
