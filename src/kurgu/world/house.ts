/**
 * The rooms around the track: floors (oak planks, kitchen checks, bathroom tiles, lawn,
 * garage concrete), the star rug, papered walls with skirting boards, doorways between rooms,
 * sunny windows with curtains, soft light shafts, ceilings with a lamp, and — in the garden —
 * a picket fence under an open sky. Built from the generated HouseLayout.
 */
import * as THREE from 'three'
import type { ZoneId } from '../sim/kurguTrack'
import type { HouseLayout, Room } from '../sim/layout'
import { BOX, type BatchSink, CYL, Placer, RBOX, SPHERE } from './batch'
import { floorTexture, rugTexture, shaftTexture, wallTexture, windowTexture } from './textures'

const FLOOR_TILE: Readonly<Record<ZoneId, number>> = { cocuk: 40, mutfak: 40, banyo: 40, bahce: 30, garaj: 60 }
const CURTAIN: Readonly<Record<ZoneId, number>> = { cocuk: 0x3d7fd9, mutfak: 0xe86a5a, banyo: 0x58c7b8, bahce: 0xffffff, garaj: 0x8a97a8 }
const SKIRT = 0xfffaf0
const DOOR_W = 46
const DOOR_H = 62

export interface HouseView {
  readonly group: THREE.Group
  /** Light shafts and window glows: dimmed at night. */
  setNight(night: boolean): void
  dispose(): void
}

interface Owned { dispose(): void }

/** A plane whose texture repeats every `tile` metres (material.userData.tile), so walls of one room merge. */
function plane(w: number, h: number, mat: THREE.Material, owned: Owned[]): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h)
  const tile = (mat.userData.tile as number | undefined) ?? 0
  if (tile > 0) {
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile)
  }
  owned.push(g)
  return new THREE.Mesh(g, mat)
}

const matCache = new WeakMap<THREE.Texture, Map<string, THREE.MeshStandardMaterial>>()

function texMat(tex: THREE.Texture, tile: number, owned: Owned[], opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = `${tile}|${JSON.stringify(opts)}`
  const byTex = matCache.get(tex) ?? new Map<string, THREE.MeshStandardMaterial>()
  matCache.set(tex, byTex)
  const hit = byTex.get(key)
  if (hit !== undefined) return hit
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, envMapIntensity: 0.4, ...opts })
  m.userData.tile = tile
  byTex.set(key, m)
  owned.push(m)
  return m
}

/** Bakes every mesh under `group` into one mesh per material (walls, floors, panes, shafts). */
function mergeByMaterial(group: THREE.Group): void {
  group.updateMatrixWorld(true)
  const bins = new Map<THREE.Material, THREE.Mesh[]>()
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return
    const list = bins.get(o.material) ?? []
    list.push(o)
    bins.set(o.material, list)
  })
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
  const merged: THREE.Mesh[] = []
  for (const [mat, meshes] of bins) {
    const pos: number[] = []
    const nor: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const nm = new THREE.Matrix3()
    const v = new THREE.Vector3()
    for (const m of meshes) {
      const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)
      nm.getNormalMatrix(mtx)
      const g = m.geometry
      const base = pos.length / 3
      const p = g.getAttribute('position')
      const n = g.getAttribute('normal')
      const t = g.getAttribute('uv')
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mtx)
        pos.push(v.x, v.y, v.z)
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize()
        nor.push(v.x, v.y, v.z)
        uv.push(t.getX(i), t.getY(i))
      }
      const ix = g.getIndex()
      if (ix !== null) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, mat)
    mesh.receiveShadow = meshes.some((m) => m.receiveShadow)
    mesh.renderOrder = meshes[0].renderOrder
    merged.push(mesh)
  }
  group.clear()
  for (const m of merged) group.add(m)
}

