/**
 * The house around a Kurgu track: one room per zone stretch, laid one after another along +z
 * (the track enters each room through a door in the partition wall), plus the checks a track
 * must pass so the generated house fits it — the road stays above the floor, crosses itself
 * only as a bridge, keeps its detour lanes clear and stays inside its room.
 */
import type { V3 } from '../../sim/vec'
import type { GateDef, KurguTrack, ZoneId } from './kurguTrack'

export interface Room {
  readonly zone: ZoneId
  readonly z0: number
  readonly z1: number
  /** s range of the track inside this room. */
  readonly s0: number
  readonly s1: number
}

export interface Door { readonly z: number; readonly x: number; readonly y: number }

export interface HouseLayout {
  readonly x0: number
  readonly x1: number
  readonly z0: number
  readonly z1: number
  /** Ceiling height (rooms are open-topped in the garden). */
  readonly height: number
  readonly rooms: readonly Room[]
  readonly doors: readonly Door[]
}

export const ROOM_HEIGHT = 100
export const WALL_MARGIN = 80
const BRIDGE_CLEAR = 8.5
const ROAD_HALF = 7.5

/** Track sample positions every `step` m, with the detour lanes of the gates. */
export function roadSamples(kt: KurguTrack, step = 4): { s: number; p: V3; lane: 'main' | number }[] {
  const out: { s: number; p: V3; lane: 'main' | number }[] = []
  for (let s = 0; s <= kt.length; s += step) {
    const g = kt.gateAt(s)
    // Over a gap there is no main road to collide with.
    if (g === null || g.kind !== 'gap') out.push({ s, p: kt.main.toWorld(s, 0, 0), lane: 'main' })
  }
  for (const g of kt.def.gates) {
    for (let s = g.s0 - 22; s <= g.s1 + 22; s += step) {
      const a = kt.altBlend(g, s)
      if (a > 0.5) out.push({ s, p: altPoint(kt, g, s, 0, 0), lane: g.index })
    }
  }
  return out
}

/** World point on a gate's detour lane. */
export function altPoint(kt: KurguTrack, g: GateDef, s: number, d: number, y: number): V3 {
  const f = kt.main.frameAt(s)
  const a = kt.altBlend(g, s)
  // The detour swings out level (not along the banked road), and dips straight down.
  const hl = Math.hypot(f.left.x, f.left.z) || 1
  const side = g.alt.side * a
  const down = g.alt.down * a
  return {
    x: f.pos.x + f.left.x * d + f.up.x * y + (f.left.x / hl) * side,
    y: f.pos.y + f.left.y * d + f.up.y * y - down,
    z: f.pos.z + f.left.z * d + f.up.z * y + (f.left.z / hl) * side,
  }
}

export function houseLayout(kt: KurguTrack): HouseLayout {
  const pts = roadSamples(kt, 8).map((x) => x.p)
  const xs = pts.map((p) => p.x)
  const zs = pts.map((p) => p.z)
  const zones = kt.def.zones.length > 0 ? kt.def.zones : [{ from: 0, zone: 'cocuk' as ZoneId }]
  const rooms: Room[] = []
  const doors: Door[] = []
  const z0 = Math.min(...zs) - WALL_MARGIN
  const z1 = Math.max(...zs) + WALL_MARGIN
  zones.forEach((zn, i) => {
    const s0 = zn.from
    const s1 = zones[i + 1]?.from ?? kt.length
    const start = i === 0 ? z0 : kt.main.toWorld(s0, 0, 0).z
    const end = i === zones.length - 1 ? z1 : kt.main.toWorld(s1, 0, 0).z
    rooms.push({ zone: zn.zone, z0: start, z1: end, s0, s1 })
    if (i > 0) {
      const p = kt.main.toWorld(s0, 0, 0)
      doors.push({ z: p.z, x: p.x, y: p.y })
    }
  })
  return { x0: Math.min(...xs) - WALL_MARGIN, x1: Math.max(...xs) + WALL_MARGIN, z0, z1, height: ROOM_HEIGHT, rooms, doors }
}

/** Everything wrong with a track's fit in its house (empty = fine). */
export function layoutIssues(kt: KurguTrack): string[] {
  const issues: string[] = []
  const samples = roadSamples(kt, 4)
  for (const x of samples) {
    if (x.p.y < 0.8) {
      issues.push(`road below floor at s=${x.s.toFixed(0)} (${x.lane}) y=${x.p.y.toFixed(1)}`)
      break
    }
  }
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const a = samples[i]
      const b = samples[j]
      if (a.lane === b.lane && Math.abs(a.s - b.s) < 60) continue
      if (a.lane !== b.lane && Math.abs(a.s - b.s) < 30) continue
      const dh = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z)
      if (dh < 2 * ROAD_HALF + 2 && Math.abs(a.p.y - b.p.y) < BRIDGE_CLEAR) {
        issues.push(`road crosses itself at s=${a.s.toFixed(0)}/${b.s.toFixed(0)} (${a.lane}/${b.lane})`)
        return issues
      }
    }
  }
  const lay = houseLayout(kt)
  lay.rooms.forEach((r, i) => {
    for (const x of samples) {
      if (x.s < r.s0 + 40 || x.s > r.s1 - 40) continue
      if (x.p.z < r.z0 + 15 || x.p.z > r.z1 - 15) {
        issues.push(`room ${i} (${r.zone}) leaks at s=${x.s.toFixed(0)}: z=${x.p.z.toFixed(0)} not in ${r.z0.toFixed(0)}..${r.z1.toFixed(0)}`)
        return
      }
    }
  })
  for (let i = 1; i < lay.rooms.length; i++) {
    if (lay.rooms[i].z0 < lay.rooms[i - 1].z0 + 60) issues.push(`room ${i} does not move forward along +z`)
  }
  return issues
}
