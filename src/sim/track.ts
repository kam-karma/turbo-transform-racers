/**
 * A race track: a smooth centre line resampled every metre, with a moving frame (tangent,
 * left, up) the racer physics works in, and the surface sections laid along it.
 *
 * Track space: `s` metres along the centre line, `d` metres to the left of it, `y` metres
 * above the road surface along the frame's up.
 */
import { FORM_FOR, type Surface } from './forms'
import { add, cross, lerp, norm, scale, sub, v3, type V3 } from './vec'

export type ThemeId = 'candy' | 'ice' | 'volcano' | 'water'

export interface TrackSection {
  readonly len: number
  readonly surface: Surface
  /** Road width in metres; DEFAULT_WIDTH when absent. */
  readonly width?: number
  /** Boost pads as [from, to] metres, relative to the start of the section. */
  readonly boost?: readonly (readonly [number, number])[]
  /** The section ends in a jump lip (visual marker; the jump itself comes from the shape). */
  readonly ramp?: boolean
}

export interface CoinDef {
  readonly s: number
  readonly d: number
}

export interface TrackDef {
  readonly id: string
  readonly name: string
  readonly points: readonly V3[]
  readonly sections: readonly TrackSection[]
  readonly coins: readonly CoinDef[]
  readonly themes: readonly { readonly from: number; readonly theme: ThemeId }[]
}

export interface Frame {
  readonly s: number
  readonly pos: V3
  /** Unit tangent (forward). */
  readonly t: V3
  /** Unit vector to the left across the road (banked). */
  readonly left: V3
  /** Unit road normal (banked). */
  readonly up: V3
  /** Radians, + = climbing. */
  readonly pitch: number
  /** d(pitch)/ds in rad/m: < 0 over a crest, > 0 in a dip. */
  readonly curvV: number
  /** d(heading)/ds in rad/m: + = turning left. */
  readonly curvH: number
  readonly width: number
  readonly surface: Surface
}

export interface Track {
  readonly def: TrackDef
  readonly length: number
  readonly frames: readonly Frame[]
  frameAt(s: number): Frame
  surfaceAt(s: number): Surface
  sectionAt(s: number): { readonly index: number; readonly start: number; readonly section: TrackSection }
  /** The next point after `s` where the needed form changes (road → ice is not one). */
  nextBoundary(s: number): { readonly s: number; readonly surface: Surface } | null
  boostAt(s: number): boolean
  /** Where a racer that fell at `s` is put back: on solid road before the drop. */
  respawnS(s: number): number
  themeAt(s: number): ThemeId
  /** World position of a track-space point. */
  toWorld(s: number, d: number, y: number): V3
}

export const DEFAULT_WIDTH = 14
const MAX_BANK = (12 * Math.PI) / 180
const BANK_PER_CURV = 14
const WORLD_UP = v3(0, 1, 0)

const isSolid = (s: Surface): boolean => s === 'road' || s === 'ice'

/** Uniform Catmull-Rom point between p1 and p2. */
function catmull(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const t2 = t * t
  const t3 = t2 * t
  const f = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return v3(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z))
}

/** Dense smooth samples of the control points with their running arc length. */
function densify(points: readonly V3[]): { pts: V3[]; acc: number[] } {
  const pts: V3[] = [points[0]]
  const acc = [0]
  const n = points.length
  const SUB = 8
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p3 = points[Math.min(n - 1, i + 2)]
    for (let k = 1; k <= SUB; k++) {
      const p = catmull(p0, points[i], points[i + 1], p3, k / SUB)
      acc.push(acc[acc.length - 1] + Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y, p.z - pts[pts.length - 1].z))
      pts.push(p)
    }
  }
  return { pts, acc }
}

function resample(points: readonly V3[], step: number): { pos: V3[]; length: number } {
  const { pts, acc } = densify(points)
  const length = acc[acc.length - 1]
  const count = Math.max(2, Math.floor(length / step) + 1)
  const pos: V3[] = []
  let j = 0
  for (let i = 0; i < count; i++) {
    const s = Math.min(length, i * step)
    while (j < acc.length - 2 && acc[j + 1] < s) j++
    const span = acc[j + 1] - acc[j]
    pos.push(lerp(pts[j], pts[j + 1], span > 0 ? (s - acc[j]) / span : 0))
  }
  if (pos.length * step < length + step * 0.5) pos.push(pts[pts.length - 1])
  return { pos, length }
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))

/** Centred moving average of a per-sample value over ±k samples. */
function smooth(values: readonly number[], k: number): number[] {
  return values.map((_, i) => {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - k); j <= Math.min(values.length - 1, i + k); j++) {
      sum += values[j]
      n++
    }
    return sum / n
  })
}

