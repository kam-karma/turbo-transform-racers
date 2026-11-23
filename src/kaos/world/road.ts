/**
 * The light-ribbon road: a dark, wet deck drawn entirely in one shader (glowing edge ribbons
 * in the circuit's colours, lane dashes, boost chevrons, the start grid), with a fake wet
 * reflection of a neon city that moves with the camera, plus the deck's skirts and belly
 * with running lights. Built from the second lap's frames, which close seamlessly.
 */
import * as THREE from 'three'
import type { Track } from '../../sim/track'
import type { KaosCircuit } from '../tracks/index'

const STEP = 2
const RIM = 0.45
const DEPTH = 1.6

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aRoad;
varying vec4 vRoad;
varying vec3 vW;
varying vec3 vN;
void main() {
  vRoad = aRoad;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uHalfW;
uniform float uLap;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec4 uBoost[2];
varying vec4 vRoad;
varying vec3 vW;
varying vec3 vN;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float stripe(float x, float w) { return smoothstep(w, w * 0.35, abs(x)); }
float halo(float x, float w) { return exp(-abs(x) / w); }
bool inBoost(float s) {
  for (int i = 0; i < 2; i++) {
    if ((s >= uBoost[i].x && s < uBoost[i].y) || (s >= uBoost[i].z && s < uBoost[i].w)) return true;
  }
  return false;
}

/** A neon city seen in the wet road: colour bands by direction, bright vertical streaks. */
vec3 cityReflection(vec3 r) {
  float az = atan(r.x, r.z);
  float streak = pow(vnoise(vec2(az * 26.0, 0.5)), 6.0) * 2.2 + pow(vnoise(vec2(az * 61.0, 3.0)), 10.0) * 3.0;
  vec3 tint = mix(uA, uB, 0.5 + 0.5 * sin(az * 3.0 + 1.0));
  tint = mix(tint, uC, 0.25 * (0.5 + 0.5 * sin(az * 7.0))) * 0.8;
  float low = smoothstep(0.55, 0.0, r.y);
  return tint * (0.05 + streak) * low;
}

void main() {
  float d = vRoad.x;
  float s = vRoad.y;
  float part = vRoad.z;
  float k = vRoad.w;
  vec3 V = normalize(cameraPosition - vW);
  vec3 col;
  if (part < 0.5) {
    float ad = abs(d);
    float e = uHalfW - ad;
    bool left = d > 0.0;
    vec3 c1 = left ? uA : uB;
    vec3 c2 = left ? uB : uA;
    // wet asphalt: dark blue-black with puddles and fine grain
    float puddle = smoothstep(0.35, 0.75, vnoise(vW.xz * 0.11) * 0.7 + vnoise(vW.xz * 0.5) * 0.3);
    float grain = vnoise(vW.xz * 6.0);
    col = vec3(0.010, 0.012, 0.028) + vec3(0.012) * grain;
    // light ribbons along both edges, with their glow spilling onto the wet deck
    float r1 = stripe(e - 0.35, 0.2);
    float r2 = stripe(e - 0.95, 0.09);
    float r3 = stripe(e - 1.45, 0.06);
    col += c1 * (r1 * 3.0 + halo(e - 0.35, 0.9) * (0.16 + 0.2 * puddle));
    col += c2 * (r2 * 2.4 + r3 * 1.8 + halo(e - 0.95, 0.6) * 0.08);
    // outer rim (beyond the ribbons)
    col = mix(col, c1 * 0.35 + vec3(0.02), smoothstep(-0.02, -0.05, e));
    // lane dashes
    float lane = uHalfW / 3.0;
    float dash = step(fract(s / 14.0), 0.45);
    float lanes = stripe(ad - lane, 0.08) * dash;
    col += vec3(0.55, 0.85, 1.0) * lanes * 1.9;
    // boost chevrons, flowing forward
    if (inBoost(s) && ad < uHalfW * 0.4) {
      float chev = fract((s + ad * 0.9) / 4.0 - uTime * 1.2);
      float on = smoothstep(0.0, 0.03, chev) * smoothstep(0.13, 0.1, chev);
      float edgeFade = smoothstep(uHalfW * 0.4, uHalfW * 0.3, ad);
      col += uC * (on * 2.2 + 0.03) * edgeFade;
    }
    // start / finish grid: checker band and a bright line
    float sl = min(s, uLap - s);
    if (sl < 3.0) {
      float ch = mod(floor(d / 1.1) + floor(s / 1.1), 2.0);
      col = mix(col, vec3(0.75) * ch + vec3(0.02), smoothstep(3.0, 2.6, sl) * 0.85);
    }
    col += vec3(1.0, 0.35, 0.95) * stripe(sl - 3.4, 0.18) * 4.0;
    // wet reflection: fresnel, stronger on puddles
    vec3 N = normalize(vN);
    float fres = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 4.0);
    col += cityReflection(reflect(-V, N)) * (0.25 + 0.75 * puddle) * (0.35 + 1.6 * fres);
  } else if (part < 1.5) {
    // skirts: dark metal, a neon band under the deck edge and running lights
    vec3 c = d > 0.0 ? uA : uB;
    col = vec3(0.02, 0.02, 0.05) + c * stripe(k - 0.3, 0.09) * 3.0;
    float run = step(0.82, fract(s / 6.0 - uTime * 2.0)) * stripe(k - 0.65, 0.12);
    col += vec3(1.0, 0.75, 0.3) * run * 2.5;
  } else {
    // belly: dark with a glowing spine
    col = vec3(0.015, 0.012, 0.04) + uB * stripe(d, 0.5) * 2.5 + uA * halo(d, 3.0) * 0.15;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

export interface RoadView {
  readonly mesh: THREE.Mesh
  readonly material: THREE.ShaderMaterial
}

const col = (hex: number): THREE.Color => new THREE.Color(hex)

export function buildRoad(track: Track, c: KaosCircuit): RoadView {
  const L = c.lapLen
  const n = Math.ceil(L / STEP)
  const hw = c.spec.width / 2
  // profile corners (d, y) for the four strips: left skirt, top, right skirt, belly
  const prof: readonly (readonly [number, number, number, number, number])[] = [
    // d0, y0, d1, y1, part
    [hw + RIM, -DEPTH, hw + RIM, 0, 1],
    [hw + RIM, 0, -hw - RIM, 0, 0],
    [-hw - RIM, 0, -hw - RIM, -DEPTH, 1],
    [-hw - RIM, -DEPTH, hw + RIM, -DEPTH, 2],
  ]
  const pos: number[] = []
  const nor: number[] = []
  const road: number[] = []
  const idx: number[] = []
  let base = 0
  for (const [d0, y0, d1, y1, part] of prof) {
    for (let i = 0; i <= n; i++) {
      const s = L + Math.min(L, i * STEP)
      const f = track.frameAt(s)
      const v = Math.min(L, i * STEP)
      for (const [dd, yy, kk] of [[d0, y0, 0], [d1, y1, 1]] as const) {
        pos.push(f.pos.x + f.left.x * dd + f.up.x * yy, f.pos.y + f.left.y * dd + f.up.y * yy, f.pos.z + f.left.z * dd + f.up.z * yy)
        const nv = part === 0 ? f.up : part === 2 ? { x: -f.up.x, y: -f.up.y, z: -f.up.z } : { x: f.left.x * Math.sign(d0), y: f.left.y * Math.sign(d0), z: f.left.z * Math.sign(d0) }
        nor.push(nv.x, nv.y, nv.z)
        road.push(part === 1 ? d0 : dd, v, part, kk)
      }
      if (i > 0) {
        const a = base + (i - 1) * 2
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      }
    }
    base += (n + 1) * 2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('aRoad', new THREE.Float32BufferAttribute(road, 4))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  const boosts = (c.spec.boosts ?? []).map((u) => [u * L, u * L + 30])
  const b = [...boosts, [-1, -1], [-1, -1], [-1, -1], [-1, -1]].slice(0, 4)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHalfW: { value: hw },
      uLap: { value: L },
      uA: { value: col(c.palette.a) },
      uB: { value: col(c.palette.b) },
      uC: { value: col(c.palette.c) },
      uBoost: { value: [new THREE.Vector4(b[0][0], b[0][1], b[1][0], b[1][1]), new THREE.Vector4(b[2][0], b[2][1], b[3][0], b[3][1])] },
      ...THREE.UniformsLib.fog,
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    fog: true,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  return { mesh, material }
}
