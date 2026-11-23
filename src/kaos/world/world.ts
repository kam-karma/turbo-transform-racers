/**
 * Neon Şehir for one Kaos circuit: lights, fog and reflections, the light-ribbon road and its
 * rails and pillars, the city, billboards, rings, sky, lasers, rain, the dragon tower and
 * the neon coins. Static pieces are instanced or merged to keep draw calls low.
 */
import * as THREE from 'three'
import type { QualityProfile } from '../../game/quality'
import type { Track } from '../../sim/track'
import type { KaosCircuit } from '../tracks/index'
import { buildBackdrop } from './backdrop'
import { buildBoards, placeBoards } from './billboards'
import { buildTowers, placeTowers } from './city'
import { buildLandmark, type Landmark } from './landmark'
import { roadField, type RoadField } from './layout'
import { neonEnvironment } from './materials'
import { buildRings } from './rings'
import { buildRoad } from './road'
import { buildStructures } from './structures'

export interface NeonWorld {
  readonly group: THREE.Group
  readonly field: RoadField
  readonly groundY: number
  readonly landmark: Landmark
  readonly env: THREE.Texture
  /** Hides coin k of the lap (collected). */
  collectCoin(k: number): void
  /** All coins back (new lap, restart). */
  resetCoins(): void
  update(t: number, dt: number, camera: THREE.Camera): void
  dispose(): void
}

function buildCoins(track: Track, c: KaosCircuit): { mesh: THREE.InstancedMesh; perLap: number; mats: THREE.Matrix4[] } {
  const perLap = Math.floor(c.def.coins.length / c.laps)
  const geo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 24)
  geo.rotateX(Math.PI / 2)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffc93a, emissive: 0xffa31a, emissiveIntensity: 1.7, metalness: 0.9, roughness: 0.25 })
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, perLap))
  const mats: THREE.Matrix4[] = []
  for (let k = 0; k < perLap; k++) {
    const cd = c.def.coins[k]
    const p = track.toWorld(c.lapLen + (cd.s % c.lapLen), cd.d, 1.1)
    const m = new THREE.Matrix4().setPosition(p.x, p.y, p.z)
    mats.push(m)
    mesh.setMatrixAt(k, m)
  }
  mesh.count = perLap
  mesh.frustumCulled = false
  return { mesh, perLap, mats }
}

export async function buildNeonWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, track: Track, c: KaosCircuit, q: QualityProfile): Promise<NeonWorld> {
  const group = new THREE.Group()
  const field = roadField(track, c)
  const groundY = Math.floor(field.minY - 34)

  scene.fog = new THREE.FogExp2(0x0d0726, 0.0017)
  scene.background = new THREE.Color(0x05041a)
  const env = neonEnvironment(renderer)
  scene.environment = env
  scene.environmentIntensity = 0.9
  const hemi = new THREE.HemisphereLight(0x7a6cff, 0x12051f, 1.1)
  const cyan = new THREE.DirectionalLight(0x5feaff, 1.5)
  cyan.position.set(-1, 0.8, 0.3)
  const pink = new THREE.DirectionalLight(0xff5cf0, 1.3)
  pink.position.set(1, 0.6, -0.4)
  group.add(hemi, cyan, pink)

  const road = buildRoad(track, c)
  const structures = buildStructures(track, c, groundY)
  const towers = placeTowers(field, c, q.decor, groundY)
  const { boards, poles } = placeBoards(track, c, field, towers, q.decor, groundY)
  const towerView = buildTowers([...towers, ...poles], groundY)
  const boardView = buildBoards(boards)
  const rings = buildRings(track, c, field, groundY, q.decor)
  const backdrop = buildBackdrop(c, field.center, groundY, towers, q.particles)
  const landmark = await buildLandmark(c, field, groundY, q.decor)
  const coins = buildCoins(track, c)
  group.add(road.mesh, structures, towerView.mesh, boardView.mesh, rings.group, backdrop.group, landmark.group, coins.mesh)

  const spin = new THREE.Matrix4()
  const tmp = new THREE.Matrix4()
  const hidden = new Set<number>()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  return {
    group, field, groundY, landmark, env,
    collectCoin(k) {
      const i = k % Math.max(1, coins.perLap)
      hidden.add(i)
    },
    resetCoins() {
      hidden.clear()
    },
    update(t, dt, camera) {
      road.material.uniforms.uTime.value = t
      towerView.material.uniforms.uTime.value = t
      boardView.material.uniforms.uTime.value = t
      rings.update(t)
      backdrop.update(t, camera, dt)
      landmark.update(t)
      spin.makeRotationY(t * 3)
      coins.mats.forEach((m, i) => {
        coins.mesh.setMatrixAt(i, hidden.has(i) ? zero : tmp.copy(m).multiply(spin))
      })
      coins.mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      landmark.dispose()
      env.dispose()
      group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) {
          o.geometry.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) m.dispose()
        }
      })
      scene.environment = null
      scene.fog = null
    },
  }
}
