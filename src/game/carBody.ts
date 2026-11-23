/**
 * The car body a CarView wears: a clone of a loaded GLB (painted in the racer colour) or,
 * when the model failed to load, a chunky procedural cartoon car with the same proportions
 * and node names. Wheels are re-hung on holders so they can steer, spin and fold.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export interface WheelRig {
  /** At the wheel centre: steering (y) and folding (z, scale). */
  readonly holder: THREE.Group
  /** Rolls about x. */
  readonly spinner: THREE.Group
  readonly front: boolean
  /** +1 on the car's left (+X), -1 on the right. */
  readonly side: number
}

/** Where form parts go on this particular body (cars differ in length and roof line). */
export interface BodyFit {
  /** Body length / 3.6 m (the rt40 the parts were drawn for). */
  readonly fz: number
  /** Centre of the body along z. */
  readonly cz: number
  /** Front bumper z. */
  readonly front: number
  /** Top of the rear deck or roof where the tail fin stands, and its z. */
  readonly deckY: number
  readonly deckZ: number
}

export interface CarBody {
  readonly model: THREE.Object3D
  readonly paint: THREE.MeshStandardMaterial
  readonly wheels: readonly WheelRig[]
  readonly fit: BodyFit
}

const fits = new WeakMap<THREE.Object3D, BodyFit>()

function measure(model: THREE.Object3D): BodyFit {
  const paint = model.getObjectByName('body_paint') ?? model
  const pb = new THREE.Box3().setFromObject(paint)
  const deckZ = pb.min.z + 0.42
  const ray = new THREE.Raycaster(new THREE.Vector3(0, pb.max.y + 2, deckZ), new THREE.Vector3(0, -1, 0))
  const hit = ray.intersectObject(paint, true)[0]
  const len = pb.max.z - pb.min.z
  return {
    fz: Math.max(0.8, Math.min(1.45, len / 3.6)),
    cz: (pb.min.z + pb.max.z) / 2,
    front: pb.max.z,
    deckY: hit !== undefined ? hit.point.y - 0.04 : pb.min.y + 0.65 * (pb.max.y - pb.min.y),
    deckZ,
  }
}

const WHEEL_NAMES = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'] as const

export function makePaint(color: number): THREE.MeshStandardMaterial {
  // Double-sided: some source shells face inwards and culled panels would show the chassis.
  return new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.12, side: THREE.DoubleSide })
}

/** Builds this instance's body. The source model is cloned (geometry and materials shared). */
export function buildBody(src: THREE.Object3D | null, color: number, shadows: boolean): CarBody {
  const model = src !== null ? src.clone(true) : fallbackCar()
  const paint = makePaint(color)
  const paintMesh = model.getObjectByName('body_paint')
  if (paintMesh instanceof THREE.Mesh) paintMesh.material = paint
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = shadows
      o.receiveShadow = false
    }
  })
  model.updateMatrixWorld(true)
  // Some exports float a little: put the lowest point (tyres) on the ground.
  const box = new THREE.Box3().setFromObject(model)
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 0.02) model.position.y -= box.min.y
  model.updateMatrixWorld(true)

  const wheels: WheelRig[] = []
  for (const name of WHEEL_NAMES) {
    const w = model.getObjectByName(name)
    if (w === undefined || w.parent === null) continue
    const holder = new THREE.Group()
    const spinner = new THREE.Group()
    holder.rotation.order = 'YZX'
    holder.position.copy(w.position)
    w.parent.add(holder)
    holder.add(spinner)
    spinner.add(w)
    w.position.set(0, 0, 0)
    wheels.push({ holder, spinner, front: name[6] === 'F', side: name[7] === 'L' ? 1 : -1 })
  }
  const key = src ?? model
  let fit = fits.get(key)
  if (fit === undefined) {
    fit = measure(model)
    if (src !== null) fits.set(src, fit)
  }
  return { model, paint, wheels, fit }
}

// --- fallback cartoon car -------------------------------------------------------------

interface FallbackKit {
  readonly paint: THREE.BufferGeometry
  readonly glass: THREE.BufferGeometry
  readonly details: THREE.BufferGeometry
  readonly lampsF: THREE.BufferGeometry
  readonly lampsR: THREE.BufferGeometry
  readonly wheel: THREE.BufferGeometry
  readonly mats: { readonly glass: THREE.Material; readonly details: THREE.Material; readonly lampF: THREE.Material; readonly lampR: THREE.Material; readonly wheel: THREE.Material }
}

