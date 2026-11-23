/**
 * Big hero props made in Tripo3D (one textured mesh per GLB), scattered as instances beside
 * the track: every copy of one model is a single draw call. Models that are not there yet
 * are skipped quietly (the procedural hero islands already fill the world).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { placeLandmarks, type LandmarkOptions } from '../sim/landmarks'
import type { ThemeId, Track } from '../sim/track'

export interface PropSpec {
  readonly url: string
  readonly theme: ThemeId
  readonly options: LandmarkOptions
}

/** The Tripo landmark islands of Uçan Adalar (island-candy exists; the rest may arrive). */
export const ADALAR_PROPS: readonly PropSpec[] = [
  { url: './models/island-candy.glb', theme: 'candy', options: { count: 10, minSize: 26, maxSize: 70, seed: 11 } },
  { url: './models/island-ice.glb', theme: 'ice', options: { count: 8, minSize: 28, maxSize: 70, seed: 12 } },
  { url: './models/island-volcano.glb', theme: 'volcano', options: { count: 6, minSize: 34, maxSize: 80, seed: 13 } },
  { url: './models/island-water.glb', theme: 'water', options: { count: 8, minSize: 26, maxSize: 66, seed: 14 } },
]

/**
 * True when the URL serves a binary model. Dev servers answer missing files with the HTML
 * page, so the content type is checked as well as the status.
 */
export async function modelExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    const type = r.headers.get('content-type') ?? ''
    return r.ok && !type.includes('text/html')
  } catch {
    return false
  }
}

/** The first mesh of a GLB, with its geometry normalised so height 1 sits on y = 0. */
export async function loadSingleMesh(url: string): Promise<THREE.Mesh> {
  const gltf = await new GLTFLoader().loadAsync(url)
  let mesh: THREE.Mesh | null = null
  gltf.scene.traverse((o) => {
    if (mesh === null && o instanceof THREE.Mesh) mesh = o
  })
  if (mesh === null) throw new Error(`${url} has no mesh`)
  const m = mesh as THREE.Mesh
  const geo = m.geometry.clone()
  geo.computeBoundingBox()
  const box = geo.boundingBox as THREE.Box3
  const h = box.max.y - box.min.y || 1
  geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
  geo.scale(1 / h, 1 / h, 1 / h)
  return new THREE.Mesh(geo, m.material)
}

/** Loads a model only if it exists; null (and no console noise) otherwise. */
export async function tryLoadMesh(url: string): Promise<THREE.Mesh | null> {
  if (!(await modelExists(url))) return null
  try {
    return await loadSingleMesh(url)
  } catch (error) {
    console.warn(`Model ${url} could not load:`, error)
    return null
  }
}

/** Loads each prop and returns one group of instanced meshes; missing models are skipped. */
export async function buildTripoProps(track: Track, specs: readonly PropSpec[], decor: number): Promise<THREE.Group> {
  const group = new THREE.Group()
  group.name = 'tripoProps'
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const loaded = await Promise.all(specs.map(async (spec) => ({ spec, src: await tryLoadMesh(spec.url) })))
  for (const { spec, src } of loaded) {
    if (src === null) continue
    const spots = placeLandmarks(track, spec.theme, { ...spec.options, count: Math.max(1, Math.floor(spec.options.count * decor * decor)) })
    if (spots.length === 0) continue
    const inst = new THREE.InstancedMesh(src.geometry, src.material, spots.length)
    spots.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw)
      m4.compose(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), q, new THREE.Vector3(p.size, p.size, p.size))
      inst.setMatrixAt(i, m4)
    })
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    inst.name = spec.url
    group.add(inst)
  }
  return group
}
