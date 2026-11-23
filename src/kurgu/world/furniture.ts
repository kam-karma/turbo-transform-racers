/**
 * Giant furniture the road rests on (the track's anchors): the bed, the desk, book stacks as
 * ramps, toy shelves, the toy chest, kitchen cabinets and sink, the dining table, the bathtub,
 * a flower pot, a toolbox, a garden bench. Each is sized from the road above it: its top sits
 * just under the deck. Curved spans are built from modules that follow the bend.
 */
import * as THREE from 'three'
import type { Anchor, AnchorKind, KurguTrack } from '../sim/kurguTrack'
import { BOX, type BatchSink, CONE, CYL, Placer, RBOX, SPHERE, TORUS } from './batch'

export interface Blob { x: number; z: number; w: number; l: number; yaw: number }

const BOOK_COLORS = [0xe8473f, 0x2f7de1, 0xf2b532, 0x36b37e, 0x8e5bd6, 0xff8a3d, 0x1fb5b0, 0xd94f8a]
const PAGES = 0xfbf1dc

function rand(seed: number): () => number {
  let a = (seed * 9301 + 49297) % 233280
  return () => (a = (a * 9301 + 49297) % 233280) / 233280
}

interface Span { cx: number; cz: number; yaw: number; len: number; top: number; straight: boolean }

function spanOf(kt: KurguTrack, a: Anchor): Span {
  const mid = kt.main.frameAt((a.s0 + a.s1) / 2)
  let top = Infinity
  let hMin = Infinity
  let hMax = -Infinity
  for (let s = a.s0; s <= a.s1; s += 4) {
    const f = kt.main.frameAt(s)
    top = Math.min(top, f.pos.y - 0.9)
    const h = Math.atan2(f.t.x, f.t.z)
    hMin = Math.min(hMin, h)
    hMax = Math.max(hMax, h)
  }
  const p0 = kt.main.frameAt(a.s0).pos
  const p1 = kt.main.frameAt(a.s1).pos
  return { cx: mid.pos.x, cz: mid.pos.z, yaw: Math.atan2(mid.t.x, mid.t.z), len: Math.hypot(p1.x - p0.x, p1.z - p0.z), top, straight: hMax - hMin < 0.25 }
}

type Hero = (p: Placer, L: number, T: number, r: () => number) => { w: number; l: number }

const bed: Hero = (p, L, T) => {
  const l = Math.max(L + 26, 86)
  const w = 50
  const leg = T * 0.38
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    p.part('wood', CYL(16), 0x9a5a2e, x * (w / 2 - 2), T * 0.45, z * (l / 2 - 2), 3.6, T * 0.9 + 6, 3.6)
    p.part('wood', SPHERE(14), 0xb06c38, x * (w / 2 - 2), T * 0.9 + 4.5, z * (l / 2 - 2), 5, 5, 5)
  }
  p.part('wood', RBOX(0.1), 0xa8642f, 0, leg + T * 0.1, 0, w, T * 0.2, l)
  p.part('wood', RBOX(0.15), 0xb87440, 0, T * 0.55, l / 2 - 1, w - 2, T * 0.75, 2.4)
  p.part('fabric', RBOX(0.25), 0xf4f7ff, 0, T * 0.72, 0, w - 3, T * 0.32, l - 3)
  // Quilt: red with a folded light-blue sheet edge, draping over the sides.
  p.part('fabric', RBOX(0.2), 0xd8443c, 0, T * 0.82, -l * 0.06, w + 1.5, T * 0.36, l * 0.86)
  p.part('fabric', RBOX(0.4), 0x9fd2ff, 0, T * 0.99, l * 0.36, w + 1, 1.6, 6)
  for (const x of [-16, 16]) p.part('fabric', RBOX(0.45), x < 0 ? 0xffd04a : 0x9fd2ff, x, T + 2.2, l / 2 - 8, 13, 5, 9, 0.15, 0, x < 0 ? 0.1 : -0.12)
  // A teddy bear sitting on the corner.
  const bx = -17
  const bz = -l * 0.25
  p.part('fabric', SPHERE(14), 0xc98b4f, bx, T + 3.4, bz, 6.5, 7, 6)
  p.part('fabric', SPHERE(14), 0xc98b4f, bx, T + 9, bz, 5.2, 5, 5)
  for (const sx of [-1, 1]) p.part('fabric', SPHERE(10), 0xa8703c, bx + sx * 2.2, T + 11.6, bz, 1.9, 1.9, 1.4)
  p.part('fabric', SPHERE(10), 0xf1d2a8, bx, T + 8.4, bz + 2.3, 2.2, 1.6, 1.6)
  return { w: w + 8, l: l + 6 }
}

