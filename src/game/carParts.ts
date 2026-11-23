/**
 * Procedural form parts (boat hull, glider wings, climber treads and claws), built once and
 * shared by every CarView. Each part is merged into one geometry with vertex colours so a
 * whole form costs only a few draw calls per car.
 *
 * Car space: nose +Z, +X = the car's left, Y up, ground at y = 0, wheel centres at
 * x ±0.69, y 0.34, z ≈ ±1.0 (the rt40 proportions; the fallback car matches them).
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { FormId } from '../sim/forms'

export const FORM_COLOR: Readonly<Record<FormId, number>> = { car: 0xffd23f, boat: 0x2ec5ff, glider: 0xff6bd6, climber: 0x7dff5a }

const WHITE = 0xffffff
const STEEL = 0x4a5068
const SILVER = 0xdfe4ef
const NAVY = 0x2346c8
const SUN = 0xffd23f

/** Where the animated parts hinge, in car space. */
export const PIVOT = {
  prop: new THREE.Vector3(0, 0.3, -2.46),
  wing: new THREE.Vector3(0.8, 0.95, -0.15),
  tail: new THREE.Vector3(0, 1.02, -1.5),
  treads: new THREE.Vector3(0, 0.34, -0.02),
  claws: new THREE.Vector3(0, 0.55, 1.62),
} as const

/** Treads: half the distance between the roller centres, loop radius, width, centre x. */
export const TREAD = { half: 1.02, r: 0.44, w: 0.52, x: 0.9 } as const
/** Band texture: band uses v in [0, BAND_V]; plates sample the plain white strip above it. */
const BAND_V = 0.78
const PLATE_UV = 0.94

export interface PartsKit {
  readonly hull: THREE.BufferGeometry
  readonly prop: THREE.BufferGeometry
  /** Left wing (+X); the right one is the same geometry mirrored by scale.x = -1. */
  readonly wing: THREE.BufferGeometry
  readonly tail: THREE.BufferGeometry
  /** Both treads with side plates and rollers; uv-mapped for the scrolling cleat texture. */
  readonly treads: THREE.BufferGeometry
  readonly claws: THREE.BufferGeometry
  /** Metres of tread per texture repeat (to scroll at road speed). */
  readonly cleatPeriod: number
}

const m4 = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))

/** Smooth-shaded copy: merges coincident vertices so bevels read as rounded, not faceted. */
function smooth(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.clone()
  g.deleteAttribute('normal')
  if (g.hasAttribute('uv')) g.deleteAttribute('uv')
  const merged = mergeVertices(g, 1e-4)
  merged.computeVertexNormals()
  return merged
}

/** Non-indexed, uv-less, painted by a colour or a per-vertex colour picker; ready to merge. */
function tint(geo: THREE.BufferGeometry, color: number | ((p: THREE.Vector3) => number), m?: THREE.Matrix4, keepUv = false): THREE.BufferGeometry {
  const g = geo.index !== null ? geo.toNonIndexed() : geo.clone()
  if (!keepUv && g.hasAttribute('uv')) g.deleteAttribute('uv')
  if (m !== undefined) g.applyMatrix4(m)
  const pos = g.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    c.set(typeof color === 'number' ? color : color(p))
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** Shape (x, y) extruded `depth` along y in car space; shape y is minus car z. */
function slab(shape: THREE.Shape, depth: number, bevel: number, curveSegments = 6, bevelSegments = 2): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments })
  g.rotateX(-Math.PI / 2)
  return smooth(g)
}

function hullGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.85, 2.05)
  s.lineTo(0.85, 2.05)
  s.quadraticCurveTo(1.06, 2.05, 1.06, 1.82)
  s.lineTo(1.06, -0.6)
  s.quadraticCurveTo(1.06, -1.95, 0, -2.55)
  s.quadraticCurveTo(-1.06, -1.95, -1.06, -0.6)
  s.lineTo(-1.06, 1.82)
  s.quadraticCurveTo(-1.06, 2.05, -0.85, 2.05)
  const g = slab(s, 0.42, 0.11)
  // V-hull and raked bow: narrow the keel and lift the bottom towards the nose.
  const pos = g.getAttribute('position')
  const y0 = -0.11
  const h = 0.64
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) - y0) / h))
    const z = pos.getZ(i)
    pos.setX(i, pos.getX(i) * (0.66 + 0.34 * Math.sqrt(t)))
    pos.setY(i, pos.getY(i) + 0.13 + (1 - t) * Math.max(0, z - 0.6) * 0.24)
  }
  g.computeVertexNormals()
  const hull = tint(g, (p) => (p.y > 0.6 ? WHITE : p.y < 0.17 ? NAVY : FORM_COLOR.boat))
  // Outboard motor on the transom: the shape every kid reads as "boat" from behind.
  const head = tint(new RoundedBoxGeometry(0.5, 0.52, 0.44, 2, 0.12), (p) => (p.y > 1.08 ? FORM_COLOR.boat : WHITE), m4(0, 0.98, -2.3))
  const leg = tint(new RoundedBoxGeometry(0.16, 0.8, 0.22, 1, 0.05), STEEL, m4(0, 0.46, -2.34))
  const stripe = tint(new RoundedBoxGeometry(0.52, 0.08, 0.46, 1, 0.03), SUN, m4(0, 0.86, -2.3))
  return mergeGeometries([hull, head, leg, stripe])
}

