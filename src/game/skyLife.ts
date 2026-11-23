/**
 * Life in the sky, animated entirely on the GPU (one instanced draw call per kind, no
 * per-frame CPU work): gull flocks circling beside the course, butterflies fluttering
 * around the roadside balconies, striped hot-air balloons drifting in the distance and the
 * party balloon clusters tied to the start and finish gates.
 */
import * as THREE from 'three'
import type { Track } from '../sim/track'
import { makeRng, range } from './islandsGeo'
import { WORLD_TIME } from './islandsMaterial'
import type { LivePaletteRef } from './skyLifeShaders'
import { BALLOON_VERT, BIRD_VERT, BUTTERFLY_VERT, LIFE_FRAG, PARTY_VERT } from './skyLifeShaders'
import type { BalloonSpot } from './trackMeshGates'

export interface LifeView {
  readonly group: THREE.Group
  dispose(): void
}

interface Inst {
  pos: number[]
  param: number[]
  colA: number[]
  colB: number[]
}

const newInst = (): Inst => ({ pos: [], param: [], colA: [], colB: [] })

function instanced(base: THREE.BufferGeometry, inst: Inst, vert: string, light: LivePaletteRef, name: string): THREE.Mesh | null {
  const n = inst.pos.length / 3
  if (n === 0) return null
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a)
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(inst.pos), 3))
  g.setAttribute('iParam', new THREE.InstancedBufferAttribute(new Float32Array(inst.param), 4))
  g.setAttribute('iColA', new THREE.InstancedBufferAttribute(new Float32Array(inst.colA), 3))
  g.setAttribute('iColB', new THREE.InstancedBufferAttribute(new Float32Array(inst.colB), 3))
  g.instanceCount = n
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog])
  Object.assign(uniforms, {
    uTime: WORLD_TIME,
    uSky: { value: light.hemiSky },
    uGround: { value: light.hemiGround },
    uSun: { value: light.sun },
    uSunDir: { value: light.sunDir },
    uLight: light.level,
  })
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: LIFE_FRAG, fog: true, vertexColors: true, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(g, mat)
  mesh.name = name
  mesh.frustumCulled = false
  return mesh
}

const c3 = (hex: string): number[] => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

/** A gull: body + two wings; aWing = ±1 on wing vertices scaled by distance from the body. */
function birdGeo(): THREE.BufferGeometry {
  // x across, y up, z forward. Wings as two quads each (inner, outer) for a bent flap.
  const P: number[] = []
  const W: number[] = []
  const C: number[] = []
  const tri = (a: number[], b: number[], c: number[], wing: number[], col: number[]): void => {
    P.push(...a, ...b, ...c)
    W.push(...wing)
    for (let i = 0; i < 3; i++) C.push(...col)
  }
  const white = [1, 1, 1]
  const tip = [0.55, 0.6, 0.72]
  // Body (a flat diamond seen from below and above).
  tri([0, 0, 0.9], [0.18, 0, 0], [0, 0.12, -0.7], [0, 0, 0], white)
  tri([0, 0, 0.9], [0, 0.12, -0.7], [-0.18, 0, 0], [0, 0, 0], white)
  tri([0, -0.05, 0.6], [-0.18, 0, 0], [0.18, 0, 0], [0, 0, 0], white)
  for (const sx of [1, -1]) {
    tri([0.15 * sx, 0, 0.3], [0.15 * sx, 0, -0.25], [0.9 * sx, 0, 0.05], [0, 0, 0.6 * sx], white)
    tri([0.9 * sx, 0, 0.05], [0.15 * sx, 0, -0.25], [0.9 * sx, 0, -0.3], [0.6 * sx, 0, 0.6 * sx], white)
    tri([0.9 * sx, 0, 0.05], [0.9 * sx, 0, -0.3], [1.7 * sx, 0, -0.35], [0.6 * sx, 0.6 * sx, 1.0 * sx], tip)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(W, 1))
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  g.computeVertexNormals()
  return g
}