const desk: Hero = (p, L, T, r) => {
  const l = Math.max(L + 18, 56)
  const w = 48
  p.part('wood', RBOX(0.08), 0xc98a52, 0, T - 1.2, 0, w, 2.4, l)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('wood', RBOX(0.15), 0xb8773f, x * (w / 2 - 2.5), (T - 2.4) / 2, z * (l / 2 - 2.5), 3.2, T - 2.4, 3.2)
  p.part('wood', RBOX(0.08), 0xb8773f, -w / 2 + 10, T - 8, 0, 18, 10, l - 8)
  p.part('metal', RBOX(0.4), 0xe8c27a, -w / 2 + 1, T - 8, 0, 1.2, 1.6, 6)
  // Lamp, pencil cup and crayons on the side of the road.
  const lx = 17
  const lz = -l / 2 + 10
  p.part('plastic', CYL(20), 0x2ab3c9, lx, T + 0.8, lz, 9, 1.6, 9)
  p.part('plastic', CYL(10), 0x2ab3c9, lx, T + 8, lz, 1.2, 14, 1.2, 0, 0, -0.35)
  p.part('plastic', CONE(20), 0x2ab3c9, lx - 6, T + 15, lz, 9, 7, 9, 0, 0, 0.9)
  p.part('glow', SPHERE(12), 0xfff0c0, lx - 4.3, T + 13.2, lz, 3.4, 3.4, 3.4)
  const cz = l / 2 - 10
  p.part('plastic', CYL(18), 0x5ccf4a, 17, T + 4, cz, 7, 8, 7)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    const c = BOOK_COLORS[k]
    p.part('wood', CYL(6), c, 17 + Math.cos(a) * 1.8, T + 9.5, cz + Math.sin(a) * 1.8, 0.8, 11, 0.8, Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15)
    p.part('wood', CONE(6), 0xf3d9a6, 17 + Math.cos(a) * 2.2, T + 15.5, cz + Math.sin(a) * 2.2, 0.8, 1.4, 0.8)
  }
  p.part('plastic', RBOX(0.3), 0xff9ec0, -18, T + 1, l / 2 - 14, 5, 2, 3, 0, r() * 2, 0)
  return { w: w + 4, l: l + 4 }
}

const table: Hero = (p, L, T, r) => {
  const l = Math.max(L + 24, 70)
  const w = 56
  p.part('wood', RBOX(0.06), 0xd3a26a, 0, T - 1.3, 0, w, 2.6, l)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('wood', CYL(14), 0xb8803f, x * (w / 2 - 4), (T - 2.6) / 2, z * (l / 2 - 4), 3.4, T - 2.6, 3.4)
  for (const z of [-l / 4, l / 4]) {
    for (const x of [-20, 20]) {
      p.part('plastic', CYL(24), 0xffffff, x, T + 0.4, z, 12, 0.8, 12)
      p.part('plastic', CYL(24), [0xff8a65, 0x7cc6ff][Math.floor(r() * 2)], x, T + 0.9, z, 8, 0.4, 8)
    }
  }
  p.part('plastic', CYL(18), 0xffcc4d, -20, T + 4, 0, 5, 8, 5)
  return { w: w + 6, l: l + 6 }
}

const box: Hero = (p, L, T) => {
  const l = Math.max(L + 14, 34)
  const w = 34
  p.part('wood', RBOX(0.06), 0x3f7fd0, 0, T / 2 - 1, 0, w, T - 2, l)
  p.part('wood', RBOX(0.08), 0x2f63ad, 0, T - 0.8, 0, w + 2, 1.8, l + 2)
  for (const z of [-l / 2, l / 2]) for (const x of [-w / 2, w / 2]) p.part('metal', BOX(), 0xe8c06a, x, T / 2, z, 1, T, 1)
  p.part('plastic', SPHERE(14), 0xffd23f, w / 2 + 0.2, T * 0.55, 0, 0.6, 8, 8)
  return { w: w + 6, l: l + 6 }
}

const pot: Hero = (p, L, T) => {
  const R = Math.max(L / 2 + 8, 22)
  const g = new THREE.CylinderGeometry(R, R * 0.78, 1, 28)
  p.part('matte', g, 0xc8643c, 0, T / 2, 0, 1, T, 1)
  p.part('matte', TORUS(0.22), 0xd67450, 0, T - 0.5, 0, R * 2.1, R * 2.1, 6, Math.PI / 2)
  p.part('matte', CYL(28), 0x5a3a22, 0, T - 0.8, 0, R * 1.9, 0.6, R * 1.9)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    const side = Math.cos(a) > 0 ? 1 : -1
    const x = side * (R * 0.65)
    p.part('matte', CYL(8), 0x3f8f2f, x, T + 9, Math.sin(a) * R * 0.5, 1.2, 20, 1.2, 0, 0, side * 0.2)
    p.part('matte', SPHERE(12), 0x58b23e, x + side * 6, T + 20, Math.sin(a) * R * 0.5, 16, 2, 9, 0, a, side * 0.4)
  }
  return { w: R * 2.2, l: R * 2.2 }
}

