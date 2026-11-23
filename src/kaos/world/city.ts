/**
 * The city: dark angular towers in one instanced draw (windows, neon corner strips, bands
 * and crowns all drawn by the shader from world position, so any tower size looks right),
 * and their placement clear of the roads. Billboards live in billboards.ts.
 */
import * as THREE from 'three'
import type { KaosCircuit } from '../tracks/index'
import { rand, type RoadField } from './layout'

export interface Tower {
  readonly x: number
  readonly z: number
  readonly w: number
  readonly d: number
  readonly h: number
  readonly color: THREE.Color
  /** Distance to the nearest road. */
  readonly clear: number
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vObj;
varying vec3 vScale;
varying vec3 vN;
flat varying vec3 vCol;
flat varying float vSeed;
void main() {
  vObj = position;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vN = normal;
  vCol = instanceColor;
  vSeed = float(gl_InstanceID);
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec3 vObj;
varying vec3 vScale;
varying vec3 vN;
flat varying vec3 vCol;
flat varying float vSeed;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float style = h1(vSeed * 1.37);
  float y = vObj.y * vScale.y;
  vec3 col;
  if (abs(vN.y) > 0.5) {
    // roof: dark with a glowing rim
    vec2 q = abs(vObj.xz) * 2.0;
    float edge = max(smoothstep(0.9, 0.97, q.x), smoothstep(0.9, 0.97, q.y));
    col = vec3(0.02, 0.02, 0.05) + vCol * edge * 2.5;
  } else {
    bool fx = abs(vN.x) > 0.5;
    float u = fx ? vObj.z : vObj.x;
    float wFace = fx ? vScale.z : vScale.x;
    float hx = u * wFace;
    // base: deep navy, slightly lighter up high (sky light), darker near the ground haze
    col = mix(vec3(0.012, 0.012, 0.035), vec3(0.035, 0.03, 0.09), smoothstep(0.0, 1.0, vObj.y));
    // windows
    vec2 cell = vec2(floor(hx / 3.4), floor(y / 3.8));
    vec2 f = vec2(fract(hx / 3.4), fract(y / 3.8));
    float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.75);
    float r = h2(cell + vSeed * 17.0 + (fx ? 3.1 : 7.7));
    float lit = step(r, 0.14 + 0.2 * style);
    // far away the window grid would shimmer: blend to its average brightness
    float aa = clamp(max(fwidth(hx / 3.4), fwidth(y / 3.8)) * 1.6 - 0.2, 0.0, 1.0);
    vec3 wc = mix(vec3(1.0, 0.72, 0.42), vCol, step(0.55, h2(cell * 1.7 + vSeed)));
    float flick = 0.85 + 0.15 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
    col += wc * mix(win * lit * (0.6 + 0.9 * r) * flick, 0.12 * (0.14 + 0.2 * style), aa);
    // neon corner strips (most towers)
    float corner = smoothstep(0.47, 0.495, abs(u));
    col += vCol * corner * step(0.3, style) * 2.2;
    // horizontal bands every few floors on some towers
    float band = step(0.65, style) * smoothstep(0.465, 0.485, abs(fract(y / 22.0) - 0.5));
    col += vCol * band * 1.8;
    // crown: a bright band at the top
    float crown = smoothstep(vScale.y - 3.5, vScale.y - 2.5, y) * step(y, vScale.y - 0.6);
    col += mix(vCol, vec3(1.0), 0.2) * crown * 2.4;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

/** Places towers on a jittered grid around and inside the circuit, clear of the roads. */
export function placeTowers(field: RoadField, c: KaosCircuit, decor: number, groundY: number): Tower[] {
  const r = rand(c.seed * 977 + 5)
  const hw = c.spec.width / 2
  const out: Tower[] = []
  const pad = 420
  const step = 42 / Math.sqrt(Math.max(0.3, decor))
  const colors = [c.palette.a, c.palette.b, c.palette.c, 0x7a5cff, 0xff9a1f].map((h) => new THREE.Color(h))
  for (let x = field.min.x - pad; x <= field.max.x + pad; x += step) {
    for (let z = field.min.z - pad; z <= field.max.z + pad; z += step) {
      const px = x + (r() - 0.5) * step * 0.6
      const pz = z + (r() - 0.5) * step * 0.6
      const w = 12 + r() * 22
      const d = 12 + r() * 22
      const near = field.nearest(px, pz)
      const clear = near.dist - Math.hypot(w, d) / 2
      if (clear < hw + 30) continue
      // thin out the far ring, keep a dense wall near the roads
      if (clear > 160 && r() < 0.45) continue
      // mid-rise blocks along the ribbons keep the sky, lasers and landmarks in view;
      // the skyscrapers stand further back
      const roadTop = near.y - groundY
      const h = clear < 70 ? roadTop + 6 + r() * 38 : clear < 180 ? roadTop + 20 + r() * 90 : 70 + r() * 180
      out.push({ x: px, z: pz, w, d, h, color: colors[Math.floor(r() * colors.length)], clear })
    }
  }
  return out
}

export function buildTowers(towers: readonly Tower[], groundY: number): { mesh: THREE.InstancedMesh; material: THREE.ShaderMaterial } {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.translate(0, 0.5, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, ...THREE.UniformsLib.fog },
    vertexShader: VERT,
    fragmentShader: FRAG,
    fog: true,
  })
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, towers.length))
  const m = new THREE.Matrix4()
  towers.forEach((t, i) => {
    m.makeScale(t.w, t.h, t.d).setPosition(t.x, groundY, t.z)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, t.color)
  })
  mesh.count = towers.length
  mesh.frustumCulled = false
  return { mesh, material }
}
