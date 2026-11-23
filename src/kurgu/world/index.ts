/**
 * Builds the whole Dev Ev world for one Kurgu track: house shell, furniture under the road,
 * scattered giant toys, the toy-track road, pickups, coins, obstacles, walls and signs, light
 * and air. Static geometry is batched per material and per room so the frustum culls whole
 * rooms; the result is ~40-70 draw calls for the world.
 */
import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { QualityProfile } from '../../game/quality'
import type { AnchorKind, KurguTrack } from '../sim/kurguTrack'
import { houseLayout } from '../sim/layout'
import { buildAtmosphere, type Atmosphere } from './atmosphere'
import { Batches, type BatchSink } from './batch'
import { buildBlobs, buildDecor } from './decor'
import { buildAnchors, MODEL_KINDS } from './furniture'
import { buildHouse, type HouseView } from './house'
import { buildItems, type ItemsView } from './items'
import { createMaterials, disposeMaterials } from './materials'
import { buildPickups, type PickupsView } from './pickups'
import { buildRoad, type RoadView } from './road'
import { buildRoomDetail } from './roomDetail'

export interface DevEvWorld {
  readonly group: THREE.Group
  readonly road: RoadView
  readonly pickups: PickupsView
  readonly items: ItemsView
  readonly atmosphere: Atmosphere
  readonly house: HouseView
  update(t: number, dt: number, camera: THREE.Camera, focus: THREE.Vector3, playerS: number): void
  dispose(): void
}

let draco: DRACOLoader | null = null

/** A GLB from public/models, or null when it is missing or broken (procedural fallback). */
export async function tryLoadModel(url: string): Promise<THREE.Object3D | null> {
  try {
    draco ??= new DRACOLoader().setDecoderPath('./draco/')
    const head = await fetch(url, { method: 'HEAD' })
    const type = head.headers.get('content-type') ?? ''
    if (!head.ok || type.includes('text/html')) return null
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(url)
    return gltf.scene
  } catch {
    return null
  }
}

async function loadAnchorModels(kt: KurguTrack): Promise<Map<AnchorKind, THREE.Object3D>> {
  const kinds = [...new Set(kt.def.anchors.map((a) => a.kind))].filter((k) => MODEL_KINDS.includes(k))
  const loaded = await Promise.all(kinds.map(async (k) => [k, await tryLoadModel(`./models/devev-${k}.glb`)] as const))
  const out = new Map<AnchorKind, THREE.Object3D>()
  for (const [k, m] of loaded) if (m !== null) out.set(k, m)
  return out
}

/** Splits batched geometry into per-room meshes so whole rooms are culled at once. */
function roomMeshes(batchesByRoom: readonly Batches[], mats: ReturnType<typeof createMaterials>, group: THREE.Group): THREE.Mesh[][] {
  return batchesByRoom.map((b) => b.entries().map(([key, batch]) => {
    const mesh = new THREE.Mesh(batch.build(), mats[key])
    mesh.receiveShadow = key !== 'glow'
    group.add(mesh)
    return mesh
  }))
}

export async function buildDevEvWorld(kt: KurguTrack, scene: THREE.Scene, renderer: THREE.WebGLRenderer, q: QualityProfile, night: boolean): Promise<DevEvWorld> {
  const group = new THREE.Group()
  const mats = createMaterials()
  const lay = houseLayout(kt)
  const sunFromLeft = kt.def.id.length % 2 === 0
  const models = await loadAnchorModels(kt)
  // One batch set per room (by z) so culling works per room.
  const rooms = lay.rooms.map(() => new Batches())
  const roomOf = (z: number): Batches => {
    const i = lay.rooms.findIndex((r) => z >= r.z0 && z < r.z1)
    return rooms[i < 0 ? (z < lay.z0 ? 0 : rooms.length - 1) : i]
  }
  const router: BatchSink = { of: (key) => ({ add: (g, m, c) => roomOf(m.elements[14]).of(key).add(g, m, c) }) }
  const objects: THREE.Object3D[] = []
  const furniture = buildAnchors(kt, router, models, objects)
  const house = buildHouse(lay, router, 2, sunFromLeft)
  buildRoomDetail(lay, router)
  const decor = buildDecor(kt, lay, router, furniture, q.decor, sunFromLeft)
  const items = buildItems(kt, router)
  const roomSets = roomMeshes(rooms, mats, group)
  for (const o of objects) group.add(o)
  group.add(house.group)
  if (decor.art !== null) group.add(decor.art)
  group.add(buildBlobs([...furniture, ...decor.blobs]))
  const road = buildRoad(kt, mats, q.decor)
  group.add(road.group)
  const pickups = buildPickups(kt)
  group.add(pickups.group, items.group)
  const atmosphere = buildAtmosphere(scene, renderer, q, night, sunFromLeft)
  group.add(atmosphere.group)
  house.setNight(night)

  return {
    group, road, pickups, items, atmosphere, house,
    update(t, dt, camera, focus, playerS) {
      // Walls hide everything but this room and its neighbours (seen through the doors).
      const here = Math.max(0, lay.rooms.findIndex((r) => playerS >= r.s0 && playerS < r.s1))
      roomSets.forEach((set, i) => { for (const m of set) m.visible = Math.abs(i - here) <= 1 })
      road.update(t)
      pickups.update(t, dt, playerS)
      items.update(t, dt, focus)
      atmosphere.update(t, dt, camera, focus)
    },
    dispose() {
      road.dispose()
      pickups.dispose()
      items.dispose()
      house.dispose()
      atmosphere.dispose()
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && Object.values(mats).includes(o.material as THREE.Material)) o.geometry.dispose()
      })
      if (decor.art !== null) {
        decor.art.geometry.dispose()
        const m = decor.art.material as THREE.MeshStandardMaterial
        m.map?.dispose()
        m.dispose()
      }
      disposeMaterials(mats)
    },
  }
}
