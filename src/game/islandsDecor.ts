/**
 * Island props per theme, chunky and soft-shaded: lollipops, gumdrops, candy balls and
 * cotton-candy trees; ice crystals and snowy pines; volcanic rocks with glowing lava pools;
 * round leafy trees and bushes. Each prop is planned first (size, for the road-clearance
 * check) and only then built into the caller's merge lists.
 */
import * as THREE from 'three'
import type { ThemeId } from '../sim/track'
import { blob, col, finish, gradY, lathe, paint, pick, place, range, type Rng } from './islandsGeo'

export interface DecorSink {
  readonly solid: THREE.BufferGeometry[]
  readonly glow: THREE.BufferGeometry[]
}

export interface DecorPlan {
  /** Footprint radius and height, for the clearance check. */
  readonly r: number
  readonly h: number
  build(sink: DecorSink, at: THREE.Vector3): void
}

const CANDY = ['#ff4f7b', '#ffb52e', '#7be05a', '#b46cff', '#3fc7ff', '#ff7ad9', '#ffe14d']
const tmp = new THREE.Color()

/** Spiral-swirled lens: the lollipop head, standing up and facing along local Z. */
function swirlDisc(R: number, c1: string, c2: string, seg = 32): THREE.BufferGeometry {
  const T = R * 0.22
  const pts: [number, number][] = [[0, -T]]
  const K = seg > 32 ? 8 : seg > 16 ? 4 : 3
  for (let k = 1; k <= K; k++) pts.push([(R * k) / K, -T * Math.cos(((k / K) * Math.PI) / 2) ** 0.5])
  for (let k = K - 1; k >= 1; k--) pts.push([(R * k) / K, T * Math.cos(((k / K) * Math.PI) / 2) ** 0.5])
  pts.push([0, T])
  const a = col(c1)
  const b = col(c2)
  const g = lathe(pts, seg, (p) => {
    const ang = Math.atan2(p.z, p.x)
    const rr = Math.hypot(p.x, p.z) / R
    const f = (((ang / (Math.PI * 2)) * 3 + rr * 1.6) % 1 + 1) % 1
    return tmp.copy(f < 0.5 ? a : b)
  })
  g.rotateX(Math.PI / 2)
  return g
}

function stick(h: number, r: number, color = '#fff8f0'): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r * 1.1, h, 8, 1, true)
  g.translate(0, h / 2, 0)
  return paint(finish(g), col(color))
}

export function lollipop(h: number, R: number, c1: string, c2: string, seg = 28): THREE.BufferGeometry[] {
  const head = swirlDisc(R, c1, c2, seg)
  head.translate(0, h + R * 0.85, 0)
  return [stick(h + R * 0.5, Math.max(0.12, R * 0.07)), head]
}

export function gumdrop(r: number, c: string): THREE.BufferGeometry {
  const base = col(c)
  const light = base.clone().lerp(col('#ffffff'), 0.35)
  return lathe(
    [[0, 0], [r, 0], [r * 1.0, r * 0.3], [r * 0.85, r * 0.75], [r * 0.5, r * 1.08], [0, r * 1.2]],
    14,
    gradY(base.clone().multiplyScalar(0.75), light, 0, r * 1.2),
  )
}

function candyBall(r: number, c1: string, c2: string): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 12, 8)
  g.translate(0, r * 0.9, 0)
  const a = col(c1)
  const b = col(c2)
  return paint(finish(g), (p) => tmp.copy(Math.sin(Math.atan2(p.z, p.x) * 3 + p.y * 0.6) > 0 ? a : b))
}

function cottonTree(h: number, c: string): THREE.BufferGeometry[] {
  const out = [stick(h, Math.max(0.15, h * 0.04), '#fff1e2')]
  const base = col(c)
  const paintPuff = gradY(base.clone().multiplyScalar(0.8), base.clone().lerp(col('#ffffff'), 0.4), -h * 0.2, h * 0.25)
  const puffs: [number, number, number, number][] = [
    [0, h, 0, h * 0.34],
    [h * 0.22, h * 0.88, h * 0.08, h * 0.24],
    [-h * 0.2, h * 0.9, -h * 0.1, h * 0.25],
  ]
  for (const [x, y, z, r] of puffs) out.push(place(blob(r, 1, paintPuff), new THREE.Vector3(x, y, z)))
  return out
}

