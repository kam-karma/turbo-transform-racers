/**
 * Part pickups on the road: each lane of a pickup row is a soap-bubble with the toy part
 * spinning inside and a glowing ring on the deck in the part's colour (golden for shiny and
 * the hidden part). Rows the player has passed pop; knocked-off parts bounce down the road
 * as loose bubbles that can be caught again. Instanced: one draw per part kind + bubbles.
 */
import * as THREE from 'three'
import type { KurguTrack } from '../sim/kurguTrack'
import type { DroppedPart } from '../sim/kurguRacer'
import { PART_DEFS, PART_IDS, type PartId } from '../sim/parts'
import { centredPartGeometry, partMaterial } from '../view/partMeshes'

interface Slot { s: number; d: number; part: PartId; shiny: boolean; row: number; lane: number; scale: number; target: number; pop: number }

const BUBBLE_R = 2.3
/** Pickups further than this along the track are not drawn. */
const NEAR_M = 420
const LIFT = 2.6
const GOLD = new THREE.Color(0xffd34d)

function bubbleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
        #else
        vC = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (f * 0.8 + vec3(0.0, 0.33, 0.67) + uTime * 0.05));
        vec3 col = mix(vC, irid, 0.35) * (0.6 + 1.6 * f);
        float spec = pow(max(dot(normalize(vN), normalize(vec3(0.4, 0.8, 0.3))), 0.0), 40.0);
        gl_FragColor = vec4(col + spec * 1.5, 0.1 + 0.65 * f + spec);
      }`,
  })
}

export interface PickupsView {
  readonly group: THREE.Group
  /** The player passed row i having taken lane (or none). */
  passRow(row: number, lane: number | null): void
  takeHidden(): void
  setDrops(drops: readonly DroppedPart[]): void
  reset(): void
  /** Animates bubbles; the whole set is skipped (11 draw calls) when none is near `nearS`. */
  update(t: number, dt: number, nearS: number): void
  dispose(): void
}

export function buildPickups(kt: KurguTrack): PickupsView {
  const group = new THREE.Group()
  const slots: Slot[] = []
  kt.def.rows.forEach((r, ri) => r.lanes.forEach((l, li) => slots.push({ s: r.s, d: l.d, part: l.part, shiny: l.shiny, row: ri, lane: li, scale: 1, target: 1, pop: 0 })))
  const h = kt.def.hidden
  const hiddenSlot: Slot = { s: h.s, d: h.d, part: h.part, shiny: true, row: -1, lane: 0, scale: 1, target: 1, pop: 0 }
  slots.push(hiddenSlot)
  const DROPS = 4
  const drops: Slot[] = []
  for (let i = 0; i < DROPS; i++) drops.push({ s: 0, d: 0, part: 'wing', shiny: false, row: -2, lane: i, scale: 0, target: 0, pop: 0 })
  const all = [...slots, ...drops]

  const bubbleGeo = new THREE.SphereGeometry(BUBBLE_R, 24, 16)
  const bubbleMat = bubbleMaterial()
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, all.length)
  bubbles.renderOrder = 6
  const ringGeo = new THREE.TorusGeometry(2.1, 0.22, 8, 32)
  ringGeo.rotateX(Math.PI / 2)
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: true })
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, all.length)
  const partMat = partMaterial()
  const byKind = new Map<PartId, { mesh: THREE.InstancedMesh; slots: Slot[] }>()
  for (const id of PART_IDS) {
    // Room for every lane of this kind, plus the loose drops (any kind).
    const n = all.filter((x) => x.part === id).length + DROPS
    const mesh = new THREE.InstancedMesh(centredPartGeometry(id), partMat, n)
    mesh.frustumCulled = false
    byKind.set(id, { mesh, slots: [] })
    group.add(mesh)
  }
  const c = new THREE.Color()
  all.forEach((x, i) => {
    c.set(x.shiny ? GOLD : PART_DEFS[x.part].color)
    bubbles.setColorAt(i, c)
    rings.setColorAt(i, c)
  })
  bubbles.frustumCulled = false
  rings.frustumCulled = false
  group.add(rings, bubbles)

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const pos = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let time = 0

  const write = (): void => {
    for (const k of byKind.values()) k.slots.length = 0
    all.forEach((x, i) => {
      const f = kt.main.frameAt(x.s)
      const w = kt.main.toWorld(x.s, x.d, 0)
      const bob = Math.sin(time * 2.4 + i) * 0.35
      const s = x.scale * (1 + x.pop * 0.6)
      pos.set(w.x, w.y + LIFT + bob, w.z)
      m.compose(pos, q.identity(), sc.setScalar(Math.max(1e-4, s)))
      bubbles.setMatrixAt(i, m)
      pos.set(w.x, w.y + 0.25, w.z)
      q.setFromUnitVectors(up, new THREE.Vector3(f.up.x, f.up.y, f.up.z))
      m.compose(pos, q, sc.setScalar(Math.max(1e-4, x.scale * (1 + 0.08 * Math.sin(time * 5 + i)))))
      rings.setMatrixAt(i, m)
      byKind.get(x.part)?.slots.push(x)
    })
    for (const k of byKind.values()) {
      k.slots.forEach((x, j) => {
        const w = kt.main.toWorld(x.s, x.d, 0)
        const bob = Math.sin(time * 2.4 + x.lane + x.row) * 0.35
        e.set(0.25, time * 1.6 + x.lane, 0)
        q.setFromEuler(e)
        pos.set(w.x, w.y + LIFT + bob, w.z)
        m.compose(pos, q, sc.setScalar(Math.max(1e-4, x.scale * 1.05)))
        k.mesh.setMatrixAt(j, m)
      })
      k.mesh.count = k.slots.length
      k.mesh.instanceMatrix.needsUpdate = true
    }
    bubbles.instanceMatrix.needsUpdate = true
    rings.instanceMatrix.needsUpdate = true
  }
  write()

  return {
    group,
    passRow(row, lane) {
      for (const x of slots) {
        if (x.row !== row) continue
        x.target = 0
        if (x.lane === lane) x.pop = 1
      }
    },
    takeHidden() {
      hiddenSlot.target = 0
      hiddenSlot.pop = 1
    },
    setDrops(list) {
      drops.forEach((x, i) => {
        const dp = list[i]
        if (dp === undefined) {
          x.target = 0
          return
        }
        if (x.target === 0 || x.part !== dp.part || x.s !== dp.s) {
          x.part = dp.part
          x.shiny = dp.shiny
          x.s = dp.s
          x.d = dp.d
          x.scale = 0.01
          bubbles.setColorAt(slots.length + i, c.set(PART_DEFS[dp.part].color))
          rings.setColorAt(slots.length + i, c)
          if (bubbles.instanceColor !== null) bubbles.instanceColor.needsUpdate = true
          if (rings.instanceColor !== null) rings.instanceColor.needsUpdate = true
        }
        x.target = 1
      })
    },
    reset() {
      for (const x of slots) {
        x.target = 1
        x.scale = 1
        x.pop = 0
      }
      for (const x of drops) x.target = x.scale = 0
    },
    update(t, dt, nearS) {
      time = t
      group.visible = all.some((x) => x.scale > 0.02 && Math.abs(x.s - nearS) < NEAR_M)
      if (!group.visible) return
      bubbleMat.uniforms.uTime.value = t
      for (const x of all) {
        x.scale += (x.target - x.scale) * Math.min(1, (x.target > x.scale ? 6 : 10) * dt)
        x.pop = Math.max(0, x.pop - dt * 4)
      }
      write()
    },
    dispose() {
      bubbleGeo.dispose()
      bubbleMat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      partMat.dispose()
      for (const k of byKind.values()) k.mesh.geometry.dispose()
    },
  }
}
