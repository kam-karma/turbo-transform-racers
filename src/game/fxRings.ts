/**
 * Expanding glow rings: hoops that ride with the car (perfect switch, boost, finish) and flat
 * shock waves that stay where they were born (splash). A small fixed pool of quads; an idle
 * ring is invisible and costs no draw call.
 */
import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)
/** PlaneGeometry faces +Z. */
const FACING = new THREE.Vector3(0, 0, 1)
const tmp = new THREE.Vector3()

interface Ring {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  age: number
  delay: number
  life: number
  r0: number
  r1: number
  alpha: number
  /** true: centred on the car each frame and facing along its forward; false: flat on the world */
  follow: boolean
  ahead: number
  lift: number
}

export class RingPool {
  readonly group = new THREE.Group()
  private readonly rings: Ring[] = []
  private next = 0

  constructor(count: number, tex: THREE.Texture) {
    const geo = new THREE.PlaneGeometry(1, 1)
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      mesh.renderOrder = 12
      this.group.add(mesh)
      this.rings.push({ mesh, mat, age: 0, delay: 0, life: 1, r0: 1, r1: 2, alpha: 1, follow: false, ahead: 0, lift: 0 })
    }
  }

  /** Hoop around the car. Radii in metres; colour linear (may exceed 1 to bloom). */
  hoop(r: number, g: number, b: number, r0: number, r1: number, life: number, delay = 0, ahead = 0.6): void {
    const ring = this.take()
    this.init(ring, r, g, b, r0, r1, life, delay)
    ring.follow = true
    ring.ahead = ahead
    ring.lift = 0.6
  }

  /** Flat shock wave lying on the world at `at`. */
  wave(at: THREE.Vector3, r: number, g: number, b: number, r0: number, r1: number, life: number): void {
    const ring = this.take()
    this.init(ring, r, g, b, r0, r1, life, 0)
    ring.follow = false
    ring.mesh.position.copy(at)
    ring.mesh.quaternion.setFromUnitVectors(FACING, UP)
  }

  private take(): Ring {
    // Round robin: when all are busy the oldest one is reused, which is the least visible.
    const ring = this.rings[this.next]
    this.next = (this.next + 1) % this.rings.length
    return ring
  }

  private init(ring: Ring, r: number, g: number, b: number, r0: number, r1: number, life: number, delay: number): void {
    ring.mat.color.setRGB(r, g, b)
    ring.age = 0
    ring.delay = delay
    ring.life = life
    ring.r0 = r0
    ring.r1 = r1
    ring.alpha = 1
    ring.mesh.visible = false
  }

  update(dt: number, carPos: THREE.Vector3, carFwd: THREE.Vector3): void {
    for (const ring of this.rings) {
      if (ring.life <= 0) continue
      if (ring.delay > 0) {
        ring.delay -= dt
        continue
      }
      ring.age += dt
      const t = ring.age / ring.life
      if (t >= 1) {
        ring.life = 0
        ring.mesh.visible = false
        continue
      }
      ring.mesh.visible = true
      // Fast start, gentle settle: the ring "pops" out then drifts.
      const e = 1 - (1 - t) * (1 - t) * (1 - t)
      const rad = ring.r0 + (ring.r1 - ring.r0) * e
      ring.mesh.scale.set(rad * 2, rad * 2, 1)
      ring.mat.opacity = ring.alpha * (1 - t) * Math.min(1, t * 10)
      if (ring.follow) {
        ring.mesh.position.copy(carPos).addScaledVector(carFwd, ring.ahead).addScaledVector(UP, ring.lift)
        tmp.copy(ring.mesh.position).add(carFwd)
        ring.mesh.lookAt(tmp)
      }
    }
  }
}
