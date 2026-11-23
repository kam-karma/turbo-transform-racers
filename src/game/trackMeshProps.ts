/**
 * Track furniture: candy-cane rails and posts, boost chevrons, and the glowing jump lips and
 * landing pads around the gaps. All of it is merged per material.
 */
import * as THREE from 'three'
import type { Track } from '../sim/track'
import { DEFAULT_WIDTH } from '../sim/track'
import { col } from './islandsGeo'
import { WORLD_TIME } from './islandsMaterial'
import { BOOST_W, KERB, THEME_COLORS } from './trackMeshRoad'
import { onTrack, sectionStarts, sweep, type ProfilePoint } from './trackMeshSweep'

const RAIL_Y = 1.0
const RAIL_R = 0.2
const POST_EVERY = 10

const solid = (s: string): boolean => s === 'road' || s === 'ice' || s === 'climb'

function colored(g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r
    a[i * 3 + 1] = c.g
    a[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

function post(track: Track, s: number, d: number, tint: THREE.Color, h = RAIL_Y): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.13, 0.16, h, 6, 1, true)
  // Two spiral turns per post.
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 2 * (h / RAIL_Y))
  g.translate(0, h / 2, 0)
  return onTrack(colored(g, tint), track, s, d, 0)
}

/** Rails, posts and the beacon poles: everything that wears the candy-stripe material. */
export function buildRails(track: Track, coarse = false): THREE.BufferGeometry[] {
  const railStep = coarse ? 8 : 5
  const postEvery = coarse ? 16 : POST_EVERY
  const out: THREE.BufferGeometry[] = []
  const starts = sectionStarts(track)
  const ring: ProfilePoint[] = []
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI * 2
    ring.push({ d: Math.cos(a) * RAIL_R, y: RAIL_Y + Math.sin(a) * RAIL_R, u: k / 6 })
  }
  track.def.sections.forEach((sec, i) => {
    if (!solid(sec.surface)) return
    const s0 = starts[i]
    const s1 = Math.min(track.length, s0 + sec.len)
    const dr = (sec.width ?? DEFAULT_WIDTH) / 2 + KERB - 0.45
    const tint = (s: number): THREE.Color => col(THEME_COLORS[track.themeAt(s)].kerb)
    for (const side of [1, -1]) {
      const pts = ring.map((p) => ({ d: p.d + dr * side, y: p.y, u: p.u }))
      out.push(sweep(track, s0, s1, railStep, [{ pts, color: tint }], 1.6))
      for (let s = s0 + 0.3; s < s1; s += postEvery) out.push(post(track, s, dr * side, tint(s)))
      out.push(post(track, s1 - 0.3, dr * side, tint(s1)))
    }
  })
  return out
}

/** The glowing bits around gaps and boost pads (glow material, vertex colours). */
export function buildGlowMarks(track: Track): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  const starts = sectionStarts(track)
  const secs = track.def.sections
  const PINK = col('#ff3fc8')
  const YELLOW = col('#ffc21a')
  secs.forEach((sec, i) => {
    const s0 = starts[i]
    const s1 = Math.min(track.length, s0 + sec.len)
    const hw = (sec.width ?? DEFAULT_WIDTH) / 2
    const e = hw + KERB
    if (solid(sec.surface) && secs[i + 1]?.surface === 'gap') {
      // Take-off lip: a bright bar on the edge plus pink chevrons leading up to it.
      out.push(bar(track, s1 - 0.3, e * 2 + 0.4, 0.34, 0.6, PINK))
      for (let k = 1; k <= 5; k++) out.push(chevron(track, s1 - k * 5, hw * 0.5, 2.6, 0.85, PINK, 0.02))
      out.push(...beacons(track, s1 - 0.6, e, PINK))
    }
    if (solid(sec.surface) && secs[i - 1]?.surface === 'gap') {
      // Landing pad: lit frame and forward chevrons in the colour of the car form.
      out.push(bar(track, s0 + 0.3, e * 2 + 0.4, 0.34, 0.6, YELLOW))
      const L = 26
      for (const side of [1, -1]) out.push(strip(track, s0 + 0.5, s0 + L, (hw - 0.6) * side, 0.35, YELLOW))
      out.push(bar(track, s0 + L, hw * 2 - 0.8, 0.05, 0.35, YELLOW))
      for (let k = 1; k <= 4; k++) out.push(chevron(track, s0 + 2 + k * 5, hw * 0.5, 2.6, 0.85, YELLOW, 0.025))
      out.push(...beacons(track, s0 + 0.6, e, YELLOW))
    }
    for (const [a, b] of sec.boost ?? []) {
      // Thin lit borders frame each boost pad; the chevrons themselves animate separately.
      for (const side of [1, -1]) out.push(strip(track, s0 + a, Math.min(s1, s0 + b), (hw * BOOST_W + 0.12) * side, 0.3, col('#2ec5ff')))
    }
  })
  return out
}

