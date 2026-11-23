/**
 * Floating islands around and under the track, themed by where along the course they sit,
 * plus a hero landmark every ~400 m. Everything is merged into a few meshes per 500 m chunk
 * (so distant chunks are frustum-culled) and a handful of shared animated meshes.
 */
import * as THREE from 'three'
import type { ThemeId, Track } from '../sim/track'
import type { QualityProfile } from './quality'
import { Corridor, type Footprint } from './islandsCorridor'
import { planDecor, type DecorSink } from './islandsDecor'
import { fallGeo, flowMaterial, rainbowMaterial, smokeMesh } from './islandsFlow'
import { makeRng, mergeKeep, place, range, type Rng } from './islandsGeo'
import { buildHero } from './islandsHeroes'
import { glowMaterial, toonMaterial } from './islandsMaterial'
import { islandBody, islandStyle, lavaVeins } from './islandsShapes'

const CELL = 360
const STATION = 90
const HERO_EVERY = 400

interface Extras {
  readonly water: THREE.BufferGeometry[]
  readonly lava: THREE.BufferGeometry[]
  readonly rainbow: THREE.BufferGeometry[]
  readonly vents: { p: THREE.Vector3; size: number }[]
}

interface Ctx {
  readonly track: Track
  readonly q: QualityProfile
  readonly rnd: Rng
  readonly cor: Corridor
  readonly chunks: Map<string, DecorSink>
  readonly extras: Extras
}

/** Islands merge per map cell, so far cells can be culled by distance (worlds/adalar). */
const sinkAt = (c: Ctx, x: number, z: number): DecorSink => {
  const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
  let sink = c.chunks.get(k)
  if (sink === undefined) {
    sink = { solid: [], glow: [] }
    c.chunks.set(k, sink)
  }
  return sink
}

/** Horizontal unit vector to the left of the track at s. */
function leftAt(track: Track, s: number): THREE.Vector3 {
  const f = track.frameAt(s)
  return new THREE.Vector3(f.left.x, 0, f.left.z).normalize()
}

interface IslandOpts {
  readonly s: number
  readonly side: 1 | -1
  readonly dist: [number, number]
  readonly r: [number, number]
  readonly top: [number, number]
  readonly decor: number
  readonly decorSize: number
  readonly segments?: number
}

/** Tries a few spots for one island; builds it (body, props, falls) where it fits. */
function placeIsland(c: Ctx, o: IslandOpts): boolean {
  const { track, rnd, cor } = c
  const f = track.frameAt(o.s)
  const left = leftAt(track, o.s)
  const theme = track.themeAt(o.s)
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = range(rnd, o.r[0], o.r[1]) * (1 - attempt * 0.12)
    const dist = range(rnd, o.dist[0], o.dist[1]) + attempt * 12
    const x = f.pos.x + left.x * dist * o.side
    const z = f.pos.z + left.z * dist * o.side
    const y = f.pos.y + range(rnd, o.top[0], o.top[1])
    const depth = r * range(rnd, 0.9, 1.5)
    const fp: Footprint = { x, z, r: r * 1.15, yMin: y - depth - r * 0.2, yMax: y + r * 0.08 + 0.5 }
    if (!cor.clearOfRoad(fp) || !cor.clearOfIslands(fp)) continue
    // Low quality: coarser bodies (the silhouette survives, the triangle count halves).
    const seg = o.segments ?? Math.max(12, Math.min(26, Math.round(r * 0.9)))
    const body = islandBody(r, depth, islandStyle(theme, rnd), rnd, Math.max(10, Math.round(seg * (c.q.decor < 1 ? 0.65 : 0.85))))
    const sink = sinkAt(c, x, z)
    const at = new THREE.Vector3(x, y, z)
    sink.solid.push(place(body.geo, at))
    if (theme === 'volcano') sink.glow.push(...lavaVeins(body, rnd).map((g) => g.translate(x, y, z)))
    let yMax = fp.yMax
    const n = Math.round(o.decor)
    for (let i = 0; i < n; i++) {
      const plan = planDecor(theme, rnd, o.decorSize)
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * Math.max(0, body.r * 0.8 - plan.r)
      const px = x + Math.cos(a) * d
      const pz = z + Math.sin(a) * d
      const py = y + body.topY(d) - 0.15
      const dfp: Footprint = { x: px, z: pz, r: plan.r, yMin: py, yMax: py + plan.h }
      if (!cor.clearOfRoad(dfp)) continue
      plan.build(sink, new THREE.Vector3(px, py, pz))
      yMax = Math.max(yMax, dfp.yMax)
    }
    addFalls(c, theme, at, r, depth)
    cor.claim({ ...fp, yMax })
    if (c.q.decor >= 1) satellites(c, theme, at, r, sink)
    return true
  }
  return false
}

