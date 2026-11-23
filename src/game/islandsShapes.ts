/**
 * The floating island body: a softly domed top whose frosting / snow / grass drips over the
 * rim, a layered side band, and a faceted rocky cone hanging underneath (the classic
 * "floating island" silhouette of the concept art).
 */
import * as THREE from 'three'
import type { ThemeId } from '../sim/track'
import { angleNoise, col, type Rng } from './islandsGeo'

export interface IslandStyle {
  readonly topCentre: string
  readonly top: string
  /** Colour of the rim coat that drips down the side (frosting, snow, grass). */
  readonly drip: string
  readonly side: string
  readonly under: string
  readonly tip: string
  /** How far the coat drips down the side band (0..1 of the band). */
  readonly dripLen: number
}

const STYLES: Readonly<Record<ThemeId, readonly IslandStyle[]>> = {
  candy: [
    { topCentre: '#ffd6ec', top: '#ffaad3', drip: '#fff4fa', side: '#cf9160', under: '#a5643f', tip: '#6e3e30', dripLen: 0.85 },
    { topCentre: '#d4ffe9', top: '#97ecc4', drip: '#ff8cc6', side: '#d39a68', under: '#a5643f', tip: '#6e3e30', dripLen: 0.8 },
    { topCentre: '#fff1c4', top: '#ffd98a', drip: '#b48cff', side: '#c98458', under: '#9a5a3e', tip: '#663a2c', dripLen: 0.75 },
  ],
  ice: [
    { topCentre: '#ffffff', top: '#eef8ff', drip: '#ffffff', side: '#a6dcff', under: '#6cb4ee', tip: '#3a78c8', dripLen: 0.7 },
    { topCentre: '#ffffff', top: '#e2f4ff', drip: '#f4fbff', side: '#8fd0fb', under: '#5aa4e6', tip: '#2f68bb', dripLen: 0.6 },
  ],
  volcano: [
    { topCentre: '#8a6656', top: '#6e4f46', drip: '#ff8a2e', side: '#8a5a44', under: '#6a4436', tip: '#3e2a26', dripLen: 0.4 },
    { topCentre: '#94705c', top: '#76564a', drip: '#ffb03a', side: '#7c4f3c', under: '#5e3c32', tip: '#352422', dripLen: 0.3 },
  ],
  water: [
    { topCentre: '#b5f07a', top: '#86d957', drip: '#5fc24a', side: '#c38c5c', under: '#91644a', tip: '#5e4032', dripLen: 0.55 },
    { topCentre: '#c4f58a', top: '#7fd35a', drip: '#58b844', side: '#b98052', under: '#8a5e44', tip: '#59402f', dripLen: 0.5 },
  ],
}

export function islandStyle(theme: ThemeId, r: Rng): IslandStyle {
  const list = STYLES[theme]
  return list[Math.floor(r() * list.length) % list.length]
}

export interface IslandBody {
  readonly geo: THREE.BufferGeometry
  /** Height of the top surface at a horizontal distance from the centre (local, y = 0 at rim). */
  topY(dist: number): number
  /** Radius of the rim. */
  readonly r: number
  /** Depth of the hanging cone below the rim. */
  readonly depth: number
  /** Height of the side band between rim and cone. */
  readonly band: number
  /** Actual rim radius at an angle (the outline is irregular). */
  rimAt(angle: number): number
}

const tmp = new THREE.Color()

/**
 * Builds a body of rim radius r with the top centre at y = dome, rim at y = 0, and the cone
 * tip at y = −depth. Centred on the origin.
 */
