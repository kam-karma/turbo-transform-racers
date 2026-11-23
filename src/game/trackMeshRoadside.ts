/**
 * Near-road detail that makes speed readable: little floating balconies bolted to the slab
 * carrying themed props, lamp posts, pennant flags, chevron boards on the outside of bends,
 * painted corner arrows, form signs and road paint before every change of form, bridge
 * piers under the slab, buoys and spills along the canals, and fairy lights at night.
 */
import * as THREE from 'three'
import type { Side, TracksidePlan } from '../sim/landmarksTrackside'
import type { ThemeId, Track } from '../sim/track'
import { DEFAULT_WIDTH } from '../sim/track'
import { col, makeRng, range, type Rng } from './islandsGeo'
import { planDecor, type DecorSink } from './islandsDecor'
import { fallGeo } from './islandsFlow'
import { FORM_CELL } from './trackMeshAtlas'
import { FORM_COLORS } from './trackMeshBand'
import { board, decal, onRoad, roundBox, tint, tintY, upright, type Buckets } from './trackMeshKit'
import { KERB, THEME_COLORS } from './trackMeshRoad'

export type SinkAt = (s: number) => Buckets

export interface RoadsideOut {
  /** Butterfly anchors (world space) near the balconies. */
  readonly butterflies: THREE.Vector3[]
  /** Falling-water sheets (flow material). */
  readonly falls: THREE.BufferGeometry[]
}

const BANK = 1.4
const LAMP: Readonly<Record<ThemeId, string>> = { candy: '#ffb0e0', ice: '#aef0ff', volcano: '#ffb347', water: '#fff0a0' }
const PLATE_TOP: Readonly<Record<ThemeId, string>> = { candy: '#ffb3d9', ice: '#f2fbff', volcano: '#5a4440', water: '#86d957' }
const FLAG = ['#ff4f8b', '#ffd23f', '#3fd0ff', '#8a5cff', '#5ee06a']

const hwAt = (track: Track, s: number): number => (track.frameAt(s).width ?? DEFAULT_WIDTH) / 2
/** Lateral offset of the outer edge of the slab (or canal bank) at s. */
const edgeAt = (track: Track, s: number): number => hwAt(track, s) + (track.surfaceAt(s) === 'water' ? BANK : KERB)

/** A small round platform hung on the slab side, carrying 1-3 themed props. */
function balcony(b: Buckets, track: Track, s: number, side: Side, theme: ThemeId, rnd: Rng, butterflies: THREE.Vector3[], q: number): void {
  const R = 2.7
  const d = side * (edgeAt(track, s) + R - 0.5)
  const colors = THEME_COLORS[theme]
  const plate = new THREE.CylinderGeometry(R, R * 0.92, 0.9, 18)
  plate.translate(0, -0.7, 0)
  b.solid.push(onRoad(tintY(plate, colors.b, PLATE_TOP[theme], -1.1, -0.3), track, s, d, 0))
  const rim = new THREE.TorusGeometry(R * 0.98, 0.2, 5, 22).rotateX(Math.PI / 2).translate(0, -0.27, 0)
  b.solid.push(onRoad(tint(rim, colors.a), track, s, d, 0))
  const cone = new THREE.ConeGeometry(R * 0.85, 2.6, 9).rotateX(Math.PI).translate(0, -2.45, 0)
  b.solid.push(onRoad(tintY(cone.toNonIndexed(), colors.under, colors.c, -3.7, -1.2), track, s, d, 0))
  const sink: DecorSink = { solid: [], glow: [] }
  const n = 1 + Math.floor(rnd() * 2.4 * q)
  for (let i = 0; i < n; i++) {
    const plan = planDecor(theme, rnd, range(rnd, 0.42, 0.62))
    const a = rnd() * Math.PI * 2
    const r = Math.max(0, R - 0.9 - plan.r) * Math.sqrt(rnd())
    // Props keep to the outer half so nothing overhangs the road.
    const off = side * Math.abs(Math.cos(a) * r) * 0.8
    plan.build(sink, new THREE.Vector3(off, -0.25, Math.sin(a) * r))
  }
  for (const g of sink.solid) b.solid.push(onRoad(g, track, s, d, 0))
  for (const g of sink.glow) b.glow.push(onRoad(g, track, s, d, 0))
  if (theme === 'candy' || theme === 'water') {
    const p = track.toWorld(s, d, 2.2)
    butterflies.push(new THREE.Vector3(p.x, p.y, p.z))
  }
}