/** Little islets floating around a bigger island: the layered clusters of the concept art. */
function satellites(c: Ctx, theme: ThemeId, at: THREE.Vector3, r: number, sink: DecorSink): void {
  const { rnd, cor } = c
  const n = r < 10 ? 1 : 1 + Math.floor(rnd() * 2.6 * (0.4 + 0.6 * c.q.decor))
  for (let i = 0; i < n; i++) {
    const sr = r * range(rnd, 0.16, 0.3)
    const a = rnd() * Math.PI * 2
    const dist = r * range(rnd, 1.15, 1.55) + sr
    const x = at.x + Math.cos(a) * dist
    const z = at.z + Math.sin(a) * dist
    const y = at.y + range(rnd, -r * 0.45, r * 0.12)
    const fp: Footprint = { x, z, r: sr * 1.1, yMin: y - sr * 1.8, yMax: y + sr * 0.8 }
    if (!cor.clearOfRoad(fp)) continue
    const body = islandBody(sr, sr * range(rnd, 1.1, 1.7), islandStyle(theme, rnd), rnd, 10)
    sink.solid.push(place(body.geo, new THREE.Vector3(x, y, z)))
    if (sr > 2.2 && rnd() < 0.75) {
      const plan = planDecor(theme, rnd, Math.min(0.8, sr * 0.22))
      plan.build(sink, new THREE.Vector3(x, y + body.topY(0) - 0.1, z))
    }
  }
}

/** Waterfalls (or lava falls) pouring off the rim of some islands into the cloud sea. */
function addFalls(c: Ctx, theme: string, at: THREE.Vector3, r: number, depth: number): void {
  const { rnd, cor } = c
  const chance = theme === 'water' ? 0.85 : theme === 'volcano' ? 0.45 : theme === 'candy' ? 0.4 : 0.3
  if (rnd() > chance * (0.5 + 0.5 * c.q.decor) || r < 9) return
  const n = theme === 'water' && r > 16 ? 2 : 1
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const start = at.clone().addScaledVector(out, r * 0.93)
    start.y += 0.2
    const len = depth + range(rnd, 50, 100)
    const fp: Footprint = { x: start.x + out.x * 4, z: start.z + out.z * 4, r: 6, yMin: start.y - len, yMax: start.y }
    if (!cor.clearOfRoad(fp)) continue
    const g = fallGeo(start, out, range(rnd, 2.5, 5) * (r / 14), len)
    if (theme === 'volcano') c.extras.lava.push(g)
    else c.extras.water.push(g)
  }
  if (theme === 'volcano' && rnd() < 0.3) c.extras.vents.push({ p: at.clone().setY(at.y + 2), size: 9 })
}

function placeHero(c: Ctx, s: number, side: 1 | -1): void {
  const { track, rnd, cor } = c
  const theme = track.themeAt(s)
  const hero = buildHero(theme, rnd)
  const f = track.frameAt(s)
  const left = leftAt(track, s)
  for (let attempt = 0; attempt < 10; attempt++) {
    const sd = attempt % 2 === 0 ? side : -side
    const dist = hero.r + 30 + range(rnd, 10, 50) + attempt * 18
    const x = f.pos.x + left.x * dist * sd
    const z = f.pos.z + left.z * dist * sd
    const y = f.pos.y + range(rnd, -26, -12)
    const fp: Footprint = { x, z, r: hero.r, yMin: y - hero.depth - 140, yMax: y + hero.top }
    if (!cor.clearOfRoad(fp) || !cor.clearOfIslands(fp)) continue
    cor.claim(fp)
    const at = new THREE.Vector3(x, y, z)
    const sink = sinkAt(c, x, z)
    for (const g of hero.solid) sink.solid.push(g.translate(x, y, z))
    for (const g of hero.glow) sink.glow.push(g.translate(x, y, z))
    for (const g of hero.water) c.extras.water.push(g.translate(x, y, z))
    for (const g of hero.lava) c.extras.lava.push(g.translate(x, y, z))
    for (const g of hero.rainbow) c.extras.rainbow.push(g.translate(x, y, z))
    for (const v of hero.vents) c.extras.vents.push({ p: v.p.clone().add(at), size: v.size })
    return
  }
  for (const g of [...hero.solid, ...hero.glow, ...hero.water, ...hero.lava, ...hero.rainbow]) g.dispose()
}

