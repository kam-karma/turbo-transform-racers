/**
 * Destructible neon props along a Kaos lap: neon block stacks, hologram signs and glass
 * barriers, laid out in clusters (walls, pyramids, sign gates, glass chicanes). Every cluster
 * leaves a car-wide way through, so smashing is a choice, not a toll. Smashed props rebuild
 * as holograms a few seconds later, so every lap has something to break.
 *
 * Positions are lap-relative (s within a lap); the race passes lap-relative s for each car.
 */
import { rng } from '../../sim/bot'
import { overlaps, type Body } from './contacts'

export type BreakKind = 'block' | 'sign' | 'glass'

export interface BreakableDef {
  readonly id: number
  readonly cluster: number
  readonly kind: BreakKind
  /** Lap-relative distance along the track. */
  readonly s: number
  readonly d: number
  readonly halfL: number
  readonly halfW: number
  /** 0..1 colour pick for the view. */
  readonly hue: number
}

export const BREAK_SCORE: Readonly<Record<BreakKind, number>> = { block: 10, sign: 25, glass: 15 }
/** Şok meter gained by the player per smash. */
export const BREAK_METER: Readonly<Record<BreakKind, number>> = { block: 0.035, sign: 0.08, glass: 0.05 }
/** Speed kept after smashing through. */
export const BREAK_KEEP: Readonly<Record<BreakKind, number>> = { block: 0.97, sign: 0.985, glass: 0.95 }

export const REBUILD_S = 9
export const START_CLEAR = 90
export const END_CLEAR = 50
const EDGE = 0.9

const BLOCK = { halfL: 0.7, halfW: 0.7 }
const SIGN = { halfL: 0.35, halfW: 1.3 }
const GLASS = { halfL: 0.2, halfW: 1.5 }

type Item = Omit<BreakableDef, 'id' | 'cluster'>
type Rand = () => number

const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))]

/** A wall of block stacks across the road with one gap. */
function wall(s: number, lim: number, r: Rand): Item[] {
  const gap = (r() * 2 - 1) * (lim - 2)
  const out: Item[] = []
  const hue = r()
  for (let d = -lim + BLOCK.halfW; d <= lim - BLOCK.halfW + 1e-6; d += 2.2) {
    if (Math.abs(d - gap) < 2.1 + BLOCK.halfW) continue
    out.push({ kind: 'block', s, d, ...BLOCK, hue })
  }
  return out
}

/** Pyramid of blocks in one lane, 3-2-1 towards the driver. */
function pyramid(s: number, lim: number, r: Rand): Item[] {
  const c = pick(r, [-1, 1]) * (lim - 3.4) * (0.4 + 0.6 * r())
  const hue = r()
  const rows: readonly (readonly number[])[] = [[0], [-0.8, 0.8], [-1.6, 0, 1.6]]
  return rows.flatMap((row, k) => row.map((x) => ({ kind: 'block' as const, s: s + k * 1.6, d: c + x, ...BLOCK, hue })))
}

/** Hologram signs on both edges (and sometimes the middle). */
function signs(s: number, lim: number, r: Rand): Item[] {
  const d = lim - SIGN.halfW
  const out: Item[] = [{ kind: 'sign', s, d, ...SIGN, hue: r() }, { kind: 'sign', s: s + 6, d: -d, ...SIGN, hue: r() }]
  if (r() < 0.5) out.push({ kind: 'sign', s: s + 14, d: (r() * 2 - 1) * 2, ...SIGN, hue: r() })
  return out
}

/** Glass panels across one side: a chicane. */
function glass(s: number, lim: number, r: Rand): Item[] {
  const side = pick(r, [-1, 1])
  const hue = r()
  const out: Item[] = []
  for (let k = 0; k < 3; k++) out.push({ kind: 'glass', s, d: side * (lim - GLASS.halfW - k * 3.05), ...GLASS, hue })
  out.push({ kind: 'glass', s: s + 12, d: -side * (lim - GLASS.halfW), ...GLASS, hue })
  out.push({ kind: 'glass', s: s + 12, d: -side * (lim - GLASS.halfW - 3.05), ...GLASS, hue })
  return out
}

