/**
 * Sweeps cross-section profiles along the track frames. A profile is a list of strips; each
 * strip is a polyline in (d, y) track space and gets its own vertices, so strips meet with a
 * hard crease and a hard colour change (kerb bands, cake layers of the road's side).
 *
 * Winding: walking from one profile point to the next, the face normal is (b - a) × forward.
 * So a deck goes left → right (normal up), the left side bottom → top, the underside
 * right → left and the right side top → bottom.
 */
import * as THREE from 'three'
import type { Frame, Track } from '../sim/track'

export interface ProfilePoint {
  readonly d: number
  readonly y: number
  /** Texture u; defaults to the normalised running length along the strip. */
  readonly u?: number
}

export interface Strip {
  readonly pts: readonly ProfilePoint[]
  /** Colour per ring (by track s); white when absent. */
  readonly color?: (s: number) => THREE.Color
}

/** Sample positions from s0 to s1 inclusive, about `step` apart. */
export function samples(s0: number, s1: number, step: number): number[] {
  const n = Math.max(1, Math.round((s1 - s0) / step))
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(s0 + ((s1 - s0) * i) / n)
  return out
}

const WHITE = new THREE.Color(1, 1, 1)

export function sweep(track: Track, s0: number, s1: number, step: number, strips: readonly Strip[], vScale = 1): THREE.BufferGeometry {
  const ss = samples(s0, s1, step)
  const frames: Frame[] = ss.map((s) => track.frameAt(s))
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (const st of strips) {
    const m = st.pts.length
    const us = stripU(st.pts)
    const base = pos.length / 3
    for (let r = 0; r < ss.length; r++) {
      const f = frames[r]
      const c = st.color?.(ss[r]) ?? WHITE
      for (let k = 0; k < m; k++) {
        const p = st.pts[k]
        pos.push(f.pos.x + f.left.x * p.d + f.up.x * p.y, f.pos.y + f.left.y * p.d + f.up.y * p.y, f.pos.z + f.left.z * p.d + f.up.z * p.y)
        uv.push(us[k], ss[r] / vScale)
        col.push(c.r, c.g, c.b)
      }
    }
    for (let r = 0; r < ss.length - 1; r++) {
      for (let k = 0; k < m - 1; k++) {
        const a = base + r * m + k
        idx.push(a, a + 1, a + m, a + 1, a + m + 1, a + m)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function stripU(pts: readonly ProfilePoint[]): number[] {
  if (pts.every((p) => p.u !== undefined)) return pts.map((p) => p.u ?? 0)
  const acc = [0]
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].d - pts[i - 1].d, pts[i].y - pts[i - 1].y))
  const total = acc[acc.length - 1] || 1
  return acc.map((a) => a / total)
}

const basisM = new THREE.Matrix4()
const vx = new THREE.Vector3()
const vy = new THREE.Vector3()
const vz = new THREE.Vector3()

/**
 * Matrix placing local geometry on the road at (s, d, y): local +X = left, +Y = up,
 * +Z = forward (the contract's pose convention, no yaw).
 */
export function trackMatrix(track: Track, s: number, d: number, y: number, out = new THREE.Matrix4()): THREE.Matrix4 {
  const f = track.frameAt(s)
  vx.set(f.left.x, f.left.y, f.left.z)
  vy.set(f.up.x, f.up.y, f.up.z)
  vz.set(f.t.x, f.t.y, f.t.z)
  const p = track.toWorld(s, d, y)
  basisM.makeBasis(vx, vy, vz)
  out.copy(basisM).setPosition(p.x, p.y, p.z)
  return out
}

/** Applies trackMatrix to a geometry in place. */
export function onTrack(geo: THREE.BufferGeometry, track: Track, s: number, d: number, y: number): THREE.BufferGeometry {
  geo.applyMatrix4(trackMatrix(track, s, d, y))
  return geo
}

/**
 * A flat cap closing the slab at a section end (gap edges, track ends). The outline must be
 * convex-ish; it is fanned from its centroid and turned to face `dir` (+1 forward, −1 back).
 */
export function cap(track: Track, s: number, outline: readonly ProfilePoint[], color: THREE.Color, dir: 1 | -1): THREE.BufferGeometry {
  const f = track.frameAt(s)
  const toW = (p: { d: number; y: number }): THREE.Vector3 =>
    new THREE.Vector3(f.pos.x + f.left.x * p.d + f.up.x * p.y, f.pos.y + f.left.y * p.d + f.up.y * p.y, f.pos.z + f.left.z * p.d + f.up.z * p.y)
  const cd = outline.reduce((a, p) => a + p.d, 0) / outline.length
  const cy = outline.reduce((a, p) => a + p.y, 0) / outline.length
  const centre = toW({ d: cd, y: cy })
  const want = new THREE.Vector3(f.t.x, f.t.y, f.t.z).multiplyScalar(dir)
  const pos: number[] = []
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  for (let i = 0; i < outline.length; i++) {
    const a = toW(outline[i])
    const b = toW(outline[(i + 1) % outline.length])
    e1.subVectors(a, centre)
    e2.subVectors(b, centre)
    const flip = e1.clone().cross(e2).dot(want) < 0
    const tri = flip ? [centre, b, a] : [centre, a, b]
    for (const v of tri) pos.push(v.x, v.y, v.z)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  const n = pos.length / 3
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0), 2))
  const c: number[] = []
  for (let i = 0; i < n; i++) c.push(color.r, color.g, color.b)
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
  return g
}

/** Section start positions along s (same accumulation as the sim). */
export function sectionStarts(track: Track): number[] {
  const out: number[] = []
  let acc = 0
  for (const sec of track.def.sections) {
    out.push(acc)
    acc += sec.len
  }
  return out
}
