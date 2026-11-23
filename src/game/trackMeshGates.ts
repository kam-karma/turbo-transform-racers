/**
 * The big set pieces over the road: the start and finish gates (candy pillars, printed
 * banner, bunting, balloon clusters, chequered line), themed arches (candy cane, ice
 * crystal, lava rock, bubbles over water), and rings over glides and boost pads.
 */
import * as THREE from 'three'
import type { TracksidePlan } from '../sim/landmarksTrackside'
import { GHOST_SLOTS, PLAYER_SLOT } from '../sim/grid'
import type { ThemeId, Track } from '../sim/track'
import { DEFAULT_WIDTH } from '../sim/track'
import { col, makeRng, range, type Rng } from './islandsGeo'
import { crystalCluster, lollipop } from './islandsDecor'
import { board, decal, roundBox, tint, tintY, upright, type Buckets } from './trackMeshKit'
import { KERB, THEME_COLORS } from './trackMeshRoad'

export interface BalloonSpot {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly r: number
  readonly color: string
}

export type SinkAt = (s: number) => Buckets

const CANDY = ['#ff4f8b', '#ffd23f', '#3fd0ff', '#8a5cff', '#5ee06a', '#ff8a2e']
const halfWidth = (track: Track, s: number): number => (track.frameAt(s).width ?? DEFAULT_WIDTH) / 2

/** A torus arc standing across the road (local XY plane), spanning angles a0..a1. */
function arc(R: number, r: number, a0: number, a1: number, radial = 8, tubular = 36): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(R, r, radial, tubular, a1 - a0)
  g.rotateZ(a0)
  return g
}

/** Points along a semicircle of radius R (angle 0 = left foot, π = right foot). */
function arcPoints(R: number, n: number): { p: THREE.Vector3; a: number }[] {
  const out: { p: THREE.Vector3; a: number }[] = []
  for (let k = 0; k < n; k++) {
    const a = (k / (n - 1)) * Math.PI
    out.push({ p: new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0), a })
  }
  return out
}

/** Fairy lights along the inside of an arch. */
function bulbs(R: number, n: number, colors: readonly string[]): THREE.BufferGeometry[] {
  return arcPoints(R, n).slice(1, -1).map(({ p }, i) => tint(new THREE.IcosahedronGeometry(0.22, 0).translate(p.x, p.y, -0.4), colors[i % colors.length]))
}

function candyArch(b: Buckets, R: number, rnd: Rng): void {
  const c = CANDY[Math.floor(rnd() * CANDY.length)]
  const tube = arc(R, 0.8, 0, Math.PI, 10, 44)
  const uv = tube.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 16)
  b.stripe.push(tint(tube, c))
  for (const x of [R, -R]) b.trim.push(tint(new THREE.SphereGeometry(1.25, 14, 10).translate(x, 0.4, 0), c))
  const pop = lollipop(1.2, 2.4, '#ffffff', CANDY[Math.floor(rnd() * CANDY.length)], 32)
  for (const g of pop) b.solid.push(g.translate(0, R - 0.6, 0))
  for (const x of [-R * 0.62, R * 0.62]) {
    const g = new THREE.IcosahedronGeometry(0.9, 2)
    g.scale(1, 0.75, 1)
    b.trim.push(tint(g.translate(x, R * 0.8, 0), CANDY[Math.floor(rnd() * CANDY.length)]))
  }
  b.glow.push(...bulbs(R - 0.9, 13, ['#fff4b0', '#ff9ad5']))
}

function iceArch(b: Buckets, R: number, rnd: Rng): void {
  b.trim.push(tintY(arc(R, 0.7, 0, Math.PI, 8, 40), '#7cc8ff', '#e8f8ff', 0, R))
  for (const { p, a } of arcPoints(R, 11)) {
    const h = range(rnd, 2.2, 4.2) * (0.7 + 0.3 * Math.sin(a))
    for (const g of crystalCluster(h, rnd)) {
      g.rotateZ(a - Math.PI / 2)
      b.solid.push(g.translate(p.x, p.y, 0))
    }
  }
  b.glow.push(...bulbs(R - 0.8, 11, ['#bff4ff', '#ffffff']))
}

