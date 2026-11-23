/**
 * Things that flow: waterfalls and lava falls pouring off island rims into the cloud sea
 * (scrolling-streak shader), rising volcano smoke (instanced billboards) and rainbows.
 */
import * as THREE from 'three'
import { WORLD_TIME } from './islandsMaterial'

/**
 * A curved falling sheet starting at `start`, leaving the rim along `outward` and dropping
 * `length` metres. uv.x runs across, uv.y is metres fallen; aT is 0 at the lip … 1 at the end.
 */
export function fallGeo(start: THREE.Vector3, outward: THREE.Vector3, width: number, length: number): THREE.BufferGeometry {
  const ACROSS = 5
  const ALONG = 16
  const side = new THREE.Vector3().crossVectors(outward, new THREE.Vector3(0, 1, 0)).normalize()
  const pos: number[] = []
  const uv: number[] = []
  const at: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= ALONG; i++) {
    const t = i / ALONG
    const drop = length * t ** 1.15
    const out = 2.4 * THREE.MathUtils.smoothstep(t, 0, 0.18) + t * 4
    const w = width * (1 + t * 0.7)
    for (let k = 0; k <= ACROSS; k++) {
      const u = k / ACROSS
      const bulge = Math.sin(Math.PI * u) * w * 0.18
      const p = start
        .clone()
        .addScaledVector(outward, out + bulge)
        .addScaledVector(side, (u - 0.5) * w)
      p.y -= drop - (t < 0.06 ? 0.3 * (1 - t / 0.06) : 0)
      pos.push(p.x, p.y, p.z)
      uv.push(u, drop)
      at.push(t)
    }
  }
  for (let i = 0; i < ALONG; i++) {
    for (let k = 0; k < ACROSS; k++) {
      const a = i * (ACROSS + 1) + k
      const b = a + ACROSS + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1))
  g.setIndex(idx)
  return g.toNonIndexed()
}

const FLOW_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aT;
varying vec2 vUv;
varying float vT;
void main() {
  vUv = uv;
  vT = aT;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const FLOW_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uSpeed;
uniform float uGain;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uFoam;
varying vec2 vUv;
varying float vT;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), w.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), w.x), w.y);
}
void main() {
  float v = vUv.y * 0.12 - uTime * uSpeed;
  float n = vn(vec2(vUv.x * 9.0, v)) * 0.6 + vn(vec2(vUv.x * 21.0 + 5.0, v * 2.3)) * 0.4;
  vec3 c = mix(uA, uB, smoothstep(0.35, 0.75, n));
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  c = mix(uFoam, c, edge * 0.85 + 0.15);
  // White churn right at the lip.
  c = mix(c, uFoam, smoothstep(0.08, 0.0, vT) * 0.8);
  float a = (0.62 + 0.38 * n) * (1.0 - smoothstep(0.5, 1.0, vT)) * (0.35 + 0.65 * edge);
  gl_FragColor = vec4(c * uGain, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export function flowMaterial(kind: 'water' | 'lava'): THREE.ShaderMaterial {
  const water = kind === 'water'
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uSpeed: { value: water ? 1.6 : 0.35 },
      uGain: { value: water ? 1.05 : 2.6 },
      uA: { value: new THREE.Color(water ? '#3dbdf2' : '#ff4a0a') },
      uB: { value: new THREE.Color(water ? '#bff0ff' : '#ffc02a') },
      uFoam: { value: new THREE.Color(water ? '#ffffff' : '#fff0a0') },
    },
  ])
  uniforms.uTime = WORLD_TIME
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FLOW_VERT,
    fragmentShader: FLOW_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  })
}

function puffTexture(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')
  if (ctx !== null) {
    ctx.filter = 'blur(3px)'
    const blobs: [number, number, number][] = [[64, 70, 34], [42, 60, 24], [86, 58, 26], [60, 44, 24], [76, 80, 22]]
    for (const [x, y, r] of blobs) {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.7, 'rgba(205,205,215,0.95)')
      g.addColorStop(1, 'rgba(170,170,190,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const SMOKE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 iBase;
attribute vec2 iSeed;
uniform float uTime;
varying vec2 vUv;
varying float vLife;
void main() {
  float life = fract(uTime * 0.045 + iSeed.x);
  vLife = life;
  vec3 c = iBase + vec3(sin(iSeed.x * 40.0 + life * 3.0) * 4.0 + life * 30.0, life * 110.0, cos(iSeed.x * 31.0) * 4.0 + life * 12.0);
  vec4 mvPosition = viewMatrix * vec4(c, 1.0);
  float size = iSeed.y * (0.7 + life * 2.2);
  mvPosition.xy += position.xy * size;
  vUv = uv;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const SMOKE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uMap;
varying vec2 vUv;
varying float vLife;
void main() {
  vec4 t = texture2D(uMap, vUv);
  // Dark sooty at the vent, paler as it rises; ember glow at the very bottom.
  vec3 c = mix(vec3(0.16, 0.13, 0.14), vec3(0.55, 0.53, 0.56), smoothstep(0.0, 0.8, vLife)) * t.rgb;
  c += vec3(1.6, 0.5, 0.1) * smoothstep(0.12, 0.0, vLife);
  float a = t.a * smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife)) * 0.9;
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

/** One instanced mesh of smoke puffs rising from the given vents (puffs per vent ~ 14). */
export function smokeMesh(vents: readonly { p: THREE.Vector3; size: number }[], perVent: number): THREE.Mesh | null {
  if (vents.length === 0) return null
  const quad = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.setAttribute('position', quad.getAttribute('position'))
  geo.setAttribute('uv', quad.getAttribute('uv'))
  const base: number[] = []
  const seed: number[] = []
  vents.forEach((v, vi) => {
    for (let k = 0; k < perVent; k++) {
      base.push(v.p.x, v.p.y, v.p.z)
      seed.push((k + vi * 0.37) / perVent, v.size * (0.8 + ((k * 7) % 5) * 0.08))
    }
  })
  geo.setAttribute('iBase', new THREE.InstancedBufferAttribute(new Float32Array(base), 3))
  geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 2))
  geo.instanceCount = base.length / 3
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: puffTexture() } }])
  uniforms.uTime = WORLD_TIME
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, transparent: true, depthWrite: false, fog: true })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.name = 'smoke'
  return mesh
}

const RAINBOW = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#6ee06a', '#4cb8ff', '#8a6cff']

/** A half-ring rainbow of radius R standing in the plane facing `facing` (horizontal). */
export function rainbowGeo(centre: THREE.Vector3, R: number, band: number, facing: number): THREE.BufferGeometry {
  const pos: number[] = []
  const colArr: number[] = []
  const SEG = 40
  const c = new THREE.Color()
  const n = RAINBOW.length
  const ring = (k: number): number => R + band * (0.5 - k / n)
  for (let b = 0; b < n; b++) {
    c.set(RAINBOW[b])
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI
      const a1 = ((i + 1) / SEG) * Math.PI
      const r0 = ring(b)
      const r1 = ring(b + 1)
      const p = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r]
      const quad = [p(r0, a0), p(r1, a0), p(r0, a1), p(r1, a0), p(r1, a1), p(r0, a1)]
      for (const [x, y] of quad) {
        pos.push(x, y, 0)
        colArr.push(c.r, c.g, c.b)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3))
  g.rotateY(facing)
  g.translate(centre.x, centre.y, centre.z)
  return g
}

export function rainbowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, fog: true })
}
