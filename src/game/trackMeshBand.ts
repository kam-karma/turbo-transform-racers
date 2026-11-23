/**
 * The perfect line: a glowing band across the road over the last `speed × 0.3` metres before
 * the next form boundary, tinted with the colour of the form needed after it, plus a light
 * curtain standing at the boundary itself so it reads from far away.
 */
import * as THREE from 'three'
import { FORM_FOR, PERFECT_WINDOW, type FormId } from '../sim/forms'
import type { Track } from '../sim/track'
import { WORLD_TIME } from './islandsMaterial'

export const FORM_COLORS: Readonly<Record<FormId, string>> = {
  car: '#ffd23f',
  boat: '#2ec5ff',
  glider: '#ff6bd6',
  climber: '#7dff5a',
}

const SEG = 20
const CURTAIN_H = 3.4
const MIN_LEN = 5

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec2 aK;
varying vec2 vK;
void main() {
  vK = aK;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
varying vec2 vK;
void main() {
  float a;
  if (vK.y < 0.5) {
    // Floor band: x = 0 at the window start … 1 at the boundary.
    float t = vK.x;
    float chev = step(0.5, fract(t * 4.0 - uTime * 2.5));
    a = (0.25 + 0.75 * t * t) * (0.55 + 0.45 * chev) + smoothstep(0.9, 1.0, t) * 1.5;
  } else {
    // Curtain: x = 0 at the road … 1 at the top.
    float h = vK.x;
    a = pow(1.0 - h, 2.2) * (0.75 + 0.25 * sin(uTime * 9.0));
  }
  vec3 c = uColor * (0.9 + 1.5 * a);
  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export interface PerfectBand {
  readonly mesh: THREE.Mesh
  update(playerS: number, playerSpeed: number): void
}

export function buildPerfectBand(track: Track): PerfectBand {
  const floorVerts = (SEG + 1) * 2
  const n = floorVerts + 4
  const pos = new Float32Array(n * 3)
  const k = new Float32Array(n * 2)
  for (let i = 0; i <= SEG; i++) {
    k[i * 4] = i / SEG
    k[i * 4 + 2] = i / SEG
  }
  const cb = floorVerts
  k.set([0, 1, 0, 1, 1, 1, 1, 1], cb * 2)
  const idx: number[] = []
  for (let i = 0; i < SEG; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  idx.push(cb, cb + 1, cb + 2, cb + 1, cb + 3, cb + 2)
  const geo = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', posAttr)
  geo.setAttribute('aK', new THREE.BufferAttribute(k, 2))
  geo.setIndex(idx)
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(FORM_COLORS.car) }, uOpacity: { value: 1 } }])
  uniforms.uTime = WORLD_TIME
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  })
  // merge() cloned the uniform values, so tint the material's own colour.
  const color = mat.uniforms.uColor.value as THREE.Color
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'perfectBand'
  // Positions are rewritten every frame in world space, so culling would only misjudge it.
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  mesh.visible = false

  const put = (i: number, s: number, d: number, y: number): void => {
    const p = track.toWorld(s, d, y)
    pos[i * 3] = p.x
    pos[i * 3 + 1] = p.y
    pos[i * 3 + 2] = p.z
  }

  return {
    mesh,
    update(playerS, playerSpeed) {
      const b = track.nextBoundary(playerS)
      if (b === null || b.s - playerS > 600) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      color.set(FORM_COLORS[FORM_FOR[b.surface]])
      const len = Math.max(MIN_LEN, playerSpeed * PERFECT_WINDOW)
      const s0 = b.s - len
      for (let i = 0; i <= SEG; i++) {
        const s = s0 + (len * i) / SEG
        const f = track.frameAt(s)
        // Over water the band floats above the waves.
        const y = f.surface === 'water' ? 0.22 : 0.07
        const hw = f.width / 2
        put(i * 2, s, hw, y)
        put(i * 2 + 1, s, -hw, y)
      }
      const hw = track.frameAt(b.s - 0.05).width / 2 + 0.6
      put(cb, b.s, hw, 0.05)
      put(cb + 1, b.s, -hw, 0.05)
      put(cb + 2, b.s, hw, CURTAIN_H)
      put(cb + 3, b.s, -hw, CURTAIN_H)
      posAttr.needsUpdate = true
    },
  }
}
