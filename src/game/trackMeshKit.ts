/**
 * Shared bits for the trackside set pieces (gates, arches, rings, signs, roadside props):
 * the merge buckets every builder fills, vertex painting and the few primitive shapes.
 *
 * Buckets map to materials in trackMesh.ts:
 * - stripe: candy-stripe mask, vertex tint (needs uv)        - solid: matte toon, vertex colour
 * - trim:   glossy toon (balloons, rings, glossy edges)       - glow: unlit bloom colour
 * - atlas:  printed decals, sign faces and banners (needs uv)
 */
import * as THREE from 'three'
import type { Track } from '../sim/track'
import { col } from './islandsGeo'
import { trackMatrix } from './trackMeshSweep'
import { cellUv, type Cell } from './trackMeshAtlas'

export interface Buckets {
  readonly stripe: THREE.BufferGeometry[]
  readonly solid: THREE.BufferGeometry[]
  readonly trim: THREE.BufferGeometry[]
  readonly glow: THREE.BufferGeometry[]
  readonly atlas: THREE.BufferGeometry[]
}

export const newBuckets = (): Buckets => ({ stripe: [], solid: [], trim: [], glow: [], atlas: [] })

/** Attribute sets each bucket is merged with. */
export const KEEP: Readonly<Record<keyof Buckets, readonly string[]>> = {
  stripe: ['position', 'normal', 'uv', 'color'],
  solid: ['position', 'normal', 'color'],
  trim: ['position', 'normal', 'color'],
  glow: ['position', 'color'],
  atlas: ['position', 'normal', 'uv', 'color'],
}

/** Paints a whole geometry one colour (hex or Color) and returns it. */
export function tint(g: THREE.BufferGeometry, c: string | THREE.Color): THREE.BufferGeometry {
  const k = typeof c === 'string' ? col(c) : c
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i * 3] = k.r
    a[i * 3 + 1] = k.g
    a[i * 3 + 2] = k.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

/** Paints by local height: bottom colour at y0 → top colour at y1. */
export function tintY(g: THREE.BufferGeometry, bottom: string, top: string, y0: number, y1: number): THREE.BufferGeometry {
  const a = col(bottom)
  const b = col(top)
  const p = g.getAttribute('position')
  const out = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.clamp((p.getY(i) - y0) / (y1 - y0 || 1), 0, 1)
    c.copy(a).lerp(b, t)
    out[i * 3] = c.r
    out[i * 3 + 1] = c.g
    out[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3))
  return g
}

const m4 = new THREE.Matrix4()
const r4 = new THREE.Matrix4()

/**
 * Places local geometry on the track at (s, d, y): local +X = left across the road, +Y = up,
 * +Z = forward. `yaw` turns it about the local up first.
 */
export function onRoad(g: THREE.BufferGeometry, track: Track, s: number, d: number, y: number, yaw = 0): THREE.BufferGeometry {
  if (yaw !== 0) g.applyMatrix4(r4.makeRotationY(yaw))
  g.applyMatrix4(trackMatrix(track, s, d, y, m4))
  return g
}

/**
 * Like onRoad but keeps the piece upright in the world (gates and arches must not lean with
 * the road's bank or pitch): only the heading of the track is used.
 */
export function upright(g: THREE.BufferGeometry, track: Track, s: number, d: number, y: number): THREE.BufferGeometry {
  const f = track.frameAt(s)
  const p = track.toWorld(s, d, y)
  const fwd = new THREE.Vector3(f.t.x, 0, f.t.z).normalize()
  const left = new THREE.Vector3(fwd.z, 0, -fwd.x)
  m4.makeBasis(left, new THREE.Vector3(0, 1, 0), fwd).setPosition(p.x, p.y, p.z)
  g.applyMatrix4(m4)
  return g
}

/** Remaps a geometry's 0..1 uvs into an atlas cell. */
export function toCell(g: THREE.BufferGeometry, cell: Cell): THREE.BufferGeometry {
  const [u0, v0, u1, v1] = cellUv(cell)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i))
  return g
}

/** A decal lying flat on the road: w across, l along, the artwork's top pointing forward. */
export function decal(track: Track, s: number, d: number, w: number, l: number, cell: Cell, c: string | THREE.Color, lift = 0.03): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, l)
  // Plane: +Y (art top) → forward (+Z), facing up; mirror x so the art is not flipped from above.
  g.rotateX(-Math.PI / 2)
  g.scale(-1, 1, -1)
  return onRoad(tint(toCell(g, cell), c), track, s, d, lift)
}

/** An upright board facing back down the road (towards oncoming cars). */
export function board(w: number, h: number, cell: Cell, c: string | THREE.Color = '#ffffff'): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h)
  // Facing −Z (towards the driver); mirror x to keep the art readable from that side.
  g.rotateY(Math.PI)
  return tint(toCell(g, cell), c)
}

/** A rounded box (pillow edges), centred at the origin. */
export function roundBox(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, seg + 1, seg + 1, seg + 1)
  const p = g.getAttribute('position')
  const v = new THREE.Vector3()
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const c = new THREE.Vector3(THREE.MathUtils.clamp(v.x, -inner.x, inner.x), THREE.MathUtils.clamp(v.y, -inner.y, inner.y), THREE.MathUtils.clamp(v.z, -inner.z, inner.z))
    const n = v.clone().sub(c)
    if (n.lengthSq() > 1e-8) v.copy(c).add(n.normalize().multiplyScalar(r))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.deleteAttribute('normal')
  const out = g.toNonIndexed()
  out.computeVertexNormals()
  g.dispose()
  return out
}

/** Glossy party balloon (with knot) of radius r whose bottom sits at y = 0, plus its string. */
export function balloon(r: number, c: string, stringLen: number): { body: THREE.BufferGeometry; string: THREE.BufferGeometry } {
  const pts: THREE.Vector2[] = []
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI
    const x = Math.cos(a) * r * (a < 0 ? 0.82 + 0.18 * Math.cos(a) : 1)
    pts.push(new THREE.Vector2(Math.max(0.001, x), r * 1.15 + Math.sin(a) * r * 1.15))
  }
  pts.unshift(new THREE.Vector2(0.001, -r * 0.12), new THREE.Vector2(r * 0.12, -r * 0.08))
  const body = tint(new THREE.LatheGeometry(pts, 12), c)
  const string = tint(new THREE.CylinderGeometry(0.03, 0.03, stringLen, 3, 1, true).translate(0, -stringLen / 2 - r * 0.1, 0), '#ffffff')
  return { body, string }
}
