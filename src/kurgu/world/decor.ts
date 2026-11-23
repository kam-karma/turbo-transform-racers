/**
 * Fills the rooms: giant toys and household things scattered on the floor, tall furniture
 * against the walls, children's drawings framed on the walls, and soft contact shadows under
 * everything. Nothing is placed where it would poke through the road.
 */
import * as THREE from 'three'
import type { KurguTrack } from '../sim/kurguTrack'
import { roadSamples, type HouseLayout } from '../sim/layout'
import { type BatchSink, Placer, RBOX } from './batch'
import type { Blob } from './furniture'
import { ZONE_HEROES } from './heroes'
import { ZONE_PROPS } from './props'
import { blobTexture } from './textures'

const CELL = 24

class RoadHash {
  private readonly cells = new Map<string, { x: number; z: number; y: number }[]>()

  constructor(kt: KurguTrack, private readonly blobs: readonly Blob[]) {
    for (const x of roadSamples(kt, 5)) {
      const k = `${Math.floor(x.p.x / CELL)},${Math.floor(x.p.z / CELL)}`
      const list = this.cells.get(k) ?? []
      list.push({ x: x.p.x, z: x.p.z, y: x.p.y })
      this.cells.set(k, list)
    }
  }

  /** True when a prop of radius r and height h at (x, z) touches neither road nor furniture. */
  clear(x: number, z: number, r: number, h: number): boolean {
    const reach = r + 11
    const n = Math.ceil(reach / CELL)
    const cx = Math.floor(x / CELL)
    const cz = Math.floor(z / CELL)
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        for (const p of this.cells.get(`${cx + i},${cz + j}`) ?? []) {
          if (Math.hypot(p.x - x, p.z - z) < reach && p.y < h + 6) return false
        }
      }
    }
    for (const b of this.blobs) if (Math.hypot(b.x - x, b.z - z) < r + Math.max(b.w, b.l) * 0.5) return false
    return true
  }
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DecorResult { readonly blobs: Blob[]; readonly art: THREE.Mesh | null }

export function buildDecor(kt: KurguTrack, lay: HouseLayout, batches: BatchSink, furniture: readonly Blob[], density: number, sunFromLeft: boolean): DecorResult {
  const hash = new RoadHash(kt, furniture)
  const rnd = rng(kt.def.id.length * 977 + kt.def.points.length)
  const blobs: Blob[] = []
  const placed: { x: number; z: number; r: number }[] = []
  const free = (x: number, z: number, r: number): boolean => placed.every((q) => Math.hypot(q.x - x, q.z - z) > q.r + r + 4)
  const spacing = 56 / Math.sqrt(Math.max(0.3, density))
  for (const room of lay.rooms) {
    const set = ZONE_PROPS[room.zone]
    // Set pieces first, in the roomiest free spots.
    const spots: { x: number; z: number }[] = []
    for (let z = room.z0 + 50; z < room.z1 - 50; z += 30) for (let x = lay.x0 + 60; x < lay.x1 - 60; x += 30) spots.push({ x, z })
    spots.sort(() => rnd() - 0.5)
    for (const def of ZONE_HEROES[room.zone]) {
      const spot = spots.find((c) => hash.clear(c.x, c.z, def.r + 6, def.h) && free(c.x, c.z, def.r + 10))
      if (spot === undefined) continue
      const yaw = rnd() * Math.PI * 2
      def.build(new Placer(batches, spot.x, 0, spot.z, yaw), rnd)
      placed.push({ x: spot.x, z: spot.z, r: def.r + 6 })
      blobs.push({ x: spot.x, z: spot.z, w: def.r * 2.4, l: def.r * 2.4, yaw })
    }
    for (let z = room.z0 + 24; z < room.z1 - 24; z += spacing) {
      for (let x = lay.x0 + 26; x < lay.x1 - 26; x += spacing) {
        const def = set.floor[Math.floor(rnd() * set.floor.length) % set.floor.length]
        const px = x + (rnd() - 0.5) * spacing * 0.7
        const pz = z + (rnd() - 0.5) * spacing * 0.7
        if (rnd() < 0.5 || !hash.clear(px, pz, def.r, def.h) || !free(px, pz, def.r)) continue
        const yaw = rnd() * Math.PI * 2
        def.build(new Placer(batches, px, 0, pz, yaw), rnd)
        placed.push({ x: px, z: pz, r: def.r })
        blobs.push({ x: px, z: pz, w: def.r * 2.3, l: def.r * 2.3, yaw })
      }
    }
    // Tall furniture against the walls, facing into the room.
    for (const side of [-1, 1]) {
      let i = side < 0 ? 0 : 1
      for (let z = room.z0 + 50; z < room.z1 - 40; z += 95) {
        if (room.zone !== 'bahce' && (side < 0) === sunFromLeft && i % 2 === 0) {
          i++
          continue
        }
        const def = set.wall[i++ % set.wall.length]
        const x = side < 0 ? lay.x0 + def.r * 0.6 + 2 : lay.x1 - def.r * 0.6 - 2
        if (!hash.clear(x, z, def.r, def.h) || !free(x, z, def.r)) continue
        def.build(new Placer(batches, x, 0, z, side < 0 ? Math.PI / 2 : -Math.PI / 2), rnd)
        placed.push({ x, z, r: def.r })
        blobs.push({ x, z, w: def.r * 2.4, l: def.r * 1.6, yaw: Math.PI / 2 })
      }
    }
  }
  return { blobs, art: buildArt(lay, batches, sunFromLeft) }
}

