/**
 * Giant neon rings and arches: nested "gyroscope" rings slowly turning over the road (they
 * cross the deck plane only outside the road edges), arch tunnels the cars race through,
 * huge ring sculptures standing in the city, and the start/finish gate. Two instanced draws
 * per shape: a dark metal body and a glowing neon tube with running light segments.
 */
import * as THREE from 'three'
import type { Frame, Track } from '../../sim/track'
import type { KaosCircuit } from '../tracks/index'
import { rand, type RoadField } from './layout'

const NEON_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;
flat varying vec3 vCol;
void main() {
  vUv = uv;
  vCol = instanceColor;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const NEON_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uSegs;
varying vec2 vUv;
flat varying vec3 vCol;
void main() {
  float u = vUv.x * uSegs;
  float gap = smoothstep(0.0, 0.04, fract(u)) * smoothstep(1.0, 0.96, fract(u));
  float run = smoothstep(0.85, 1.0, fract(vUv.x * 3.0 - uTime * 0.25));
  float block = step(fract(u * 0.25 + 0.1), 0.06);
  vec3 c = vCol * (2.2 + 1.6 * run) * (0.35 + 0.65 * gap) + vec3(1.0, 0.85, 0.3) * block * 3.0;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

interface Spin { readonly i: number; readonly base: THREE.Matrix4; readonly axis: THREE.Vector3; readonly speed: number; readonly amp: number; readonly phase: number }

class RingSet {
  readonly body: THREE.InstancedMesh
  readonly neon: THREE.InstancedMesh
  private n = 0

  constructor(arc: number, cap: number, bodyMat: THREE.Material, neonMat: THREE.ShaderMaterial) {
    this.body = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.05, 6, arc > 4 ? 72 : 40, arc), bodyMat, cap)
    this.neon = new THREE.InstancedMesh(new THREE.TorusGeometry(0.93, 0.024, 4, arc > 4 ? 72 : 40, arc), neonMat, cap)
    for (const m of [this.body, this.neon]) {
      m.count = 0
      m.frustumCulled = false
    }
  }

  add(m: THREE.Matrix4, color: THREE.Color): number {
    const i = this.n++
    this.body.setMatrixAt(i, m)
    this.neon.setMatrixAt(i, m)
    this.neon.setColorAt(i, color)
    this.body.count = this.n
    this.neon.count = this.n
    return i
  }

  set(i: number, m: THREE.Matrix4): void {
    this.body.setMatrixAt(i, m)
    this.neon.setMatrixAt(i, m)
  }

  touch(): void {
    this.body.instanceMatrix.needsUpdate = true
    this.neon.instanceMatrix.needsUpdate = true
  }
}

export interface RingsView {
  readonly group: THREE.Group
  update(t: number): void
}

/** Basis on the road at s: x = left, y = up, z = forward. */
function roadBasis(f: Frame, lift: number): THREE.Matrix4 {
  const x = new THREE.Vector3(f.left.x, f.left.y, f.left.z)
  const y = new THREE.Vector3(f.up.x, f.up.y, f.up.z)
  const z = new THREE.Vector3(f.t.x, f.t.y, f.t.z)
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(f.pos.x + y.x * lift, f.pos.y + y.y * lift, f.pos.z + y.z * lift)
}

const scaleM = (r: number): THREE.Matrix4 => new THREE.Matrix4().makeScale(r, r, r)

export function buildRings(track: Track, c: KaosCircuit, field: RoadField, groundY: number, decor: number): RingsView {
  const group = new THREE.Group()
  const r = rand(c.seed * 71 + 9)
  const L = c.lapLen
  const hw = c.spec.width / 2
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x20243a, metalness: 0.85, roughness: 0.28 })
  const neonMat = (segs: number): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSegs: { value: segs }, ...THREE.UniformsLib.fog },
    vertexShader: NEON_VERT, fragmentShader: NEON_FRAG, fog: true,
  })
  const ringNeon = neonMat(28)
  const archNeon = neonMat(10)
  const rings = new RingSet(Math.PI * 2, 40, bodyMat, ringNeon)
  const arches = new RingSet(Math.PI, 60, bodyMat, archNeon)
  const pal = [c.palette.a, c.palette.b, c.palette.c].map((h) => new THREE.Color(h))
  const spins: Spin[] = []

  // gyroscopes: three nested rings over the road, gently rocking
  const gyros = [0.14, 0.47, 0.8].slice(0, decor < 0.75 ? 2 : 3)
  for (const u of gyros) {
    const f = track.frameAt(L + u * L)
    const lift = 8
    const base = roadBasis(f, lift)
    ;[16, 22, 28].forEach((R, k) => {
      const m = base.clone().multiply(scaleM(R))
      const i = rings.add(m, pal[k % 3])
      spins.push({ i, base: m, axis: new THREE.Vector3(0, 1, 0), speed: 0.35 + k * 0.12, amp: 0.45 - k * 0.1, phase: k * 1.3 })
    })
  }
  // arch tunnels
  for (const u of [0.3, 0.63, 0.93]) {
    for (let k = 0; k < 7; k++) {
      const f = track.frameAt(L + u * L + k * 9)
      arches.add(roadBasis(f, -0.5).multiply(scaleM(hw + 2.6 + (k % 2) * 0.6)), pal[k % 2])
    }
  }
  // start / finish gate: two big arches
  for (const ds of [-3, 3]) {
    const f = track.frameAt(L + ds)
    arches.add(roadBasis(f, -0.5).multiply(scaleM(hw + 5)), pal[ds < 0 ? 2 : 0])
  }
  // ring sculptures standing in the city, turning slowly
  const sculptures = Math.round(5 * decor)
  for (let k = 0, tries = 0; k < sculptures && tries < 200; tries++) {
    const ang = r() * Math.PI * 2
    const rad = 120 + r() * 260
    const x = field.center.x + Math.cos(ang) * rad * 1.3
    const z = field.center.z + Math.sin(ang) * rad
    const R = 30 + r() * 30
    if (field.nearest(x, z).dist < R + hw + 15) continue
    const m = new THREE.Matrix4().makeRotationY(r() * Math.PI).setPosition(x, groundY + R + 10, z).multiply(scaleM(R))
    const i = rings.add(m, pal[k % 3])
    spins.push({ i, base: m, axis: new THREE.Vector3(0, 1, 0), speed: 0.08 + r() * 0.1, amp: -1, phase: r() * 6 })
    const inner = m.clone().multiply(scaleM(0.72))
    const j = rings.add(inner, pal[(k + 1) % 3])
    spins.push({ i: j, base: inner, axis: new THREE.Vector3(1, 0, 0), speed: 0.2 + r() * 0.2, amp: -1, phase: r() * 6 })
    k++
  }
  rings.touch()
  arches.touch()
  group.add(rings.body, rings.neon, arches.body, arches.neon)

  const rot = new THREE.Matrix4()
  const tmp = new THREE.Matrix4()
  return {
    group,
    update(t) {
      ringNeon.uniforms.uTime.value = t
      archNeon.uniforms.uTime.value = t
      for (const s of spins) {
        // amp < 0: full turns; otherwise a rocking swing of ±amp rad
        const a = s.amp < 0 ? t * s.speed + s.phase : s.amp * Math.sin(t * s.speed + s.phase)
        rot.makeRotationAxis(s.axis, a)
        tmp.copy(s.base).multiply(rot)
        rings.set(s.i, tmp)
      }
      rings.touch()
    },
  }
}
