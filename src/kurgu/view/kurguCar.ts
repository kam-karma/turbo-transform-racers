/**
 * A Kurgu racer on screen: the shared CarView (body, paint, fade, name tag) with the toy
 * parts clicked onto it. A new part pops on with a squash-and-overshoot "klak"; a knocked-off
 * part tumbles away into the room. On the player's car the spool/float wheels roll and the
 * propeller spins; the rocket burns while boosting. The detour lane offset and the lift of
 * big wheels are applied on top of the track pose.
 */
import * as THREE from 'three'
import { CarView, type Pose } from '../../game/car'
import type { Track } from '../../sim/track'
import type { SlotView } from '../sim/kurguGhost'
import { SLOTS, type PartId, type Slot } from '../sim/parts'
import { PROP_HUB, WHEEL_LIFT, WHEEL_SPOTS, WHEEL_Y, partGeometry, propBladesGeometry, propMastGeometry, wheelGeometry } from './partMeshes'

const REF_LEN = 3.3
const REF_W = 1.75
const POP_S = 0.34
const easeOutBack = (u: number): number => 1 + 3.2 * (u - 1) ** 3 + 2.2 * (u - 1) ** 2

interface Mount { id: PartId; shiny: boolean; root: THREE.Group; t: number; spin: THREE.Object3D[] }
interface Flyer { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; t: number }

export interface PartAssets {
  readonly mat: THREE.Material
  readonly shinyMat: THREE.Material
  readonly flameMat: THREE.Material
  readonly flameGeo: THREE.BufferGeometry
}

export function createPartAssets(): PartAssets {
  const flameGeo = new THREE.ConeGeometry(0.32, 1.4, 12)
  flameGeo.rotateX(-Math.PI / 2)
  flameGeo.translate(0, 0, -0.7)
  return {
    mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, envMapIntensity: 1.1 }),
    shinyMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.55, color: 0xffe08a, emissive: 0x7a4a00, emissiveIntensity: 0.5, envMapIntensity: 1.6 }),
    flameMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    flameGeo,
  }
}

export class KurguCar {
  readonly view: CarView
  private readonly mountAt: THREE.Object3D
  private readonly mounts: Record<Slot, Mount | null> = { front: null, side: null, back: null, wheels: null }
  private readonly flyers: Flyer[] = []
  private readonly scale: THREE.Vector3
  private readonly flame: THREE.Mesh
  private offset = new THREE.Vector3()
  private lift = 0
  private wheelRoll = 0

  constructor(model: THREE.Object3D | null, color: number, private readonly assets: PartAssets, private readonly scene: THREE.Object3D, opts: { label?: string; badge?: string; shadows?: boolean; rolling?: boolean } = {}) {
    this.view = new CarView(model, color, opts)
    this.rolling = opts.rolling ?? false
    // Parts ride on the tilt group so they pitch and roll with the body.
    this.mountAt = this.view.root.children[0] ?? this.view.root
    const box = new THREE.Box3().setFromObject(this.view.root)
    const size = box.getSize(new THREE.Vector3())
    const len = size.z > 0.5 ? size.z : REF_LEN
    const wid = size.x > 0.5 ? Math.min(size.x, len * 0.7) : REF_W
    this.scale = new THREE.Vector3(wid / REF_W, Math.max(0.8, len / REF_LEN), len / REF_LEN)
    this.flame = new THREE.Mesh(assets.flameGeo, assets.flameMat)
    this.flame.visible = false
    this.flame.position.set(0, 1.36 * this.scale.y, -1.92 * this.scale.z)
    this.mountAt.add(this.flame)
  }

  private readonly rolling: boolean

  get root(): THREE.Group {
    return this.view.root
  }

  get worldPos(): THREE.Vector3 {
    return this.view.worldPos
  }

  /** Sync the parts with what the racer wears; changes pop on or fly off. */
  setParts(slots: SlotView, animate: boolean): void {
    for (const slot of SLOTS) {
      const want = slots[slot]
      const have = this.mounts[slot]
      if (want?.id === have?.id && want?.shiny === have?.shiny) continue
      if (have !== null) this.drop(slot, animate)
      if (want !== null) this.mount(slot, want.id, want.shiny, animate)
    }
    const w = this.mounts.wheels?.id
    this.lift = w === 'bigwheel' ? WHEEL_LIFT.bigwheel : w === 'float' ? WHEEL_LIFT.float : w === 'treads' ? WHEEL_LIFT.treads : 0
  }