/** Children's drawings in white frames on the wall opposite the windows. */
function buildArt(lay: HouseLayout, batches: BatchSink, sunFromLeft: boolean): THREE.Mesh | null {
  const tex = artTexture()
  const pos: number[] = []
  const uv: number[] = []
  const x = sunFromLeft ? lay.x1 - 0.8 : lay.x0 + 0.8
  const face = sunFromLeft ? -1 : 1
  let n = 0
  for (const room of lay.rooms) {
    if (room.zone === 'bahce' || room.zone === 'garaj') continue
    for (let z = room.z0 + 70; z < room.z1 - 60; z += 120) {
      const w = 26 + (n % 2) * 8
      const h = 22 + ((n + 1) % 2) * 6
      const y = 58 + (n % 3) * 4
      const cell = n % 4
      const u0 = (cell % 2) * 0.5
      const v0 = cell < 2 ? 0.5 : 0
      const corners: [number, number, number, number][] = [[-1, -1, u0, v0], [1, -1, u0 + 0.5, v0], [1, 1, u0 + 0.5, v0 + 0.5], [-1, 1, u0, v0 + 0.5]]
      const quad = [0, 1, 2, 0, 2, 3]
      for (const q of quad) {
        const [a, b, u, v] = corners[q]
        pos.push(x, y + (b * h) / 2, z + (-a * face * w) / 2)
        uv.push(u, v)
      }
      const p = new Placer(batches, x - face * 0.3, 0, z, face > 0 ? Math.PI / 2 : -Math.PI / 2)
      p.part('wood', RBOX(0.2), 0xffffff, 0, y + h / 2 + 1, 0, w + 4, 2.2, 1.6)
      p.part('wood', RBOX(0.2), 0xffffff, 0, y - h / 2 - 1, 0, w + 4, 2.2, 1.6)
      for (const sx of [-1, 1]) p.part('wood', RBOX(0.2), 0xffffff, sx * (w / 2 + 1), y, 0, 2.2, h + 4, 1.6)
      n++
    }
  }
  if (n === 0) {
    tex.dispose()
    return null
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }))
}

function artTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 512
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  const cells: ((x: number, y: number) => void)[] = [
    (x, y) => { // a red race car
      c.fillStyle = '#fffbe8'; c.fillRect(x, y, 256, 256)
      c.fillStyle = '#e8352c'; c.beginPath(); c.roundRect(x + 40, y + 120, 176, 56, 20); c.fill()
      c.beginPath(); c.roundRect(x + 80, y + 86, 90, 44, 16); c.fill()
      c.fillStyle = '#2b2b3a'; for (const dx of [80, 180]) { c.beginPath(); c.arc(x + dx, y + 180, 22, 0, 7); c.fill() }
      c.fillStyle = '#9fd2ff'; c.fillRect(x + 96, y + 96, 56, 24)
      c.strokeStyle = '#ffd23f'; c.lineWidth = 8; c.beginPath(); c.moveTo(x + 20, y + 140); c.lineTo(x + 0, y + 140); c.stroke()
    },
    (x, y) => { // rocket and stars
      c.fillStyle = '#1f3f8f'; c.fillRect(x, y, 256, 256)
      c.fillStyle = '#ffd23f'; for (const [a, b] of [[40, 40], [200, 60], [60, 200], [220, 210]]) { c.beginPath(); c.arc(x + a, y + b, 6, 0, 7); c.fill() }
      c.fillStyle = '#f4f4f4'; c.beginPath(); c.ellipse(x + 128, y + 128, 36, 80, 0, 0, 7); c.fill()
      c.fillStyle = '#e8352c'; c.beginPath(); c.moveTo(x + 92, y + 120); c.lineTo(x + 128, y + 30); c.lineTo(x + 164, y + 120); c.fill()
      c.fillStyle = '#ff9a1f'; c.beginPath(); c.moveTo(x + 104, y + 200); c.lineTo(x + 128, y + 250); c.lineTo(x + 152, y + 200); c.fill()
      c.fillStyle = '#5fb8ff'; c.beginPath(); c.arc(x + 128, y + 124, 16, 0, 7); c.fill()
    },
    (x, y) => { // house and sun
      c.fillStyle = '#bfe6ff'; c.fillRect(x, y, 256, 256)
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x + 206, y + 52, 30, 0, 7); c.fill()
      c.fillStyle = '#8fd35e'; c.fillRect(x, y + 200, 256, 56)
      c.fillStyle = '#ff8a65'; c.fillRect(x + 64, y + 120, 110, 84)
      c.fillStyle = '#b8402c'; c.beginPath(); c.moveTo(x + 50, y + 124); c.lineTo(x + 119, y + 64); c.lineTo(x + 188, y + 124); c.fill()
      c.fillStyle = '#5a3a22'; c.fillRect(x + 104, y + 156, 28, 48)
    },
    (x, y) => { // rainbow
      c.fillStyle = '#fffbe8'; c.fillRect(x, y, 256, 256)
      ;['#ff5a5a', '#ff9a3c', '#ffd23f', '#4fd16a', '#3fa9ff', '#a77bff'].forEach((col, i) => {
        c.strokeStyle = col; c.lineWidth = 14; c.beginPath(); c.arc(x + 128, y + 200, 110 - i * 14, Math.PI, 0); c.stroke()
      })
      c.fillStyle = '#ffffff'; for (const dx of [30, 226]) { c.beginPath(); c.arc(x + dx, y + 200, 26, 0, 7); c.fill() }
    },
  ]
  cells.forEach((f, i) => f((i % 2) * 256, (i < 2 ? 0 : 1) * 256))
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** One instanced draw for every contact shadow. */
export function buildBlobs(blobs: readonly Blob[]): THREE.InstancedMesh {
  const tex = blobTexture()
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  const geo = new THREE.PlaneGeometry(1, 1)
  geo.rotateX(-Math.PI / 2)
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, blobs.length))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  blobs.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw)
    m.compose(new THREE.Vector3(b.x, 0.22, b.z), q, new THREE.Vector3(b.w, 1, b.l))
    im.setMatrixAt(i, m)
  })
  im.count = blobs.length
  im.renderOrder = 1
  im.computeBoundingSphere()
  return im
}