function rockArch(b: Buckets, R: number, rnd: Rng): void {
  for (const { p, a } of arcPoints(R, 13)) {
    const g = new THREE.DodecahedronGeometry(range(rnd, 1.3, 1.9), 0)
    g.rotateY(rnd() * 3)
    g.scale(1, 1, range(rnd, 0.8, 1.1))
    const flat = g.toNonIndexed()
    flat.computeVertexNormals()
    b.solid.push(tintY(flat, '#3a2a2c', '#6e4a3e', -1.5, 1.5).translate(p.x, p.y, 0))
    if (a > 0.3 && a < Math.PI - 0.3) b.glow.push(tint(new THREE.IcosahedronGeometry(0.35, 0).translate(p.x * 0.86, p.y * 0.86, -0.9), '#ffb03a'))
  }
  b.glow.push(tint(arc(R - 1.3, 0.16, 0.15, Math.PI - 0.15, 4, 40).translate(0, 0, -0.6), '#ff6a1a'))
}

function bubbleArch(b: Buckets, R: number, rnd: Rng): void {
  for (const { p } of arcPoints(R, 17)) {
    const r = range(rnd, 0.6, 1.25)
    b.trim.push(tint(new THREE.IcosahedronGeometry(r, 1).translate(p.x + range(rnd, -0.3, 0.3), p.y, range(rnd, -0.4, 0.4)), rnd() < 0.3 ? '#ffffff' : '#7fe3f5'))
  }
  b.trim.push(tint(arc(R, 0.35, 0, Math.PI, 6, 36), '#3ec9e8'))
  b.glow.push(...bulbs(R - 0.9, 13, ['#c8fbff', '#ffe9a8']))
}

const ARCHES: Readonly<Record<ThemeId, (b: Buckets, R: number, rnd: Rng) => void>> = {
  candy: candyArch,
  ice: iceArch,
  volcano: rockArch,
  water: bubbleArch,
}

/** Builds an arch in local space and stands it on the road at s. */
function placeLocal(sink: Buckets, track: Track, s: number, build: (b: Buckets) => void): void {
  const local: Buckets = { stripe: [], solid: [], trim: [], glow: [], atlas: [] }
  build(local)
  for (const k of Object.keys(local) as (keyof Buckets)[]) for (const g of local[k]) sink[k].push(upright(g, track, s, 0, 0))
}

/** Triangular pennants hanging in a sagging line between two local points. */
function bunting(b: Buckets, from: THREE.Vector3, to: THREE.Vector3, sag: number, n: number, rnd: Rng): void {
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    pts.push(from.clone().lerp(to, t).setY(THREE.MathUtils.lerp(from.y, to.y, t) - sag * 4 * t * (1 - t)))
  }
  for (let k = 0; k < n; k++) {
    const a = pts[k]
    const c = pts[k + 1]
    const tip = a.clone().lerp(c, 0.5).setY((a.y + c.y) / 2 - 0.9)
    const pos = [a, c, tip, c, a, tip].flatMap((v) => [v.x, v.y, v.z])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    b.solid.push(tint(g, CANDY[(k + Math.floor(rnd() * 2)) % CANDY.length]))
  }
}

