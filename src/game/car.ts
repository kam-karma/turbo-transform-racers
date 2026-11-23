/**
 * A racer on screen: the painted car body plus procedural form parts, placed on the track
 * from a track-space pose and playing the 0.25 s transformation (squash & stretch pop,
 * parts unfolding with overshoot, a colour flash) whenever the form changes.
 */
import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { FormId, Surface } from '../sim/forms'
import { FX_AIR, FX_FLAME } from '../sim/ghost'
import type { Track } from '../sim/track'
import { buildBody } from './carBody'
import { makeLabel } from './carLabel'
import { FORM_COLOR, partsKit } from './carParts'
import { FormRig, type Openness } from './carRig'

export interface Pose { s: number; d: number; y: number; yaw: number; form: FormId; speed: number; fx: number; surface: Surface; formT: number }

/** Length of the transform as the simulation counts it. */
const T = 0.25
/** Squash-and-stretch settles a little after the parts are out. */
const WOBBLE_END = 0.42
const WHEEL_R = 0.34
const LABEL_Y = 2.55

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const smooth01 = (u: number): number => u * u * (3 - 2 * u)
const easeOutBack = (u: number): number => {
  const c1 = 2.2
  const c3 = c1 + 1
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2
}
const easeInQuad = (u: number): number => u * u
/** Frame-rate independent approach factor. */
const approach = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt)

const PART_FORMS = ['boat', 'glider', 'climber'] as const

interface Tween { from: number; to: number; delay: number; dur: number; out: boolean }

/** Body scale-y over the transform: squash, stretch, settle (piecewise keys, seconds). */
const SQUASH: readonly (readonly [number, number])[] = [[0, 1], [0.06, 0.72], [0.15, 1.22], [0.25, 0.93], [0.33, 1.04], [WOBBLE_END, 1]]

function squashAt(a: number): number {
  for (let i = 1; i < SQUASH.length; i++) {
    const [t1, v1] = SQUASH[i]
    if (a <= t1) {
      const [t0, v0] = SQUASH[i - 1]
      return v0 + (v1 - v0) * smooth01((a - t0) / (t1 - t0))
    }
  }
  return 1
}

let draco: DRACOLoader | null = null

/**
 * GLTF (+Draco) car; rejects when the file is missing or lacks the painted body.
 * `textured` models (Tripo exports: one mesh with its own colours) skip the paint check and
 * keep their textures.
 */
export async function loadCarModel(url: string, textured = false): Promise<THREE.Object3D> {
  draco ??= new DRACOLoader().setDecoderPath('./draco/')
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(url)
  if (!textured && gltf.scene.getObjectByName('body_paint') === undefined) throw new Error(`Car model ${url} has no "body_paint"`)
  return gltf.scene
}

const tmpX = new THREE.Vector3()
const tmpY = new THREE.Vector3()
const tmpZ = new THREE.Vector3()
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()

export class CarView {
  readonly root = new THREE.Group()
  /** Sink, float, pitch and roll on top of the track pose. */
  private readonly tilt = new THREE.Group()
  /** Squash & stretch and the transform hop; pivot on the ground. */
  private readonly body = new THREE.Group()
  private readonly rig: FormRig
  private readonly paint: THREE.MeshStandardMaterial
  private readonly label: THREE.Sprite | null
  private form: FormId = 'car'
  private readonly open: Openness = { boat: 0, glider: 0, climber: 0 }
  private readonly tweens: Partial<Record<keyof Openness, Tween>> = {}
  /** Seconds since the last transform started (Infinity when idle). */
  private animT = Infinity
  private readonly flashColor = new THREE.Color()
  private time = 0
  private placed = false
  private prevY = 0
  private prevYaw = 0
  private vy = 0
  private pitch = 0
  private roll = 0
  private steer = 0
  private sink = 0
  private float = 0
  private opacity = 1
  /** Materials this car owns (mutated in place) vs shared ones (swapped for clones to fade). */
  private readonly fadeSlots: { mesh: THREE.Mesh | THREE.Sprite; base: THREE.Material; clone: THREE.Material | null; own: boolean }[] = []
  private readonly baseOpacity = new Map<THREE.Material, { opacity: number; transparent: boolean }>()

  /** The car body alone (no transform parts): the garage look is applied to this. */
  readonly bodyModel: THREE.Object3D

