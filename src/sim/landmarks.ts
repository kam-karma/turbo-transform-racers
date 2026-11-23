/**
 * Where big hero props (Tripo models such as the candy island) float beside the track: in a
 * given theme zone, off to either side, never close enough to the road to be driven into or
 * to block the camera.
 */
import { rng } from './bot'
import type { ThemeId, Track } from './track'
import { add, len, scale, sub, v3, type V3 } from './vec'

export interface Landmark {
  readonly s: number
  readonly pos: V3
  /** Height in metres the model is scaled to. */
  readonly size: number
  /** Radians about the vertical axis. */
  readonly yaw: number
}

export interface LandmarkOptions {
  readonly count: number
  readonly minSize: number
  readonly maxSize: number
  readonly seed: number
}

const CLEARANCE = 16
const TRIES = 400

function nearestRoad(track: Track, p: V3): number {
  let best = Infinity
  for (let s = 0; s <= track.length; s += 4) best = Math.min(best, len(sub(track.frameAt(s).pos, p)))
  return best
}

export function placeLandmarks(track: Track, theme: ThemeId, o: LandmarkOptions): Landmark[] {
  const rand = rng(o.seed)
  const zone: number[] = []
  for (let s = 0; s < track.length; s += 10) if (track.themeAt(s) === theme) zone.push(s)
  const out: Landmark[] = []
  for (let t = 0; t < TRIES && out.length < o.count && zone.length > 0; t++) {
    const s = zone[Math.floor(rand() * zone.length)]
    const size = o.minSize + (o.maxSize - o.minSize) * rand()
    const side = rand() < 0.5 ? -1 : 1
    const off = CLEARANCE + size * 0.6 + 20 + rand() * 90
    const f = track.frameAt(s)
    const pos = add(add(f.pos, scale(f.left, side * off)), v3(0, -size * 0.35 + (rand() - 0.5) * 30, 0))
    if (nearestRoad(track, pos) - size * 0.5 <= CLEARANCE) continue
    if (out.some((l) => len(sub(l.pos, pos)) < (l.size + size) * 0.7)) continue
    out.push({ s, pos, size, yaw: rand() * Math.PI * 2 })
  }
  return out
}