function gate(sink: Buckets, track: Track, s: number, finish: boolean, rnd: Rng, balloons: BalloonSpot[]): void {
  const hw = halfWidth(track, s)
  const X = hw + KERB + 1.3
  const H = 9.4
  const stack = finish ? ['#ffcf3a', '#ffffff', '#ff8a1a'] : ['#ff4f8b', '#ffffff', '#ffd23f']
  placeLocal(sink, track, s, (b) => {
    for (const x of [X, -X]) {
      b.trim.push(tint(new THREE.CylinderGeometry(1.7, 1.9, 0.9, 20).translate(x, 0.45, 0), '#ffffff'))
      for (let k = 0; k < 6; k++) {
        const g = new THREE.CylinderGeometry(1.05, 1.05, 1.18, 18)
        g.translate(x, 1.4 + k * 1.2, 0)
        b.trim.push(tint(g, stack[k % stack.length]))
        b.trim.push(tint(new THREE.TorusGeometry(1.08, 0.12, 6, 20).rotateX(Math.PI / 2).translate(x, 0.82 + k * 1.2, 0), '#ffffff'))
      }
      b.trim.push(tint(new THREE.SphereGeometry(1.55, 18, 12).translate(x, H + 1.9, 0), stack[0]))
      b.glow.push(tint(new THREE.OctahedronGeometry(0.7, 0).scale(1, 1.4, 0.5).translate(x, H + 4.1, 0), '#fff2a0'))
    }
    b.solid.push(tint(roundBox(2 * X, 2.3, 1.3, 0.45).translate(0, H, 0), '#fff6ec'))
    const BW = Math.min(11, 2 * X - 5)
    b.atlas.push(board(BW, BW / 2, finish ? 'bannerFinish' : 'bannerStart').translate(0, H + 0.4, -0.7))
    const back = board(BW, BW / 2, finish ? 'bannerFinish' : 'bannerStart')
    back.rotateY(Math.PI)
    b.atlas.push(back.translate(0, H + 0.4, 0.7))
    bunting(b, new THREE.Vector3(X - 0.6, H - 1.3, -0.3), new THREE.Vector3(-X + 0.6, H - 1.3, -0.3), 1.4, 14, rnd)
    b.glow.push(...[...Array(17).keys()].map((k) => tint(new THREE.IcosahedronGeometry(0.2, 0).translate(-X + 1.2 + (k * (2 * X - 2.4)) / 16, H - 1.25, -0.72), k % 2 === 0 ? '#fff3a0' : '#ff9ad5')))
  })
  // Balloon clusters tied to the pillar tops (animated by the life layer).
  const f = track.frameAt(s)
  for (const side of [1, -1]) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const p = track.toWorld(s + Math.sin(a) * 1.4, side * X + Math.cos(a) * 1.4, 0)
      balloons.push({ x: p.x, y: f.pos.y + H + 3.6 + range(rnd, 0, 2.2), z: p.z, r: range(rnd, 0.85, 1.15), color: CANDY[(k + (side > 0 ? 0 : 3)) % CANDY.length] })
    }
  }
  // Chequered line across the road and, at the start, painted grid boxes.
  const cells = Math.round((2 * hw) / 1.75)
  const w = (2 * hw) / cells
  for (let k = 0; k < cells; k++) for (const row of [0, 1]) sink.atlas.push(decal(track, s + (row - 0.5) * w * 1.0, hw - w * (k + 0.5), w, w, 'checker', '#ffffff', 0.04))
  if (!finish) for (const slot of [PLAYER_SLOT, ...GHOST_SLOTS]) sink.atlas.push(decal(track, slot.s + 1.0, slot.d, 2.9, 4.4, 'grid', '#ffffff', 0.035))
}

/**
 * A round floating plaza beyond either end of the road (so the course never just stops in
 * the air): rainbow-banded sides, frosted top, candy around the rim and, at the finish, a
 * winners' podium. `dir` = +1 past the finish, −1 behind the start.
 */