function bar(track: Track, s: number, w: number, h: number, depth: number, c: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, depth)
  g.translate(0, h / 2, 0)
  return onTrack(colored(g, c), track, s, 0, 0)
}

/** A flat lit line along the road from sA to sB at lateral offset d. */
function strip(track: Track, sA: number, sB: number, d: number, w: number, c: THREE.Color): THREE.BufferGeometry {
  return sweep(track, sA, sB, 2, [{ pts: [{ d: d + w / 2, y: 0.035 }, { d: d - w / 2, y: 0.035 }], color: () => c }], 1)
}

/** Flat forward-pointing chevron lying on the road. */
function chevronGeo(halfW: number, len: number, thick: number): THREE.BufferGeometry {
  // Shape space: x = left, y = backward (tip at −y ends up pointing forward on the road).
  const sh = new THREE.Shape()
  sh.moveTo(0, -len / 2)
  sh.lineTo(halfW, len / 2)
  sh.lineTo(halfW - thick * 1.2, len / 2)
  sh.lineTo(0, -len / 2 + thick * 1.6)
  sh.lineTo(-halfW + thick * 1.2, len / 2)
  sh.lineTo(-halfW, len / 2)
  sh.closePath()
  const g = new THREE.ShapeGeometry(sh)
  g.rotateX(-Math.PI / 2)
  return g
}

function chevron(track: Track, s: number, halfW: number, len: number, thick: number, c: THREE.Color, y: number): THREE.BufferGeometry {
  return onTrack(colored(chevronGeo(halfW, len, thick), c), track, s, 0, y)
}

function beacons(track: Track, s: number, e: number, c: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  for (const side of [1, -1]) {
    const pole = new THREE.CylinderGeometry(0.1, 0.14, 3.2, 8)
    pole.translate(0, 1.6, 0)
    out.push(onTrack(colored(pole, col('#fff6ec')), track, s, (e + 0.2) * side, 0))
    const orb = new THREE.IcosahedronGeometry(0.55, 1)
    orb.translate(0, 3.5, 0)
    out.push(onTrack(colored(orb, c), track, s, (e + 0.2) * side, 0))
  }
  return out
}

const BOOST_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
attribute float aS;
varying float vGlow;
void main() {
  // A crest of light runs forward through the chevrons, faster than the cars.
  float ph = fract(aS / 16.0 - uTime * 1.6);
  vGlow = 0.45 + 2.6 * pow(ph, 6.0);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const BOOST_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
varying float vGlow;
void main() {
  vec3 c = uColor * (1.1 + vGlow * 1.8) + vec3(0.8) * max(0.0, vGlow - 1.2);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

/** Boost chevrons with a travelling glow; null when the track has no boost pads. */
export function buildBoostArrows(track: Track): THREE.Mesh | null {
  const starts = sectionStarts(track)
  const parts: THREE.BufferGeometry[] = []
  track.def.sections.forEach((sec, i) => {
    const hw = (sec.width ?? DEFAULT_WIDTH) / 2
    for (const [a, b] of sec.boost ?? []) {
      for (let s = starts[i] + a + 2; s < starts[i] + b - 1; s += 3.2) {
        const g = chevronGeo(hw * 0.55, 2.2, 0.75)
        g.deleteAttribute('uv')
        g.deleteAttribute('normal')
        const n = g.getAttribute('position').count
        g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(n).fill(s), 1))
        parts.push(onTrack(g, track, s, 0, 0.04).toNonIndexed())
      }
    }
  })
  if (parts.length === 0) return null
  const merged = new THREE.BufferGeometry()
  const pos: number[] = []
  const aS: number[] = []
  for (const p of parts) {
    pos.push(...(p.getAttribute('position').array as Float32Array))
    aS.push(...(p.getAttribute('aS').array as Float32Array))
    p.dispose()
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  merged.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1))
  merged.computeBoundingSphere()
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color('#1fb4ff') } }])
  uniforms.uTime = WORLD_TIME
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: BOOST_VERT, fragmentShader: BOOST_FRAG, fog: true })
  const mesh = new THREE.Mesh(merged, mat)
  mesh.name = 'boostArrows'
  return mesh
}