/** Candy-cane lamp post with a hooked top and a glowing lantern over the road edge. */
function lamp(b: Buckets, track: Track, s: number, side: Side, theme: ThemeId): void {
  const d = side * (edgeAt(track, s) + 0.35)
  const pole = new THREE.CylinderGeometry(0.16, 0.2, 5.6, 8, 1, true).translate(0, 2.8, 0)
  const uv = pole.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 6)
  b.stripe.push(onRoad(tint(pole, THEME_COLORS[theme].kerb), track, s, d, 0))
  // Hook bending over the road (towards −side).
  const hook = new THREE.TorusGeometry(0.9, 0.15, 6, 12, Math.PI).translate(0.9, 0, 0)
  if (side > 0) hook.rotateY(Math.PI)
  hook.translate(0, 5.6, 0)
  b.stripe.push(onRoad(tint(hook, THEME_COLORS[theme].kerb), track, s, d, 0))
  const lx = -side * 1.8
  b.trim.push(onRoad(tint(new THREE.ConeGeometry(0.38, 0.32, 10).translate(lx, 5.5, 0), THEME_COLORS[theme].kerb), track, s, d, 0))
  b.glow.push(onRoad(tint(new THREE.IcosahedronGeometry(0.3, 1).translate(lx, 5.12, 0), LAMP[theme]), track, s, d, 0))
  b.trim.push(onRoad(tint(new THREE.SphereGeometry(0.34, 10, 6).translate(0, 0.25, 0), THEME_COLORS[theme].kerb), track, s, d, 0))
}

function flag(b: Buckets, track: Track, s: number, side: Side, rnd: Rng): void {
  const d = side * (edgeAt(track, s) + 0.4)
  b.trim.push(onRoad(tint(new THREE.CylinderGeometry(0.09, 0.11, 6.2, 6).translate(0, 3.1, 0), '#fff6ec'), track, s, d, 0))
  b.trim.push(onRoad(tint(new THREE.SphereGeometry(0.2, 8, 6).translate(0, 6.3, 0), '#ffd23f'), track, s, d, 0))
  const c = FLAG[Math.floor(rnd() * FLAG.length)]
  // A pennant streaming back along the road with a gentle wave, double-faced.
  const pos: number[] = []
  const N = 5
  const at = (t: number, top: boolean): number[] => [Math.sin(t * 3.2) * 0.35 * t, top ? 6.1 - 0.62 * t : 4.85 + 0.62 * t, -t * 2.6]
  for (let k = 0; k < N; k++) {
    const t0 = k / N
    const t1 = (k + 1) / N
    const a = at(t0, true)
    const bb = at(t0, false)
    const c1 = at(t1, true)
    const d1 = at(t1, false)
    pos.push(...a, ...bb, ...c1, ...bb, ...d1, ...c1, ...a, ...c1, ...bb, ...bb, ...c1, ...d1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  b.solid.push(onRoad(tint(g, c), track, s, d, 0))
}

function chevronBoard(b: Buckets, track: Track, s: number, side: Side, left: boolean): void {
  const d = side * (edgeAt(track, s) + 0.7)
  const face = board(2.6, 1.6, left ? 'boardLeft' : 'boardRight').translate(0, 1.9, -0.08)
  b.atlas.push(onRoad(face, track, s, d, 0))
  b.solid.push(onRoad(tint(roundBox(2.7, 1.25, 0.14, 0.06).translate(0, 1.9, 0.02), '#fff6ec'), track, s, d, 0))
  for (const x of [-0.85, 0.85]) b.trim.push(onRoad(tint(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6).translate(x, 0.7, 0), '#fff6ec'), track, s, d, 0))
}

function formSign(b: Buckets, track: Track, f: TracksidePlan['formSigns'][number]): void {
  const c = FORM_COLORS[f.form]
  for (const side of [1, -1] as const) {
    const d = side * (edgeAt(track, f.s) + 1.0)
    b.atlas.push(onRoad(board(3.2, 3.2, FORM_CELL[f.form], c).translate(0, 4.2, -0.2), track, f.s, d, 0))
    const disc = new THREE.CylinderGeometry(1.78, 1.78, 0.3, 28).rotateX(Math.PI / 2).translate(0, 4.2, 0)
    b.trim.push(onRoad(tint(disc, '#1d2a6b'), track, f.s, d, 0))
    b.glow.push(onRoad(tint(new THREE.TorusGeometry(1.8, 0.09, 4, 32).translate(0, 4.2, -0.2), c), track, f.s, d, 0))
    b.trim.push(onRoad(tint(new THREE.CylinderGeometry(0.14, 0.18, 2.6, 8).translate(0, 1.3, 0.1), '#fff6ec'), track, f.s, d, 0))
  }
  if (!f.paint) return
  const hw = hwAt(track, f.boundary - 40)
  b.atlas.push(decal(track, f.boundary - 58, 0, Math.min(7, hw), Math.min(7, hw), FORM_CELL[f.form], col(c).clone().multiplyScalar(1.15)))
  for (const k of [40, 32, 24]) b.atlas.push(decal(track, f.boundary - k, 0, hw * 1.3, hw * 0.65, 'chevron', c))
}

/** Tapering column from the slab belly down towards the clouds. */
function pier(b: Buckets, track: Track, s: number, theme: ThemeId, rnd: Rng): void {
  const len = range(rnd, 22, 38)
  const c = THEME_COLORS[theme]
  const col1 = new THREE.CylinderGeometry(1.5, 0.8, len, 10, 1, true).translate(0, -1.4 - len / 2, 0)
  b.solid.push(upright(tintY(col1, c.under, c.b, -len, -2), track, s, 0, 0))
  b.solid.push(upright(tint(new THREE.TorusGeometry(1.55, 0.3, 6, 14).rotateX(Math.PI / 2).translate(0, -3.2, 0), c.a), track, s, 0, 0))
  const tip = new THREE.DodecahedronGeometry(1.6, 0).toNonIndexed()
  tip.computeVertexNormals()
  b.solid.push(upright(tint(tip.scale(0.9, 1.4, 0.9).translate(0, -1.4 - len, 0), c.c), track, s, 0, 0))
}

function buoy(b: Buckets, track: Track, s: number, side: Side, k: number): void {
  const d = side * (hwAt(track, s) - 1.4)
  b.trim.push(onRoad(tint(new THREE.SphereGeometry(0.55, 9, 6).scale(1, 0.8, 1), k % 2 === 0 ? '#ff3d5a' : '#ffffff'), track, s, d, 0.05))
  b.trim.push(onRoad(tint(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 5).translate(0, 0.7, 0), '#fff6ec'), track, s, d, 0.05))
  b.glow.push(onRoad(tint(new THREE.IcosahedronGeometry(0.16, 0).translate(0, 1.2, 0), '#fff0a0'), track, s, d, 0.05))
}

