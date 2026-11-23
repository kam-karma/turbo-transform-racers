/**
 * Closed Kaos circuits. buildTrack makes open A-to-B tracks, so a circuit is laid as a smooth
 * closed loop through a handful of design points and then unrolled: the same loop repeated
 * once per lap. Track space stays continuous over the whole race (s runs 0 … laps × lapLen,
 * the racer finishes at the end as usual) and laps are simply s / lapLen.
 *
 * The loop is resampled densely (every few metres) before it reaches buildTrack, so its own
 * Catmull-Rom pass changes nothing and every lap lies exactly on top of the first.
 */
import type { CoinDef, TrackDef, TrackSection } from '../../sim/track'
import { v3, type V3 } from '../../sim/vec'

/** Design point: x, z, and height y (metres). */
export type DesignPoint = readonly [number, number, number]

export interface CircuitSpec {
  readonly id: string
  readonly name: string
  readonly laps: number
  readonly width: number
  /** The loop's design points in driving order; the last one joins back to the first. */
  readonly pts: readonly DesignPoint[]
  /** Boost pads (30 m) at these lap fractions. */
  readonly boosts?: readonly number[]
  /** Coin lines: start at lap fraction u, n coins 8 m apart at lateral offset d. */
  readonly coins?: readonly { readonly u: number; readonly n: number; readonly d: number }[]
}

export interface Circuit {
  readonly spec: CircuitSpec
  /** The unrolled race (all laps) for buildTrack. */
  readonly def: TrackDef
  readonly laps: number
  readonly lapLen: number
}

const SAMPLE_M = 3
const BOOST_LEN = 30
const COIN_GAP = 8

/** Centripetal Catmull-Rom point between p1 and p2 (no cusps or loops on uneven spacing). */
function centripetal(p0: V3, p1: V3, p2: V3, p3: V3, u: number): V3 {
  const dt = (a: V3, b: V3): number => Math.max(1e-4, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)))
  const t0 = 0
  const t1 = t0 + dt(p0, p1)
  const t2 = t1 + dt(p1, p2)
  const t3 = t2 + dt(p2, p3)
  const t = t1 + (t2 - t1) * u
  const mix = (a: V3, b: V3, ta: number, tb: number): V3 => {
    const k = (t - ta) / (tb - ta)
    return v3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k)
  }
  const a1 = mix(p0, p1, t0, t1)
  const a2 = mix(p1, p2, t1, t2)
  const a3 = mix(p2, p3, t2, t3)
  const b1 = mix(a1, a2, t0, t2)
  const b2 = mix(a2, a3, t1, t3)
  return mix(b1, b2, t1, t2)
}

/** One closed loop, densely sampled, without repeating the first point at the end. */
export function loopPoints(pts: readonly DesignPoint[]): V3[] {
  const p = pts.map(([x, z, y]) => v3(x, y, z))
  const n = p.length
  const out: V3[] = []
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    const steps = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z) / SAMPLE_M))
    for (let k = 0; k < steps; k++) out.push(centripetal(p0, p1, p2, p3, k / steps))
  }
  return out
}

const polyLen = (pts: readonly V3[], closed: boolean): number => {
  let l = 0
  const n = pts.length
  for (let i = 1; i < n + (closed ? 1 : 0); i++) {
    const a = pts[i - 1]
    const b = pts[i % n]
    l += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return l
}

export function buildCircuit(spec: CircuitSpec): Circuit {
  const loop = loopPoints(spec.pts)
  const lapLen = polyLen(loop, true)
  const laps = Math.max(1, Math.round(spec.laps))
  const points: V3[] = []
  for (let k = 0; k < laps; k++) points.push(...loop)
  points.push(loop[0])
  const boost = (spec.boosts ?? []).map((u): readonly [number, number] => [u * lapLen, u * lapLen + BOOST_LEN])
  const sections: TrackSection[] = []
  for (let k = 0; k < laps; k++) {
    // The last section runs on past the end so rounding never leaves the line without a section.
    sections.push({ len: k === laps - 1 ? lapLen + 50 : lapLen, surface: 'road', width: spec.width, boost })
  }
  const coins: CoinDef[] = []
  for (let k = 0; k < laps; k++) {
    for (const line of spec.coins ?? []) {
      for (let i = 0; i < line.n; i++) coins.push({ s: k * lapLen + line.u * lapLen + i * COIN_GAP, d: line.d })
    }
  }
  coins.sort((a, b) => a.s - b.s)
  return { spec, laps, lapLen, def: { id: spec.id, name: spec.name, points, sections, coins, themes: [] } }
}

/** Lap number (1-based) at distance s, capped to the race's laps. */
export const lapOf = (s: number, lapLen: number, laps: number): number => Math.max(1, Math.min(laps, Math.floor(s / lapLen) + 1))

/** Distance into the current lap. */
export const lapS = (s: number, lapLen: number): number => ((s % lapLen) + lapLen) % lapLen
