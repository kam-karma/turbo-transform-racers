/**
 * The destructible props on screen, three instanced draws: glowing neon block stacks (plus
 * the emitter bases of the signs), hologram signs (additive, from the billboard atlas) and
 * glass barriers with bright frames. Smashed props vanish (their shards are fx); rebuilt
 * ones materialise with a hologram dissolve.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Track } from '../../sim/track'
import type { BreakableDef } from '../sim/breakables'
import type { KaosCircuit } from '../tracks/index'
import { FOG_FADE } from './materials'
import { ATLAS_CELLS, ATLAS_COLS, ATLAS_ROWS, billboardAtlas } from './textures'

const BOX_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aBuild;
varying vec3 vObj;
flat varying vec3 vCol;
varying vec3 vN;
varying vec3 vV;
varying float vBuild;
varying vec3 vW;
void main() {
  vObj = position;
  vCol = instanceColor;
  vBuild = aBuild;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const BOX_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uHalf;
uniform float uGlass;
varying vec3 vObj;
flat varying vec3 vCol;
varying vec3 vN;
varying vec3 vV;
varying float vBuild;
varying vec3 vW;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  if (h3(floor(vW * 6.0)) > vBuild) discard;
  vec3 q = abs(vObj) / uHalf;
  // how many axes are near the box edge: 2 = on an edge line
  float e1 = smoothstep(0.82, 0.93, q.x), e2 = smoothstep(0.82, 0.93, q.y), e3 = smoothstep(0.82, 0.93, q.z);
  float edge = max(max(e1 * e2, e2 * e3), e1 * e3);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  float pulse = 0.75 + 0.25 * sin(uTime * 4.0 + vW.x * 0.3 + vW.z * 0.2);
  vec3 col;
  float a = 1.0;
  if (uGlass > 0.5) {
    col = vCol * (0.08 + 0.5 * fres) + vCol * edge * 2.2 + vec3(0.8, 0.9, 1.0) * smoothstep(0.96, 1.0, fract((vObj.x + vObj.y) * 1.3 - uTime * 0.6)) * 0.6;
    a = clamp(0.22 + fres * 0.5 + edge, 0.0, 1.0);
  } else {
    // dark glossy core, a glowing frame on each face and a bright inner square
    vec3 face = abs(vN);
    float sq = 0.0;
    if (face.y > 0.5) sq = max(smoothstep(0.5, 0.56, max(q.x, q.z)) * step(max(q.x, q.z), 0.62), 0.0);
    else if (face.x > 0.5) sq = smoothstep(0.5, 0.56, max(q.y, q.z)) * step(max(q.y, q.z), 0.62);
    else sq = smoothstep(0.5, 0.56, max(q.x, q.y)) * step(max(q.x, q.y), 0.62);
    col = vec3(0.03, 0.02, 0.07) + vCol * (fres * 0.6 + 0.12) + vCol * (edge * 3.6 + sq * 2.4) * pulse;
  }
  col += vCol * (1.0 - vBuild) * 4.0;
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  ${FOG_FADE}
}
`

const SIGN_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uMap;
uniform float uTime;
varying vec2 vUv;
flat varying float vCell;
varying float vBuild;
float h(float n) { return fract(sin(n * 91.7) * 47453.5); }
void main() {
  vec2 uv = vUv;
  float row = floor(uv.y * 40.0);
  if (h(row + floor(uTime * 12.0)) > vBuild + 0.02) discard;
  uv.x += (h(row + floor(uTime * 20.0)) - 0.5) * 0.04 * step(0.9, h(floor(uTime * 5.0) + vCell));
  float c = mod(vCell, ${ATLAS_COLS}.0);
  float r = floor(vCell / ${ATLAS_COLS}.0);
  vec4 t = texture2D(uMap, vec2((clamp(uv.x, 0.0, 1.0) + c) / ${ATLAS_COLS}.0, 1.0 - (1.0 - uv.y + r) / ${ATLAS_ROWS}.0));
  float scan = 0.7 + 0.3 * sin(vUv.y * 120.0 - uTime * 10.0);
  float a = t.a * 0.9;
  vec3 col = t.rgb * t.rgb * 3.0 * scan;
  gl_FragColor = vec4(col * a, a * 0.6);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  ${FOG_FADE}
}
`

const SIGN_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aBuild;
attribute float aCell;
varying vec2 vUv;
flat varying float vCell;
varying float vBuild;
void main() {
  vUv = uv;
  vCell = aCell;
  vBuild = aBuild;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

/** The neon block shader (dark glossy core, glowing frames) for other cubes, e.g. dragon blocks. */
export function neonBoxMaterial(half: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHalf: { value: new THREE.Vector3(half, half, half) }, uGlass: { value: 0 }, ...THREE.UniformsLib.fog },
    vertexShader: BOX_VERT, fragmentShader: BOX_FRAG, fog: true,
  })
}

