/**
 * Keeps scenery out of the racing corridor: a spatial hash of track centre points answers
 * "does this vertical cylinder come within 12 m of the centre line at road height?".
 */
import type { Track } from '../sim/track'

const CELL = 40
/** Minimum horizontal distance between scenery and the centre line. */
export const CLEAR = 12
/** The corridor's vertical extent around the road: slab below, jumps and gliders above. */
const BELOW = 5
const ABOVE = 16

export interface Footprint {
  readonly x: number
  readonly z: number
  readonly r: number
  readonly yMin: number
  readonly yMax: number
}

export class Corridor {
  private readonly cells = new Map<string, number[]>()
  private readonly pts: number[] = []
  private readonly placed: Footprint[] = []

  constructor(track: Track) {
    for (let i = 0; i < track.frames.length; i += 2) {
      const p = track.frames[i].pos
      const k = this.pts.length / 3
      this.pts.push(p.x, p.y, p.z)
      const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`
      const list = this.cells.get(key)
      if (list === undefined) this.cells.set(key, [k])
      else list.push(k)
    }
  }

  /** True when the cylinder stays clear of the road corridor. */
  clearOfRoad(f: Footprint): boolean {
    const reach = f.r + CLEAR
    const x0 = Math.floor((f.x - reach) / CELL)
    const x1 = Math.floor((f.x + reach) / CELL)
    const z0 = Math.floor((f.z - reach) / CELL)
    const z1 = Math.floor((f.z + reach) / CELL)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        for (const k of this.cells.get(`${cx},${cz}`) ?? []) {
          const px = this.pts[k * 3]
          const py = this.pts[k * 3 + 1]
          const pz = this.pts[k * 3 + 2]
          if (Math.hypot(px - f.x, pz - f.z) >= reach) continue
          if (f.yMax > py - BELOW && f.yMin < py + ABOVE) return false
        }
      }
    }
    return true
  }

  /** True when the cylinder overlaps no island placed so far. */
  clearOfIslands(f: Footprint, gap = 4): boolean {
    return this.placed.every((o) => Math.hypot(o.x - f.x, o.z - f.z) >= o.r + f.r + gap || f.yMax < o.yMin - gap || f.yMin > o.yMax + gap)
  }

  claim(f: Footprint): void {
    this.placed.push(f)
  }
}