const toolbox: Hero = (p, L, T) => {
  const l = Math.max(L + 12, 40)
  const w = 32
  p.part('metal', RBOX(0.05), 0xd8342c, 0, T / 2, 0, w, T, l)
  for (let y = T * 0.25; y < T - 2; y += T * 0.25) p.part('metal', BOX(), 0x9c1f1a, 0, y, 0, w + 0.4, 0.6, l + 0.4)
  for (const z of [-l / 3, l / 3]) p.part('metal', RBOX(0.3), 0xc9ced6, w / 2 + 0.6, T * 0.6, z, 1.2, 2, 8)
  return { w: w + 4, l: l + 4 }
}

const HEROES: Partial<Record<AnchorKind, Hero>> = { bed, desk, table, box, pot, toolbox, sink: table }

type Module = (p: Placer, T: number, r: () => number, i: number) => void

const books: Module = (p, T, r) => {
  let y = 0
  while (y < T - 0.4) {
    const th = Math.min(T - y, 1.6 + r() * 1.4)
    const w = 23 + r() * 4
    const l = 14 + r() * 2
    const yaw = (r() - 0.5) * 0.14
    p.part('wood', RBOX(0.1), BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], (r() - 0.5) * 1.5, y + th / 2, 0, w, th, l, 0, yaw)
    p.part('matte', BOX(), PAGES, (r() - 0.5) * 1.5 - 0.6, y + th / 2, 0.4, w - 1.4, th * 0.8, l - 0.2, 0, yaw)
    y += th
  }
}

const shelf: Module = (p, T, r) => {
  const w = 30
  p.part('wood', BOX(), 0xf2e3c8, 0, T - 0.8, 0, w, 1.6, 22)
  p.part('wood', BOX(), 0xf2e3c8, 0, T * 0.5, 0, w, 1.2, 22)
  for (const x of [-w / 2, w / 2]) p.part('wood', BOX(), 0xe6d2b0, x, T / 2, 0, 1.6, T, 22)
  p.part('wood', BOX(), 0xd9c39c, 0, T / 2, -10.5, w, T, 1)
  const c = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]
  p.part('plastic', SPHERE(16), c, (r() - 0.5) * 10, T * 0.5 + 4.6, 2, 8, 8, 8)
  p.part('plastic', RBOX(0.2), BOOK_COLORS[Math.floor(r() * 8)], (r() - 0.5) * 12, 3, 3, 6, 5, 6, 0, r())
}

const counter: Module = (p, T, r, i) => {
  const w = 36
  p.part('matte', BOX(), 0x4a3b33, 0, 1.5, 0, w - 4, 3, 23)
  p.part('wood', BOX(), 0xfaf6ee, 0, (T - 2) / 2 + 1.5, 0, w, T - 5, 24)
  for (const x of [-1, 1]) {
    p.part('plastic', RBOX(0.06), 0x8fc9e8, x * (w / 2 + 0.3), (T - 2) / 2 + 1.5, 0, 0.8, T - 8, 21.5)
    p.part('metal', RBOX(0.4), 0xd9dde3, x * (w / 2 + 1), T - 7, 0, 1, 1.4, 8)
  }
  p.part('wood', RBOX(0.05), 0xe7d3b3, 0, T - 1, 0, w + 3, 2, 24.2)
  if (i % 3 === 1) {
    const side = r() < 0.5 ? -1 : 1
    p.part('plastic', CYL(18), [0xff6b5a, 0x3fa9ff, 0xffd23f][i % 3], side * 13, T + 3.5, 0, 6, 7, 6)
    p.part('plastic', TORUS(0.3), [0xff6b5a, 0x3fa9ff, 0xffd23f][i % 3], side * 16.6, T + 3.8, 0, 3.4, 3.4, 3.4, 0, Math.PI / 2)
  }
}