function propGeo(): THREE.BufferGeometry {
  const parts = [tint(new THREE.ConeGeometry(0.09, 0.22, 8), STEEL, m4(0, 0, -0.06, -Math.PI / 2))]
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const blade = new THREE.SphereGeometry(1, 8, 5)
    parts.push(tint(blade, SUN, m4(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0, 0, 0.5, a, 0.17, 0.07, 0.035)))
  }
  return mergeGeometries(parts)
}

function wingGeo(): THREE.BufferGeometry {
  const main = new THREE.Shape()
  main.moveTo(0, -0.5)
  main.lineTo(1.42, -0.2)
  main.lineTo(1.42, 0.56)
  main.lineTo(0, 0.82)
  main.closePath()
  const tip = new THREE.Shape()
  tip.moveTo(1.36, -0.21)
  tip.lineTo(1.62, -0.15)
  tip.quadraticCurveTo(1.86, -0.08, 1.8, 0.28)
  tip.lineTo(1.68, 0.53)
  tip.lineTo(1.36, 0.57)
  tip.closePath()
  const fin = new THREE.Shape()
  fin.moveTo(0, 0)
  fin.lineTo(0.55, 0)
  fin.lineTo(0.5, 0.38)
  fin.quadraticCurveTo(0.42, 0.46, 0.34, 0.4)
  fin.closePath()
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 3 })
  finGeo.rotateY(Math.PI / 2)
  return mergeGeometries([
    tint(slab(main, 0.06, 0.04, 4, 1), FORM_COLOR.glider),
    tint(slab(tip, 0.06, 0.04, 4, 1), WHITE),
    tint(smooth(finGeo), SUN, m4(1.64, 0.08, 0.08)),
  ])
}

function tailGeo(): THREE.BufferGeometry {
  // Fin profile in (back, up); turned so profile x runs towards -Z.
  const fin = new THREE.Shape()
  fin.moveTo(-0.3, 0)
  fin.lineTo(0.42, 0)
  fin.lineTo(0.47, 0.56)
  fin.lineTo(0.12, 0.56)
  fin.closePath()
  const cap = new THREE.Shape()
  cap.moveTo(0.1, 0.54)
  cap.lineTo(0.47, 0.54)
  cap.lineTo(0.5, 0.8)
  cap.quadraticCurveTo(0.42, 0.92, 0.26, 0.85)
  cap.closePath()
  const upright = (shape: THREE.Shape): THREE.BufferGeometry => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 4 })
    g.rotateY(Math.PI / 2)
    g.translate(-0.035, 0, 0)
    return smooth(g)
  }
  const stab = new THREE.Shape()
  stab.moveTo(-0.8, 0.45)
  stab.lineTo(-0.7, 0.1)
  stab.lineTo(0.7, 0.1)
  stab.lineTo(0.8, 0.45)
  stab.closePath()
  return mergeGeometries([
    tint(upright(fin), FORM_COLOR.glider),
    tint(upright(cap), WHITE),
    tint(slab(stab, 0.04, 0.035, 2, 1), (p) => (Math.abs(p.x) > 0.55 ? FORM_COLOR.glider : WHITE), m4(0, 0.1, 0)),
  ])
}

