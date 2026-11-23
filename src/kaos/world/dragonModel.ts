/**
 * The Tripo dragon (public/models/dragon.glb, nose +Z) dressed for Neon Şehir: its own PBR
 * texture with a glowing hologram shell on top (fresnel rim + scanlines, additive), scaled
 * to a given length. Loaded once; null when the file is missing (callers fall back to the
 * procedural HoloDragon).
 */
import * as THREE from 'three'
import { tryLoadMesh } from '../../game/tripoProps'
import { holoMaterial, type HoloMaterial } from './materials'

let cached: Promise<THREE.Mesh | null> | null = null

export function loadDragonMesh(): Promise<THREE.Mesh | null> {
  cached ??= tryLoadMesh('./models/dragon.glb')
  return cached
}

export interface DragonModel {
  /** Pivot at the body's centre; +Z = nose. */
  readonly group: THREE.Group
  readonly shell: HoloMaterial
  /** Nose offset from the pivot (local +Z, metres). */
  readonly nose: number
  /** Top of the model above the pivot (metres). */
  readonly top: number
  dispose(): void
}

/** A dragon `length` metres nose to tail, with its hologram shell. */
export function dressDragon(src: THREE.Mesh, length: number, color: number, color2: number, glow = 1.4, withShell = true): DragonModel {
  const geo = src.geometry
  geo.computeBoundingBox()
  const box = geo.boundingBox as THREE.Box3
  const size = box.getSize(new THREE.Vector3())
  const k = length / Math.max(size.z, size.x, 1e-3)
  const centre = box.getCenter(new THREE.Vector3())
  const body = new THREE.Mesh(geo, src.material)
  body.position.set(-centre.x * k, -centre.y * k, -centre.z * k)
  body.scale.setScalar(k)
  const mat = body.material as THREE.MeshStandardMaterial
  if (mat.isMeshStandardMaterial === true) {
    // keep the painted look but let the neon colours glow a little at night
    const m = mat.clone()
    m.emissive = new THREE.Color(1, 1, 1)
    m.emissiveMap = m.map
    m.emissiveIntensity = 0.55
    body.material = m
  }
  const shell = holoMaterial(color, color2, glow, 60)
  shell.uniforms.uAlpha.value = 0.55
  const over = new THREE.Mesh(geo, shell)
  over.position.copy(body.position).multiplyScalar(1.015)
  over.scale.setScalar(k * 1.015)
  const group = new THREE.Group()
  group.add(body)
  if (withShell) group.add(over)
  for (const m of [body, over]) m.frustumCulled = false
  return {
    group, shell, nose: (box.max.z - centre.z) * k, top: (box.max.y - centre.y) * k,
    dispose() {
      ;(body.material as THREE.Material).dispose()
      shell.dispose()
    },
  }
}
