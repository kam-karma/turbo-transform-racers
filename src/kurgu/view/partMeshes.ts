/**
 * The nine toy parts as chunky vertex-coloured meshes (one draw each): pencil-sharpener
 * drill, eraser bumper, horseshoe magnet, studded block wings, pencil rocket, toy propeller,
 * thread-spool big wheels, inflatable float rings and tank treads. Drawn for a 3.3 m car
 * (+z forward, ground at y = 0); the car view scales them to the body it wears them on.
 * Tripo models (public/models/devev-part-<id>.glb) replace them when present.
 */
import * as THREE from 'three'
import { Batch, BOX, CONE, CYL, HEX, RBOX, SPHERE, TORUS, trs } from '../world/batch'
import type { PartId } from '../sim/parts'

type Draw = (b: Batch) => void

const p = (b: Batch, g: THREE.BufferGeometry, c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): void => {
  b.add(g, trs(x, y, z, rx, ry, rz, sx, sy, sz), c)
}

/** Where each part sits on the reference car. */
export const WHEEL_SPOTS: readonly [number, number][] = [[0.86, 1.08], [-0.86, 1.08], [0.86, -1.1], [-0.86, -1.1]]

/** Hub height of the spinning wheel parts, and how much they lift the car. */
export const WHEEL_Y = { bigwheel: 0.62, float: 0.38 } as const
export const WHEEL_LIFT = { bigwheel: 0.3, float: 0.06, treads: 0.08 } as const

const WHEEL = {
  bigwheel: (b: Batch, x: number, y: number, z: number): void => {
    p(b, CYL(22), 0xd9a066, x, y, z, 1.24, 0.42, 1.24, 0, 0, Math.PI / 2)
    p(b, CYL(22), 0xb58cff, x, y, z, 1.0, 0.36, 1.0, 0, 0, Math.PI / 2)
    for (const dx of [-0.24, 0.24]) p(b, CYL(22), 0xc98a52, x + dx, y, z, 1.3, 0.08, 1.3, 0, 0, Math.PI / 2)
    p(b, BOX(), 0xfff3d6, x, y, z, 0.44, 0.12, 0.9)
  },
  float: (b: Batch, x: number, y: number, z: number): void => {
    p(b, TORUS(0.42), 0xff5a5a, x, y, z, 0.86, 0.86, 1.1, 0, Math.PI / 2)
    for (const a of [0.6, 2.2, 3.8, 5.4]) p(b, SPHERE(8), 0xffffff, x + (x > 0 ? 0.05 : x < 0 ? -0.05 : 0), y + Math.sin(a) * 0.43, z + Math.cos(a) * 0.43, 0.26, 0.26, 0.26)
  },
}

/** Hub of the toy propeller on the reference car. */
export const PROP_HUB: readonly [number, number, number] = [0, 1.6, -1.62]

