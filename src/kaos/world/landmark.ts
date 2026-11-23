/**
 * The Ejderha Kulesi landmark: a tall dark tower with glowing rings near the circuit's heart,
 * a hologram dragon coiled round it, and smaller hologram sky-serpents gliding between the
 * towers. A Tripo `dragon.glb` / `neon-tower.glb` replaces the procedural pieces when present.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { KaosCircuit } from '../tracks/index'
import { dressDragon, loadDragonMesh, type DragonModel } from './dragonModel'
import { HoloDragon } from './holoDragon'
import { rand, type RoadField } from './layout'
import { neonMetal, paintGeo } from './materials'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export interface Landmark {
  readonly group: THREE.Group
  readonly x: number
  readonly z: number
  /** The Tripo dragon perched on the tower (hidden in the boss race: it is out flying). */
  setPerchVisible(on: boolean): void
  update(t: number): void
  dispose(): void
}

const TOWER_H = 230
const TOWER_R = 12

function towerMesh(color: number, groundY: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.CylinderGeometry(TOWER_R * 0.8, TOWER_R, TOWER_H, 8, 1)
  body.translate(0, groundY + TOWER_H / 2, 0)
  parts.push(paintGeo(body, 0x161a30, 0))
  for (let k = 0; k < 7; k++) {
    const y = groundY + 30 + k * 30
    const r = TOWER_R * (1 - (y - groundY) / TOWER_H * 0.2) + 0.6
    const ring = new THREE.TorusGeometry(r, 0.5, 6, 32)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, y, 0)
    parts.push(paintGeo(ring, color, 3))
  }
  const spire = new THREE.ConeGeometry(TOWER_R * 0.5, 50, 8)
  spire.translate(0, groundY + TOWER_H + 25, 0)
  parts.push(paintGeo(spire, 0x161a30, 0))
  const tip = new THREE.SphereGeometry(2.2, 12, 8)
  tip.translate(0, groundY + TOWER_H + 52, 0)
  parts.push(paintGeo(tip, 0xff3df2, 5))
  // a ring platform for the dragon's head
  const deck = new THREE.CylinderGeometry(TOWER_R * 1.7, TOWER_R * 1.5, 3, 16)
  deck.translate(0, groundY + TOWER_H - 8, 0)
  parts.push(paintGeo(deck, 0x1d2240, 0))
  const deckGlow = new THREE.TorusGeometry(TOWER_R * 1.7, 0.45, 6, 48)
  deckGlow.rotateX(Math.PI / 2)
  deckGlow.translate(0, groundY + TOWER_H - 6.5, 0)
  parts.push(paintGeo(deckGlow, color, 3.5))
  const m = new THREE.Mesh(mergeGeometries(parts, false), neonMetal({ roughness: 0.3, metalness: 0.7 }))
  m.frustumCulled = false
  return m
}

/** Picks a spot near the circuit's middle that is clear of every road. */
function spot(field: RoadField, hw: number): { x: number; z: number } {
  for (let r = 0; r < 600; r += 12) {
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const x = field.center.x + Math.cos(a) * r
      const z = field.center.z + Math.sin(a) * r
      if (field.nearest(x, z).dist > hw + 45) return { x, z }
    }
  }
  return { x: field.center.x, z: field.max.z + 200 }
}

async function tryLoad(url: string): Promise<THREE.Object3D | null> {
  try {
    return (await new GLTFLoader().loadAsync(url)).scene
  } catch {
    return null
  }
}

export async function buildLandmark(c: KaosCircuit, field: RoadField, groundY: number, decor: number): Promise<Landmark> {
  const group = new THREE.Group()
  const { x, z } = spot(field, c.spec.width / 2)
  const [glbTower, dragonMesh] = await Promise.all([tryLoad('./models/neon-tower.glb'), loadDragonMesh()])
  const tower = glbTower ?? towerMesh(c.palette.a, groundY)
  if (glbTower !== null) {
    const box = new THREE.Box3().setFromObject(glbTower)
    const k = (TOWER_H + 50) / Math.max(1, box.max.y - box.min.y)
    glbTower.scale.setScalar(k)
    glbTower.position.y = groundY - box.min.y * k
  }
  tower.position.x += x
  tower.position.z += z
  group.add(tower)

  const dragons: { d: HoloDragon; spine: (u: number, o: THREE.Vector3, t: number) => void }[] = []
  let perch: DragonModel | null = null
  const perchY = groundY + TOWER_H - 6.5 + 9
  if (dragonMesh !== null) {
    perch = dressDragon(dragonMesh, 46, 0x22e6ff, 0xff3df2, 1.3, decor >= 0.75)
    group.add(perch.group)
  }
  {
    // the hologram coiled round the tower
    const d = new HoloDragon({ color: 0xb6ff2e, color2: 0xfff27a, radius: 5.5, segments: 72, intensity: 2.1 })
    const top = groundY + TOWER_H - 20
    dragons.push({
      d,
      spine: (u, o, t) => {
        const a = -u * 3.1 * Math.PI * 2 + t * 0.22
        const r = TOWER_R + 9 + 2.5 * Math.sin(u * 14 + t * 1.5) + (u < 0.06 ? (0.06 - u) * 160 : 0)
        o.set(x + Math.cos(a) * r, top - u * 165 + 3 * Math.sin(u * 9 + t), z + Math.sin(a) * r)
      },
    })
  }
  // hologram sky serpents
  const rr = rand(c.seed * 17 + 2)
  const serpents = Math.round(3 * decor)
  const cols: readonly (readonly [number, number])[] = [[0x22e6ff, 0x9ffcff], [0xff3df2, 0xffb0f6], [0x7a5cff, 0xc6b8ff]]
  for (let k = 0; k < serpents; k++) {
    const d = new HoloDragon({ color: cols[k % 3][0], color2: cols[k % 3][1], radius: 2.4, segments: 40, intensity: 2.4 })
    const cx = field.center.x + (rr() - 0.5) * (field.max.x - field.min.x)
    const cz = field.center.z + (rr() - 0.5) * (field.max.z - field.min.z)
    const R = 90 + rr() * 120
    const h = groundY + 95 + rr() * 60
    const sp = 0.05 + rr() * 0.04
    const ph = rr() * 6
    dragons.push({
      d,
      spine: (u, o, t) => {
        const a = t * sp + ph - u * 0.5
        o.set(cx + Math.cos(a) * R, h + 8 * Math.sin(u * 8 - t * 2), cz + Math.sin(a) * R + 6 * Math.sin(u * 10 + t * 1.6))
      },
    })
  }
  for (const d of dragons) group.add(d.d.group)
  return {
    group, x, z,
    setPerchVisible(on) {
      if (perch !== null) perch.group.visible = on
    },
    update(t) {
      if (perch !== null) {
        // circling slowly round the tower top, banking into the turn
        const a = t * 0.12
        const R = TOWER_R * 1.7 + 6
        perch.group.position.set(x + Math.cos(a) * R, perchY + 3 * Math.sin(t * 0.8), z + Math.sin(a) * R)
        perch.group.rotation.set(0, -a, 0.25)
        perch.shell.uniforms.uTime.value = t
      }
      for (const d of dragons) {
        d.d.setSpine((u, o) => d.spine(u, o, t), t)
        d.d.update(t)
      }
    },
    dispose() {
      for (const d of dragons) d.d.dispose()
      perch?.dispose()
    },
  }
}