const tub: Module = (p, T, r, i) => {
  p.part('plastic', RBOX(0.1), 0xffffff, 0, 1.5, 0, 34, 3, 24)
  for (const x of [-1, 1]) p.part('plastic', RBOX(0.3), 0xffffff, x * 13.5, (T + 2) / 2, 0, 5, T + 2, 24)
  for (let k = 0; k < 3; k++) p.part('plastic', SPHERE(12), 0xffffff, (r() < 0.5 ? -1 : 1) * (10 + r() * 2), T + 0.5 + r() * 2, (r() - 0.5) * 20, 3 + r() * 3, 2.4 + r() * 2, 3 + r() * 3)
  if (i % 4 === 2) {
    const x = r() < 0.5 ? -13.5 : 13.5
    p.part('plastic', SPHERE(14), 0xffd21f, x, T + 4.6, 0, 5, 4.2, 6)
    p.part('plastic', SPHERE(14), 0xffd21f, x, T + 8.4, 2, 3.6, 3.6, 3.6)
    p.part('plastic', CONE(10), 0xff8a1f, x, T + 8.2, 4.4, 1.6, 2.4, 1.6, Math.PI / 2)
  }
}

const bench: Module = (p, T, _r, i) => {
  for (let k = -2; k <= 2; k++) p.part('wood', RBOX(0.2), 0x9b6337, k * 6.4, T - 0.8, 0, 5.6, 1.6, 25)
  if (i % 2 === 0) for (const x of [-14, 14]) p.part('metal', BOX(), 0x2d3a35, x, (T - 1.6) / 2, 0, 1.6, T - 1.6, 2)
  p.part('wood', RBOX(0.2), 0x9b6337, 18, T + 8, 0, 1.6, 6, 25, 0, 0, 0.15)
}

const MODULES: Readonly<Record<AnchorKind, Module>> = {
  books, shelf, counter, tub, bench, bed: books, desk: books, table: books, box: books, pot: books, toolbox: counter, sink: counter,
}

/** Kinds that may come as a Tripo model (public/models/devev-<kind>.glb). */
export const MODEL_KINDS: readonly AnchorKind[] = ['bed', 'desk', 'table', 'box', 'pot', 'toolbox']

/** A loaded model stretched over the span: footprint w × l, its top at T. */
function placeModel(model: THREE.Object3D, sp: Span, w: number, l: number): THREE.Object3D {
  const o = model.clone(true)
  const box = new THREE.Box3().setFromObject(o)
  const size = box.getSize(new THREE.Vector3())
  const inner = new THREE.Group()
  o.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
  inner.add(o)
  inner.scale.set(w / Math.max(1e-3, size.x), sp.top / Math.max(1e-3, size.y), l / Math.max(1e-3, size.z))
  const outer = new THREE.Group()
  outer.add(inner)
  outer.position.set(sp.cx, 0, sp.cz)
  outer.rotation.y = sp.yaw
  outer.traverse((x) => { if (x instanceof THREE.Mesh) x.receiveShadow = true })
  return outer
}

/** Builds every anchor of the track into the batches (or as models); returns contact shadows. */
export function buildAnchors(kt: KurguTrack, batches: BatchSink, models: ReadonlyMap<AnchorKind, THREE.Object3D>, objects: THREE.Object3D[]): Blob[] {
  const blobs: Blob[] = []
  kt.def.anchors.forEach((a, ai) => {
    const r = rand(ai + 3)
    const sp = spanOf(kt, a)
    const hero = HEROES[a.kind]
    if (hero !== undefined && sp.straight && sp.top > 3) {
      const model = models.get(a.kind)
      if (model !== undefined) {
        const w = a.kind === 'pot' ? Math.max(sp.len + 16, 44) : 50
        const l = Math.max(sp.len + 20, 56)
        objects.push(placeModel(model, sp, w, l))
        blobs.push({ x: sp.cx, z: sp.cz, w: w * 1.15, l: l * 1.1, yaw: sp.yaw })
        return
      }
      const size = hero(new Placer(batches, sp.cx, 0, sp.cz, sp.yaw), sp.len, sp.top, r)
      blobs.push({ x: sp.cx, z: sp.cz, w: size.w * 1.15, l: size.l * 1.1, yaw: sp.yaw })
      return
    }
    const mod = MODULES[a.kind]
    const step = a.kind === 'books' || MODULES[a.kind] === books ? 13 : 24
    let i = 0
    for (let s = a.s0 + step / 2; s < a.s1; s += step) {
      const f = kt.main.frameAt(s)
      const T = f.pos.y - 0.9
      if (T < 1.5) continue
      const yaw = Math.atan2(f.t.x, f.t.z)
      mod(new Placer(batches, f.pos.x, 0, f.pos.z, yaw), T, r, i++)
      blobs.push({ x: f.pos.x, z: f.pos.z, w: 36, l: step * 1.3, yaw })
    }
  })
  return blobs
}

