/**
 * Shared race assets: car models (loaded once, cloned per use), the shipped ghosts per track,
 * and scene disposal. Missing files never break a race: callers get null / [] and fall back.
 */
import * as THREE from 'three'
import { loadCarModel } from '../game/car'
import { modelExists } from '../game/tripoProps'
import { decodeGhost, type Ghost } from '../sim/ghost'

/** Player car length in metres; Tripo exports are normalised to about 1 m, nose towards +Z. */
export const CAR_LENGTH = 3.3

const models = new Map<string, Promise<THREE.Object3D | null>>()

/** Geometries, materials and textures owned by the model cache: clones share them, so a race never frees them. */
const shared = new Set<unknown>()

export function markShared(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry !== undefined) shared.add(m.geometry)
    const mats = m.material === undefined ? [] : Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      shared.add(mat)
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) shared.add(v)
    }
  })
}

/** Loads a model once (textured = keep the Tripo texture instead of the toon body paint). */
export function loadModel(url: string, textured = false): Promise<THREE.Object3D | null> {
  const key = `${url}|${textured}`
  let p = models.get(key)
  if (p === undefined) {
    p = (async () => {
      if (!(await modelExists(url))) return null
      const m = await loadCarModel(url, textured)
      markShared(m)
      return m
    })().catch((error: unknown) => {
      console.warn(`Model ${url} could not load:`, error)
      models.delete(key)
      return null
    })
    models.set(key, p)
  }
  return p
}

/** A fresh deep clone (materials stay shared; the car look clones what it recolours). */
export async function cloneModel(url: string, textured = false): Promise<THREE.Object3D | null> {
  const m = await loadModel(url, textured)
  return m === null ? null : m.clone(true)
}

/** Scales a ~1 m Tripo car to race size inside a wrapper, so CarView keeps its own transforms. */
export function raceSized(model: THREE.Object3D | null, length = CAR_LENGTH): THREE.Object3D | null {
  if (model === null) return null
  const box = new THREE.Box3().setFromObject(model)
  const len = box.max.z - box.min.z
  if (!(len > 0)) return null
  model.scale.multiplyScalar(length / len)
  const wrap = new THREE.Group()
  wrap.add(model)
  return wrap
}

/** The low-poly rival cars (Kupa Pilotları) by ghost car id. */
export const RIVAL_CARS = ['rt40', 'r40', 'r245'] as const

/** Synchronous rival model lookup for modes (null until preloaded or when missing). */
export function rivalModel(car: string): THREE.Object3D | null {
  const cached = rivalCache.get(car)
  return cached === undefined || cached === null ? null : cached.clone(true)
}

const rivalCache = new Map<string, THREE.Object3D | null>()

export async function warmRivals(): Promise<void> {
  await Promise.all(RIVAL_CARS.map(async (c) => rivalCache.set(c, await loadModel(`./models/${c}_lod.glb`))))
}

const ghostCache = new Map<string, Promise<Ghost[]>>()

/** The Kupa Pilotları ghosts of one track id (variants have their own ids, e.g. adalar2-reverse). */
export function loadGhosts(trackId: string): Promise<Ghost[]> {
  let p = ghostCache.get(trackId)
  if (p === undefined) {
    p = (async () => {
      const res = await fetch(`./ghosts/${trackId}.json`)
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return []
      const list = (await res.json()) as unknown[]
      return list.map((g) => decodeGhost(JSON.stringify(g)))
    })().catch((error: unknown) => {
      console.warn(`Ghosts for ${trackId} could not load:`, error)
      ghostCache.delete(trackId)
      return []
    })
    ghostCache.set(trackId, p)
  }
  return p
}

/** Frees every geometry, material and texture under a scene (a finished race). */
export function disposeScene(scene: THREE.Object3D): void {
  const seen = new Set<unknown>(shared)
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry !== undefined && !seen.has(m.geometry)) {
      seen.add(m.geometry)
      m.geometry.dispose()
    }
    const mats = m.material === undefined ? [] : Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      if (seen.has(mat)) continue
      seen.add(mat)
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !seen.has(v)) {
        seen.add(v)
        v.dispose()
      }
      mat.dispose()
    }
  })
  scene.clear()
}
