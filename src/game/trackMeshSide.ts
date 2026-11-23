/**
 * Assembles the trackside layer (gates, arches, rings, roadside props, signs, decals) into
 * merged meshes per 500 m chunk and per material, and shows only the chunks near the
 * player: the far ones would be a few fogged pixels but cost triangles and draw calls.
 */
import * as THREE from 'three'
import { planTrackside, type TracksidePlan } from '../sim/landmarksTrackside'
import type { Track } from '../sim/track'
import { mergeKeep } from './islandsGeo'
import { flowMaterial } from './islandsFlow'
import { glowMaterial, toonMaterial } from './islandsMaterial'
import { atlasMaterial } from './trackMeshAtlas'
import { buildGates, type BalloonSpot } from './trackMeshGates'
import { KEEP, newBuckets, type Buckets } from './trackMeshKit'
import { buildRoadside } from './trackMeshRoadside'

const CHUNK = 500
/** Chunks whose bounding sphere comes within this distance of the player are drawn. */
const VIEW = 950
const VIEW_LOW = 480

export interface TracksideView {
  readonly group: THREE.Group
  readonly plan: TracksidePlan
  readonly balloons: readonly BalloonSpot[]
  readonly butterflies: readonly THREE.Vector3[]
  update(playerS: number): void
  dispose(): void
}

export interface TracksideOptions {
  readonly decor: number
  readonly night: boolean
  readonly stripe: THREE.Material
  readonly shadows: boolean
}

export function buildTrackside(track: Track, o: TracksideOptions): TracksideView {
  const plan = planTrackside(track, o.decor)
  const chunks = new Map<number, Buckets>()
  const sinkAt = (s: number): Buckets => {
    const k = Math.max(0, Math.floor(s / CHUNK))
    let b = chunks.get(k)
    if (b === undefined) {
      b = newBuckets()
      chunks.set(k, b)
    }
    return b
  }
  const balloons = buildGates(track, plan, sinkAt)
  const side = buildRoadside(track, plan, sinkAt, { decor: o.decor, night: o.night })

  const mats: Record<keyof Buckets, THREE.Material> = {
    stripe: o.stripe,
    solid: toonMaterial({ roughness: 0.68, rim: 0.38 }),
    trim: toonMaterial({ roughness: 0.22, rim: 0.3, envMapIntensity: 1.25 }),
    glow: glowMaterial(o.night ? 3.2 : 2.3, 0.3),
    atlas: atlasMaterial(),
  }
  const group = new THREE.Group()
  group.name = 'trackside'
  const parts: { k: number; meshes: THREE.Mesh[]; centre: THREE.Vector3; r: number }[] = []
  for (const [k, b] of [...chunks.entries()].sort((a, c) => a[0] - c[0])) {
    const meshes: THREE.Mesh[] = []
    for (const key of Object.keys(b) as (keyof Buckets)[]) {
      const g = mergeKeep(b[key], KEEP[key])
      if (g === null) continue
      const m = new THREE.Mesh(g, mats[key])
      m.name = `side-${key}-${k}`
      m.receiveShadow = o.shadows && key !== 'glow'
      meshes.push(m)
      group.add(m)
    }
    if (meshes.length === 0) continue
    const box = new THREE.Box3()
    for (const m of meshes) box.expandByObject(m)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    parts.push({ k, meshes, centre: sphere.center, r: sphere.radius })
  }
  const falls = mergeKeep(side.falls, ['position', 'uv', 'aT'])
  const fallMat = flowMaterial('water')
  if (falls !== null) {
    const m = new THREE.Mesh(falls, fallMat)
    m.name = 'trackFalls'
    m.renderOrder = 3
    group.add(m)
  }
  const view = o.decor < 1 ? VIEW_LOW : VIEW
  const at = new THREE.Vector3()
  return {
    group,
    plan,
    balloons,
    butterflies: side.butterflies,
    update(playerS) {
      const p = track.frameAt(playerS).pos
      at.set(p.x, p.y, p.z)
      for (const c of parts) {
        const on = c.centre.distanceTo(at) - c.r < view
        for (const m of c.meshes) m.visible = on
      }
    },
    dispose() {
      group.traverse((o2) => {
        if (o2 instanceof THREE.Mesh) o2.geometry.dispose()
      })
      for (const [key, m] of Object.entries(mats)) if (key !== 'stripe') m.dispose()
      fallMat.dispose()
    },
  }
}
