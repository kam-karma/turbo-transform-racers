/**
 * Where things may stand: a coarse spatial hash of the circuit's centre line answers "how far
 * is the nearest road" in the ground plane, so towers, billboards and creatures keep clear
 * of the ribbons (including the bridge of a figure eight).
 */
import type { Track } from '../../sim/track'
import type { KaosCircuit } from '../tracks/index'

const CELL = 40
const SAMPLE = 6

export interface RoadField {
  /** Nearest centre-line point in x/z: distance, its lap s and road height. */
  nearest(x: number, z: number): { dist: number; s: number; y: number }
  readonly min: { x: number; z: number }
  readonly max: { x: number; z: number }
  readonly center: { x: number; z: number }
  readonly minY: number
  readonly maxY: number
}

export function roadField(track: Track, c: KaosCircuit): RoadField {
  const L = c.lapLen
  const pts: { x: number; z: number; y: number; s: number }[] = []
  for (let s = 0; s < L; s += SAMPLE) {
    const p = track.frameAt(L + s).pos
    pts.push({ x: p.x, z: p.z, y: p.y, s })
  }
  const grid = new Map<string, number[]>()
  const key = (i: number, j: number): string => `${i},${j}`
  pts.forEach((p, k) => {
    const i = Math.floor(p.x / CELL)
    const j = Math.floor(p.z / CELL)
    const list = grid.get(key(i, j)) ?? []
    list.push(k)
    grid.set(key(i, j), list)
  })
  const xs = pts.map((p) => p.x)
  const zs = pts.map((p) => p.z)
  const ys = pts.map((p) => p.y)
  const min = { x: Math.min(...xs), z: Math.min(...zs) }
  const max = { x: Math.max(...xs), z: Math.max(...zs) }
  return {
    min, max,
    center: { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 },
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    nearest(x, z) {
      const i0 = Math.floor(x / CELL)
      const j0 = Math.floor(z / CELL)
      let best = Infinity
      let bk = 0
      for (let r = 0; r <= 6 && (best === Infinity || r * CELL - CELL < best); r++) {
        for (let i = i0 - r; i <= i0 + r; i++) {
          for (let j = j0 - r; j <= j0 + r; j++) {
            if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue
            for (const k of grid.get(key(i, j)) ?? []) {
              const dd = Math.hypot(pts[k].x - x, pts[k].z - z)
              if (dd < best) {
                best = dd
                bk = k
              }
            }
          }
        }
      }
      if (best === Infinity) {
        // far away: brute force (rare: only for the outer ring)
        pts.forEach((p, k) => {
          const dd = Math.hypot(p.x - x, p.z - z)
          if (dd < best) {
            best = dd
            bk = k
          }
        })
      }
      return { dist: best, s: pts[bk].s, y: pts[bk].y }
    },
  }
}

/** Small seeded PRNG for decoration. */
export function rand(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