/** Glass in the middle, block stacks on the edges. */
function mixed(s: number, lim: number, r: Rand): Item[] {
  const hue = r()
  return [
    { kind: 'glass', s, d: 0, ...GLASS, hue },
    { kind: 'block', s: s + 4, d: lim - BLOCK.halfW, ...BLOCK, hue },
    { kind: 'block', s: s + 6, d: lim - BLOCK.halfW, ...BLOCK, hue },
    { kind: 'block', s: s + 4, d: -(lim - BLOCK.halfW), ...BLOCK, hue },
    { kind: 'block', s: s + 6, d: -(lim - BLOCK.halfW), ...BLOCK, hue },
  ]
}

const PATTERNS = [wall, pyramid, signs, glass, mixed, signs, pyramid] as const

export function layoutBreakables(lapLen: number, width: number, seed: number): BreakableDef[] {
  const r = rng(seed * 7919 + 13)
  const lim = width / 2 - EDGE
  const out: BreakableDef[] = []
  let s = START_CLEAR
  let cluster = 0
  // The first clusters cycle through every pattern so each lap shows all kinds.
  while (s < lapLen - END_CLEAR - 20) {
    const pattern = cluster < PATTERNS.length ? PATTERNS[(cluster + Math.floor(r() * 2)) % PATTERNS.length] : pick(r, PATTERNS)
    for (const it of pattern(s, lim, r)) {
      if (it.s > lapLen - END_CLEAR) continue
      out.push({ ...it, id: out.length, cluster })
    }
    cluster++
    s += 55 + r() * 40
  }
  return out
}

const NOT_BROKEN = -1

export class BreakField {
  /** Race time each item was smashed, or -1. */
  private readonly brokenAt: Float64Array

  constructor(readonly items: readonly BreakableDef[], private readonly lapLen = Infinity) {
    this.brokenAt = new Float64Array(items.length).fill(NOT_BROKEN)
  }

  isBroken(id: number): boolean {
    return this.brokenAt[id] !== NOT_BROKEN
  }

  /** Smashes whatever the car (at lap-relative s) touches; returns their ids. */
  hits(car: Body, time: number): number[] {
    const out: number[] = []
    for (const it of this.items) {
      if (this.brokenAt[it.id] !== NOT_BROKEN || Math.abs(this.ds(car.s, it.s)) > 6) continue
      if (overlaps({ ...car, s: it.s + this.ds(car.s, it.s) }, it.s, it.d, it.halfL, it.halfW)) {
        this.brokenAt[it.id] = time
        out.push(it.id)
      }
    }
    return out
  }

  /** Smashes every whole item within radius r of (s, d); returns their ids. */
  within(s: number, d: number, r: number, time: number): number[] {
    const out: number[] = []
    for (const it of this.items) {
      if (this.brokenAt[it.id] !== NOT_BROKEN) continue
      if (Math.hypot(this.ds(s, it.s), d - it.d) <= r) {
        this.brokenAt[it.id] = time
        out.push(it.id)
      }
    }
    return out
  }

  /** Items whose rebuild time has come; they are whole again. */
  rebuild(time: number): number[] {
    const out: number[] = []
    for (let i = 0; i < this.brokenAt.length; i++) {
      if (this.brokenAt[i] !== NOT_BROKEN && time - this.brokenAt[i] >= REBUILD_S) {
        this.brokenAt[i] = NOT_BROKEN
        out.push(i)
      }
    }
    return out
  }

  reset(): void {
    this.brokenAt.fill(NOT_BROKEN)
  }

  /** Signed lap-wrapped distance from the item at `b` to `a`. */
  private ds(a: number, b: number): number {
    let x = a - b
    if (Number.isFinite(this.lapLen)) {
      const L = this.lapLen
      x = ((x % L) + L * 1.5) % L - L / 2
    }
    return x
  }
}