export function buildTrack(def: TrackDef, step = 1): Track {
  const { pos, length } = resample(def.points, step)
  const n = pos.length
  const starts: number[] = []
  let acc = 0
  for (const sec of def.sections) {
    starts.push(acc)
    acc += sec.len
  }

  const sectionIndex = (s: number): number => {
    let i = 0
    while (i + 1 < starts.length && starts[i + 1] <= s) i++
    return i
  }

  const tangents = pos.map((_, i) => norm(sub(pos[Math.min(n - 1, i + 1)], pos[Math.max(0, i - 1)])))
  const headings = tangents.map((t) => Math.atan2(t.x, t.z))
  const pitches = tangents.map((t) => Math.asin(Math.max(-1, Math.min(1, t.y))))
  const rawCurvH = headings.map((_, i) => wrap(headings[Math.min(n - 1, i + 1)] - headings[Math.max(0, i - 1)]) / (step * (i > 0 && i < n - 1 ? 2 : 1)))
  const rawCurvV = pitches.map((_, i) => (pitches[Math.min(n - 1, i + 1)] - pitches[Math.max(0, i - 1)]) / (step * (i > 0 && i < n - 1 ? 2 : 1)))
  const curvH = smooth(rawCurvH, 6)
  const curvV = smooth(rawCurvV, 2)

  const frames: Frame[] = pos.map((p, i) => {
    const t = tangents[i]
    const left0 = norm(cross(WORLD_UP, t))
    const up0 = cross(t, left0)
    const bank = Math.max(-MAX_BANK, Math.min(MAX_BANK, curvH[i] * BANK_PER_CURV))
    const c = Math.cos(bank)
    const sn = Math.sin(bank)
    const s = Math.min(length, i * step)
    const sec = def.sections[sectionIndex(s)]
    return {
      s,
      pos: p,
      t,
      up: add(scale(up0, c), scale(left0, sn)),
      left: sub(scale(left0, c), scale(up0, sn)),
      pitch: pitches[i],
      curvV: curvV[i],
      curvH: curvH[i],
      width: sec?.width ?? DEFAULT_WIDTH,
      surface: sec?.surface ?? 'road',
    }
  })

  const surfaceAt = (s: number): Surface => def.sections[sectionIndex(s)]?.surface ?? 'road'

  const frameAt = (s: number): Frame => {
    const c = Math.max(0, Math.min(length, s))
    const f = c / step
    const i = Math.min(n - 2, Math.floor(f))
    const k = Math.min(1, f - i)
    const a = frames[i]
    const b = frames[i + 1]
    return {
      s: c,
      pos: lerp(a.pos, b.pos, k),
      t: norm(lerp(a.t, b.t, k)),
      left: norm(lerp(a.left, b.left, k)),
      up: norm(lerp(a.up, b.up, k)),
      pitch: a.pitch + (b.pitch - a.pitch) * k,
      curvV: a.curvV + (b.curvV - a.curvV) * k,
      curvH: a.curvH + (b.curvH - a.curvH) * k,
      width: k < 0.5 ? a.width : b.width,
      surface: surfaceAt(c),
    }
  }

  const nextBoundary = (s: number): { s: number; surface: Surface } | null => {
    for (let j = sectionIndex(s) + 1; j < def.sections.length; j++) {
      if (FORM_FOR[def.sections[j].surface] !== FORM_FOR[def.sections[j - 1].surface]) return { s: starts[j], surface: def.sections[j].surface }
    }
    return null
  }

  const boostAt = (s: number): boolean => {
    const i = sectionIndex(s)
    const rel = s - starts[i]
    return (def.sections[i]?.boost ?? []).some(([a, b]) => rel >= a && rel < b)
  }

  const respawnS = (s: number): number => {
    const i = sectionIndex(s)
    if (isSolid(def.sections[i].surface)) return Math.max(starts[i], s - 20)
    for (let k = i - 1; k >= 0; k--) {
      if (isSolid(def.sections[k].surface)) return Math.max(starts[k] + 10, starts[k + 1] - 30)
    }
    return 0
  }

  const themeAt = (s: number): ThemeId => {
    let theme: ThemeId = def.themes[0]?.theme ?? 'candy'
    for (const z of def.themes) if (z.from <= s) theme = z.theme
    return theme
  }

  const toWorld = (s: number, d: number, y: number): V3 => {
    const f = frameAt(s)
    return add(add(f.pos, scale(f.left, d)), scale(f.up, y))
  }

  return {
    def,
    length,
    frames,
    frameAt,
    surfaceAt,
    sectionAt: (s) => {
      const index = sectionIndex(s)
      return { index, start: starts[index], section: def.sections[index] }
    },
    nextBoundary,
    boostAt,
    respawnS,
    themeAt,
    toWorld,
  }
}