export function buildHouse(lay: HouseLayout, batches: BatchSink, windowsPerRoom: number, sunFromLeft: boolean): HouseView {
  const group = new THREE.Group()
  const owned: Owned[] = []
  const shaftTex = shaftTexture()
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  const winTex = windowTexture()
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(1.5, 1.45, 1.35) })
  owned.push(shaftTex, shaftMat, winTex, winMat)
  const floorTex = new Map<ZoneId, THREE.CanvasTexture>()
  const wallTex = new Map<ZoneId, THREE.CanvasTexture>()
  const ftex = (z: ZoneId): THREE.CanvasTexture => {
    if (!floorTex.has(z)) floorTex.set(z, floorTexture(z))
    return floorTex.get(z) as THREE.CanvasTexture
  }
  const wtex = (z: ZoneId): THREE.CanvasTexture => {
    if (!wallTex.has(z)) wallTex.set(z, wallTexture(z))
    return wallTex.get(z) as THREE.CanvasTexture
  }
  const W = lay.x1 - lay.x0
  const H = lay.height
  const cx = (lay.x0 + lay.x1) / 2
  const shafts: THREE.Mesh[] = []
  const wins: THREE.Mesh[] = []
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfff6ea, emissive: 0xe8d8c0, emissiveIntensity: 0.45, roughness: 1 })
  owned.push(ceilMat)

  lay.rooms.forEach((room, i) => {
    const D = room.z1 - room.z0
    const cz = (room.z0 + room.z1) / 2
    const garden = room.zone === 'bahce'
    const tile = FLOOR_TILE[room.zone]
    const floor = plane(W, D, texMat(ftex(room.zone), tile, owned, { roughness: garden ? 1 : 0.6 }), owned)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, 0, cz)
    floor.receiveShadow = true
    group.add(floor)
    if (room.zone === 'cocuk') addRug(group, cx, cz, W, D, owned)
    const wallH = garden ? 34 : H
    const wm = texMat(wtex(room.zone), 40, owned, { roughness: 0.9 })
    for (const side of [-1, 1]) {
      const wall = plane(D, wallH, wm, owned)
      wall.position.set(side < 0 ? lay.x0 : lay.x1, wallH / 2, cz)
      wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2
      group.add(wall)
      const p = new Placer(batches, side < 0 ? lay.x0 : lay.x1, 0, cz, 0)
      p.part('matte', BOX(), SKIRT, -side * 0.6, 2.4, 0, 1.4, 4.8, D)
      if (garden) addHedge(batches, side < 0 ? lay.x0 + 8 : lay.x1 - 8, room)
    }
    // End walls and partitions.
    if (i === 0) group.add(endWall(lay, room.z0, 1, wtex(room.zone), wallH, owned, batches))
    if (i === lay.rooms.length - 1) group.add(endWall(lay, room.z1, -1, wtex(room.zone), wallH, owned, batches))
    if (!garden) {
      const ceil = plane(W, D, ceilMat, owned)
      ceil.rotation.x = Math.PI / 2
      ceil.position.set(cx, H, cz)
      group.add(ceil)
      const lamp = new Placer(batches, cx, H, cz, 0)
      lamp.part('glow', SPHERE(20), 0xfff2c8, 0, -6, 0, 26, 10, 26)
      lamp.part('matte', CYL(24), 0xffffff, 0, -1.5, 0, 34, 3, 34)
      const n = Math.max(1, windowsPerRoom)
      for (let k = 0; k < n; k++) {
        const z = room.z0 + ((k + 0.5) * D) / n
        addWindow(group, batches, sunFromLeft ? lay.x0 : lay.x1, z, sunFromLeft ? 1 : -1, CURTAIN[room.zone], winMat, shaftMat, owned, shafts, wins)
      }
    }
  })
  lay.doors.forEach((door, i) => {
    const a = lay.rooms[i]
    const b = lay.rooms[i + 1]
    const h = a.zone === 'bahce' || b.zone === 'bahce' ? 34 : H
    group.add(partition(lay, door.x, door.z, wtex(a.zone), wtex(b.zone), h, owned, batches))
  })
  mergeByMaterial(group)
  return {
    group,
    setNight(night) {
      group.traverse((o) => { if (o instanceof THREE.Mesh && o.material === shaftMat) o.visible = !night })
      ceilMat.emissiveIntensity = night ? 0.06 : 0.45
      winMat.color.setRGB(night ? 0.35 : 1.5, night ? 0.4 : 1.45, night ? 0.75 : 1.35)
    },
    dispose() {
      for (const o of owned) o.dispose()
      for (const t of floorTex.values()) t.dispose()
      for (const t of wallTex.values()) t.dispose()
    },
  }
}

function addRug(group: THREE.Group, cx: number, cz: number, W: number, D: number, owned: Owned[]): void {
  const tex = rugTexture()
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, envMapIntensity: 0.2 })
  owned.push(tex, mat)
  const rug = plane(W * 0.62, D * 0.6, mat, owned)
  rug.rotation.x = -Math.PI / 2
  rug.position.set(cx, 0.12, cz)
  rug.receiveShadow = true
  group.add(rug)
}

function endWall(lay: HouseLayout, z: number, facing: number, tex: THREE.CanvasTexture, h: number, owned: Owned[], batches: BatchSink): THREE.Mesh {
  const W = lay.x1 - lay.x0
  const wall = plane(W, h, texMat(tex, 40, owned, { roughness: 0.9 }), owned)
  wall.position.set((lay.x0 + lay.x1) / 2, h / 2, z)
  wall.rotation.y = facing > 0 ? 0 : Math.PI
  new Placer(batches, (lay.x0 + lay.x1) / 2, 0, z + facing * 0.6, 0).part('matte', BOX(), SKIRT, 0, 2.4, 0, W, 4.8, 1.4)
  return wall
}

