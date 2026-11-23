/**
 * Sweeps (d, y) profiles along any frame function — the main road, or a gate's detour lane
 * that swings out beside or below it. Same winding rules as game/trackMeshSweep.ts: walking a
 * profile, the face normal is (b - a) × forward.
 */
import * as THREE from 'three'
import type { V3 } from '../../sim/vec'

export interface LaneFrame { readonly pos: V3; readonly left: V3; readonly up: V3 }
export type FrameFn = (s: number) => LaneFrame

export interface PPoint { readonly d: number; readonly y: number; readonly u?: number }
export interface PStrip { readonly pts: readonly PPoint[]; readonly color?: (s: number) => THREE.Color }

const WHITE = new THREE.Color(1, 1, 1)

export function samplesBetween(s0: number, s1: number, step: number): number[] {
  const n = Math.max(1, Math.round((s1 - s0) / step))
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(s0 + ((s1 - s0) * i) / n)
  return out
}

export function sweepFrames(frame: FrameFn, ss: readonly number[], strips: readonly PStrip[], vScale = 1): THREE.BufferGeometry {
  const frames = ss.map(frame)
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
  g.computeBoundingSphere()
  return g
}

function stripU(pts: readonly PPoint[]): number[] {
  if (pts.every((p) => p.u !== undefined)) return pts.map((p) => p.u ?? 0)
  const acc = [0]
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].d - pts[i - 1].d, pts[i].y - pts[i - 1].y))
  const total = acc[acc.length - 1] || 1
  return acc.map((a) => a / total)
}

/** Merges non-empty indexed geometries with the same attributes. */
export function mergeIndexed(gs: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (const g of gs) {
    const base = pos.length / 3
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const t = g.getAttribute('uv')
    const c = g.getAttribute('color')
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
      uv.push(t.getX(i), t.getY(i))
      col.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    const ix = g.getIndex()
    if (ix !== null) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  out.setIndex(idx)
  out.computeBoundingSphere()
  return out
}