/** Butterfly: four wing triangles fanning from the body; aWing = ±1 per side. */
function butterflyGeo(): THREE.BufferGeometry {
  const P: number[] = []
  const W: number[] = []
  const C: number[] = []
  for (const sx of [1, -1]) {
    const quads: number[][][] = [
      [[0, 0, 0.05], [0.7 * sx, 0, 0.55], [0.85 * sx, 0, 0.05]],
      [[0, 0, 0.05], [0.85 * sx, 0, 0.05], [0.25 * sx, 0, -0.15]],
      [[0, 0, -0.05], [0.55 * sx, 0, -0.2], [0.4 * sx, 0, -0.6]],
    ]
    for (const t of quads) {
      for (const v of t) {
        P.push(...v)
        W.push(sx * Math.min(1, Math.abs(v[0]) * 1.4))
        const edge = Math.hypot(v[0], v[2]) > 0.6 ? 1 : 0
        C.push(edge, 0, 0)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(W, 1))
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  g.computeVertexNormals()
  return g
}

/** Hot-air balloon of height ~1: striped envelope (aGore), skirt and a basket (color.g = 1). */
function balloonGeo(): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = []
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 + (k / 12) * Math.PI
    const r = k < 3 ? 0.12 + (k / 3) * 0.22 : Math.cos(a) * 0.42 + 0.02
    prof.push(new THREE.Vector2(Math.max(0.01, r), 0.62 + Math.sin(a) * 0.42 + (k < 3 ? -0.08 * (3 - k) : 0)))
  }
  const env = new THREE.LatheGeometry(prof, 16).toNonIndexed()
  const n = env.getAttribute('position').count
  const gore = new Float32Array(n)
  const p = env.getAttribute('position')
  for (let i = 0; i < n; i++) gore[i] = (Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 1) % 1
  env.setAttribute('aGore', new THREE.BufferAttribute(gore, 1))
  env.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  const basket = new THREE.BoxGeometry(0.16, 0.12, 0.16).translate(0, 0.02, 0).toNonIndexed()
  const m = basket.getAttribute('position').count
  basket.setAttribute('aGore', new THREE.BufferAttribute(new Float32Array(m), 1))
  basket.setAttribute('color', new THREE.BufferAttribute(new Float32Array(m * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  basket.deleteAttribute('uv')
  env.deleteAttribute('uv')
  const pos = [...(env.getAttribute('position').array as Float32Array), ...(basket.getAttribute('position').array as Float32Array)]
  const nor = [...(env.getAttribute('normal').array as Float32Array), ...(basket.getAttribute('normal').array as Float32Array)]
  const gr = [...gore, ...(basket.getAttribute('aGore').array as Float32Array)]
  const col = [...(env.getAttribute('color').array as Float32Array), ...(basket.getAttribute('color').array as Float32Array)]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('aGore', new THREE.Float32BufferAttribute(gr, 1))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

/** Party balloon of radius 1 (bottom at y = 0) and a string hanging 3 below (color.g = 1). */
function partyGeo(): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [new THREE.Vector2(0.01, -0.1), new THREE.Vector2(0.12, -0.06)]
  for (let k = 0; k <= 7; k++) {
    const a = -Math.PI / 2 + (k / 7) * Math.PI
    prof.push(new THREE.Vector2(Math.max(0.01, Math.cos(a) * (a < 0 ? 0.82 + 0.18 * Math.cos(a) : 1)), 1.15 + Math.sin(a) * 1.15))
  }
  const body = new THREE.LatheGeometry(prof, 10).toNonIndexed()
  body.deleteAttribute('uv')
  const n = body.getAttribute('position').count
  body.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  const str = new THREE.CylinderGeometry(0.025, 0.025, 3, 3, 4, true).translate(0, -1.6, 0).toNonIndexed()
  str.deleteAttribute('uv')
  const m = str.getAttribute('position').count
  str.setAttribute('color', new THREE.BufferAttribute(new Float32Array(m * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  const g = new THREE.BufferGeometry()
  for (const k of ['position', 'normal', 'color']) {
    const a = [...(body.getAttribute(k).array as Float32Array), ...(str.getAttribute(k).array as Float32Array)]
    g.setAttribute(k, new THREE.Float32BufferAttribute(a, 3))
  }
  return g
}

const BIRD_SPOTS = 340
const BALLOON_COLORS: [string, string][] = [
  ['#ff4f6d', '#ffd23f'], ['#3fb6ff', '#ffffff'], ['#8a5cff', '#ff9ad5'], ['#5ee06a', '#fff1a0'], ['#ff8a2e', '#ffffff'], ['#ff5fa8', '#7fe8ff'],
]
const WING_COLORS = ['#ff7ab8', '#ffd23f', '#7fe8ff', '#b98cff', '#ff9a3c', '#8be36a']

export function buildLife(track: Track, light: LivePaletteRef, o: { decor: number; partyBalloons: readonly BalloonSpot[]; butterflies: readonly THREE.Vector3[]; night: boolean }): LifeView {
  const rnd = makeRng(73)
  const group = new THREE.Group()
  group.name = 'life'
  const birds = newInst()
  for (let s = 150; s < track.length - 100; s += BIRD_SPOTS) {
    const f = track.frameAt(s)
    const side = rnd() < 0.5 ? 1 : -1
    const off = range(rnd, 35, 90) * side
    const cx = f.pos.x + f.left.x * off
    const cz = f.pos.z + f.left.z * off
    const cy = f.pos.y + range(rnd, 16, 40)
    const n = Math.round(range(rnd, 4, 7) * (0.5 + 0.5 * o.decor))
    const dir = rnd() < 0.5 ? 1 : -1
    for (let i = 0; i < n; i++) {
      birds.pos.push(cx, cy + range(rnd, -3, 3), cz)
      // scale, phase, radius, angular speed
      birds.param.push(range(rnd, 1.1, 1.6), rnd() * 6.28, range(rnd, 12, 26), dir * range(rnd, 0.28, 0.42))
      birds.colA.push(...c3('#ffffff'))
      birds.colB.push(...c3('#ffb14a'))
    }
  }
  const flies = newInst()
  for (const p of o.butterflies) {
    if (rnd() > 0.85 * o.decor + 0.15) continue
    const n = 1 + Math.floor(rnd() * 2)
    for (let i = 0; i < n; i++) {
      flies.pos.push(p.x, p.y, p.z)
      flies.param.push(range(rnd, 0.45, 0.7), rnd() * 6.28, range(rnd, 1.5, 3), range(rnd, 0.8, 1.3))
      const a = WING_COLORS[Math.floor(rnd() * WING_COLORS.length)]
      flies.colA.push(...c3(a))
      flies.colB.push(...c3('#2a1a3a'))
    }
  }
  const hot = newInst()
  const count = Math.round(14 * (0.5 + 0.5 * o.decor))
  for (let i = 0; i < count; i++) {
    const s = ((i + 0.5) / count) * track.length
    const f = track.frameAt(s)
    const off = range(rnd, 110, 320) * (i % 2 === 0 ? 1 : -1)
    hot.pos.push(f.pos.x + f.left.x * off, f.pos.y + range(rnd, 25, 110), f.pos.z + f.left.z * off)
    hot.param.push(range(rnd, 11, 18), rnd() * 6.28, 0, 0)
    const [a, b] = BALLOON_COLORS[i % BALLOON_COLORS.length]
    hot.colA.push(...c3(a))
    hot.colB.push(...c3(b))
  }
  const party = newInst()
  for (const b of o.partyBalloons) {
    party.pos.push(b.x, b.y, b.z)
    party.param.push(b.r, rnd() * 6.28, 0, 0)
    party.colA.push(...c3(b.color))
    party.colB.push(...c3('#ffffff'))
  }
  const meshes = [
    instanced(birdGeo(), birds, BIRD_VERT, light, 'birds'),
    instanced(butterflyGeo(), flies, BUTTERFLY_VERT, light, 'butterflies'),
    instanced(balloonGeo(), hot, BALLOON_VERT, light, 'hotAirBalloons'),
    instanced(partyGeo(), party, PARTY_VERT, light, 'partyBalloons'),
  ]
  for (const m of meshes) if (m !== null) group.add(m)
  return {
    group,
    dispose() {
      for (const m of meshes) {
        if (m === null) continue
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    },
  }
}