/** Wall between two rooms with a doorway (and its white frame) where the track goes through. */
function partition(lay: HouseLayout, dx: number, z: number, texA: THREE.CanvasTexture, texB: THREE.CanvasTexture, h: number, owned: Owned[], batches: BatchSink): THREE.Group {
  const g = new THREE.Group()
  const left = dx - DOOR_W / 2 - lay.x0
  const right = lay.x1 - (dx + DOOR_W / 2)
  const segs: [number, number, number, number][] = [
    [lay.x0 + left / 2, h / 2, left, h],
    [dx + DOOR_W / 2 + right / 2, h / 2, right, h],
    [dx, (DOOR_H + h) / 2, DOOR_W, h - DOOR_H],
  ]
  for (const [x, y, w, hh] of segs) {
    if (w <= 0 || hh <= 0) continue
    for (const [tex, rot, off] of [[texA, Math.PI, -0.4], [texB, 0, 0.4]] as const) {
      const m = plane(w, hh, texMat(tex, 40, owned, { roughness: 0.9 }), owned)
      m.position.set(x, y, z + off)
      m.rotation.y = rot
      g.add(m)
    }
  }
  const p = new Placer(batches, dx, 0, z, 0)
  for (const side of [-1, 1]) p.part('wood', RBOX(0.2), 0xfff8ee, side * (DOOR_W / 2 + 1.5), DOOR_H / 2, 0, 3, DOOR_H + 3, 3.4)
  p.part('wood', RBOX(0.2), 0xfff8ee, 0, DOOR_H + 1.5, 0, DOOR_W + 6, 3, 3.4)
  if (left > 0) p.part('matte', BOX(), SKIRT, -(DOOR_W / 2 + left / 2), 2.4, 0, left, 4.8, 2.4)
  if (right > 0) p.part('matte', BOX(), SKIRT, DOOR_W / 2 + right / 2, 2.4, 0, right, 4.8, 2.4)
  return g
}

function addWindow(group: THREE.Group, batches: BatchSink, wx: number, z: number, inward: number, curtain: number, winMat: THREE.Material, shaftMat: THREE.Material, owned: Owned[], shafts: THREE.Mesh[], wins: THREE.Mesh[]): void {
  const W = 62
  const H = 56
  const y = 34 + H / 2
  const pane = plane(W, H, winMat, owned)
  pane.position.set(wx + inward * 0.3, y, z)
  pane.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2
  group.add(pane)
  wins.push(pane)
  const p = new Placer(batches, wx + inward * 1.2, 0, z, inward > 0 ? Math.PI / 2 : -Math.PI / 2)
  // Frame, cross bars, sill (local x along the wall, z out of the wall).
  p.part('wood', RBOX(0.25), 0xffffff, 0, y + H / 2 + 1.5, 0, W + 6, 3, 3)
  p.part('wood', RBOX(0.25), 0xffffff, 0, y - H / 2 - 1.5, 1.5, W + 10, 3, 6)
  for (const sx of [-1, 1]) p.part('wood', RBOX(0.25), 0xffffff, sx * (W / 2 + 1.5), y, 0, 3, H + 6, 3)
  p.part('wood', BOX(), 0xffffff, 0, y, 0.4, 1.6, H, 1.2)
  p.part('wood', BOX(), 0xffffff, 0, y + 6, 0.4, W, 1.6, 1.2)
  // Curtains: soft folds hanging either side, a rod across.
  p.part('metal', CYL(10), 0xd9b36a, 0, y + H / 2 + 7, 4, 1.2, W + 44, 1.2, 0, 0, Math.PI / 2)
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      p.part('fabric', CYL(12), curtain, sx * (W / 2 + 6 + k * 3.2), y - 4, 4 + (k % 2) * 0.8, 4.2, H + 26, 3.4)
    }
  }
  // Two crossed soft shafts from the window down into the room.
  const dir = new THREE.Vector3(inward * 0.85, -0.62, 0.22).normalize()
  const len = 150
  for (const k of [0, 1]) {
    const s = plane(W * 0.9, len, shaftMat, owned)
    const c = new THREE.Vector3(wx, y, z).addScaledVector(dir, len / 2)
    s.position.copy(c)
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
    s.rotateY(k === 0 ? 0 : Math.PI / 2)
    s.renderOrder = 5
    group.add(s)
    shafts.push(s)
  }
}

function addHedge(batches: BatchSink, x: number, room: Room): void {
  const p = new Placer(batches, x, 0, 0, 0)
  for (let z = room.z0 + 10; z < room.z1 - 10; z += 14) {
    const s = 16 + ((z * 7) % 9)
    p.part('matte', SPHERE(12), 0x4c9a38, 0, 30 + (z % 5), z, s, s * 0.9, s)
    p.part('matte', SPHERE(12), 0x5fb447, (z % 3) - 1, 38, z + 5, s * 0.7, s * 0.6, s * 0.7)
  }
}