  constructor(model: THREE.Object3D | null, color: number, opts: { label?: string; badge?: string; shadows?: boolean } = {}) {
    const shadows = opts.shadows ?? false
    const built = buildBody(model, color, shadows)
    this.paint = built.paint
    this.rig = new FormRig(built.wheels, built.fit, shadows)
    this.bodyModel = built.model
    this.body.add(built.model, this.rig.group)
    this.tilt.add(this.body)
    this.root.add(this.tilt)
    this.label = opts.label !== undefined ? makeLabel(opts.label, opts.badge ?? '🏁', color) : null
    if (this.label !== null) {
      this.label.position.y = LABEL_Y
      this.root.add(this.label)
    }
    const own = new Set<THREE.Material>([this.paint, this.rig.mat, this.rig.treadMat])
    if (this.label !== null) own.add(this.label.material)
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite) || Array.isArray(o.material)) return
      const base = o.material as THREE.Material
      this.fadeSlots.push({ mesh: o, base, clone: null, own: own.has(base) })
      this.baseOpacity.set(base, { opacity: base.opacity, transparent: base.transparent })
    })
    this.rig.apply(this.open, 0)
  }

  /** Live position of the car on the track (before sink / hop offsets); do not mutate. */
  /** Name tags crowd the screen when a ghost is right next to the player: hide them up close. */
  setLabelVisible(on: boolean): void {
    if (this.label !== null) this.label.visible = on
  }

  get worldPos(): THREE.Vector3 {
    return this.root.position
  }

  setForm(form: FormId, animate: boolean): void {
    if (form === this.form && this.placed) return
    this.form = form
    for (const key of PART_FORMS) {
      const target = key === form ? 1 : 0
      if (!animate) {
        this.open[key] = target
        delete this.tweens[key]
      } else if (target === 1) {
        this.tweens[key] = { from: this.open[key], to: 1, delay: 0.04, dur: T - 0.04, out: false }
      } else if (this.open[key] > 0) {
        this.tweens[key] = { from: this.open[key], to: 0, delay: 0, dur: 0.11, out: true }
      }
    }
    this.flashColor.set(FORM_COLOR[form])
    this.animT = animate ? 0 : Infinity
    if (!animate) this.rig.apply(this.open, this.steer)
  }

  update(pose: Pose, track: Track, dt: number): void {
    const h = Math.max(0, Math.min(dt, 0.1))
    this.time += h
    if (pose.form !== this.form) {
      this.setForm(pose.form, this.placed)
      // Line the animation up with the simulation's own transform clock.
      if (this.placed && pose.formT > 0 && pose.formT <= T) this.animT = T - pose.formT - h
    }
    this.place(pose, track, h)
    this.animate(h)
    this.attitude(pose, h)
    this.rig.apply(this.open, this.steer)
    this.rig.spin(h, pose.speed, this.open, WHEEL_R, partsKit().cleatPeriod)
    this.glow(pose)
  }

  /** Frees what this car owns: its own materials, fade clones and the name tag texture. */
  dispose(): void {
    this.root.removeFromParent()
    for (const slot of this.fadeSlots) {
      slot.clone?.dispose()
      if (slot.own) slot.base.dispose()
    }
    if (this.label !== null) {
      ;(this.label.material as THREE.SpriteMaterial).map?.dispose()
      this.label.material.dispose()
    }
  }

  setOpacity(a: number): void {
    const v = clamp(a, 0, 1)
    if (Math.abs(v - this.opacity) < 0.005) return
    const wasOpaque = this.opacity >= 0.999
    this.opacity = v
    const opaque = v >= 0.999
    for (const slot of this.fadeSlots) {
      const base = this.baseOpacity.get(slot.base) ?? { opacity: 1, transparent: false }
      if (slot.own) {
        slot.base.opacity = base.opacity * v
        slot.base.transparent = opaque ? base.transparent : true
        if (wasOpaque !== opaque) slot.base.needsUpdate = true
        continue
      }
      // Shared materials are cloned on the first fade so other cars stay solid.
      if (opaque) {
        slot.mesh.material = slot.base
        continue
      }
      slot.clone ??= slot.base.clone()
      slot.clone.opacity = base.opacity * v
      slot.clone.transparent = true
      slot.mesh.material = slot.clone
    }
  }

  private place(pose: Pose, track: Track, h: number): void {
    const f = track.frameAt(pose.s)
    const p = track.toWorld(pose.s, pose.d, pose.y)
    const c = Math.cos(pose.yaw)
    const s = Math.sin(pose.yaw)
    tmpZ.set(f.t.x * c + f.left.x * s, f.t.y * c + f.left.y * s, f.t.z * c + f.left.z * s).normalize()
    tmpY.set(f.up.x, f.up.y, f.up.z)
    tmpX.crossVectors(tmpY, tmpZ).normalize()
    tmpY.crossVectors(tmpZ, tmpX)
    tmpQ.setFromRotationMatrix(tmpM.makeBasis(tmpX, tmpY, tmpZ))
    const jump = this.root.position.distanceToSquared(tmpX.set(p.x, p.y, p.z)) > 15 * 15
    if (!this.placed || jump) {
      this.root.quaternion.copy(tmpQ)
      this.prevY = pose.y
      this.prevYaw = pose.yaw
      this.vy = 0
    } else {
      // Frames are 1 m apart; a short slerp hides their tiny kinks without visible lag.
      this.root.quaternion.slerp(tmpQ, approach(22, h))
    }
    this.root.position.set(p.x, p.y, p.z)
    this.placed = true
  }

  /** Advances the per-form tweens and the body pop of the transform. */
  private animate(h: number): void {
    if (this.animT === Infinity) return
    this.animT += h
    const a = Math.max(0, this.animT)
    for (const key of PART_FORMS) {
      const tw = this.tweens[key]
      if (tw === undefined) continue
      const u = clamp((a - tw.delay) / tw.dur, 0, 1)
      const e = tw.out ? easeInQuad(u) : easeOutBack(u)
      this.open[key] = tw.from + (tw.to - tw.from) * e
      if (u >= 1) {
        this.open[key] = tw.to
        delete this.tweens[key]
      }
    }
    const sy = squashAt(a)
    const sxz = 1 / Math.sqrt(sy)
    this.body.scale.set(sxz, sy, sxz)
    const hop = clamp((a - 0.04) / (T - 0.02), 0, 1)
    this.body.position.y = 0.42 * Math.sin(Math.PI * hop)
    // A quick wiggle about the vertical sells "something clicked into place".
    this.body.rotation.y = 0.16 * Math.sin(Math.PI * 2 * clamp(a / 0.3, 0, 1)) * (1 - clamp(a / 0.3, 0, 1))
    const fl = clamp(1 - a / (T + 0.05), 0, 1)
    this.rig.setFlash(this.flashColor, 3.2 * fl * fl)
    if (a >= WOBBLE_END) {
      this.animT = Infinity
      this.body.scale.set(1, 1, 1)
      this.body.position.y = 0
      this.body.rotation.y = 0
      this.rig.setFlash(this.flashColor, 0)
    }
  }

  /** Pitch, roll, sinking and floating from how the pose moves and what it is on. */
  private attitude(pose: Pose, h: number): void {
    if (h > 0) {
      this.vy += ((pose.y - this.prevY) / h - this.vy) * approach(10, h)
      const yawRate = (pose.yaw - this.prevYaw) / h
      this.steer += (clamp(pose.yaw * 1.1 + yawRate * 0.12, -0.5, 0.5) - this.steer) * approach(10, h)
    }
    this.prevY = pose.y
    this.prevYaw = pose.yaw
    const air = pose.y > 0.08 || (pose.fx & FX_AIR) !== 0
    const onWater = pose.surface === 'water' && pose.y < 0.4
    this.sink += ((onWater && pose.form !== 'boat' ? 1 : 0) - this.sink) * approach(6, h)
    this.float += ((onWater && pose.form === 'boat' ? 1 : 0) - this.float) * approach(8, h)
    const glide = clamp(this.open.glider, 0, 1)
    const pitchTarget = (air ? clamp(-this.vy * 0.025, -0.3, 0.3) : 0) + 0.14 * this.sink - this.float * (0.03 + 0.06 * clamp(pose.speed / 40, 0, 1))
    // Cars lean out of a turn; the glider banks into it.
    const rollTarget = pose.yaw * (0.1 * (1 - glide) - 0.85 * glide)
    this.pitch += (pitchTarget - this.pitch) * approach(7, h)
    this.roll += (rollTarget - this.roll) * approach(5, h)
    const bob = Math.sin(this.time * 5.5) * 0.035 * this.float
    this.tilt.position.y = -0.5 * this.sink - 0.3 * this.float + bob + 0.1 * clamp(this.open.climber, 0, 1)
    this.tilt.rotation.set(this.pitch, 0, this.roll + Math.sin(this.time * 3.7) * 0.03 * this.float)
  }

  /** Transform flash on the paint, else the combo flame glow. */
  private glow(pose: Pose): void {
    const p = this.paint
    if (this.animT !== Infinity) {
      const fl = clamp(1 - this.animT / (T + 0.05), 0, 1)
      p.emissive.copy(this.flashColor)
      p.emissiveIntensity = 0.75 * fl * fl
    } else if ((pose.fx & FX_FLAME) !== 0) {
      p.emissive.setHex(0xff5a1f)
      p.emissiveIntensity = 0.28 + 0.14 * Math.sin(this.time * 14)
    } else {
      p.emissiveIntensity = 0
    }
  }
}
