/**
 * The race track as seen: surface decks, the cake-layered floating slab with its glossy
 * rainbow edge, water channels, candy rails, boost chevrons, gap lips and landing pads, coins,
 * the perfect line, and the trackside layer (gates, arches, rings, roadside props, signs).
 *
 * Draw calls: one per material for the road itself (≈ 10), plus ≤ 5 per visible trackside
 * chunk (two or three chunks are near the player at a time).
 */
import * as THREE from 'three'
import type { Track } from '../sim/track'
import type { QualityProfile } from './quality'
import { mergeKeep } from './islandsGeo'
import { glowMaterial, stripeMaterial, toonMaterial, WORLD_TIME } from './islandsMaterial'
import { buildPerfectBand } from './trackMeshBand'
import { buildCoins } from './trackMeshCoins'
import { buildBoostArrows, buildGlowMarks, buildRails } from './trackMeshProps'
import { buildRoadGeos } from './trackMeshRoad'
import { buildTrackside, type TracksideView } from './trackMeshSide'
import { climbTexture, iceTexture, roadTexture, stripeMask } from './trackMeshTextures'
import { waterMaterial } from './trackMeshWater'

const CELL = 450

export interface TrackView {
  readonly group: THREE.Group
  /** Gates, arches, rings and roadside props (with their plan, balloon and butterfly spots). */
  readonly side: TracksideView
  update(timeS: number, playerS: number, playerSpeed: number): void
  collectCoin(index: number): void
  /** Shows every coin again (race restart). */
  resetCoins(): void
  dispose(): void
}

export interface TrackMeshOptions {
  /** Night variant: fairy lights along the rails, brighter glows. */
  readonly night?: boolean
}

export function buildTrackMesh(track: Track, q: QualityProfile, o: TrackMeshOptions = {}): TrackView {
  const group = new THREE.Group()
  group.name = 'track'
  const shadows = q.bloom
  const materials: THREE.Material[] = []
  // Big road meshes are merged per 450 m map cell so the parts behind the camera are culled.
  const add = (geos: THREE.BufferGeometry[], keep: readonly string[], mat: THREE.Material, name: string, receive = false, chunk = false): void => {
    materials.push(mat)
    const cells = new Map<string, THREE.BufferGeometry[]>()
    for (const g of geos) {
      g.computeBoundingSphere()
      const c = (g.boundingSphere as THREE.Sphere).center
      const key = chunk ? `${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}` : 'all'
      const list = cells.get(key)
      if (list === undefined) cells.set(key, [g])
      else list.push(g)
    }
    for (const [key, list] of cells) {
      const g = mergeKeep(list, keep)
      if (g === null) continue
      const mesh = new THREE.Mesh(g, mat)
      mesh.name = `${name}-${key}`
      mesh.receiveShadow = receive && shadows
      group.add(mesh)
    }
  }
  const ALL = ['position', 'normal', 'uv', 'color']
  const coarse = q.decor < 1
  const road = buildRoadGeos(track, coarse)
  add(road.road, ALL, toonMaterial({ map: roadTexture(), roughness: 0.62, rim: 0.1, envMapIntensity: 0.55 }), 'road', true)
  add(road.ice, ALL, toonMaterial({ map: iceTexture(), roughness: 0.12, rim: 0.25, envMapIntensity: 1.1 }), 'ice', true)
  add(road.climb, ALL, toonMaterial({ map: climbTexture(), roughness: 0.8, rim: 0.15 }), 'climb', true)
  add(road.shell, ['position', 'normal', 'color'], toonMaterial({ roughness: 0.34, rim: 0.36, envMapIntensity: 1.1 }), 'slab', true, true)
  const stripe = stripeMaterial(stripeMask())
  add([...road.candy, ...buildRails(track, coarse)], ALL, stripe, 'candy', true, true)
  add(buildGlowMarks(track), ['position', 'color'], glowMaterial(2.2, 0.35), 'glowMarks')
  const water = mergeKeep(road.water, ['position', 'normal', 'uv'])
  const waterMat = waterMaterial()
  materials.push(waterMat)
  if (water !== null) {
    const mesh = new THREE.Mesh(water, waterMat)
    mesh.name = 'water'
    mesh.renderOrder = 2
    group.add(mesh)
  }
  const boost = buildBoostArrows(track)
  if (boost !== null) group.add(boost)
  const coins = buildCoins(track, coarse)
  group.add(coins.mesh)
  const band = buildPerfectBand(track)
  group.add(band.mesh)
  const side = buildTrackside(track, { decor: q.decor, night: o.night ?? false, stripe, shadows })
  group.add(side.group)

  return {
    group,
    side,
    update(timeS, playerS, playerSpeed) {
      WORLD_TIME.value = timeS
      coins.update(timeS)
      band.update(playerS, playerSpeed)
      side.update(playerS)
    },
    collectCoin(index) {
      coins.collect(index)
    },
    resetCoins() {
      coins.reset()
    },
    dispose() {
      side.dispose()
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.parent !== side.group) {
          obj.geometry.dispose()
          const m = obj.material as THREE.Material | THREE.Material[]
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
      for (const m of materials) {
        if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose()
        m.dispose()
      }
    },
  }
}
