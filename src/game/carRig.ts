/**
 * The form parts of one car (meshes over the shared kit) and how they sit for a given
 * "openness" per form: 0 = folded away, 1 = deployed, > 1 = overshoot during the pop.
 */
import * as THREE from 'three'
import type { BodyFit, WheelRig } from './carBody'
import { PIVOT, makeTreadTexture, partsKit } from './carParts'

export interface Openness {
  boat: number
  glider: number
  climber: number
}

let treadTex: THREE.CanvasTexture | null = null

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

export class FormRig {
  readonly group = new THREE.Group()
  /** Per instance so the transform flash only lights this car. */
  readonly mat: THREE.MeshStandardMaterial
  readonly treadMat: THREE.MeshStandardMaterial
  private readonly hull: THREE.Mesh
  private readonly prop: THREE.Mesh
  private readonly wingL: THREE.Mesh
  private readonly wingR: THREE.Mesh
  private readonly tail: THREE.Mesh
  private readonly treads: THREE.Mesh
  private readonly claws: THREE.Mesh
  private readonly tex: THREE.Texture
  private readonly wheelY: number[]

  constructor(private readonly wheels: readonly WheelRig[], private readonly fit: BodyFit, shadows: boolean) {
    const kit = partsKit()
    treadTex ??= makeTreadTexture()
    // A clone shares the canvas upload but keeps its own scroll offset.
    this.tex = treadTex.clone()
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 })
    this.treadMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: this.tex, roughness: 0.7, side: THREE.DoubleSide })
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, at: THREE.Vector3 | null): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat)
      if (at !== null) m.position.copy(at)
      m.castShadow = shadows
      m.visible = false
      this.group.add(m)
      return m
    }
    this.hull = mesh(kit.hull, this.mat, null)
    this.prop = mesh(kit.prop, this.mat, PIVOT.prop)
    this.wingL = mesh(kit.wing, this.mat, PIVOT.wing)
    this.wingR = mesh(kit.wing, this.mat, new THREE.Vector3(-PIVOT.wing.x, PIVOT.wing.y, PIVOT.wing.z))
    this.tail = mesh(kit.tail, this.mat, PIVOT.tail)
    this.treads = mesh(kit.treads, this.treadMat, PIVOT.treads)
    this.claws = mesh(kit.claws, this.mat, PIVOT.claws)
    this.wheelY = wheels.map((w) => w.holder.position.y)
    // Fit the parts drawn for the rt40 onto this body: stretch along z, follow the roof line.
    const cz = fit.cz
    this.hull.position.z = cz
    this.prop.position.z = cz + PIVOT.prop.z * fit.fz
    this.wingL.position.z = this.wingR.position.z = cz + PIVOT.wing.z
    this.tail.position.set(0, fit.deckY, fit.deckZ)
    this.treads.position.z = cz + PIVOT.treads.z
    this.claws.position.z = fit.front - 0.24
  }

  /** Places every part for the given openness; `steer` turns the front wheels (rad). */
  apply(k: Openness, steer: number): void {
    const b = Math.max(0, k.boat)
    const g = Math.max(0, k.glider)
    const c = Math.max(0, k.climber)
    const tiny = 0.001

    this.hull.visible = b > 0.01
    this.hull.scale.set(0.7 + 0.3 * b, Math.max(tiny, b), (0.75 + 0.25 * b) * this.fit.fz)
    this.prop.visible = b > 0.01
    this.prop.scale.setScalar(Math.max(tiny, b))

    // Wings swing out from hanging along the doors; overshoot flaps them past level.
    const ws = Math.max(tiny, 0.2 + 0.8 * g)
    const fold = 1.75 * (1 - g)
    this.wingL.visible = this.wingR.visible = g > 0.01
    this.wingL.scale.set(ws, ws, ws)
    this.wingR.scale.set(-ws, ws, ws)
    this.wingL.rotation.z = 0.08 - fold
    this.wingR.rotation.z = -(0.08 - fold)
    this.tail.visible = g > 0.01
    this.tail.scale.set(0.5 + 0.5 * g, Math.max(tiny, g), 0.5 + 0.5 * g)

    // Treads grow out of the wheel line; claws swing down from over the bonnet.
    this.treads.visible = c > 0.01
    this.treads.scale.set(0.85 + 0.15 * c, Math.max(tiny, c), Math.max(tiny, 0.4 + 0.6 * c) * this.fit.fz)
    this.claws.visible = c > 0.01
    this.claws.scale.setScalar(Math.max(tiny, c))
    this.claws.rotation.x = 0.12 - 2.1 * (1 - c)

    const flat = clamp01(b)
    const ws2 = clamp01(1 - 0.45 * flat) * clamp01(1 - c * 1.2)
    this.wheels.forEach((w, i) => {
      w.holder.rotation.z = w.side * flat * (Math.PI / 2)
      w.holder.rotation.y = w.front ? steer * (1 - flat) : 0
      w.holder.position.y = this.wheelY[i] + 0.14 * flat
      w.holder.scale.setScalar(Math.max(tiny, ws2))
      w.holder.visible = ws2 > 0.02
    })
  }

  /** Rolls wheels, treads and the propeller for this frame. */
  spin(dt: number, speed: number, k: Openness, wheelR: number, cleatPeriod: number): void {
    const roll = (speed / wheelR) * dt * (1 - clamp01(k.boat))
    for (const w of this.wheels) w.spinner.rotation.x = (w.spinner.rotation.x + roll) % (Math.PI * 2)
    if (this.treads.visible) this.tex.offset.x = (this.tex.offset.x + (speed * dt) / cleatPeriod) % 1
    if (this.prop.visible) this.prop.rotation.z = (this.prop.rotation.z + Math.min(45, 12 + speed * 1.2) * dt) % (Math.PI * 2)
  }

  setFlash(color: THREE.Color, intensity: number): void {
    this.mat.emissive.copy(color)
    this.mat.emissiveIntensity = intensity
    this.treadMat.emissive.copy(color)
    this.treadMat.emissiveIntensity = intensity
  }
}
