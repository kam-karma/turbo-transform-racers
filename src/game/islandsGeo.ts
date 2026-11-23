/**
 * Small geometry toolkit for the world: seeded randomness, value noise, vertex painting and
 * merging. Everything decorative is baked into a few merged, vertex-coloured meshes so the
 * whole world costs a handful of draw calls.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type Rng = () => number

/** mulberry32: tiny, fast, good enough for scattering props. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const range = (r: Rng, a: number, b: number): number => a + (b - a) * r()
export const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(r() * list.length))]

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Periodic 1D noise over an angle so rings close without a seam. */
export function angleNoise(a: number, freq: number, seed: number): number {
  const x = ((a / (Math.PI * 2)) % 1 + 1) % 1
  const p = x * freq
  const i = Math.floor(p)
  const f = p - i
  const u = f * f * (3 - 2 * f)
  const h = (k: number): number => hash((((k % freq) + freq) % freq) + seed * 91.7)
  return h(i) * (1 - u) + h(i + 1) * u
}

const cache = new Map<string, THREE.Color>()
/** Linear-space colour from an sRGB hex string (cached: many props share colours). */
export function col(hex: string): THREE.Color {
  let c = cache.get(hex)
  if (c === undefined) {
    c = new THREE.Color(hex)
    cache.set(hex, c)
  }
  return c
}

export type Painter = (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color

/** Writes a colour attribute from a constant or a per-vertex function (in local space). */
export function paint(geo: THREE.BufferGeometry, c: THREE.Color | Painter): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const out = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    let k: THREE.Color
    if (typeof c === 'function') {
      p.fromBufferAttribute(pos, i)
      if (nor !== undefined) n.fromBufferAttribute(nor, i)
      k = c(p, n)
    } else k = c
    out[i * 3] = k.r
    out[i * 3 + 1] = k.g
    out[i * 3 + 2] = k.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3))
  return geo
}

const tmpC = new THREE.Color()
/** Vertical gradient from `bottom` to `top` over local y in [y0, y1], with a soft top highlight. */
export function gradY(bottom: THREE.Color, top: THREE.Color, y0: number, y1: number): Painter {
  return (p) => {
    const t = THREE.MathUtils.clamp((p.y - y0) / (y1 - y0 || 1), 0, 1)
    return tmpC.copy(bottom).lerp(top, t * t * (3 - 2 * t))
  }
}

/**
 * Normalises a geometry for merging: non-indexed, only position / normal / color. Smooth
 * normals are computed before un-indexing unless `flat` asks for faceted rock or crystal.
 */
export function finish(geo: THREE.BufferGeometry, flat = false): THREE.BufferGeometry {
  let g = geo
  if (!flat && g.getAttribute('normal') === undefined) g.computeVertexNormals()
  if (g.index !== null) g = g.toNonIndexed()
  if (flat) g.computeVertexNormals()
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name)
  }
  if (g.getAttribute('color') === undefined) paint(g, col('#ffffff'))
  g.morphAttributes = {}
  return g
}

const m4 = new THREE.Matrix4()
const q4 = new THREE.Quaternion()
const e4 = new THREE.Euler()
const s4 = new THREE.Vector3()

/** Places a (finished) geometry: Euler rotation (rx, ry, rz), uniform or per-axis scale. */
export function place(geo: THREE.BufferGeometry, pos: THREE.Vector3, ry = 0, scale: number | THREE.Vector3 = 1, rx = 0, rz = 0): THREE.BufferGeometry {
  e4.set(rx, ry, rz, 'YXZ')
  q4.setFromEuler(e4)
  if (typeof scale === 'number') s4.setScalar(scale)
  else s4.copy(scale)
  m4.compose(pos, q4, s4)
  geo.applyMatrix4(m4)
  return geo
}

/** Revolved profile (x = radius, y = height) with smooth normals, finished and painted. */
export function lathe(profile: readonly [number, number][], segments: number, paintWith: THREE.Color | Painter, flat = false): THREE.BufferGeometry {
  // LatheGeometry already carries seam-aware smooth normals.
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments)
  const f = finish(g, flat)
  return paint(f, paintWith)
}

/** A soft, slightly squashed blob (puff, bush, gumdrop body). */
export function blob(radius: number, detail: number, paintWith: THREE.Color | Painter, squash = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail)
  // Icosphere normals are already smooth (radial); scale() carries them along.
  g.scale(1, squash, 1)
  return paint(finish(g), paintWith)
}

/**
 * Merges geometries that may mix indexed and non-indexed parts, keeping only `keep`
 * attributes (every part must carry all of them). Null when the list is empty.
 */
export function mergeKeep(list: readonly THREE.BufferGeometry[], keep: readonly string[]): THREE.BufferGeometry | null {
  if (list.length === 0) return null
  const flat = list.map((g) => {
    const f = g.index !== null ? g.toNonIndexed() : g
    for (const name of Object.keys(f.attributes)) if (!keep.includes(name)) f.deleteAttribute(name)
    f.morphAttributes = {}
    return f
  })
  const merged = mergeGeometries(flat, false)
  for (const g of list) g.dispose()
  for (const g of flat) g.dispose()
  if (merged === null) throw new Error('world mesh: geometry attributes do not match')
  merged.computeBoundingSphere()
  return merged
}
