/**
 * The Kurgu road: a modular toy track of our own design — a cream moulded deck with two lane
 * grooves and puzzle-tab joints every 16 m, chunky rounded side rails in a rainbow of piece
 * colours, a navy base, and stacked toy-block pillars wherever it runs above the floor.
 * Water gates become a moulded channel full of water, climbs get tread ridges, gaps leave
 * open air between two lips, and each gate's detour ("uzun yol") is a grey-blue side lane.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { GateDef, KurguTrack } from '../sim/kurguTrack'
import { altPoint } from '../sim/layout'
import { Batch, BOX, trs } from './batch'
import type { Materials } from './materials'
import { mergeIndexed, samplesBetween, sweepFrames, type FrameFn, type PStrip } from './sweep'
import { chevronTexture, climbTexture, deckTexture, waterTexture } from './textures'

export const PIECE_M = 16
const RAIL_H = 1.15
const RAIL_W = 1.2
const BASE_Y = -0.7
const PIER_STEP = 26

const RAINBOW = [0x5fd3b0, 0xff7a6b, 0xffc93c, 0x5aaeff, 0xb38cff].map((c) => new THREE.Color(c))
const DETOUR = [0x8fa3c7, 0xc9d4e8].map((c) => new THREE.Color(c))
const BASE = new THREE.Color(0x34406e)
const CHANNEL = new THREE.Color(0x1f8fb0)

const pieceColor = (pal: readonly THREE.Color[]) => (s: number): THREE.Color => pal[Math.floor(s / PIECE_M) % pal.length]

function railStrips(h: number, pal: readonly THREE.Color[]): PStrip[] {
  const c = pieceColor(pal)
  return [
    { pts: [{ d: h + RAIL_W, y: BASE_Y }, { d: h + RAIL_W, y: RAIL_H - 0.35 }, { d: h + RAIL_W - 0.25, y: RAIL_H }, { d: h + 0.25, y: RAIL_H }, { d: h, y: RAIL_H - 0.35 }, { d: h, y: 0 }], color: c },
    { pts: [{ d: -h, y: 0 }, { d: -h, y: RAIL_H - 0.35 }, { d: -h - 0.25, y: RAIL_H }, { d: -h - RAIL_W + 0.25, y: RAIL_H }, { d: -h - RAIL_W, y: RAIL_H - 0.35 }, { d: -h - RAIL_W, y: BASE_Y }], color: c },
    { pts: [{ d: -h - RAIL_W, y: BASE_Y }, { d: h + RAIL_W, y: BASE_Y }], color: () => BASE },
  ]
}

const deckStrip = (h: number, y = 0): PStrip => ({ pts: [{ d: h, y, u: 0 }, { d: -h, y, u: 1 }] })

export interface RoadView {
  readonly group: THREE.Group
  update(t: number): void
  dispose(): void
}

interface Pier { x: number; z: number; top: number; d: number }

function pierGeometry(): THREE.BufferGeometry {
  // One toy block: rounded body with four studs on top (unit height = 2.4 m).
  const body = new RoundedBoxGeometry(3, 2.3, 3, 1, 0.35)
  body.translate(0, 1.15, 0)
  const parts: THREE.BufferGeometry[] = [body]
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    // Studs: a squat 6-sided cap is enough under the deck.
    const stud = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 6, 1, true)
    stud.translate(x, 2.45, z)
    parts.push(stud)
  }
  const b = new Batch()
  const id = new THREE.Matrix4()
  for (const p of parts) b.add(p, id, 0xffffff)
  return b.build()
}

export function buildRoad(kt: KurguTrack, mats: Materials, decor: number): RoadView {
  const group = new THREE.Group()
  const deckTex = deckTexture()
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.55, envMapIntensity: 0.7 })
  const climbTex = climbTexture()
  const climbMat = new THREE.MeshStandardMaterial({ map: climbTex, roughness: 0.45 })
  const wTex = waterTexture()
  wTex.repeat.set(1, 1)
  const waterMat = new THREE.MeshStandardMaterial({ map: wTex, color: 0x9be8ff, transparent: true, opacity: 0.82, roughness: 0.06, envMapIntensity: 1.6, emissive: 0x0a4a66, emissiveIntensity: 0.25 })
  const lipTex = chevronTexture('#ffcf3a', '#ff5a5a')
  const lipMat = new THREE.MeshStandardMaterial({ map: lipTex, roughness: 0.4 })
  const owned: { dispose(): void }[] = [deckTex, deckMat, climbTex, climbMat, wTex, waterMat, lipTex, lipMat]
  const main: FrameFn = (s) => kt.main.frameAt(s)
  const sections = kt.main.def.sections
  const piers: Pier[] = []
  const anchors = kt.def.anchors
  const onFurniture = (s: number): boolean => anchors.some((a) => s > a.s0 - 6 && s < a.s1 + 6)

  // Main road, in chunks for frustum culling.
  let start = 0
  const decks: THREE.BufferGeometry[] = []
  const rails: THREE.BufferGeometry[] = []
  const flush = (): void => {
    if (decks.length > 0) group.add(new THREE.Mesh(mergeIndexed(decks.splice(0)), deckMat))
    if (rails.length > 0) group.add(new THREE.Mesh(mergeIndexed(rails.splice(0)), mats.plastic))
  }
  let chunkLen = 0
  for (const sec of sections) {
    const s0 = start
    const s1 = start + sec.len
    start = s1
    const h = (sec.width ?? 14) / 2
    let bend = 0
    for (let s = s0; s <= s1; s += 8) bend = Math.max(bend, Math.abs(kt.main.frameAt(s).curvH), Math.abs(kt.main.frameAt(s).curvV))
    const ss = samplesBetween(s0, s1, bend > 0.004 ? 2.5 : 5)
    if (sec.surface === 'gap') {
      // Lips on both edges of the gap.
      for (const [a, b] of [[s0 - 5, s0], [s1, s1 + 5]]) group.add(new THREE.Mesh(sweepFrames(main, samplesBetween(a, b, 1), [deckStrip(h, 0.04)], 5), lipMat))
      continue
    }
    if (sec.surface === 'water') {
      rails.push(sweepFrames(main, ss, [...railStrips(h, RAINBOW), { pts: [{ d: h, y: -1.4 }, { d: -h, y: -1.4 }], color: () => CHANNEL }]))
      const surf = sweepFrames(main, ss, [deckStrip(h, -0.3)], 24)
      group.add(new THREE.Mesh(surf, waterMat))
    } else {
      rails.push(sweepFrames(main, ss, railStrips(h, RAINBOW)))
      if (sec.surface === 'climb') group.add(new THREE.Mesh(sweepFrames(main, ss, [deckStrip(h)], 8), climbMat))
      else decks.push(sweepFrames(main, ss, [deckStrip(h)], PIECE_M))
    }
    for (let s = Math.ceil(s0 / PIER_STEP) * PIER_STEP; s < s1; s += PIER_STEP) {
      if (onFurniture(s) || sec.surface === 'climb') continue
      for (const side of [1, -1]) {
        const p = kt.main.toWorld(s, side * (h - 1), BASE_Y)
        piers.push({ x: p.x, z: p.z, top: p.y, d: side })
      }
    }
    chunkLen += sec.len
    if (chunkLen > 300) {
      flush()
      chunkLen = 0
    }
  }
  flush()

  // Detour lanes.
  for (const g of kt.def.gates) buildDetour(kt, g, group, deckMat, mats, piers)

  // Joint clips on the rails, every piece.
  const clips = new Batch()
  const clipGeo = BOX()
  for (let s = PIECE_M; s < kt.length; s += PIECE_M) {
    if (kt.main.surfaceAt(s) === 'gap') continue
    const f = kt.main.frameAt(s)
    const h = f.width / 2
    const yaw = Math.atan2(f.t.x, f.t.z)
    for (const side of [1, -1]) {
      const p = kt.main.toWorld(s, side * (h + RAIL_W / 2), RAIL_H)
      clips.add(clipGeo, trs(p.x, p.y, p.z, -f.pitch, yaw, 0, RAIL_W + 0.35, 0.45, 1.1), 0xfff6e0)
    }
  }
  if (!clips.empty) group.add(new THREE.Mesh(clips.build(), mats.plastic))

  group.add(buildPiers(piers, decor, owned))
  for (const m of group.children) {
    if (m instanceof THREE.Mesh) m.receiveShadow = true
  }
  return {
    group,
    update(t) {
      wTex.offset.set(Math.sin(t * 0.4) * 0.05, -t * 0.25)
    },
    dispose() {
      group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
      for (const o of owned) o.dispose()
    },
  }
}

function buildDetour(kt: KurguTrack, g: GateDef, group: THREE.Group, deckMat: THREE.Material, mats: Materials, piers: Pier[]): void {
  const lane: FrameFn = (s) => {
    const f = kt.main.frameAt(s)
    return { pos: altPoint(kt, g, s, 0, -0.06), left: f.left, up: f.up }
  }
  const e = 22
  const ss = samplesBetween(g.s0 - e, g.s1 + e, 2).filter((s) => kt.altBlend(g, s) > 0.12)
  if (ss.length < 2) return
  const h = kt.main.frameAt((g.s0 + g.s1) / 2).width / 2
  group.add(new THREE.Mesh(sweepFrames(lane, ss, [deckStrip(h)], PIECE_M), deckMat))
  group.add(new THREE.Mesh(sweepFrames(lane, ss, railStrips(h, DETOUR)), mats.plastic))
  for (let i = 0; i < ss.length; i += 10) {
    const s = ss[i]
    for (const side of [1, -1]) {
      const p = altPoint(kt, g, s, side * (h - 1), BASE_Y - 0.06)
      piers.push({ x: p.x, z: p.z, top: p.y, d: side })
    }
  }
}

const BLOCK_COLORS = [0xff5a5a, 0x3fa9ff, 0xffd23f, 0x4fd16a, 0xff9a3c, 0xa77bff].map((c) => new THREE.Color(c))
const BLOCK_H = 2.4
/** Stacked blocks are drawn this tall (fewer instances than real 2.4 m blocks). */
const STACK_H = 3.4