/** A sheet of water pouring over the canal bank (or off the canal end) into the void. */
function spill(out: THREE.BufferGeometry[], track: Track, s: number, side: Side | 0, width: number, length: number): void {
  const f = track.frameAt(s)
  const edge = side === 0 ? 0 : side * (hwAt(track, s) + BANK + 0.2)
  const p = track.toWorld(s, edge, side === 0 ? -0.1 : 0.55)
  const outward = side === 0 ? new THREE.Vector3(f.t.x, 0, f.t.z) : new THREE.Vector3(f.left.x * side, 0, f.left.z * side)
  out.push(fallGeo(new THREE.Vector3(p.x, p.y, p.z), outward.normalize(), width, length))
}

/** Little glowing bulbs along both rails (night). */
function fairyLights(b: Buckets, track: Track, s0: number, s1: number): void {
  const colors = ['#fff1a0', '#ff9ad5', '#9ff0ff', '#b8ff9a']
  let k = 0
  for (let s = s0; s < s1; s += 4.5) {
    const surf = track.surfaceAt(s)
    if (surf !== 'road' && surf !== 'ice') continue
    for (const side of [1, -1]) {
      const g = new THREE.OctahedronGeometry(0.16, 0).translate(0, 1.27, 0)
      b.glow.push(onRoad(tint(g, colors[k++ % colors.length]), track, s, side * (edgeAt(track, s) - 0.45), 0))
    }
  }
}

export function buildRoadside(track: Track, plan: TracksidePlan, sinkAt: SinkAt, o: { decor: number; night: boolean }): RoadsideOut {
  const rnd = makeRng(57)
  const butterflies: THREE.Vector3[] = []
  const falls: THREE.BufferGeometry[] = []
  for (const x of plan.balconies) balcony(sinkAt(x.s), track, x.s, x.side, x.theme, rnd, butterflies, o.decor)
  for (const x of plan.lamps) lamp(sinkAt(x.s), track, x.s, x.side, x.theme)
  for (const x of plan.flags) flag(sinkAt(x.s), track, x.s, x.side, rnd)
  for (const x of plan.boards) chevronBoard(sinkAt(x.s), track, x.s, x.side, x.left)
  for (const x of plan.arrows) sinkAt(x.s).atlas.push(decal(track, x.s, 0, 5, 5, x.left ? 'arrowLeft' : 'arrowRight', '#ffffff'))
  for (const x of plan.formSigns) formSign(sinkAt(x.s), track, x)
  for (const x of plan.piers) pier(sinkAt(x.s), track, x.s, track.themeAt(x.s), rnd)
  plan.buoys.forEach((x, k) => buoy(sinkAt(x.s), track, x.s, x.side, k))
  for (const x of plan.spills) spill(falls, track, x.s, x.side, range(rnd, 2.5, 4), range(rnd, 30, 55))
  for (const x of plan.edgeFalls) spill(falls, track, x.s, 0, hwAt(track, x.s - 2) * 2 + 1, 90)
  if (o.night) for (let s = 0; s < track.length; s += 100) fairyLights(sinkAt(s + 50), track, s, Math.min(track.length, s + 100))
  return { butterflies, falls }
}