function crystal(h: number, r: number): THREE.BufferGeometry {
  const deep = col('#4aa6ee')
  const mid = col('#9fe0ff')
  const tipC = col('#ffffff')
  return lathe(
    [[0, 0], [r, 0], [r, h * 0.72], [0, h]],
    6,
    (p) => (p.y < h * 0.6 ? tmp.copy(deep).lerp(mid, p.y / (h * 0.6)) : tmp.copy(mid).lerp(tipC, (p.y - h * 0.6) / (h * 0.4))),
    true,
  )
}

export function crystalCluster(h: number, rnd: Rng): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [crystal(h, h * 0.16)]
  const n = 3 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd()
    const hh = h * range(rnd, 0.35, 0.7)
    const g = crystal(hh, hh * 0.18)
    out.push(place(g, new THREE.Vector3(Math.cos(a) * h * 0.14, 0, Math.sin(a) * h * 0.14), 0, 1, Math.cos(a) * 0.45, -Math.sin(a) * 0.45))
  }
  return out
}

function snowPine(h: number): THREE.BufferGeometry[] {
  const out = [stick(h * 0.25, h * 0.05, '#8a5a3c')]
  const green = col('#2c9a86')
  const snow = col('#ffffff')
  for (let k = 0; k < 3; k++) {
    const r = h * (0.34 - k * 0.08)
    const y0 = h * (0.18 + k * 0.24)
    const ch = h * 0.38
    const g = lathe([[0, 0], [r, 0], [r * 0.85, ch * 0.12], [0, ch]], 10, (p) => tmp.copy(p.y > ch * 0.55 ? snow : green).multiplyScalar(0.85 + 0.15 * (p.y / ch)))
    out.push(place(g, new THREE.Vector3(0, y0, 0)))
  }
  return out
}

function rock(r: number, c: string, rnd: Rng): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(r, 0)
  g.scale(range(rnd, 0.9, 1.3), range(rnd, 0.55, 0.9), range(rnd, 0.9, 1.2))
  const base = col(c)
  const f = finish(g, true)
  return paint(f, (p) => tmp.copy(base).multiplyScalar(0.8 + 0.4 * THREE.MathUtils.clamp(p.y / r + 0.5, 0, 1)))
}

function lavaPool(r: number): { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry } {
  const rim = lathe([[r * 0.85, 0.25], [r * 1.15, 0.2], [r * 1.25, 0]], 16, col('#2a1e22'))
  const hot = col('#ffd23a')
  const warm = col('#ff5a12')
  const pool = new THREE.CircleGeometry(r * 0.95, 16)
  pool.rotateX(-Math.PI / 2)
  pool.translate(0, 0.22, 0)
  const glow = paint(finish(pool), (p) => tmp.copy(hot).lerp(warm, Math.hypot(p.x, p.z) / r))
  return { solid: rim, glow }
}

function leafyTree(h: number, rnd: Rng): THREE.BufferGeometry[] {
  const out = [stick(h * 0.55, h * 0.07, '#9a6a44')]
  const greens = ['#4cc552', '#6fd85a', '#3bb04a', '#8be36a']
  const base = col(pick(rnd, greens))
  const p = gradY(base.clone().multiplyScalar(0.7), base.clone().lerp(col('#fff7b0'), 0.25), h * 0.3, h * 1.1)
  out.push(place(blob(h * 0.36, 1, p), new THREE.Vector3(0, h * 0.75, 0)))
  out.push(place(blob(h * 0.26, 1, p), new THREE.Vector3(h * 0.22, h * 0.62, h * 0.05)))
  out.push(place(blob(h * 0.24, 1, p), new THREE.Vector3(-h * 0.18, h * 0.66, -h * 0.12)))
  return out
}

function flowers(r: number, rnd: Rng): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  for (let k = 0; k < 5; k++) {
    const a = rnd() * Math.PI * 2
    const d = rnd() * r
    out.push(place(blob(0.35, 0, col(pick(rnd, ['#ff7ab8', '#ffe14d', '#ffffff', '#b98cff']))), new THREE.Vector3(Math.cos(a) * d, 0.3, Math.sin(a) * d)))
  }
  return out
}

const at = (list: THREE.BufferGeometry[], p: THREE.Vector3, ry: number): THREE.BufferGeometry[] => list.map((g) => place(g, p, ry))