function plaza(sink: Buckets, track: Track, s: number, dir: 1 | -1, rnd: Rng): void {
  const R = 17
  const theme = track.themeAt(s)
  const c = THEME_COLORS[theme]
  const off = dir * (R - 1.5)
  placeLocal(sink, track, s, (b) => {
    const top = c.bands[0] === '#ffffff' ? '#f4fbff' : theme === 'volcano' ? '#6e4f46' : theme === 'water' ? '#86d957' : '#ffc6e2'
    b.solid.push(tint(new THREE.CylinderGeometry(R, R, 0.3, 40).translate(0, -0.2, off), top))
    c.bands.forEach((band, i) => {
      const r0 = R + 0.15 - i * 0.05
      b.trim.push(tint(new THREE.CylinderGeometry(r0, r0 - 0.05, 0.34, 40, 1, true).translate(0, -0.52 - i * 0.34, off), band))
    })
    const cone = new THREE.ConeGeometry(R * 0.95, 16, 14).rotateX(Math.PI).translate(0, -10.1, off).toNonIndexed()
    cone.computeVertexNormals()
    b.solid.push(tintY(cone, c.under, c.c, -18, -2))
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2
      const x = Math.cos(a) * (R - 1.6)
      const z = off + Math.sin(a) * (R - 1.6)
      // Keep the road's way in clear.
      if (Math.abs(x) < 9 && Math.sign(z - off) === -dir) continue
      if (k % 2 === 0) for (const g of lollipop(2.6, 1.3, '#ffffff', CANDY[k % CANDY.length], 24)) b.solid.push(g.translate(x, -0.05, z))
      else b.trim.push(tint(new THREE.SphereGeometry(1.0, 14, 10).scale(1, 0.85, 1).translate(x, 0.6, z), CANDY[(k + 2) % CANDY.length]))
    }
    if (dir > 0) {
      const steps: [number, number, string][] = [[0, 2.2, '#ffd23f'], [-4.2, 1.5, '#dfe6f2'], [4.2, 1.0, '#e8955a']]
      for (const [x, h, col2] of steps) {
        b.trim.push(tint(roundBox(4, h, 3.4, 0.3).translate(x, h / 2 - 0.05, off + 4), col2))
        b.atlas.push(board(1.6, 1.6, 'star', '#ffffff').translate(x, h * 0.5, off + 4 - 1.75))
      }
    }
    void rnd
  })
}

/** A hoop standing over the glide path (gaps) or the road (boost pads). */
function ring(sink: Buckets, track: Track, s: number, kind: 'glide' | 'boost'): void {
  const hw = halfWidth(track, s)
  placeLocal(sink, track, s, (b) => {
    if (kind === 'glide') {
      const y = 3.2
      b.trim.push(tint(new THREE.TorusGeometry(6.6, 0.62, 10, 48).translate(0, y, 0), '#ff6bd6'))
      b.trim.push(tint(new THREE.TorusGeometry(7.35, 0.22, 6, 48).translate(0, y, 0), '#ffd23f'))
      b.glow.push(tint(new THREE.TorusGeometry(5.95, 0.14, 4, 48).translate(0, y, 0), '#ffc2f0'))
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        b.glow.push(tint(new THREE.OctahedronGeometry(0.42, 0).translate(Math.cos(a) * 6.6, y + Math.sin(a) * 6.6, -0.6), '#fff4b0'))
      }
    } else {
      const R = hw + 0.9
      b.trim.push(tint(arc(R, 0.5, 0, Math.PI, 8, 40), '#1f7dff'))
      b.glow.push(tint(arc(R - 0.55, 0.15, 0.05, Math.PI - 0.05, 4, 40), '#7fe8ff'))
      b.glow.push(tint(arc(R + 0.55, 0.12, 0.05, Math.PI - 0.05, 4, 40), '#2ec5ff'))
    }
  })
}

/** Builds every gate, arch and ring into the chunk buckets; returns the balloon spots. */
export function buildGates(track: Track, plan: TracksidePlan, sinkAt: SinkAt): BalloonSpot[] {
  const rnd = makeRng(41)
  const balloons: BalloonSpot[] = []
  for (const g of plan.gates) gate(sinkAt(g.s), track, g.s, g.kind === 'finish', rnd, balloons)
  plaza(sinkAt(0), track, 0, -1, rnd)
  plaza(sinkAt(track.length), track, track.length, 1, rnd)
  for (const a of plan.arches) {
    const hw = halfWidth(track, a.s)
    const R = hw + (a.water ? 1.4 : KERB) + 1.2
    const theme = a.water ? 'water' : a.theme
    placeLocal(sinkAt(a.s), track, a.s, (b) => ARCHES[theme](b, R, rnd))
  }
  for (const r of plan.rings) ring(sinkAt(r.s), track, r.s, r.kind)
  return balloons
}

/** Theme kerb colour, for builders that want to match the road trims. */
export const kerbColor = (theme: ThemeId): THREE.Color => col(THEME_COLORS[theme].kerb)
