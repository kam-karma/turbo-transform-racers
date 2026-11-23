/**
 * Hologram billboards: huge glowing screens on the tower faces that look at the circuit and
 * giant roadside screens on poles facing the traffic. One instanced draw over the canvas
 * atlas; the shader adds scanlines, a breathing glow and the odd hologram glitch.
 */
import * as THREE from 'three'
import type { Track } from '../../sim/track'
import type { KaosCircuit } from '../tracks/index'
import type { Tower } from './city'
import { rand, type RoadField } from './layout'
import { ATLAS_CELLS, ATLAS_COLS, ATLAS_ROWS, billboardAtlas } from './textures'

interface Board {
  readonly pos: THREE.Vector3
  /** Facing direction (unit, horizontal). */
  readonly n: THREE.Vector3
  readonly size: number
  readonly cell: number
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aCell;
attribute float aSeed;
varying vec2 vUv;
flat varying float vCell;
flat varying float vSeed;
void main() {
  vUv = uv;
  vCell = aCell;
  vSeed = aSeed;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uMap;
uniform float uTime;
varying vec2 vUv;
flat varying float vCell;
flat varying float vSeed;
float h(float n) { return fract(sin(n * 91.7) * 47453.5); }
void main() {
  vec2 uv = vUv;
  // glitch: a few rows slide sideways for an instant now and then
  float tick = floor(uTime * 8.0 + vSeed * 13.0);
  float g = step(0.93, h(tick + vSeed)) * step(0.6, h(floor(uv.y * 14.0) + tick));
  uv.x = clamp(uv.x + g * (h(tick * 3.1) - 0.5) * 0.12, 0.0, 1.0);
  float col = mod(vCell, ${ATLAS_COLS}.0);
  float row = floor(vCell / ${ATLAS_COLS}.0);
  vec2 a = vec2((uv.x + col) / ${ATLAS_COLS}.0, 1.0 - (1.0 - uv.y + row) / ${ATLAS_ROWS}.0);
  vec4 t = texture2D(uMap, a);
  if (t.a < 0.35) discard;
  float scan = 0.82 + 0.18 * sin(vUv.y * 260.0 + uTime * 6.0);
  float breathe = 0.8 + 0.2 * sin(uTime * 1.7 + vSeed * 6.0);
  vec3 c = t.rgb * t.rgb * 1.9 * scan * breathe * (1.0 + g * 0.8);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

/** Boards on tower faces near the road, plus roadside screens; returns the screens' poles too. */
export function placeBoards(track: Track, c: KaosCircuit, field: RoadField, towers: readonly Tower[], decor: number, groundY: number): { boards: Board[]; poles: Tower[] } {
  const r = rand(c.seed * 131 + 3)
  const boards: Board[] = []
  const poles: Tower[] = []
  for (const t of towers) {
    if (t.clear > 120 || r() > 0.55 * decor + 0.2) continue
    const near = field.nearest(t.x, t.z)
    const f = track.frameAt(c.lapLen + near.s).pos
    const dx = f.x - t.x
    const dz = f.z - t.z
    const alongX = Math.abs(dx) > Math.abs(dz)
    const n = alongX ? new THREE.Vector3(Math.sign(dx), 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz))
    const face = alongX ? t.d : t.w
    const size = Math.min(face * 0.85, 30)
    const y = Math.min(groundY + t.h - size * 0.6, near.y + 12 + r() * 35)
    const off = (alongX ? t.w : t.d) / 2 + 0.5
    boards.push({ pos: new THREE.Vector3(t.x + n.x * off, y, t.z + n.z * off), n, size, cell: Math.floor(r() * ATLAS_CELLS) })
  }
  const hw = c.spec.width / 2
  const gap = 150 / Math.max(0.5, decor)
  for (let s = 60, k = 0; s < c.lapLen - 40; s += gap * (0.8 + r() * 0.4), k++) {
    const f = track.frameAt(c.lapLen + s)
    const side = k % 2 === 0 ? 1 : -1
    const d = side * (hw + 13)
    const p = new THREE.Vector3(f.pos.x + f.left.x * d, f.pos.y, f.pos.z + f.left.z * d)
    if (field.nearest(p.x, p.z).dist < hw + 8) continue
    const n = new THREE.Vector3(-f.t.x, 0, -f.t.z).normalize().addScaledVector(new THREE.Vector3(-f.left.x * side, 0, -f.left.z * side), 0.45).normalize()
    const size = 15
    boards.push({ pos: p.clone().setY(f.pos.y + 11 + size / 2), n, size, cell: Math.floor(r() * ATLAS_CELLS) })
    poles.push({ x: p.x - n.x * 0.8, z: p.z - n.z * 0.8, w: 1.6, d: 1.6, h: f.pos.y + 11 - groundY, color: new THREE.Color(c.palette.b), clear: hw + 10 })
  }
  return { boards, poles }
}

export function buildBoards(boards: readonly Board[]): { mesh: THREE.InstancedMesh; material: THREE.ShaderMaterial } {
  const geo = new THREE.PlaneGeometry(1, 1)
  const n = Math.max(1, boards.length)
  const cells = new Float32Array(n)
  const seeds = new Float32Array(n)
  boards.forEach((b, i) => {
    cells[i] = b.cell
    seeds[i] = i * 0.37
  })
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: billboardAtlas() }, uTime: { value: 0 }, ...THREE.UniformsLib.fog },
    vertexShader: VERT,
    fragmentShader: FRAG,
    fog: true,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.InstancedMesh(geo, material, n)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const z = new THREE.Vector3(0, 0, 1)
  boards.forEach((b, i) => {
    q.setFromUnitVectors(z, b.n)
    m.compose(b.pos, q, new THREE.Vector3(b.size, b.size, 1))
    mesh.setMatrixAt(i, m)
  })
  mesh.count = boards.length
  mesh.frustumCulled = false
  return { mesh, material }
}
