/**
 * "Dev Balina Dalgası", the Dönüşüm boss: a towering curling wave rolls down the track
 * behind the player with a giant cartoon whale surfing on its back. The chase itself is
 * src/sim/boss.ts; this is only the view: update() with the boss position along the track.
 *
 * Uses the Tripo `whale.glb` when it exists, otherwise the procedural whale.
 */
import * as THREE from 'three'
import type { Track } from '../../sim/track'
import { DEFAULT_WIDTH } from '../../sim/track'
import { WORLD_TIME } from '../../game/islandsMaterial'
import type { QualityProfile } from '../../game/quality'
import { trackMatrix } from '../../game/trackMeshSweep'
import { tryLoadMesh } from '../../game/tripoProps'
import { buildWhaleModel } from './whaleModel'
import { SPRAY_FRAG, SPRAY_VERT, WAVE_FRAG, WAVE_VERT } from './whaleShaders'

export interface WhaleBossView {
  readonly group: THREE.Group
  /** danger 0..1 (from bossDanger): the wave grows and the whale leans in as it closes. */
  update(timeS: number, bossS: number, danger: number): void
  dispose(): void
}

/** Cross-section of the wave (z forward, y up), back slope → crest → curling lip → foot. */
const PROFILE: readonly [number, number][] = [
  [-22, -3], [-14, 2], [-7.5, 7.5], [-2.5, 11.8], [1, 13.2], [3.8, 12.3], [5.2, 9.8], [4.4, 7.0], [3.3, 4.4], [4.8, 1.3], [8, -1.6],
]
const NX = 36
const NU = 40
const HALF_EXTRA = 13
const WHALE_LEN = 17

function profileCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(PROFILE.map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'centripetal')
}

/** The wave sheet: x across the road (with tapered ends), u = 0..1 along the profile. */
function waveGeo(halfW: number): THREE.BufferGeometry {
  const curve = profileCurve()
  const pts = curve.getSpacedPoints(NU)
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= NX; i++) {
    const t = i / NX
    const x = (t - 0.5) * 2 * halfW
    // Ends fall away so the wave reads as a rolling hill of water, not a wall with edges.
    const end = Math.min(1, (1 - Math.abs(2 * t - 1)) * 3.2)
    const h = 0.25 + 0.75 * Math.sin((end * Math.PI) / 2)
    for (let k = 0; k <= NU; k++) {
      const p = pts[k]
      pos.push(x, p.y * h - (1 - h) * 2.5, p.z * (0.7 + 0.3 * h) - (1 - h) * 4)
      uv.push(t, k / NU)
    }
  }
  for (let i = 0; i < NX; i++) {
    for (let k = 0; k < NU; k++) {
      const a = i * (NU + 1) + k
      const b = (i + 1) * (NU + 1) + k
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function sprayGeo(halfW: number, n: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * 3)
  const seed = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 2 * halfW * 0.9
    pos[i * 3 + 1] = 12.8
    pos[i * 3 + 2] = 3.5
    seed[i * 2] = Math.random()
    seed[i * 2 + 1] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2))
  return g
}

export async function buildWhaleBoss(track: Track, q: QualityProfile): Promise<WhaleBossView> {
  const group = new THREE.Group()
  group.name = 'whaleBoss'
  const halfW = DEFAULT_WIDTH / 2 + HALF_EXTRA
  const waveMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDanger: { value: 0 } }]),
    vertexShader: WAVE_VERT,
    fragmentShader: WAVE_FRAG,
    fog: true,
    side: THREE.DoubleSide,
  })
  waveMat.uniforms.uTime = WORLD_TIME
  const wave = new THREE.Mesh(waveGeo(halfW), waveMat)
  wave.name = 'wave'
  wave.frustumCulled = false
  const sprayMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 1 } }]),
    vertexShader: SPRAY_VERT,
    fragmentShader: SPRAY_FRAG,
    fog: true,
    transparent: true,
    depthWrite: false,
  })
  sprayMat.uniforms.uTime = WORLD_TIME
  const spray = new THREE.Points(sprayGeo(halfW, Math.round(140 * (0.5 + 0.5 * q.particles))), sprayMat)
  spray.frustumCulled = false
  spray.renderOrder = 5

  const rig = new THREE.Group()
  rig.add(wave, spray)
  group.add(rig)

  const whaleHolder = new THREE.Group()
  whaleHolder.position.set(0, 12, -5.5)
  rig.add(whaleHolder)
  const tripo = await tryLoadMesh('./models/whale.glb')
  const materials: THREE.Material[] = [waveMat, sprayMat]
  let tail: THREE.Object3D | null = null
  let spout: THREE.Object3D | null = null
  if (tripo !== null) {
    // Tripo models are normalised to height 1; scale by length (nose towards +Z).
    tripo.geometry.computeBoundingBox()
    const box = tripo.geometry.boundingBox as THREE.Box3
    const length = box.max.z - box.min.z || 1
    tripo.scale.setScalar(WHALE_LEN / length)
    tripo.position.y = -2.5
    whaleHolder.add(tripo)
  } else {
    const w = buildWhaleModel()
    whaleHolder.add(w.root)
    tail = w.tail
    spout = w.spout
    materials.push(...w.materials)
  }

  const m = new THREE.Matrix4()
  return {
    group,
    update(timeS, bossS, danger) {
      const s = Math.max(0, Math.min(track.length, bossS))
      trackMatrix(track, s, 0, 0, m)
      rig.matrixAutoUpdate = false
      rig.matrix.copy(m)
      // Behind the start the wave keeps rolling straight back along the first frame.
      if (bossS < 0) {
        const f = track.frameAt(0)
        rig.matrix.premultiply(new THREE.Matrix4().makeTranslation(f.t.x * bossS, f.t.y * bossS, f.t.z * bossS))
      }
      const grow = 1 + 0.22 * danger
      rig.matrix.multiply(new THREE.Matrix4().makeScale(1, grow, grow))
      rig.matrixWorldNeedsUpdate = true
      waveMat.uniforms.uDanger.value = danger
      // The whale surfs: bob, roll and lean forward as it closes in.
      whaleHolder.position.y = 11.2 + Math.sin(timeS * 1.6) * 0.7
      whaleHolder.rotation.set(-0.12 - danger * 0.12 + Math.sin(timeS * 1.1) * 0.05, Math.sin(timeS * 0.7) * 0.12, Math.sin(timeS * 1.3) * 0.08)
      if (tail !== null) tail.rotation.x = Math.sin(timeS * 3.2) * 0.35
      if (spout !== null) {
        const k = 0.75 + 0.35 * Math.abs(Math.sin(timeS * 2.4))
        spout.scale.set(k, k * (0.9 + 0.3 * Math.sin(timeS * 4.8)), k)
      }
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose()
      })
      for (const mat of materials) mat.dispose()
    },
  }
}
