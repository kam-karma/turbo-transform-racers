/**
 * Geometry batching for the Dev Ev world: hundreds of procedural toys and furniture parts are
 * appended (transformed, vertex-coloured) into one buffer per material, so a whole room
 * draws in a handful of calls (spec §15.2: ≤ 150 draw calls).
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export type MatKey = 'plastic' | 'matte' | 'wood' | 'fabric' | 'metal' | 'glow'

const tmpV = new THREE.Vector3()
const tmpN = new THREE.Vector3()
const tmpNM = new THREE.Matrix3()
const tmpC = new THREE.Color()

export class Batch {
  private readonly pos: number[] = []
  private readonly nor: number[] = []
  private readonly col: number[] = []
  private readonly uv: number[] = []

  get empty(): boolean {
    return this.pos.length === 0
  }

  /** Appends `g` placed by `m`, painted `color` (multiplies any vertex colours `g` has). */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.ColorRepresentation): void {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const c = g.getAttribute('color')
    const t = g.getAttribute('uv')
    const idx = g.getIndex()
    tmpNM.getNormalMatrix(m)
    tmpC.set(color)
    const count = idx === null ? p.count : idx.count
    for (let k = 0; k < count; k++) {
      const i = idx === null ? k : idx.getX(k)
      tmpV.fromBufferAttribute(p, i).applyMatrix4(m)
      this.pos.push(tmpV.x, tmpV.y, tmpV.z)
      if (n !== undefined) tmpN.fromBufferAttribute(n, i).applyMatrix3(tmpNM).normalize()
      else tmpN.set(0, 1, 0)
      this.nor.push(tmpN.x, tmpN.y, tmpN.z)
      const r = c !== undefined ? c.getX(i) : 1
      const gg = c !== undefined ? c.getY(i) : 1
      const b = c !== undefined ? c.getZ(i) : 1
      this.col.push(tmpC.r * r, tmpC.g * gg, tmpC.b * b)
      this.uv.push(t !== undefined ? t.getX(i) : 0, t !== undefined ? t.getY(i) : 0)
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/** Anything geometry can be appended to by material key. */
export interface BatchSink {
  of(key: MatKey): { add(g: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.ColorRepresentation): void }
}

/** One Batch per material key. */
export class Batches implements BatchSink {
  private readonly map = new Map<MatKey, Batch>()

  of(key: MatKey): Batch {
    let b = this.map.get(key)
    if (b === undefined) {
      b = new Batch()
      this.map.set(key, b)
    }
    return b
  }

  entries(): [MatKey, Batch][] {
    return [...this.map.entries()].filter(([, b]) => !b.empty)
  }
}

// --- shared unit primitives (cached; scaled by the matrix) -------------------------------

const cache = new Map<string, THREE.BufferGeometry>()
const cached = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
  let g = cache.get(key)
  if (g === undefined) {
    g = make()
    cache.set(key, g)
  }
  return g
}

export const BOX = (): THREE.BufferGeometry => cached('box', () => new THREE.BoxGeometry(1, 1, 1))
/** Rounded unit box; `r` is the corner radius as a share of the smallest side. */
export const RBOX = (r = 0.12): THREE.BufferGeometry => cached(`rbox${r}`, () => new RoundedBoxGeometry(1, 1, 1, 1, r))
export const CYL = (seg = 16): THREE.BufferGeometry => cached(`cyl${Math.min(seg, 16)}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, Math.min(seg, 16)))
export const CONE = (seg = 16): THREE.BufferGeometry => cached(`cone${Math.min(seg, 16)}`, () => new THREE.CylinderGeometry(0, 0.5, 1, Math.min(seg, 16)))
export const SPHERE = (seg = 14): THREE.BufferGeometry => cached(`sph${Math.min(seg, 16)}`, () => new THREE.SphereGeometry(0.5, Math.min(seg, 16), Math.max(7, (Math.min(seg, 16) * 0.66) | 0)))
export const TORUS = (tube = 0.25): THREE.BufferGeometry => cached(`tor${tube}`, () => new THREE.TorusGeometry(0.5, tube, 8, 22))
export const HEX = (): THREE.BufferGeometry => cached('hex', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6))

const mtmp = new THREE.Matrix4()
const qtmp = new THREE.Quaternion()
const etmp = new THREE.Euler()
const ptmp = new THREE.Vector3()
const stmp = new THREE.Vector3()

/** Matrix from position, Euler rotation (radians, YXZ) and size. */
export function trs(x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
  etmp.set(rx, ry, rz, 'YXZ')
  qtmp.setFromEuler(etmp)
  return mtmp.compose(ptmp.set(x, y, z), qtmp, stmp.set(sx, sy, sz))
}

/**
 * A local frame on the floor (or on furniture): place parts in local metres, then add them
 * to a batch already rotated by `yaw` and moved to (x, y, z).
 */
export class Placer {
  private readonly base = new THREE.Matrix4()
  private readonly local = new THREE.Matrix4()
  private readonly out = new THREE.Matrix4()

  constructor(private readonly batches: BatchSink, x: number, y: number, z: number, yaw: number) {
    this.base.makeRotationY(yaw).setPosition(x, y, z)
  }

  part(key: MatKey, g: THREE.BufferGeometry, color: THREE.ColorRepresentation, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): void {
    this.local.copy(trs(x, y, z, rx, ry, rz, sx, sy, sz))
    this.out.multiplyMatrices(this.base, this.local)
    this.batches.of(key).add(g, this.out, color)
  }
}