export function buildIslands(track: Track, q: QualityProfile, seed: number): THREE.Group {
  const c: Ctx = {
    track,
    q,
    rnd: makeRng(seed),
    cor: new Corridor(track),
    chunks: new Map(),
    extras: { water: [], lava: [], rainbow: [], vents: [] },
  }
  const { rnd } = c
  let side: 1 | -1 = rnd() < 0.5 ? 1 : -1
  for (let s = HERO_EVERY * 0.55; s < track.length - 60; s += HERO_EVERY) {
    placeHero(c, s, side)
    side = side === 1 ? -1 : 1
  }
  const dec = q.decor
  for (let s = 15; s < track.length; s += STATION * range(rnd, 0.8, 1.2)) {
    const sd: 1 | -1 = rnd() < 0.5 ? 1 : -1
    // Close islands just below the road: the frame of every corner.
    if (rnd() < 0.9) placeIsland(c, { s, side: sd, dist: [22, 45], r: [8, 17], top: [-12, -3], decor: 4 * dec, decorSize: 1.1 })
    if (rnd() < 0.55 * (0.6 + 0.4 * dec)) placeIsland(c, { s: s + 30, side: sd === 1 ? -1 : 1, dist: [40, 100], r: [11, 22], top: [-28, 4], decor: 5 * dec, decorSize: 1.25 })
    // Islands right under the road, seen when looking over the edge.
    if (dec >= 1 && rnd() < 0.25) placeIsland(c, { s: s + 10, side: sd, dist: [0, 6], r: [12, 20], top: [-24, -14], decor: 3 * dec, decorSize: 0.9 })
    // Big background islands give the world depth.
    if (rnd() < 0.5 * (0.4 + 0.6 * dec)) {
      placeIsland(c, { s: s + 30, side: rnd() < 0.5 ? 1 : -1, dist: [160, 420], r: [24, 48], top: [-50, 25], decor: 2 * dec, decorSize: 2.4, segments: 14 })
    }
  }

  const group = new THREE.Group()
  group.name = 'islands'
  const solidMat = toonMaterial({ roughness: 0.75, rim: 0.42 })
  const glowMat = glowMaterial(2.8, 0.3)
  for (const [k, sink] of [...c.chunks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const solid = mergeKeep(sink.solid, ['position', 'normal', 'color'])
    if (solid !== null) {
      const m = new THREE.Mesh(solid, solidMat)
      m.name = `islands-${k}`
      m.receiveShadow = q.bloom
      group.add(m)
    }
    const glow = mergeKeep(sink.glow, ['position', 'color'])
    if (glow !== null) {
      const m = new THREE.Mesh(glow, glowMat)
      m.name = `islandGlow-${k}`
      group.add(m)
    }
  }
  const flows: [THREE.BufferGeometry[], THREE.Material, string][] = [
    [c.extras.water, flowMaterial('water'), 'waterfalls'],
    [c.extras.lava, flowMaterial('lava'), 'lavafalls'],
  ]
  for (const [list, mat, name] of flows) {
    const g = mergeKeep(list, ['position', 'uv', 'aT'])
    if (g === null) continue
    const m = new THREE.Mesh(g, mat)
    m.name = name
    m.renderOrder = 3
    group.add(m)
  }
  const rb = mergeKeep(c.extras.rainbow, ['position', 'color'])
  if (rb !== null) {
    const m = new THREE.Mesh(rb, rainbowMaterial())
    m.name = 'rainbows'
    m.renderOrder = 4
    group.add(m)
  }
  const smoke = smokeMesh(c.extras.vents, Math.round(30 * (0.5 + 0.5 * q.particles)))
  if (smoke !== null) group.add(smoke)
  return group
}

