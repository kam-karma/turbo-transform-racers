/**
 * The procedural "Dev Balina": a chubby, glossy cartoon whale about 14 m long, nose towards
 * +Z, with big friendly eyes, a grin, rosy cheeks, flippers, a swishing tail and a water
 * spout. Used until (or instead of) a Tripo `whale.glb`.
 */
import * as THREE from 'three'
import { mergeKeep } from '../../game/islandsGeo'
import { tint } from '../../game/trackMeshKit'

export interface WhaleModel {
  readonly root: THREE.Group
  /** Pivot at the tail root; rotate about X to swish. */
  readonly tail: THREE.Object3D
  /** The water spout on the head; scale to make it pulse. */
  readonly spout: THREE.Object3D
  readonly materials: THREE.Material[]
}

const LEN = 7
const RAD = 3.3

/** Body radius (0..1 of RAD) at z (−1 tail … +1 nose). */
function bodyR(z: number): number {
  const pts: [number, number][] = [[-1, 0.16], [-0.78, 0.3], [-0.45, 0.64], [-0.05, 0.92], [0.35, 1.0], [0.66, 0.92], [0.86, 0.7], [0.97, 0.36], [1, 0.02]]
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, r0] = pts[i]
    const [z1, r1] = pts[i + 1]
    if (z <= z1) {
      const t = (z - z0) / (z1 - z0)
      return r0 + (r1 - r0) * (t * t * (3 - 2 * t))
    }
  }
  return 0
}

function body(): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = []
  for (let k = 0; k <= 24; k++) {
    const z = -1 + (2 * k) / 24
    prof.push(new THREE.Vector2(Math.max(0.01, bodyR(z) * RAD), z * LEN))
  }
  const g = new THREE.LatheGeometry(prof, 28)
  // Lathe runs along +Y: lay it along +Z, flatten the belly a little.
  g.rotateX(Math.PI / 2)
  g.scale(1, 0.88, 1)
  const top = new THREE.Color('#2f7fe6')
  const back = new THREE.Color('#1b4fb8')
  const belly = new THREE.Color('#d9f2ff')
  const p = g.getAttribute('position')
  const c = new Float32Array(p.count * 3)
  const k = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const z = p.getZ(i)
    const r = Math.max(0.01, bodyR(z / LEN) * RAD * 0.88)
    const h = y / r
    k.copy(back).lerp(top, THREE.MathUtils.smoothstep(h, 0.9, -0.1))
    // Pale belly with throat grooves towards the front.
    if (h < -0.28) {
      const groove = z > 0 && Math.sin(Math.atan2(p.getX(i), -y) * 22) > 0.55 ? 0.9 : 1
      k.copy(belly).multiplyScalar(groove)
    }
    c[i * 3] = k.r
    c[i * 3 + 1] = k.g
    c[i * 3 + 2] = k.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  g.deleteAttribute('uv')
  return g
}

function face(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  const zEye = 0.6 * LEN
  const rEye = bodyR(0.6) * RAD
  for (const sx of [1, -1]) {
    const ex = sx * rEye * 0.72
    const ey = rEye * 0.48 * 0.88
    const ez = zEye + 0.6
    out.push(tint(new THREE.SphereGeometry(0.95, 18, 14).scale(1, 1.15, 0.7).translate(ex, ey, ez), '#ffffff'))
    out.push(tint(new THREE.SphereGeometry(0.55, 14, 10).scale(1, 1.15, 0.6).translate(ex + sx * 0.08, ey - 0.05, ez + 0.5), '#101828'))
    out.push(tint(new THREE.SphereGeometry(0.18, 8, 6).translate(ex + sx * 0.18, ey + 0.32, ez + 0.82), '#ffffff'))
    // Brow and rosy cheek.
    out.push(tint(new THREE.CapsuleGeometry(0.16, 1.0, 3, 6).rotateZ(Math.PI / 2 - sx * 0.25).translate(ex, ey + 1.35, ez + 0.05), '#163f94'))
    out.push(tint(new THREE.SphereGeometry(0.75, 12, 8).scale(1, 0.6, 0.4).translate(sx * rEye * 0.6, -0.3, zEye + 1.6), '#ff8fb8'))
  }
  // A wide grin across the front.
  const smile = new THREE.TorusGeometry(2.3, 0.2, 6, 24, Math.PI * 0.8)
  smile.rotateZ(Math.PI + Math.PI * 0.1)
  smile.translate(0, 0.2, 0)
  smile.rotateX(-0.35)
  out.push(tint(smile.translate(0, -0.6, LEN * 0.92), '#5a1630'))
  return out
}

function flippers(): THREE.BufferGeometry[] {
  return [1, -1].map((sx) =>
    tint(new THREE.SphereGeometry(1, 14, 10).scale(2.2, 0.35, 1.1).rotateY(sx * 0.5).rotateZ(sx * -0.45).translate(sx * RAD * 0.95, -1.4, 1.4), '#2a6fd6'),
  )
}

function tailGeo(): THREE.BufferGeometry[] {
  const stem = tint(new THREE.CylinderGeometry(0.55, 0.9, 2.4, 12).rotateX(Math.PI / 2).translate(0, 0, -1.0), '#1f5cc4')
  const flukes = [1, -1].map((sx) => tint(new THREE.SphereGeometry(1, 16, 10).scale(2.4, 0.3, 1.2).rotateY(sx * -0.45).translate(sx * 1.9, 0, -2.6), '#2a74e0'))
  return [stem, ...flukes]
}

function spoutGeo(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [tint(new THREE.CylinderGeometry(0.35, 0.5, 3.2, 10, 1, true).translate(0, 1.6, 0), '#bfefff')]
  const puffs: [number, number, number, number][] = [[0, 3.6, 0, 0.9], [0.9, 3.3, 0.2, 0.7], [-0.9, 3.3, -0.1, 0.7], [0.4, 4.2, -0.3, 0.6], [-0.4, 4.1, 0.4, 0.6], [1.6, 2.6, 0, 0.5], [-1.6, 2.6, 0, 0.5]]
  for (const [x, y, z, r] of puffs) out.push(tint(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), '#e8fbff'))
  return out
}

const KEEP = ['position', 'normal', 'color']

export function buildWhaleModel(): WhaleModel {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0, envMapIntensity: 1.2 })
  const spoutMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, transparent: true, opacity: 0.85, emissive: '#5fd8ff', emissiveIntensity: 0.25 })
  const root = new THREE.Group()
  root.name = 'whale'
  const main = mergeKeep([body(), ...face(), ...flippers()], KEEP)
  if (main !== null) root.add(new THREE.Mesh(main, mat))
  const tail = new THREE.Group()
  tail.position.set(0, 0, -LEN * 0.9)
  const tg = mergeKeep(tailGeo(), KEEP)
  if (tg !== null) tail.add(new THREE.Mesh(tg, mat))
  root.add(tail)
  const spout = new THREE.Group()
  spout.position.set(0, RAD * 0.88 * 0.95, LEN * 0.25)
  const sg = mergeKeep(spoutGeo(), KEEP)
  if (sg !== null) spout.add(new THREE.Mesh(sg, spoutMat))
  root.add(spout)
  return { root, tail, spout, materials: [mat, spoutMat] }
}
