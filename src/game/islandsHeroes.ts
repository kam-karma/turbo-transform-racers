/**
 * Hero landmarks, one per ~400 m: a giant lollipop island, an ice-crystal spire, a smoking
 * volcano with lava rivers, and a mesa pouring waterfalls under a rainbow. Built in local
 * space with the island rim at y = 0; islands.ts places them.
 */
import * as THREE from 'three'
import type { ThemeId } from '../sim/track'
import { angleNoise, blob, col, finish, gradY, lathe, paint, place, range, type Rng } from './islandsGeo'
import { crystalCluster, gumdrop, lollipop, planDecor, type DecorSink } from './islandsDecor'
import { fallGeo, rainbowGeo } from './islandsFlow'
import { islandBody, islandStyle } from './islandsShapes'

export interface HeroParts extends DecorSink {
  readonly water: THREE.BufferGeometry[]
  readonly lava: THREE.BufferGeometry[]
  readonly rainbow: THREE.BufferGeometry[]
  readonly vents: { p: THREE.Vector3; size: number }[]
  /** Footprint radius, height above the rim and depth below it (for clearance). */
  r: number
  top: number
  depth: number
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)
const tmp = new THREE.Color()

function empty(): HeroParts {
  return { solid: [], glow: [], water: [], lava: [], rainbow: [], vents: [], r: 0, top: 0, depth: 0 }
}

/** Scatters themed props on a ring between rMin and rMax of a body's top. */
function ring(h: HeroParts, theme: ThemeId, rnd: Rng, n: number, rMin: number, rMax: number, topY: (d: number) => number, size = 1.4): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5
    const d = range(rnd, rMin, rMax)
    planDecor(theme, rnd, size).build(h, v(Math.cos(a) * d, topY(d), Math.sin(a) * d))
  }
}

function candyHero(rnd: Rng): HeroParts {
  const h = empty()
  const body = islandBody(30, 34, islandStyle('candy', rnd), rnd, 34)
  h.solid.push(body.geo)
  const y0 = body.topY(0)
  h.solid.push(...lollipop(34, 13, '#ff3d7f', '#ffffff', 48).map((g) => place(g, v(0, y0, 0), rnd() * 6)))
  h.solid.push(...lollipop(16, 6, '#ffd23f', '#ff7a2a', 32).map((g) => place(g, v(13, body.topY(13), 6), 1.2)))
  h.solid.push(...lollipop(12, 5, '#8a5cff', '#7be05a', 32).map((g) => place(g, v(-10, body.topY(10), -11), 2.1)))
  const drops = ['#ff4f7b', '#7be05a', '#3fc7ff', '#ffb52e', '#b46cff', '#ff7ad9']
  drops.forEach((c, i) => {
    const a = (i / drops.length) * Math.PI * 2 + 0.4
    h.solid.push(place(gumdrop(range(rnd, 2.6, 3.8), c), v(Math.cos(a) * 20, body.topY(20), Math.sin(a) * 20)))
  })
  ring(h, 'candy', rnd, 7, 6, 18, body.topY)
  h.r = 35
  h.top = 34 + 13 * 1.9
  h.depth = body.depth
  return h
}

function icicle(len: number, r: number): THREE.BufferGeometry {
  return lathe([[0, 0], [r, 0], [r * 0.5, -len * 0.5], [0, -len]], 6, gradY(col('#3f86d8'), col('#cdeeff'), -len, 0), true)
}

function iceHero(rnd: Rng): HeroParts {
  const h = empty()
  const body = islandBody(30, 40, islandStyle('ice', rnd), rnd, 34)
  h.solid.push(body.geo)
  h.solid.push(...crystalCluster(62, rnd).map((g) => place(g, v(0, body.topY(0) - 0.5, 0))))
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.4
    const d = range(rnd, 13, 21)
    h.solid.push(...crystalCluster(range(rnd, 16, 32), rnd).map((g) => place(g, v(Math.cos(a) * d, body.topY(d) - 0.3, Math.sin(a) * d), rnd() * 6)))
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3
    const d = range(rnd, 14, 25)
    h.solid.push(place(icicle(range(rnd, 8, 22), range(rnd, 1.5, 3)), v(Math.cos(a) * d, -4.5 - (25 - d) * 0.6, Math.sin(a) * d)))
  }
  ring(h, 'ice', rnd, 6, 8, 24, body.topY)
  h.r = 34
  h.top = 64
  h.depth = body.depth + 10
  return h
}

