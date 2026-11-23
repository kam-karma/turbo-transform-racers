/**
 * Follow camera: behind and above the car, widening its field of view with speed and turbo,
 * pulling back in the air, with a decaying shake for hits and landings.
 */
import * as THREE from 'three'
import type { RacerState } from '../sim/racer'

const DIST = 7.2
const HEIGHT = 2.7
const AIR_DIST = 2.2
const BASE_FOV = 62
const MAX_FOV = 82

const tmp = new THREE.Vector3()
const look = new THREE.Vector3()
const upBlend = new THREE.Vector3()

export class ChaseCamera {
  private shakeAmt = 0
  private fov = BASE_FOV
  private extra = 0
  private snapped = false

  constructor(private readonly cam: THREE.PerspectiveCamera) {}

  get position(): THREE.Vector3 {
    return this.cam.position
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, amount))
  }

  /** Jump straight to the follow position (start, respawn). */
  snap(): void {
    this.snapped = false
  }

  update(pos: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3, st: RacerState, dt: number): void {
    this.extra += ((st.airborne ? AIR_DIST : 0) - this.extra) * Math.min(1, 3 * dt)
    upBlend.copy(up).lerp(THREE.Object3D.DEFAULT_UP, 0.6).normalize()
    tmp.copy(pos).addScaledVector(forward, -(DIST + this.extra)).addScaledVector(upBlend, HEIGHT + this.extra * 0.4)
    const k = this.snapped ? 1 - Math.exp(-9 * dt) : 1
    this.snapped = true
    this.cam.position.lerp(tmp, k)
    look.copy(pos).addScaledVector(forward, 7).addScaledVector(upBlend, 1.1)
    if (this.shakeAmt > 0.001) {
      const a = this.shakeAmt * 0.35
      this.cam.position.x += (Math.random() - 0.5) * a
      this.cam.position.y += (Math.random() - 0.5) * a
      this.shakeAmt *= Math.exp(-7 * dt)
    }
    this.cam.up.copy(upBlend)
    this.cam.lookAt(look)
    const target = Math.min(MAX_FOV, BASE_FOV + (st.speed / 42) * 10 + (st.turbo > 0 ? 7 : 0) + (st.boost > 0 ? 4 : 0))
    this.fov += (target - this.fov) * Math.min(1, 4 * dt)
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov
      this.cam.updateProjectionMatrix()
    }
  }
}