function buildPiers(piers: readonly Pier[], decor: number, owned: { dispose(): void }[]): THREE.InstancedMesh {
  const geo = pierGeometry()
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.32, envMapIntensity: 1 })
  owned.push(geo, mat)
  const mats: THREE.Matrix4[] = []
  const cols: THREE.Color[] = []
  let k = 0
  for (const p of piers) {
    if (p.top < 1.6) continue
    if (p.top < 3.2) {
      // Floor-level track: one squat block as a foot.
      if (decor < 1 && k++ % 2 === 1) continue
      mats.push(trs(p.x, 0, p.z, 0, 0, 0, 1, p.top / BLOCK_H, 1).clone())
      cols.push(BLOCK_COLORS[(mats.length * 7) % BLOCK_COLORS.length])
      continue
    }
    const n = Math.max(1, Math.round(p.top / STACK_H))
    const hh = p.top / n
    for (let i = 0; i < n; i++) {
      mats.push(trs(p.x, i * hh, p.z, 0, ((i % 2) * Math.PI) / 4, 0, 1, hh / BLOCK_H, 1).clone())
      cols.push(BLOCK_COLORS[(i + Math.round(p.x * 0.13 + p.z * 0.07)) % BLOCK_COLORS.length])
    }
  }
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length))
  mats.forEach((m, i) => {
    im.setMatrixAt(i, m)
    im.setColorAt(i, cols[i])
  })
  im.count = mats.length
  im.castShadow = false
  im.receiveShadow = true
  im.computeBoundingSphere()
  return im
}