export function islandBody(r: number, depth: number, style: IslandStyle, rnd: Rng, segments?: number): IslandBody {
  const seg = segments ?? Math.max(12, Math.min(26, Math.round(r * 0.9)))
  const seed = rnd() * 1000
  const dome = r * 0.07
  const band = Math.max(1.4, r * 0.16)
  const topRings: [number, number][] = [
    [0, dome],
    [0.4, dome * 0.9],
    [0.7, dome * 0.62],
    [0.9, dome * 0.28],
    [1.0, 0],
  ]
  const sideRings: [number, number][] = [
    [1.04, -band * 0.3],
    [1.03, -band * 0.65],
    [1.0, -band],
  ]
  const underRings: [number, number][] = [
    [0.86, -band - depth * 0.16],
    [0.62, -band - depth * 0.42],
    [0.34, -band - depth * 0.7],
    [0.12, -band - depth * 0.9],
    [0.02, -band - depth],
  ]
  const outline = (j: number): number => 0.86 + 0.24 * angleNoise((j / seg) * Math.PI * 2, 7, seed)
  const dripFor = (j: number): number => style.dripLen * (0.35 + 0.65 * angleNoise((j / seg) * Math.PI * 2, 11, seed + 3) ** 1.5)

  // Smooth top + side band (shared vertices, modular columns so there is no seam).
  const rings = [...topRings, ...sideRings]
  const pos: number[] = []
  const colArr: number[] = []
  const cTopC = col(style.topCentre)
  const cTop = col(style.top)
  const cDrip = col(style.drip)
  const cSide = col(style.side)
  rings.forEach(([f, y], i) => {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2
      const rr = r * f * outline(j)
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr)
      if (i < topRings.length) tmp.copy(cTopC).lerp(cTop, Math.min(1, f * 1.1))
      else {
        const depthIn = -y / band
        tmp.copy(depthIn < dripFor(j) ? cDrip : cSide)
      }
      colArr.push(tmp.r, tmp.g, tmp.b)
    }
  })
  const idx: number[] = []
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j
      const b = (i + 1) * seg + j
      const c = i * seg + ((j + 1) % seg)
      const d = (i + 1) * seg + ((j + 1) % seg)
      idx.push(a, c, b, c, d, b)
    }
  }
  const top = new THREE.BufferGeometry()
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  top.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3))
  top.setIndex(idx)
  top.computeVertexNormals()
  const topFlat = top.toNonIndexed()
  top.dispose()

  // Faceted rocky cone underneath, coloured per face so facets read.
  const under = [sideRings[sideRings.length - 1], ...underRings]
  const up: number[] = []
  const jag = (i: number, j: number): number => 1 + (angleNoise((j / seg) * Math.PI * 2, 13, seed + i * 7.1) - 0.5) * 0.35
  const ringPt = (i: number, j: number): THREE.Vector3 => {
    const [f, y] = under[i]
    const a = (j / seg) * Math.PI * 2
    const rr = r * f * outline(j) * (i === 0 ? 1 : jag(i, j))
    return new THREE.Vector3(Math.cos(a) * rr, y + (i > 0 ? (rnd() - 0.5) * band * 0.4 : 0), Math.sin(a) * rr)
  }
  const grid: THREE.Vector3[][] = under.map((_, i) => Array.from({ length: seg }, (_, j) => ringPt(i, j)))
  const uc: number[] = []
  const cUnder = col(style.under)
  const cTip = col(style.tip)
  const tri = (p: THREE.Vector3, q: THREE.Vector3, s: THREE.Vector3, k: number): void => {
    up.push(p.x, p.y, p.z, q.x, q.y, q.z, s.x, s.y, s.z)
    tmp.copy(k < 0.15 ? cSide : cUnder).lerp(cTip, Math.max(0, (k - 0.15) / 0.85) ** 1.3)
    tmp.multiplyScalar(0.9 + rnd() * 0.18)
    for (let n = 0; n < 3; n++) uc.push(tmp.r, tmp.g, tmp.b)
  }
  for (let i = 0; i < under.length - 1; i++) {
    const k = i / (under.length - 1)
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg
      tri(grid[i][j], grid[i][j1], grid[i + 1][j], k)
      tri(grid[i][j1], grid[i + 1][j1], grid[i + 1][j], k)
    }
  }
  const cone = new THREE.BufferGeometry()
  cone.setAttribute('position', new THREE.Float32BufferAttribute(up, 3))
  cone.setAttribute('color', new THREE.Float32BufferAttribute(uc, 3))
  cone.computeVertexNormals()

  const merged = new THREE.BufferGeometry()
  const P = [...(topFlat.getAttribute('position').array as Float32Array), ...up]
  const N = [...(topFlat.getAttribute('normal').array as Float32Array), ...(cone.getAttribute('normal').array as Float32Array)]
  const C = [...(topFlat.getAttribute('color').array as Float32Array), ...uc]
  merged.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  merged.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  topFlat.dispose()
  cone.dispose()

  const topY = (dist: number): number => {
    const f = dist / r
    for (let i = 0; i < topRings.length - 1; i++) {
      const [f0, y0] = topRings[i]
      const [f1, y1] = topRings[i + 1]
      if (f <= f1) return y0 + ((y1 - y0) * (f - f0)) / (f1 - f0)
    }
    return 0
  }
  return { geo: merged, topY, r: r * 0.86, depth: depth + band, band, rimAt: (a) => r * (0.86 + 0.24 * angleNoise(a, 7, seed)) }
}

/** Glowing lava veins running from the rim down the rocky cone of a volcano island. */
export function lavaVeins(body: IslandBody, rnd: Rng): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  const hot = col('#ffcf3a')
  const warm = col('#ff4a12')
  const n = 2 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const R = body.rimAt(a)
    const prof: [number, number, number][] = [
      [R * 1.03, 0.05, 1],
      [R * 1.06, -body.band * 0.6, 0.85],
      [R * 0.95, -body.band - (body.depth - body.band) * 0.12, 0.6],
      [R * 0.78, -body.band - (body.depth - body.band) * 0.3, 0.3],
    ]
    const w = 0.5 + rnd() * 0.5 + R * 0.025
    const pos: number[] = []
    const cl: number[] = []
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))
    const pt = (k: number, sgn: number): THREE.Vector3 => {
      const [rr, y, ww] = prof[k]
      return new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).addScaledVector(side, sgn * w * ww)
    }
    for (let k = 0; k < prof.length - 1; k++) {
      const quad = [pt(k, 1), pt(k, -1), pt(k + 1, 1), pt(k, -1), pt(k + 1, -1), pt(k + 1, 1)]
      quad.forEach((p, qi) => {
        pos.push(p.x, p.y, p.z)
        const kk = qi === 2 || qi === 4 || qi === 5 ? k + 1 : k
        tmp.copy(hot).lerp(warm, kk / (prof.length - 1))
        cl.push(tmp.r, tmp.g, tmp.b)
      })
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3))
    out.push(g)
  }
  return out
}