let fb: FallbackKit | null = null

function colored(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rz = 0): THREE.BufferGeometry {
  const g = geo.index !== null ? geo.toNonIndexed() : geo
  if (g.hasAttribute('uv')) g.deleteAttribute('uv')
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1)))
  const c = new THREE.Color(color)
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function fallbackKit(): FallbackKit {
  if (fb !== null) return fb
  const rb = (w: number, h: number, d: number, r: number): THREE.BufferGeometry => new RoundedBoxGeometry(w, h, d, 3, r)
  const W = 0xffffff
  const paint = mergeGeometries([
    colored(rb(1.78, 0.62, 3.5, 0.24), W, 0, 0.66, 0),
    colored(rb(1.46, 0.16, 1.66, 0.07), W, 0, 1.46, -0.3),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => colored(rb(0.4, 0.4, 1.0, 0.16), W, sx * 0.78, 0.62, sz * 1.0))),
  ])
  const dark = 0x2b2f3d
  const chrome = 0xc9ced9
  const details = mergeGeometries([
    colored(rb(1.86, 0.22, 0.3, 0.1), dark, 0, 0.42, 1.72),
    colored(rb(1.86, 0.22, 0.3, 0.1), dark, 0, 0.42, -1.72),
    colored(rb(0.9, 0.18, 0.08, 0.05), chrome, 0, 0.66, 1.76),
    ...[-0.35, 0.35].map((x) => colored(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10).rotateX(Math.PI / 2), chrome, x, 0.36, -1.88)),
    colored(rb(1.5, 0.08, 0.36, 0.03), dark, 0, 1.16, -1.62),
  ])
  const glass = new RoundedBoxGeometry(1.5, 0.44, 1.7, 2, 0.14).translate(0, 1.18, -0.3)
  const lamp = (x: number, z: number): THREE.BufferGeometry => colored(new THREE.SphereGeometry(0.14, 10, 6).scale(1, 1, 0.45), 0xffffff, x, 0.72, z)
  const lampsF = mergeGeometries([lamp(0.56, 1.75), lamp(-0.56, 1.75)])
  const lampsR = mergeGeometries([lamp(0.6, -1.75), lamp(-0.6, -1.75)])
  const wheel = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 16, 1), 0x24262f, 0, 0, 0, Math.PI / 2),
    colored(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 12, 1), 0xf1f3f7, 0, 0, 0, Math.PI / 2),
  ])
  const mats = {
    glass: new THREE.MeshStandardMaterial({ color: 0x23395e, roughness: 0.08, metalness: 0.4 }),
    details: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 }),
    lampF: new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff1b0, emissiveIntensity: 1.4 }),
    lampR: new THREE.MeshStandardMaterial({ color: 0xff3048, emissive: 0xff2040, emissiveIntensity: 1.6 }),
    wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
  }
  fb = { paint, glass, details, lampsF, lampsR, wheel, mats }
  return fb
}

/** Same node names and proportions as the GLB cars (nose +Z, ~1.8 × 3.6 m). */
function fallbackCar(): THREE.Object3D {
  const k = fallbackKit()
  const root = new THREE.Group()
  const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): void => {
    const m = new THREE.Mesh(geo, mat)
    m.name = name
    m.position.set(x, y, z)
    root.add(m)
  }
  // Placeholder material; buildBody swaps in the instance paint.
  add('body_paint', k.paint, k.mats.details)
  add('body_details', k.details, k.mats.details)
  add('glass', k.glass, k.mats.glass)
  add('lamps_front', k.lampsF, k.mats.lampF)
  add('lamps_rear', k.lampsR, k.mats.lampR)
  add('wheel_FL', k.wheel, k.mats.wheel, 0.7, 0.34, 1.0)
  add('wheel_FR', k.wheel, k.mats.wheel, -0.7, 0.34, 1.0)
  add('wheel_RL', k.wheel, k.mats.wheel, 0.7, 0.34, -1.0)
  add('wheel_RR', k.wheel, k.mats.wheel, -0.7, 0.34, -1.0)
  return root
}