function volcanoHero(rnd: Rng): HeroParts {
  const h = empty()
  const body = islandBody(40, 38, islandStyle('volcano', rnd), rnd, 34)
  h.solid.push(body.geo)
  const y0 = body.topY(0) - 1
  const prof: [number, number][] = [[38, 0], [33, 7], [26, 17], [19, 28], [13, 38], [10.5, 43], [9, 44], [7, 40], [4, 37], [0, 37]]
  const cone = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 30)
  const p = cone.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const k = 1 + (angleNoise(Math.atan2(z, x), 9, 5) - 0.5) * 0.22 * Math.min(1, p.getY(i) / 10 + 0.3)
    p.setX(i, x * k)
    p.setZ(i, z * k)
  }
  const rock = col('#3e2e2e')
  const high = col('#7a4a3a')
  const ember = col('#ff6a2a')
  const coneGeo = paint(finish(cone, true), (q) => {
    const t = q.y / 44
    tmp.copy(rock).lerp(high, t)
    if (t > 0.86) tmp.lerp(ember, (t - 0.86) * 3)
    return tmp
  })
  h.solid.push(place(coneGeo, v(0, y0, 0)))
  // Lava rivers: glowing ribbons running down the flanks.
  const hot = col('#ffd84a')
  const warm = col('#ff5a12')
  const rivers = [0.6, 2.5, 4.4]
  for (const a0 of rivers) {
    const pos: number[] = []
    const cols: number[] = []
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 14; k++) {
      const t = k / 14
      const y = 43 - t * 43
      const pr = THREE.MathUtils.lerp(10.5, 38, t ** 0.95)
      const a = a0 + Math.sin(t * 7 + a0) * 0.06
      const kk = 1 + (angleNoise(a, 9, 5) - 0.5) * 0.22 * Math.min(1, y / 10 + 0.3)
      pts.push(v(Math.cos(a) * (pr * kk + 0.45), y0 + y + 0.25, Math.sin(a) * (pr * kk + 0.45)))
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const w = 1.2 + (k / pts.length) * 1.8
      const dir = pts[k + 1].clone().sub(pts[k]).normalize()
      const side = v(-dir.z, 0, dir.x).normalize().multiplyScalar(w)
      const a = pts[k].clone().add(side)
      const b = pts[k].clone().sub(side)
      const c = pts[k + 1].clone().add(side)
      const d = pts[k + 1].clone().sub(side)
      for (const q of [a, b, c, b, d, c]) pos.push(q.x, q.y, q.z)
      for (let n = 0; n < 6; n++) {
        tmp.copy(hot).lerp(warm, k / pts.length)
        cols.push(tmp.r, tmp.g, tmp.b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    h.glow.push(g)
  }
  const pool = new THREE.CircleGeometry(8.5, 18).rotateX(-Math.PI / 2)
  pool.translate(0, y0 + 38.5, 0)
  h.glow.push(paint(finish(pool), (q) => tmp.copy(hot).lerp(warm, Math.hypot(q.x, q.z) / 9)))
  // Lava pours off the rim below the first river.
  const out = v(Math.cos(rivers[0]), 0, Math.sin(rivers[0]))
  h.lava.push(fallGeo(out.clone().multiplyScalar(38), out, 7, 110))
  h.vents.push({ p: v(0, y0 + 40, 0), size: 26 })
  ring(h, 'volcano', rnd, 6, 30, 36, body.topY, 1.5)
  h.r = 46
  h.top = 46 + 60
  h.depth = body.depth
  return h
}

function waterHero(rnd: Rng): HeroParts {
  const h = empty()
  const body = islandBody(34, 30, islandStyle('water', rnd), rnd, 34)
  h.solid.push(body.geo)
  const y0 = body.topY(0) - 0.5
  const grass = col('#7fd85a')
  const cliff = col('#e2bc8e')
  const cliffDark = col('#b98a5e')
  const mesa = lathe(
    [[0, 27], [14, 27], [16.5, 26], [17.5, 24], [18, 16], [19.5, 7], [21, 1], [22, 0]],
    28,
    (q) => (q.y > 25.6 ? grass : tmp.copy(cliffDark).lerp(cliff, 0.5 + 0.5 * Math.sin(q.y * 1.3))),
  )
  h.solid.push(place(mesa, v(0, y0, 0)))
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd()
    const d = range(rnd, 3, 11)
    planDecor('water', rnd, 1.6).build(h, v(Math.cos(a) * d, y0 + 27, Math.sin(a) * d))
  }
  ring(h, 'water', rnd, 8, 24, 30, body.topY, 1.3)
  const falls = [0.3, 2.4, 4.3]
  for (const a of falls) {
    const out = v(Math.cos(a), 0, Math.sin(a))
    h.water.push(fallGeo(out.clone().multiplyScalar(16.6).setY(y0 + 26.9), out, 6, 26))
    h.water.push(fallGeo(out.clone().multiplyScalar(31).setY(0.2), out, 8, 140))
    const pool = new THREE.CircleGeometry(5, 16).rotateX(-Math.PI / 2)
    pool.translate(Math.cos(a) * 25, y0 + 0.25, Math.sin(a) * 25)
    h.solid.push(paint(finish(pool), col('#3cc8f0')))
    h.solid.push(place(blob(1.6, 1, col('#ffffff'), 0.5), v(Math.cos(a) * 23, y0 + 0.2, Math.sin(a) * 23)))
  }
  const ra = falls[0]
  h.rainbow.push(rainbowGeo(v(Math.cos(ra) * 30, -8, Math.sin(ra) * 30), 34, 7, -ra))
  h.r = 38
  h.top = 40
  h.depth = body.depth
  return h
}

export function buildHero(theme: ThemeId, rnd: Rng): HeroParts {
  switch (theme) {
    case 'candy':
      return candyHero(rnd)
    case 'ice':
      return iceHero(rnd)
    case 'volcano':
      return volcanoHero(rnd)
    case 'water':
      return waterHero(rnd)
  }
}