/** Gives an instanced geometry the per-instance build attribute the neon shaders need. */
export function solidBuild(geo: THREE.BufferGeometry, n: number): void {
  geo.setAttribute('aBuild', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1))
}

interface Slot { readonly mesh: THREE.InstancedMesh; readonly i: number; readonly m: THREE.Matrix4 }

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

function withBuild(geo: THREE.BufferGeometry, n: number): THREE.InstancedBufferAttribute {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('aBuild', a)
  return a
}

export class BreakView {
  readonly group = new THREE.Group()
  private readonly slots: Slot[][] = []
  private readonly building = new Map<number, number>()
  private readonly mats: THREE.ShaderMaterial[] = []
  private readonly builds = new Map<THREE.InstancedMesh, THREE.InstancedBufferAttribute>()
  /** World centre of every item, for the fx. */
  readonly centres: THREE.Vector3[] = []
  readonly colors: THREE.Color[] = []

  constructor(track: Track, c: KaosCircuit, readonly items: readonly BreakableDef[]) {
    const L = c.lapLen
    const pal = [c.palette.a, c.palette.b, c.palette.c, 0xff9a1f].map((h) => new THREE.Color(h))
    const count = (k: string): number => items.filter((i) => i.kind === k).length
    const nBox = count('block') * 2 + count('sign')
    const boxGeo = new RoundedBoxGeometry(1.3, 1.3, 1.3, 1, 0.14)
    const boxMat = this.mat(BOX_VERT, BOX_FRAG, { uHalf: { value: new THREE.Vector3(0.65, 0.65, 0.65) }, uGlass: { value: 0 } }, false)
    const boxes = this.instanced(boxGeo, boxMat, nBox)
    const glassGeo = new THREE.BoxGeometry(3, 1.5, 0.12)
    const glassMat = this.mat(BOX_VERT, BOX_FRAG, { uHalf: { value: new THREE.Vector3(1.5, 0.75, 0.06) }, uGlass: { value: 1 } }, true)
    const glass = this.instanced(glassGeo, glassMat, Math.max(1, count('glass')))
    const signGeo = new THREE.PlaneGeometry(2.8, 2.8)
    const cells = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count('sign'))), 1)
    signGeo.setAttribute('aCell', cells)
    const signMat = this.mat(SIGN_VERT, SIGN_FRAG, { uMap: { value: billboardAtlas() } }, true)
    signMat.side = THREE.DoubleSide
    const signs = this.instanced(signGeo, signMat, Math.max(1, count('sign')))
    const counters = new Map<THREE.InstancedMesh, number>()
    const put = (mesh: THREE.InstancedMesh, m: THREE.Matrix4, col: THREE.Color): Slot => {
      const i = counters.get(mesh) ?? 0
      counters.set(mesh, i + 1)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col)
      mesh.count = i + 1
      return { mesh, i, m }
    }
    const basis = new THREE.Matrix4()
    for (const it of items) {
      const f = track.frameAt(L + it.s)
      const p = track.toWorld(L + it.s, it.d, 0)
      basis.makeBasis(new THREE.Vector3(f.left.x, f.left.y, f.left.z), new THREE.Vector3(f.up.x, f.up.y, f.up.z), new THREE.Vector3(f.t.x, f.t.y, f.t.z))
      const at = (dx: number, dy: number, rotY = 0, s = 1): THREE.Matrix4 => {
        const m = basis.clone().multiply(new THREE.Matrix4().makeRotationY(rotY)).multiply(new THREE.Matrix4().makeScale(s, s, s))
        const off = new THREE.Vector3(dx, dy, 0).applyMatrix4(basis)
        return m.setPosition(p.x + off.x, p.y + off.y, p.z + off.z)
      }
      const col = pal[Math.floor(it.hue * pal.length) % pal.length]
      const slots: Slot[] = []
      if (it.kind === 'block') {
        slots.push(put(boxes, at(0, 0.66, it.hue * 0.6), col))
        slots.push(put(boxes, at(0, 1.98, -it.hue * 0.9, 0.92), pal[(Math.floor(it.hue * pal.length) + 1) % pal.length]))
        this.centres.push(new THREE.Vector3(p.x, p.y + 1.3, p.z))
      } else if (it.kind === 'glass') {
        slots.push(put(glass, at(0, 0.85), new THREE.Color(0x7fe9ff)))
        this.centres.push(new THREE.Vector3(p.x, p.y + 0.9, p.z))
      } else {
        const si = counters.get(signs) ?? 0
        cells.setX(si, Math.floor(it.hue * 997) % ATLAS_CELLS)
        slots.push(put(signs, at(0, 2.2, Math.PI), col))
        // emitter base: a flattened neon block under the hologram
        slots.push(put(boxes, at(0, 0.18).multiply(new THREE.Matrix4().makeScale(1.1, 0.25, 0.55)), col))
        this.centres.push(new THREE.Vector3(p.x, p.y + 2.2, p.z))
      }
      this.colors.push(it.kind === 'glass' ? new THREE.Color(0x7fe9ff) : col)
      this.slots.push(slots)
    }
    for (const m of [boxes, glass, signs]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor !== null) m.instanceColor.needsUpdate = true
    }
    signs.renderOrder = 3
    glass.renderOrder = 2
    this.group.add(boxes, glass, signs)
  }

  private mat(vert: string, frag: string, extra: Record<string, THREE.IUniform>, transparent: boolean): THREE.ShaderMaterial {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, ...extra, ...THREE.UniformsLib.fog },
      vertexShader: vert, fragmentShader: frag, fog: true, transparent, depthWrite: !transparent,
      blending: transparent ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    this.mats.push(m)
    return m
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n))
    this.builds.set(mesh, withBuild(geo, Math.max(1, n)))
    mesh.count = 0
    mesh.frustumCulled = false
    return mesh
  }

  smash(id: number): void {
    for (const s of this.slots[id] ?? []) s.mesh.setMatrixAt(s.i, ZERO)
    this.building.delete(id)
    this.touch()
  }

  rebuild(id: number): void {
    for (const s of this.slots[id] ?? []) {
      s.mesh.setMatrixAt(s.i, s.m)
      this.builds.get(s.mesh)?.setX(s.i, 0)
    }
    this.building.set(id, 0)
    this.touch()
  }

  /** Every prop whole again (restart). */
  reset(): void {
    for (let id = 0; id < this.slots.length; id++) {
      for (const s of this.slots[id]) {
        s.mesh.setMatrixAt(s.i, s.m)
        this.builds.get(s.mesh)?.setX(s.i, 1)
      }
    }
    this.building.clear()
    this.touch()
  }

  update(t: number, dt: number): void {
    for (const m of this.mats) m.uniforms.uTime.value = t
    if (this.building.size === 0) return
    for (const [id, k] of this.building) {
      const v = Math.min(1, k + dt / 0.9)
      for (const s of this.slots[id]) this.builds.get(s.mesh)?.setX(s.i, v)
      if (v >= 1) this.building.delete(id)
      else this.building.set(id, v)
    }
    for (const a of this.builds.values()) a.needsUpdate = true
  }

  private touch(): void {
    for (const m of this.builds.keys()) m.instanceMatrix.needsUpdate = true
    for (const a of this.builds.values()) a.needsUpdate = true
  }

  dispose(): void {
    for (const m of this.builds.keys()) m.geometry.dispose()
    for (const m of this.mats) m.dispose()
  }
}