/** Picks one prop for the theme; `size` ~ 1 for normal islands, larger on big ones. */
export function planDecor(theme: ThemeId, rnd: Rng, size: number): DecorPlan {
  const ry = rnd() * Math.PI * 2
  const k = rnd()
  switch (theme) {
    case 'candy': {
      if (k < 0.3) {
        const R = range(rnd, 1.6, 2.8) * size
        const h = range(rnd, 3, 6) * size
        const [c1, c2] = rnd() < 0.5 ? [pick(rnd, CANDY), '#ffffff'] : [pick(rnd, CANDY), pick(rnd, CANDY)]
        return { r: R, h: h + R * 2, build: (s, p) => s.solid.push(...at(lollipop(h, R, c1, c2, 16), p, ry)) }
      }
      if (k < 0.55) {
        const r = range(rnd, 1.2, 2.4) * size
        const c = pick(rnd, CANDY)
        return { r, h: r * 1.2, build: (s, p) => s.solid.push(place(gumdrop(r, c), p, ry)) }
      }
      if (k < 0.75) {
        const h = range(rnd, 4, 7) * size
        const c = pick(rnd, ['#ff9ad5', '#9fd8ff', '#d1a8ff', '#ffc4e1'])
        return { r: h * 0.4, h: h * 1.45, build: (s, p) => s.solid.push(...at(cottonTree(h, c), p, ry)) }
      }
      const r = range(rnd, 0.9, 1.6) * size
      const c = pick(rnd, CANDY)
      return { r, h: r * 2, build: (s, p) => s.solid.push(place(candyBall(r, c, '#ffffff'), p, ry)) }
    }
    case 'ice': {
      if (k < 0.45) {
        const h = range(rnd, 4, 9) * size
        return { r: h * 0.3, h, build: (s, p) => s.solid.push(...at(crystalCluster(h, rnd), p, ry)) }
      }
      if (k < 0.8) {
        const h = range(rnd, 4, 7.5) * size
        return { r: h * 0.35, h: h * 1.1, build: (s, p) => s.solid.push(...at(snowPine(h), p, ry)) }
      }
      const r = range(rnd, 1.5, 3) * size
      return { r, h: r, build: (s, p) => s.solid.push(place(blob(r, 1, col('#f4fbff'), 0.55), p, ry)) }
    }
    case 'volcano': {
      if (k < 0.45) {
        const r = range(rnd, 1.2, 3) * size
        return { r, h: r, build: (s, p) => s.solid.push(place(rock(r, pick(rnd, ['#4a3a3a', '#5c4440', '#3a2e33']), rnd), p, ry)) }
      }
      if (k < 0.7) {
        const r = range(rnd, 1.6, 3.2) * size
        return {
          r: r * 1.3,
          h: 0.5,
          build: (s, p) => {
            const lp = lavaPool(r)
            s.solid.push(place(lp.solid, p, ry))
            s.glow.push(place(lp.glow, p, ry))
          },
        }
      }
      const h = range(rnd, 3, 7) * size
      return {
        r: h * 0.3,
        h,
        build: (s, p) => s.solid.push(place(lathe([[0, 0], [h * 0.28, 0], [h * 0.12, h * 0.6], [0, h]], 7, gradY(col('#2a2026'), col('#6a4a44'), 0, h), true), p, ry)),
      }
    }
    case 'water': {
      if (k < 0.5) {
        const h = range(rnd, 4, 7.5) * size
        return { r: h * 0.4, h: h * 1.15, build: (s, p) => s.solid.push(...at(leafyTree(h, rnd), p, ry)) }
      }
      if (k < 0.7) {
        const r = range(rnd, 1.2, 2.2) * size
        return { r, h: r, build: (s, p) => s.solid.push(place(blob(r, 1, gradY(col('#3aa845'), col('#8fe36a'), -r, r), 0.75), p, ry)) }
      }
      if (k < 0.85) return { r: 2, h: 0.7, build: (s, p) => s.solid.push(...at(flowers(2, rnd), p, ry)) }
      const r = range(rnd, 1, 2.2) * size
      return { r, h: r, build: (s, p) => s.solid.push(place(rock(r, '#b9b0a4', rnd), p, ry)) }
    }
  }
}
