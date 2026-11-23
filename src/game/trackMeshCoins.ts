/**
 * Coins: one InstancedMesh of chunky gold coins with an embossed star, spinning and bobbing
 * above the road. Collected coins pop up and shrink away, then stay hidden.
 */
import * as THREE from 'three'
import type { Track } from '../sim/track'
import { trackMatrix } from './trackMeshSweep'

const HOVER = 1.1
const POP_S = 0.35

function coinGeometry(segments: number): THREE.BufferGeometry {
  const R = 0.72
  const T = 0.11
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(0, -T),
    new THREE.Vector2(R * 0.82, -T),
    new THREE.Vector2(R * 0.97, -T * 0.75),
    new THREE.Vector2(R, 0),
    new THREE.Vector2(R * 0.97, T * 0.75),
    new THREE.Vector2(R * 0.82, T),
    new THREE.Vector2(0, T),
  ]
  // Lathe around Y gives a flat disc; stand it up so it faces along the road.
  const body = new THREE.LatheGeometry(prof, segments).toNonIndexed()
  body.rotateX(Math.PI / 2)
  const star = new THREE.Shape()
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2
    const r = k % 2 === 0 ? R * 0.55 : R * 0.24
    if (k === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  star.closePath()
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: T * 2 + 0.08, bevelEnabled: false })
  starGeo.translate(0, 0, -(T + 0.04))
  const parts = [body, starGeo]
  const colors = [new THREE.Color('#ffc21a'), new THREE.Color('#fff09a')]
  const pos: number[] = []
  const nor: number[] = []
  const colArr: number[] = []
  parts.forEach((g, i) => {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    for (let k = 0; k < p.count; k++) {
      pos.push(p.getX(k), p.getY(k), p.getZ(k))
      nor.push(n.getX(k), n.getY(k), n.getZ(k))
      colArr.push(colors[i].r, colors[i].g, colors[i].b)
    }
    g.dispose()
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3))
  return g
}

export interface Coins {
  readonly mesh: THREE.InstancedMesh
  update(timeS: number): void
  collect(index: number): void
  /** Shows every coin again (race restart). */
  reset(): void
}

export function buildCoins(track: Track, coarse = false): Coins {
  const defs = track.def.coins
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.85,
    roughness: 0.28,
    emissive: new THREE.Color('#ff9d00'),
    emissiveIntensity: 0.35,
  })
  const mesh = new THREE.InstancedMesh(coinGeometry(coarse ? 10 : 14), mat, Math.max(1, defs.length))
  mesh.name = 'coins'
  mesh.count = defs.length
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const bases = defs.map((c) => trackMatrix(track, c.s, c.d, HOVER))
  const collectedAt = new Float64Array(defs.length).fill(-1)
  const pending = new Set<number>()
  const spin = new THREE.Matrix4()
  const lift = new THREE.Matrix4()
  const sc = new THREE.Matrix4()
  const m = new THREE.Matrix4()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  bases.forEach((b, i) => mesh.setMatrixAt(i, b))
  mesh.computeBoundingSphere()

  return {
    mesh,
    collect(index) {
      if (index >= 0 && index < defs.length && collectedAt[index] < 0) pending.add(index)
    },
    reset() {
      collectedAt.fill(-1)
      pending.clear()
      bases.forEach((b, i) => mesh.setMatrixAt(i, b))
      mesh.instanceMatrix.needsUpdate = true
    },
    update(t) {
      for (let i = 0; i < defs.length; i++) {
        if (pending.has(i)) {
          collectedAt[i] = t
          pending.delete(i)
        }
        const c = collectedAt[i]
        let rise = Math.sin(t * 2.6 + i * 0.9) * 0.16
        let scale = 1
        let rate = 3
        if (c >= 0) {
          const k = (t - c) / POP_S
          if (k >= 1) {
            mesh.setMatrixAt(i, zero)
            continue
          }
          rise += k * 2.2
          scale = k < 0.3 ? 1 + k * 1.6 : 1.48 * (1 - (k - 0.3) / 0.7)
          rate = 14
        }
        spin.makeRotationY(t * rate + i * 0.7)
        lift.makeTranslation(0, rise, 0)
        sc.makeScale(scale, scale, scale)
        m.copy(bases[i]).multiply(lift).multiply(spin).multiply(sc)
        mesh.setMatrixAt(i, m)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}