  private mount(slot: Slot, id: PartId, shiny: boolean, animate: boolean): void {
    const root = new THREE.Group()
    root.scale.copy(this.scale)
    const mat = shiny ? this.assets.shinyMat : this.assets.mat
    const spin: THREE.Object3D[] = []
    if (this.rolling && (id === 'bigwheel' || id === 'float')) {
      const g = wheelGeometry(id)
      for (const [x, z] of WHEEL_SPOTS) {
        const m = new THREE.Mesh(g, mat)
        m.position.set(x * (id === 'bigwheel' ? 1.08 : 1.05), WHEEL_Y[id], z)
        root.add(m)
        spin.push(m)
      }
    } else if (this.rolling && id === 'propeller') {
      root.add(new THREE.Mesh(propMastGeometry(), mat))
      const blades = new THREE.Mesh(propBladesGeometry(), mat)
      blades.position.set(PROP_HUB[0], PROP_HUB[1], PROP_HUB[2])
      root.add(blades)
      spin.push(blades)
    } else {
      root.add(new THREE.Mesh(partGeometry(id), mat))
    }
    root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true })
    this.mountAt.add(root)
    this.mounts[slot] = { id, shiny, root, t: animate ? 0 : POP_S, spin }
    if (animate) root.scale.set(0.01, 0.01, 0.01)
  }

  private drop(slot: Slot, animate: boolean): void {
    const m = this.mounts[slot]
    if (m === null) return
    this.mounts[slot] = null
    if (!animate) {
      m.root.removeFromParent()
      return
    }
    // Reparent into the scene where it is now, then let it tumble.
    m.root.updateWorldMatrix(true, false)
    this.scene.attach(m.root)
    const vel = new THREE.Vector3((Math.random() - 0.5) * 10, 9 + Math.random() * 5, (Math.random() - 0.5) * 10)
    this.flyers.push({ obj: m.root, vel, spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), t: 0 })
  }

  update(pose: Pose, track: Track, dt: number, offset: THREE.Vector3 | null, burning: boolean): void {
    // CarView compares with its last position to detect teleports: hand it the plain pose.
    this.view.root.position.sub(this.offset)
    this.view.update(pose, track, dt)
    this.offset.set(0, this.lift, 0)
    if (offset !== null) this.offset.add(offset)
    this.view.root.position.add(this.offset)
    for (const slot of SLOTS) {
      const m = this.mounts[slot]
      if (m === null) continue
      if (m.t < POP_S) {
        m.t += dt
        const k = Math.max(0.01, easeOutBack(Math.min(1, m.t / POP_S)))
        m.root.scale.copy(this.scale).multiplyScalar(k)
      }
    }
    this.wheelRoll += (pose.speed * dt) / 0.6
    const wheels = this.mounts.wheels
    if (wheels !== null) for (const w of wheels.spin) w.rotation.x = this.wheelRoll
    const back = this.mounts.back
    if (back !== null) for (const b of back.spin) b.rotation.z += dt * (6 + pose.speed * 0.6)
    this.flame.visible = burning && back?.id === 'rocket'
    if (this.flame.visible) this.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6)
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i]
      f.t += dt
      f.vel.y -= 28 * dt
      f.obj.position.addScaledVector(f.vel, dt)
      f.obj.rotation.x += f.spin.x * dt
      f.obj.rotation.y += f.spin.y * dt
      f.obj.rotation.z += f.spin.z * dt
      if (f.t > 1.2) {
        f.obj.removeFromParent()
        this.flyers.splice(i, 1)
      }
    }
  }

  /** Far rivals skip their parts (one draw call each). */
  setPartsVisible(on: boolean): void {
    for (const slot of SLOTS) {
      const m = this.mounts[slot]
      if (m !== null) m.root.visible = on
    }
  }

  setOpacity(a: number): void {
    this.view.setOpacity(a)
  }

  setLabelVisible(on: boolean): void {
    this.view.setLabelVisible(on)
  }

  dispose(): void {
    for (const f of this.flyers) f.obj.removeFromParent()
    for (const slot of SLOTS) this.mounts[slot]?.root.removeFromParent()
    this.view.dispose()
  }
}