const DRAW: Readonly<Record<PartId, Draw>> = {
  drill: (b) => {
    p(b, RBOX(0.2), 0xff8a3d, 0, 0.62, 1.72, 0.9, 0.62, 0.5)
    p(b, CONE(18), 0xd7dde6, 0, 0.62, 2.55, 0.86, 1.3, 0.86, Math.PI / 2)
    for (let i = 0; i < 4; i++) p(b, TORUS(0.18), 0x9aa3b0, 0, 0.62, 2.12 + i * 0.26, 0.74 - i * 0.16, 0.74 - i * 0.16, 0.5)
    p(b, SPHERE(10), 0xffd23f, 0.32, 0.86, 1.72, 0.22, 0.22, 0.22)
  },
  bumper: (b) => {
    p(b, RBOX(0.35), 0xff7eb6, 0, 0.5, 1.86, 2.0, 0.52, 0.42)
    p(b, RBOX(0.35), 0x5aaeff, 0, 0.5, 2.06, 2.02, 0.54, 0.22)
    p(b, BOX(), 0xffffff, -0.5, 0.58, 2.18, 0.5, 0.12, 0.02)
  },
  magnet: (b) => {
    p(b, CYL(8), 0xb0b7c2, 0, 0.72, 1.85, 0.12, 0.5, 0.12, Math.PI / 2)
    const arc = new THREE.TorusGeometry(0.42, 0.16, 10, 20, Math.PI)
    p(b, arc, 0xe8352c, 0, 0.78, 2.18, 1, 1, 1, -Math.PI / 2, 0, Math.PI / 2)
    for (const x of [-0.42, 0.42]) {
      p(b, CYL(12), 0xe8352c, x, 0.78, 2.38, 0.32, 0.4, 0.32, Math.PI / 2)
      p(b, CYL(12), 0xdfe5ec, x, 0.78, 2.66, 0.33, 0.18, 0.33, Math.PI / 2)
    }
  },
  wing: (b) => {
    for (const s of [-1, 1]) {
      p(b, RBOX(0.2), 0x3fa9ff, s * 1.55, 0.78, -0.05, 1.5, 0.18, 1.05, 0, 0, -s * 0.08)
      p(b, RBOX(0.25), 0xffffff, s * 2.28, 0.86, -0.05, 0.12, 0.3, 1.05)
      for (const x of [0.4, 0.95]) for (const z of [-0.25, 0.25]) p(b, CYL(10), 0x3fa9ff, s * (0.8 + x * 0.75 + 0.15), 0.9 - (x - 0.4) * 0.05, z - 0.05, 0.22, 0.12, 0.22)
    }
  },
  rocket: (b) => {
    p(b, HEX(), 0xffcf3a, 0, 1.36, -0.75, 0.5, 1.6, 0.5, Math.PI / 2)
    p(b, CYL(12), 0xff9ec0, 0, 1.36, 0.12, 0.48, 0.3, 0.48, Math.PI / 2)
    p(b, CYL(12), 0xd9c07a, 0, 1.36, -0.06, 0.5, 0.12, 0.5, Math.PI / 2)
    p(b, CONE(12), 0xc9ced6, 0, 1.36, -1.72, 0.46, 0.4, 0.46, -Math.PI / 2)
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) p(b, BOX(), 0xe8352c, Math.sin(a) * 0.35, 1.36 + Math.cos(a) * 0.35, -1.35, 0.06 + Math.abs(Math.sin(a)) * 0.3, 0.06 + Math.abs(Math.cos(a)) * 0.3, 0.5)
    p(b, BOX(), 0x8a96a8, 0, 1.06, -0.6, 0.14, 0.3, 0.5)
  },
  propeller: (b) => {
    p(b, CYL(10), 0x8a96a8, 0, 1.25, -1.5, 0.12, 0.7, 0.12)
    p(b, SPHERE(12), 0xff5a5a, 0, 1.6, -1.62, 0.3, 0.3, 0.3)
    for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) p(b, RBOX(0.4), 0x62e3b1, Math.sin(a) * 0.55, 1.6 + Math.cos(a) * 0.55, -1.7, 0.36, 0.9, 0.06, 0, 0, -a)
  },
  bigwheel: (b) => {
    for (const [x, z] of WHEEL_SPOTS) WHEEL.bigwheel(b, x * 1.08, WHEEL_Y.bigwheel, z)
  },
  float: (b) => {
    for (const [x, z] of WHEEL_SPOTS) WHEEL.float(b, x * 1.05, WHEEL_Y.float, z)
  },
  treads: (b) => {
    for (const s of [-1, 1]) {
      p(b, RBOX(0.45), 0x3a3f4a, s * 0.95, 0.4, 0, 0.42, 0.78, 2.9)
      for (let z = -1.3; z <= 1.31; z += 0.26) p(b, BOX(), 0x9be15d, s * 0.95, 0.8, z, 0.46, 0.08, 0.1)
      for (const z of [-1.05, 0, 1.05]) p(b, CYL(12), 0xc9ced6, s * 1.17, 0.4, z, 0.5, 0.06, 0.5, 0, 0, Math.PI / 2)
    }
  },
}

const cache = new Map<PartId, THREE.BufferGeometry>()

export function partGeometry(id: PartId): THREE.BufferGeometry {
  let g = cache.get(id)
  if (g === undefined) {
    const b = new Batch()
    DRAW[id](b)
    g = b.build()
    cache.set(id, g)
  }
  return g
}

/** The part on its own (pickups, the falling knocked-off part), centred on its bounds. */
export function centredPartGeometry(id: PartId): THREE.BufferGeometry {
  const g = partGeometry(id).clone()
  g.computeBoundingBox()
  const c = new THREE.Vector3()
  g.boundingBox?.getCenter(c)
  g.translate(-c.x, -c.y, -c.z)
  g.computeBoundingSphere()
  return g
}

/** One spinning wheel part, centred on its hub (player car: four of them roll). */
export function wheelGeometry(id: 'bigwheel' | 'float'): THREE.BufferGeometry {
  const b = new Batch()
  WHEEL[id](b, 0, 0, 0)
  return b.build()
}

/** The propeller without its blades (mast only) and the blades centred on the hub. */
export function propMastGeometry(): THREE.BufferGeometry {
  const b = new Batch()
  p(b, CYL(10), 0x8a96a8, 0, 1.25, -1.5, 0.12, 0.7, 0.12)
  return b.build()
}

export function propBladesGeometry(): THREE.BufferGeometry {
  const b = new Batch()
  p(b, SPHERE(12), 0xff5a5a, 0, 0, 0, 0.3, 0.3, 0.3)
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) p(b, RBOX(0.4), 0x62e3b1, Math.sin(a) * 0.55, Math.cos(a) * 0.55, -0.08, 0.36, 0.9, 0.06, 0, 0, -a)
  return b.build()
}

export const partMaterial = (): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, envMapIntensity: 1.1 })
