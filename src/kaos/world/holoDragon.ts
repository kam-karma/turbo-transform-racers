/**
 * A procedural hologram dragon: a serpentine tube body (thick neck, tapering tail) with a
 * dorsal fin ridge, rebuilt every frame along any spine the caller gives (coiled round a
 * tower, or flying over the circuit), a horned head with glowing eyes and whiskers, optional
 * flapping wings, and a sparkle dust drawn from the body's own vertices.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { holoMaterial, type HoloMaterial } from './materials'

export interface DragonLook {
  readonly color: THREE.ColorRepresentation
  readonly color2: THREE.ColorRepresentation
  /** Body radius at its thickest, metres. */
  readonly radius: number
  readonly segments?: number
  readonly wings?: boolean
  readonly intensity?: number
}

const RADIAL = 10

/** Body radius along the spine (0 = head end). */
const thickness = (u: number): number => {
  const neck = Math.min(1, 0.55 + u * 6)
  return neck * (1 - u) ** 0.85 * (0.85 + 0.15 * Math.cos(u * 40))
}

function headGeometry(r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void => {
    const gg = g.index !== null ? g.toNonIndexed() : g
    gg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)))
    parts.push(gg)
  }
  // skull and snout (forward = +z)
  add(new THREE.SphereGeometry(r * 1.15, 14, 10), 0, r * 0.15, 0)
  add(new THREE.BoxGeometry(r * 1.4, r * 0.8, r * 2.2, 2, 2, 4), 0, r * 0.05, r * 1.4)
  add(new THREE.SphereGeometry(r * 0.55, 10, 8), 0, r * 0.2, r * 2.45)
  // lower jaw, open
  add(new THREE.BoxGeometry(r * 1.1, r * 0.3, r * 1.9), 0, -r * 0.55, r * 1.25, 0.32, 0, 0)
  // horns sweeping back
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(r * 0.22, r * 2.6, 8), s * r * 0.55, r * 1.15, -r * 0.8, -1.05, 0, s * 0.35)
    add(new THREE.ConeGeometry(r * 0.12, r * 1.2, 6), s * r * 0.75, r * 0.45, -r * 0.35, -1.3, 0, s * 0.9)
    // brow ridge
    add(new THREE.BoxGeometry(r * 0.25, r * 0.22, r * 0.9), s * r * 0.5, r * 0.62, r * 0.75, 0.25, s * 0.2, 0)
  }
  // whiskers
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(r * 0.05, r * 0.02, r * 3.2, 5), s * r * 0.9, -r * 0.05, r * 2.1, 1.1, 0, s * 1.1)
  // crest
  add(new THREE.ConeGeometry(r * 0.3, r * 1.3, 4), 0, r * 1.05, -r * 0.2, -0.6, 0, 0)
  return mergeGeometries(parts.map((p) => {
    for (const a of Object.keys(p.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') p.deleteAttribute(a)
    return p
  }), false)
}

function wingGeometry(r: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(r * 3, r * 4, r * 9, r * 3.5)
  s.lineTo(r * 7, r * 1.6)
  s.lineTo(r * 8, r * 0.2)
  s.lineTo(r * 5.5, r * 0.4)
  s.lineTo(r * 5.8, -r * 1.2)
  s.lineTo(r * 3.2, -r * 0.4)
  s.lineTo(r * 2.6, -r * 1.6)
  s.lineTo(0, -r * 0.8)
  const g = new THREE.ShapeGeometry(s, 6)
  g.rotateX(-Math.PI / 2)
  return g
}

export class HoloDragon {
  readonly group = new THREE.Group()
  readonly material: HoloMaterial
  readonly head: THREE.Mesh
  private readonly body: THREE.Mesh
  private readonly dust: THREE.Points
  private readonly geo: THREE.BufferGeometry
  private readonly pos: Float32Array
  private readonly wings: THREE.Mesh[] = []
  private readonly n: number
  private readonly spine: THREE.Vector3[]
  private readonly eyes: THREE.Mesh
  private readonly r: number

  constructor(look: DragonLook) {
    this.n = look.segments ?? 64
    this.r = look.radius
    this.material = holoMaterial(look.color, look.color2, look.intensity ?? 2.2, 46)
    this.spine = Array.from({ length: this.n }, () => new THREE.Vector3())
    const ringVerts = RADIAL + 1
    const vCount = this.n * ringVerts + this.n * 3
    this.pos = new Float32Array(vCount * 3)
    const uv = new Float32Array(vCount * 2)
    const idx: number[] = []
    for (let i = 0; i < this.n; i++) {
      for (let k = 0; k <= RADIAL; k++) {
        uv.set([i / (this.n - 1), k / RADIAL], (i * ringVerts + k) * 2)
        if (i > 0 && k < RADIAL) {
          const a = (i - 1) * ringVerts + k
          const b = i * ringVerts + k
          idx.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
    }
    const fin0 = this.n * ringVerts
    for (let i = 0; i < this.n; i++) {
      const v = fin0 + i * 3
      uv.set([i / (this.n - 1), 0, i / (this.n - 1), 1, (i + 0.5) / (this.n - 1), 0.5], v * 2)
      if (i % 2 === 0 && i > 2 && i < this.n - 3) idx.push(v, v + 1, v + 2)
    }
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geo.setIndex(idx)
    this.body = new THREE.Mesh(this.geo, this.material)
    this.body.frustumCulled = false
    const dustMat = new THREE.PointsMaterial({ color: new THREE.Color(look.color2).multiplyScalar(3), size: this.r * 0.16, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
    this.dust = new THREE.Points(this.geo, dustMat)
    this.dust.frustumCulled = false
    this.head = new THREE.Mesh(headGeometry(this.r * 1.25), this.material)
    this.head.frustumCulled = false
    this.eyes = new THREE.Mesh(new THREE.SphereGeometry(this.r * 0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.3, 0.9).multiplyScalar(5) }))
    for (const s of [-1, 1]) {
      const e = this.eyes.clone()
      e.position.set(s * this.r * 0.62, this.r * 0.55, this.r * 1.05)
      this.head.add(e)
    }
    this.group.add(this.body, this.dust, this.head)
    if (look.wings === true) {
      const wg = wingGeometry(this.r)
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(wg, this.material)
        w.scale.x = s
        w.frustumCulled = false
        this.wings.push(w)
        this.group.add(w)
      }
    }
  }

  /** Rebuilds the body along spine(u) for u in 0 (head) … 1 (tail tip). */
  setSpine(spine: (u: number, out: THREE.Vector3) => void, t: number): void {
    const n = this.n
    for (let i = 0; i < n; i++) spine(i / (n - 1), this.spine[i])
    const nor = this.geo.getAttribute('normal') as THREE.BufferAttribute
    const T = new THREE.Vector3()
    let N = new THREE.Vector3(0, 1, 0)
    const B = new THREE.Vector3()
    const tmp = new THREE.Vector3()
    const ringVerts = RADIAL + 1
    const fin0 = n * ringVerts
    const ups: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const a = this.spine[Math.max(0, i - 1)]
      const b = this.spine[Math.min(n - 1, i + 1)]
      T.subVectors(a, b).normalize()
      // parallel transport the normal so the body never twists
      N = tmp.copy(N).sub(T.clone().multiplyScalar(N.dot(T))).normalize().clone()
      if (!Number.isFinite(N.x) || N.lengthSq() < 0.5) N.set(0, 1, 0)
      B.crossVectors(T, N).normalize()
      ups.push(N.clone())
      const u = i / (n - 1)
      const rr = this.r * thickness(u) * (1 + 0.06 * Math.sin(t * 4 - u * 20))
      const c = this.spine[i]
      for (let k = 0; k <= RADIAL; k++) {
        const ang = (k / RADIAL) * Math.PI * 2
        const nx = N.x * Math.cos(ang) + B.x * Math.sin(ang)
        const ny = N.y * Math.cos(ang) + B.y * Math.sin(ang)
        const nz = N.z * Math.cos(ang) + B.z * Math.sin(ang)
        const v = i * ringVerts + k
        this.pos.set([c.x + nx * rr, c.y + ny * rr, c.z + nz * rr], v * 3)
        nor.setXYZ(v, nx, ny, nz)
      }
      const fin = this.r * 0.9 * thickness(u) + this.r * 0.15
      const f = fin0 + i * 3
      const ahead = this.spine[Math.min(n - 1, i + 1)]
      this.pos.set([c.x + N.x * rr, c.y + N.y * rr, c.z + N.z * rr, c.x + N.x * (rr + fin), c.y + N.y * (rr + fin), c.z + N.z * (rr + fin), ahead.x + N.x * rr, ahead.y + N.y * rr, ahead.z + N.z * rr], f * 3)
      for (let q = 0; q < 3; q++) nor.setXYZ(f + q, B.x, B.y, B.z)
    }
    ;(this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    nor.needsUpdate = true
    // head at the front, looking along the neck
    const h0 = this.spine[0]
    const h1 = this.spine[2]
    this.head.position.copy(h0)
    this.head.up.copy(ups[0])
    this.head.lookAt(tmp.copy(h0).multiplyScalar(2).sub(h1))
    if (this.wings.length > 0) {
      const w = this.spine[Math.floor(n * 0.18)]
      const flap = Math.sin(t * 3.2) * 0.55
      this.wings.forEach((m, k) => {
        m.position.copy(w)
        m.quaternion.copy(this.head.quaternion)
        m.rotateZ((k === 0 ? -1 : 1) * flap)
        m.rotateY(k === 0 ? 0.4 : -0.4)
      })
    }
  }

  update(t: number): void {
    this.material.uniforms.uTime.value = t
  }

  dispose(): void {
    this.geo.dispose()
    this.head.geometry.dispose()
    this.eyes.geometry.dispose()
    ;(this.eyes.material as THREE.Material).dispose()
    ;(this.dust.material as THREE.Material).dispose()
    this.wings[0]?.geometry.dispose()
    this.material.dispose()
  }
}
