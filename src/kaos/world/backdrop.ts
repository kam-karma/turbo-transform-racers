/**
 * Everything far away and overhead: the night sky dome (deep blue to a magenta horizon glow
 * with stars), two rings of skyline silhouettes, the wet city floor with glowing street grid
 * and traffic, laser beams sweeping the sky from tower tops, and rain around the camera.
 */
import * as THREE from 'three'
import type { KaosCircuit } from '../tracks/index'
import type { Tower } from './city'
import { FOG_FADE } from './materials'
import { skylineTexture } from './textures'

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 zen = vec3(0.004, 0.006, 0.03);
  vec3 mid = vec3(0.025, 0.018, 0.09);
  vec3 hor = vec3(0.16, 0.03, 0.2);
  vec3 col = mix(mid, zen, smoothstep(0.1, 0.8, y));
  col = mix(hor, col, smoothstep(-0.02, 0.22, y));
  // coloured haze wraps around the horizon
  float az = atan(d.x, d.z);
  col += uA * 0.06 * smoothstep(0.25, 0.0, y) * (0.5 + 0.5 * sin(az * 2.0 + 0.7));
  col += uB * 0.08 * smoothstep(0.2, 0.0, y) * (0.5 + 0.5 * sin(az * 3.0 - 1.3));
  // stars
  vec2 g = vec2(az * 90.0, y * 140.0);
  float st = step(0.996, h2(floor(g))) * smoothstep(0.05, 0.3, y);
  col += vec3(0.9, 0.95, 1.0) * st * (0.6 + 0.4 * sin(uTime * 3.0 + h2(floor(g) * 1.3) * 30.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const GROUND_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const GROUND_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
varying vec3 vW;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float line(float x, float w) { return smoothstep(w, 0.0, abs(x)); }
void main() {
  vec2 p = vW.xz;
  vec2 cell = floor(p / 64.0);
  vec2 f = p / 64.0 - cell - 0.5;
  vec3 col = vec3(0.008, 0.008, 0.022);
  // streets: glowing grid with moving traffic dashes
  float sx = line(f.x, 0.035);
  float sz = line(f.y, 0.035);
  float tx = step(0.7, fract(p.y / 9.0 + uTime * (0.8 + h2(cell) * 1.5)));
  float tz = step(0.7, fract(p.x / 9.0 - uTime * (0.8 + h2(cell + 3.0) * 1.5)));
  col += uA * sx * (0.25 + 1.6 * tx) + uB * sz * (0.25 + 1.6 * tz);
  // building glow pooled on the wet floor near the streets
  col += mix(uA, uB, 0.5 + 0.5 * sin(p.x * 0.01 + p.y * 0.013)) * 0.012;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

const BEAM_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying float vT;
flat varying vec3 vCol;
void main() {
  vT = position.z;
  vCol = instanceColor;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const BEAM_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying float vT;
flat varying vec3 vCol;
void main() {
  float a = (1.0 - vT) * smoothstep(0.0, 0.02, vT);
  gl_FragColor = vec4(vCol * 3.0 * a, 0.0);
  ${FOG_FADE.replace('vFogDepth * vFogDepth', 'vFogDepth * vFogDepth * 0.15')}
}
`

export interface Backdrop {
  readonly group: THREE.Group
  update(t: number, camera: THREE.Camera, dt: number): void
}

interface Beam { readonly x: number; readonly y: number; readonly z: number; readonly phase: number; readonly speed: number }

export function buildBackdrop(c: KaosCircuit, center: { x: number; z: number }, groundY: number, towers: readonly Tower[], particles: number): Backdrop {
  const group = new THREE.Group()
  const uA = new THREE.Color(c.palette.a)
  const uB = new THREE.Color(c.palette.b)

  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: uA }, uB: { value: uB } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat)
  sky.renderOrder = -10
  sky.frustumCulled = false
  group.add(sky)

  for (const [r, h, k, off] of [[2300, 520, 5, 0], [1700, 380, 4, 0.37]] as const) {
    const tex = skylineTexture().clone()
    tex.repeat.set(k, 1)
    tex.offset.set(off, 0)
    tex.needsUpdate = true
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, color: new THREE.Color(r > 2000 ? 0.55 : 0.85, r > 2000 ? 0.55 : 0.85, r > 2000 ? 0.7 : 0.95),
    }))
    ring.position.set(center.x, groundY + h / 2 - 20, center.z)
    ring.renderOrder = -9
    group.add(ring)
  }

  const groundMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: uA }, uB: { value: uB }, ...THREE.UniformsLib.fog },
    vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, fog: true,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(center.x, groundY, center.z)
  group.add(ground)

  // laser beams from the tallest towers
  const tall = [...towers].sort((a, b) => b.h - a.h).slice(0, 12)
  const beams: Beam[] = tall.map((t, i) => ({ x: t.x, y: groundY + t.h, z: t.z, phase: i * 1.7, speed: 0.12 + (i % 4) * 0.05 }))
  const beamGeo = new THREE.BoxGeometry(1.2, 1.2, 1)
  beamGeo.translate(0, 0, 0.5)
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog }, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, fog: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, Math.max(1, beams.length))
  const pal = [c.palette.a, c.palette.b, c.palette.c, 0xffffff]
  beams.forEach((_, i) => beamMesh.setColorAt(i, new THREE.Color(pal[i % pal.length])))
  beamMesh.count = beams.length
  beamMesh.frustumCulled = false
  group.add(beamMesh)

  // rain: short streaks in a box that follows the camera
  const drops = Math.round(1400 * particles)
  const rainPos = new Float32Array(drops * 6)
  const seeds = new Float32Array(drops * 3)
  for (let i = 0; i < drops; i++) {
    seeds[i * 3] = Math.random()
    seeds[i * 3 + 1] = Math.random()
    seeds[i * 3 + 2] = Math.random()
  }
  const rainGeo = new THREE.BufferGeometry()
  const rainAttr = new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage)
  rainGeo.setAttribute('position', rainAttr)
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.45, 0.6, 1.0), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
  rain.frustumCulled = false
  group.add(rain)

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const one = new THREE.Vector3()
  const p = new THREE.Vector3()
  const R = 46
  const wrap = (v: number, c: number, r: number): number => c + ((((v - c) % (2 * r)) + 3 * r) % (2 * r)) - r
  return {
    group,
    update(t, camera, dt) {
      skyMat.uniforms.uTime.value = t
      groundMat.uniforms.uTime.value = t
      sky.position.copy(camera.position)
      beams.forEach((b, i) => {
        e.set(-(0.45 + 0.35 * Math.sin(t * 0.3 + b.phase)), t * b.speed + b.phase, 0, 'YXZ')
        q.setFromEuler(e)
        m.compose(p.set(b.x, b.y, b.z), q, one.set(1, 1, 1600))
        beamMesh.setMatrixAt(i, m)
      })
      beamMesh.instanceMatrix.needsUpdate = true
      const cp = camera.position
      const fall = 38 * Math.min(dt, 0.1)
      for (let i = 0; i < drops; i++) {
        seeds[i * 3 + 1] = (seeds[i * 3 + 1] - fall / (2 * R) + 1) % 1
        // world-anchored drops, wrapped into a box round the camera
        const x = wrap(seeds[i * 3] * 2 * R, cp.x, R)
        const y = wrap(seeds[i * 3 + 1] * 1.2 * R, cp.y, 0.6 * R)
        const z = wrap(seeds[i * 3 + 2] * 2 * R, cp.z, R)
        rainPos.set([x, y, z, x + 0.15, y + 1.4, z + 0.1], i * 6)
      }
      rainAttr.needsUpdate = true
    },
  }
}
