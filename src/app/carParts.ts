/**
 * Garage parts modelled in Blender (tools/blender/make_parts.py → public/models/parts/*.glb):
 * spoilers and rims, fitted with the per-car data in public/models/car-fit.json. A car's own
 * wing (mesh 'stock_spoiler', split out in Blender) is hidden while a spoiler mod is on.
 *
 * Loads are cached; every placed part clones its materials so it can be tinted, while the
 * geometry stays shared (marked `sharedPart`, never disposed by the car look).
 */
import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { fitFor, rimPlacements, spoilerMount, type Box3Like, type CarFits } from './carFit'

const parts = new Map<string, Promise<THREE.Object3D | null>>()
let loader: GLTFLoader | null = null

/** GLTF loader for the Blender parts (Draco-compressed). */
export function partsLoader(): GLTFLoader {
  loader ??= new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('./draco/'))
  return loader
}
let fitsP: Promise<CarFits> | null = null

export function loadFits(): Promise<CarFits> {
  fitsP ??= fetch('./models/car-fit.json')
    .then((r) => (r.ok ? (r.json() as Promise<CarFits>) : {}))
    .catch((error: unknown) => {
      console.warn('Car fit data could not load:', error)
      fitsP = null
      return {}
    })
  return fitsP
}

function loadPart(name: string): Promise<THREE.Object3D | null> {
  let p = parts.get(name)
  if (p === undefined) {
    p = partsLoader()
      .loadAsync(`./models/parts/${name}.glb`)
      .then((g) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) m.geometry.userData.sharedPart = true
        })
        return g.scene
      })
      .catch((error: unknown) => {
        console.warn(`Part ${name} could not load:`, error)
        parts.delete(name)
        return null
      })
    parts.set(name, p)
  }
  return p
}

export interface Tints {
  readonly paint: number
  readonly rim: number
  readonly tire: number
  readonly glow?: number
}

/** A placed copy of a part: own materials, tinted by material name. */
function instance(src: THREE.Object3D, tints: Tints): THREE.Object3D {
  const o = src.clone(true)
  o.traverse((c) => {
    c.userData.kupaAttachment = true
    const m = c as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    const own = (m.material as THREE.MeshStandardMaterial).clone()
    const key = own.name.replace(/\.\d+$/, '')
    if (key === 'paint') own.color.setHex(tints.paint)
    else if (key === 'rim') own.color.setHex(tints.rim)
    else if (key === 'tire') own.color.setHex(tints.tire)
    else if (key === 'glow' && tints.glow !== undefined) {
      own.color.setHex(tints.glow)
      own.emissive.setHex(tints.glow)
    }
    // The candy look: a touch of clearcoat-like sheen on painted parts.
    if (key === 'paint') {
      own.roughness = 0.26
      own.metalness = 0.12
    }
    m.material = own
  })
  return o
}

/** Box of the named stock part in root-local space, or null. */
function stockBox(root: THREE.Object3D): { box: Box3Like; obj: THREE.Object3D } | null {
  const obj = root.getObjectByName('stock_spoiler')
  if (obj === undefined) return null
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const b = new THREE.Box3()
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (m.geometry.boundingBox === null) m.geometry.computeBoundingBox()
    b.union(m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)))
  })
  return b.isEmpty() ? null : { box: b, obj }
}

export interface FittedPart {
  readonly obj: THREE.Object3D
  /** Undo side effects (the stock wing shows again). */
  restore(): void
}

/** The spoiler mod `spoiler-<id>` fitted to the car (replacing its own wing when it has one). */
export async function fitSpoiler(root: THREE.Object3D, carId: string, box: Box3Like, part: string, color: number, scale: number): Promise<FittedPart | null> {
  const [fits, src] = await Promise.all([loadFits(), loadPart(part)])
  const fit = fitFor(fits, carId)
  if (src === null || fit === null) return null
  const lip = part === 'spoiler-ordek'
  const stock = stockBox(root)
  const mount = spoilerMount(fit, box, stock?.box ?? null, lip)
  const o = instance(src, { paint: color, rim: color, tire: 0x1c1e26, glow: 0xff7a1a })
  const s = mount.span * Math.min(1.25, scale)
  o.scale.setScalar(s)
  // Posts stand a little forward of the very tail so the feet sit on the lid, not in the air.
  o.position.set(mount.x, mount.y - s * (lip ? 0.03 : 0.006), mount.z + (stock === null || lip ? s * (lip ? 0.1 : 0.06) : 0))
  if (stock !== null) stock.obj.visible = false
  return {
    obj: o,
    restore: () => {
      if (stock !== null) stock.obj.visible = true
    },
  }
}

/** Rims (and a fat tyre for size > 1.1) on every measured wheel. */
export async function fitWheels(carId: string, box: Box3Like, part: string, rim: number, tire: number, size: number): Promise<THREE.Object3D | null> {
  const style = part.replace(/^wheel-/, '')
  const [fits, src, tyre] = await Promise.all([loadFits(), loadPart(`rim-${style}`), size > 1.1 ? loadPart('tyre-fat') : Promise.resolve(null)])
  const fit = fitFor(fits, carId)
  if (src === null || fit === null) return null
  const g = new THREE.Group()
  for (const p of rimPlacements(fit, box)) {
    const r = instance(src, { paint: rim, rim, tire, glow: rim })
    r.scale.setScalar(p.radius * (size > 1.1 ? 1.08 : 1))
    r.position.set(p.x, p.y, p.z)
    if (p.side < 0) r.rotation.y = Math.PI
    g.add(r)
    if (tyre !== null) {
      const t = instance(tyre, { paint: tire, rim, tire })
      // tyre-fat's outer radius is ~1.04 model units; it wraps the stock tyre a bit bigger.
      t.scale.setScalar((p.wheelRadius * size) / 1.04)
      t.position.set(p.x - p.side * p.wheelRadius * 0.28, p.y, p.z)
      g.add(t)
    }
  }
  g.userData.kupaAttachment = true
  return g
}

/** Warm the part cache (garage open): first previews then appear without a pop-in. */
export function preloadParts(names: readonly string[]): void {
  void loadFits()
  for (const n of names) void loadPart(n)
}