/** One tread loop at x = cx: scrolling band, side plates and rollers. */
function treadGeo(cx: number, side: number, period: number): THREE.BufferGeometry[] {
  const { half: L, r, w } = TREAD
  const pts: { z: number; y: number; nz: number; ny: number }[] = []
  const arc = 10
  for (let i = 0; i <= arc; i++) {
    const a = -Math.PI / 2 + (i / arc) * Math.PI
    pts.push({ z: L + r * Math.cos(a), y: r * Math.sin(a), nz: Math.cos(a), ny: Math.sin(a) })
  }
  for (let i = 0; i <= arc; i++) {
    const a = Math.PI / 2 + (i / arc) * Math.PI
    pts.push({ z: -L + r * Math.cos(a), y: r * Math.sin(a), nz: Math.cos(a), ny: Math.sin(a) })
  }
  pts.push(pts[0])
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  let u = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const du = Math.hypot(b.z - a.z, b.y - a.y) / period
    const quad = [[a, u, 0], [b, u + du, 0], [b, u + du, 1], [a, u, 0], [b, u + du, 1], [a, u, 1]] as const
    for (const [p, uu, k] of quad) {
      pos.push(cx + (k - 0.5) * w * side, p.y, p.z)
      nor.push(0, p.ny, p.nz)
      uv.push(uu, k * BAND_V)
    }
    u += du
  }
  const band = new THREE.BufferGeometry()
  band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  band.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  band.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const out = [tint(band, WHITE, undefined, true)]
  const stadium = new THREE.Shape()
  const pr = r - 0.03
  stadium.absarc(L, 0, pr, -Math.PI / 2, Math.PI / 2, false)
  stadium.absarc(-L, 0, pr, Math.PI / 2, Math.PI * 1.5, false)
  const plate = (x: number, facing: number, color: number): THREE.BufferGeometry => {
    const g = new THREE.ShapeGeometry(stadium, 6)
    g.rotateY((facing * Math.PI) / 2)
    return tint(g, color, m4(x, 0, 0), true)
  }
  out.push(plate(cx + (side * w) / 2 - side * 0.01, side, FORM_COLOR.climber), plate(cx - (side * w) / 2 + side * 0.01, -side, STEEL))
  // Mudguard over the loop: the bit of the tread a chasing camera sees past the body.
  out.push(tint(new RoundedBoxGeometry(w + 0.1, 0.13, 2 * L + 0.55, 1, 0.05), FORM_COLOR.climber, m4(cx, r + 0.09, 0), true))
  out.push(tint(new RoundedBoxGeometry(w + 0.12, 0.06, 0.16, 1, 0.02), SUN, m4(cx, r + 0.1, -L - 0.2), true))
  for (const z of [-L, 0, L]) {
    const hub = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10, 1)
    out.push(tint(hub, z === 0 ? SUN : STEEL, m4(cx + (side * w) / 2, 0, z, 0, 0, Math.PI / 2), true))
  }
  for (const g of out) {
    const a = g.getAttribute('uv')
    if (g !== out[0]) for (let i = 0; i < a.count; i++) a.setXY(i, 0, PLATE_UV)
  }
  return out
}

function treadsGeo(period: number): THREE.BufferGeometry {
  return mergeGeometries([...treadGeo(TREAD.x, 1, period), ...treadGeo(-TREAD.x, -1, period)])
}

function clawsGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.52, 0.52]) {
    parts.push(tint(new THREE.CapsuleGeometry(0.12, 0.42, 2, 8), FORM_COLOR.climber, m4(x, 0, 0.26, Math.PI / 2)))
    parts.push(tint(new RoundedBoxGeometry(0.4, 0.22, 0.18, 1, 0.07), STEEL, m4(x, -0.02, 0.58)))
    for (const dx of [-0.12, 0, 0.12]) {
      parts.push(tint(new THREE.ConeGeometry(0.065, 0.36, 6), SILVER, m4(x + dx, -0.08, 0.78, Math.PI / 2 + 0.55, 0, 0)))
    }
  }
  return mergeGeometries(parts)
}

let kit: PartsKit | null = null

/** The shared part geometries (built on first use). */
export function partsKit(): PartsKit {
  if (kit !== null) return kit
  const perimeter = 2 * Math.PI * TREAD.r + 4 * TREAD.half
  const cleatPeriod = perimeter / Math.round(perimeter / 0.26)
  kit = { hull: hullGeo(), prop: propGeo(), wing: wingGeo(), tail: tailGeo(), treads: treadsGeo(cleatPeriod), claws: clawsGeo(), cleatPeriod }
  return kit
}

/** Rubber band with cleats on the lower part, plain white strip on top for the plates. */
export function makeTreadTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 64
  const g = c.getContext('2d')
  if (g === null) throw new Error('2D canvas unavailable')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 32, 64)
  const top = Math.round((1 - BAND_V) * 64)
  g.fillStyle = '#2d3040'
  g.fillRect(0, top, 32, 64 - top)
  g.fillStyle = '#8c93a8'
  g.fillRect(0, top + 3, 13, 64 - top - 6)
  g.fillStyle = '#b9bfcf'
  g.fillRect(0, top + 3, 4, 64 - top - 6)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

/** Triangle count of the kit (for the budget check on the dev page). */
export function partsTriangles(): Record<string, number> {
  const k = partsKit()
  const tri = (g: THREE.BufferGeometry): number => (g.index !== null ? g.index.count : g.getAttribute('position').count) / 3
  return { hull: tri(k.hull), prop: tri(k.prop), wings: 2 * tri(k.wing), tail: tri(k.tail), treads: tri(k.treads), claws: tri(k.claws) }
}
