/**
 * The road body, section by section: textured decks (road / ice / climb), the water channel,
 * candy kerbs, and the cake-layered side and underside slab every floating section shows.
 */
import * as THREE from 'three'
import type { Surface } from '../sim/forms'
import type { ThemeId, Track } from '../sim/track'
import { DEFAULT_WIDTH } from '../sim/track'
import { col } from './islandsGeo'
import { cap, onTrack, sectionStarts, sweep, type ProfilePoint, type Strip } from './trackMeshSweep'
import { TEX_LEN } from './trackMeshTextures'

export interface ThemeColors {
  /** Cake layers of the slab side, top to bottom. */
  readonly a: string
  readonly b: string
  readonly c: string
  readonly under: string
  /** Kerb and rail stripe tint. */
  readonly kerb: string
  /** Glossy bands down the slab side, top to bottom (the concept's rainbow road edge). */
  readonly bands: readonly [string, string, string, string, string]
}

export const THEME_COLORS: Readonly<Record<ThemeId, ThemeColors>> = {
  candy: { a: '#ff6fae', b: '#fff0d9', c: '#9ee6c9', under: '#b79ad8', kerb: '#ff3d8b', bands: ['#ff5fa2', '#ffd84a', '#7fe0a8', '#6cc6ff', '#b58cff'] },
  ice: { a: '#ffffff', b: '#bfe7ff', c: '#7fc6f2', under: '#6aa9dd', kerb: '#2f9dff', bands: ['#ffffff', '#d6f1ff', '#8fd3ff', '#4fa8f0', '#7c8cff'] },
  volcano: { a: '#ff8a2e', b: '#6b3f33', c: '#3d2b2b', under: '#2c2026', kerb: '#ff5a1a', bands: ['#ffb02e', '#ff6a1a', '#c2361f', '#6b3f33', '#3d2b2b'] },
  water: { a: '#ffe2a6', b: '#5fd3cf', c: '#2fa7c0', under: '#2b7fa8', kerb: '#19b7d6', bands: ['#fff1c4', '#ffd27a', '#5fe0cf', '#2fb7d6', '#2b7fa8'] },
}

/** Kerb width beside the asphalt. */
export const KERB = 1.2
/** Slab bottom below the road surface. */
const BOTTOM = -1.25
const BANK = 1.4
const KEEL = new THREE.Color()
const STEP = 3
const SHELL_STEP = 6

export interface RoadGeos {
  readonly road: THREE.BufferGeometry[]
  readonly ice: THREE.BufferGeometry[]
  readonly climb: THREE.BufferGeometry[]
  readonly water: THREE.BufferGeometry[]
  readonly shell: THREE.BufferGeometry[]
  readonly candy: THREE.BufferGeometry[]
}

const isSlab = (s: Surface): boolean => s === 'road' || s === 'ice' || s === 'climb'

/** `coarse` (Low quality) sweeps the slab sides and kerbs in longer steps. */
export function buildRoadGeos(track: Track, coarse = false): RoadGeos {
  const sideStep = coarse ? 10 : SHELL_STEP
  const out: RoadGeos = { road: [], ice: [], climb: [], water: [], shell: [], candy: [] }
  const starts = sectionStarts(track)
  const secs = track.def.sections
  const theme = (s: number): ThemeColors => THEME_COLORS[track.themeAt(s)]
  const layer = (k: Exclude<keyof ThemeColors, 'bands'>) => (s: number) => col(theme(s)[k])
  const band = (i: number) => (s: number) => col(theme(s).bands[i])

  secs.forEach((sec, i) => {
    const s0 = starts[i]
    const s1 = Math.min(track.length, s0 + sec.len)
    if (s1 - s0 < 0.5 || sec.surface === 'gap') return
    const w = sec.width ?? DEFAULT_WIDTH
    const hw = w / 2
    const prev = secs[i - 1]
    const next = secs[i + 1]
    const differs = (o: typeof sec | undefined): boolean => o === undefined || o.surface !== sec.surface || (o.width ?? DEFAULT_WIDTH) !== w
    if (isSlab(sec.surface)) {
      const deck = sweep(track, s0, s1, STEP, [{ pts: [{ d: hw, y: 0, u: 0 }, { d: -hw, y: 0, u: 1 }] }], TEX_LEN)
      out[sec.surface === 'ice' ? 'ice' : sec.surface === 'climb' ? 'climb' : 'road'].push(deck)
      out.candy.push(sweep(track, s0, s1, sideStep, kerbStrips(hw, layer('kerb')), 4))
      out.shell.push(sweep(track, s0, s1, sideStep, slabStrips(hw + KERB, 0.06, layer, band, coarse), 1))
      const outline = slabOutline(hw + KERB)
      if (differs(prev)) out.shell.push(cap(track, s0, outline, col(theme(s0).a), -1))
      if (differs(next)) out.shell.push(cap(track, s1, outline, col(theme(s1).a), 1))
      if (sec.surface === 'climb') out.shell.push(...climbRibs(track, s0, s1, hw))
      // Deep-blue pad under the boost chevrons so they pop off the asphalt.
      for (const [a, b] of sec.boost ?? []) {
        const pad = (): THREE.Color => col(BOOST_PAD)
        out.shell.push(sweep(track, s0 + a, Math.min(s1, s0 + b), STEP, [{ pts: [{ d: hw * BOOST_W, y: 0.02 }, { d: -hw * BOOST_W, y: 0.02 }], color: pad }], 1))
      }
    } else if (sec.surface === 'water') {
      out.shell.push(sweep(track, s0, s1, sideStep, channelStrips(hw, layer, band, coarse), 1))
      const across: ProfilePoint[] = []
      for (let k = 0; k <= 8; k++) across.push({ d: hw + 0.15 - ((2 * hw + 0.3) * k) / 8, y: -0.08, u: k / 8 })
      out.water.push(sweep(track, s0, s1, STEP, [{ pts: across }], 1))
      for (const [ss, dir] of [[s0, -1], [s1, 1]] as const) {
        if (!differs(dir < 0 ? prev : next)) continue
        const c = col(theme(ss).a)
        out.shell.push(cap(track, ss, bankOutline(hw, 1), c, dir), cap(track, ss, bankOutline(hw, -1), c, dir))
      }
    }
  })
  return out
}

/** Two raised, rounded kerbs; u stays 0 so the stripe mask gives straight bands. */
function kerbStrips(hw: number, tint: (s: number) => THREE.Color): Strip[] {
  const e = hw + KERB
  return [
    { pts: [{ d: e, y: 0.06, u: 0 }, { d: e - 0.3, y: 0.22, u: 0 }, { d: hw + 0.3, y: 0.22, u: 0 }, { d: hw, y: 0.01, u: 0 }], color: tint },
    { pts: [{ d: -hw, y: 0.01, u: 0 }, { d: -hw - 0.3, y: 0.22, u: 0 }, { d: -e + 0.3, y: 0.22, u: 0 }, { d: -e, y: 0.06, u: 0 }], color: tint },
  ]
}

type Layer = (k: Exclude<keyof ThemeColors, 'bands'>) => (s: number) => THREE.Color
type Band = (i: number) => (s: number) => THREE.Color

/**
 * Both sides and the belly of a slab whose outer edge is at ±e and top at `top`. Sides bulge
 * a little and come in three hard-edged layers like a slice of cake.
 */
function slabStrips(e: number, top: number, layer: Layer, band: Band, coarse = false): Strip[] {
  // Five rounded bands, bottom → top, bulging out a little in the middle.
  const ys = [BOTTOM, -0.98, -0.74, -0.5, -0.24, top]
  const bulge = [-0.1, 0.06, 0.14, 0.17, 0.12, 0]
  const strips: Strip[] = []
  for (let i = 0; i < 5; i++) {
    const mid = (ys[i] + ys[i + 1]) / 2
    const pts: [number, number][] = coarse
      ? [[e + bulge[i], ys[i]], [e + bulge[i + 1], ys[i + 1]]]
      : [[e + bulge[i], ys[i]], [e + (bulge[i] + bulge[i + 1]) / 2 + 0.04, mid], [e + bulge[i + 1], ys[i + 1]]]
    const tintOf = band(4 - i)
    strips.push({ pts: pts.map(([d, y]) => ({ d, y })), color: tintOf })
    // Right side: mirrored and walked top → bottom.
    strips.push({ pts: pts.map(([d, y]) => ({ d: -d, y })).reverse(), color: tintOf })
  }
  // Belly: lighter outer bands, a deeper keel down the middle so it is not one flat sheet.
  const keel = (s: number): THREE.Color => KEEL.copy(layer('under')(s)).multiplyScalar(0.72)
  strips.push(
    { pts: [{ d: -e + 0.1, y: BOTTOM }, { d: -e * 0.45, y: BOTTOM - 0.22 }], color: layer('under') },
    { pts: [{ d: -e * 0.45, y: BOTTOM - 0.22 }, { d: 0, y: BOTTOM - 0.3 }, { d: e * 0.45, y: BOTTOM - 0.22 }], color: keel },
    { pts: [{ d: e * 0.45, y: BOTTOM - 0.22 }, { d: e - 0.1, y: BOTTOM }], color: layer('under') },
  )
  return strips
}

function slabOutline(e: number): ProfilePoint[] {
  return [
    { d: e, y: 0.06 },
    { d: -e, y: 0.06 },
    { d: -e - 0.16, y: -0.45 },
    { d: -e + 0.1, y: BOTTOM },
    { d: 0, y: BOTTOM - 0.28 },
    { d: e - 0.1, y: BOTTOM },
    { d: e + 0.16, y: -0.45 },
  ]
}

const BANK_TOP = '#fff3d6'
const FLOOR = '#1b8fbf'
const FLOOR_MID = '#126f9e'

/** The water channel: outer cake sides, rounded sandy banks, a sloping floor. */
function channelStrips(hw: number, layer: Layer, band: Band, coarse: boolean): Strip[] {
  const o = hw + BANK
  const strips = slabStrips(o, 0.62, layer, band, coarse)
  const bankTop = (): THREE.Color => col(BANK_TOP)
  const floor = (): THREE.Color => col(FLOOR)
  strips.push(
    { pts: [{ d: o, y: 0.62 }, { d: o - 0.5, y: 0.78 }, { d: hw + 0.35, y: 0.66 }, { d: hw, y: 0.3 }], color: bankTop },
    { pts: [{ d: hw, y: 0.3 }, { d: hw - 0.3, y: -0.55 }, { d: hw - 0.9, y: -0.95 }], color: layer('b') },
    // Darker middle band reads as depth through the translucent water.
    { pts: [{ d: hw - 0.9, y: -0.95 }, { d: hw * 0.4, y: -1.04 }], color: floor },
    { pts: [{ d: hw * 0.4, y: -1.04 }, { d: 0, y: -1.1 }, { d: -hw * 0.4, y: -1.04 }], color: () => col(FLOOR_MID) },
    { pts: [{ d: -hw * 0.4, y: -1.04 }, { d: -hw + 0.9, y: -0.95 }], color: floor },
    { pts: [{ d: -hw + 0.9, y: -0.95 }, { d: -hw + 0.3, y: -0.55 }, { d: -hw, y: 0.3 }], color: layer('b') },
    { pts: [{ d: -hw, y: 0.3 }, { d: -hw - 0.35, y: 0.66 }, { d: -o + 0.5, y: 0.78 }, { d: -o, y: 0.62 }], color: bankTop },
  )
  return strips
}

/** One bank's end face (side = +1 left, −1 right). */
function bankOutline(hw: number, side: 1 | -1): ProfilePoint[] {
  const o = hw + BANK
  const pts: [number, number][] = [
    [o + 0.16, -0.45],
    [o, 0.62],
    [o - 0.5, 0.78],
    [hw + 0.35, 0.66],
    [hw, 0.3],
    [hw - 0.9, -0.95],
    [hw - 0.9, BOTTOM - 0.2],
    [o - 0.1, BOTTOM],
  ]
  return pts.map(([d, y]) => ({ d: d * side, y }))
}

const BOOST_PAD = '#3557c4'
/** Share of the half-width the boost pad covers. */
export const BOOST_W = 0.74
const RIB = '#a8471f'
const RIB_TOP = '#ffb347'

/** Chunky grip ribs across the climbing wall, with a light top edge so they read at speed. */
function climbRibs(track: Track, s0: number, s1: number, hw: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  for (let s = s0 + 2; s < s1 - 1; s += 1.8) {
    const g = new THREE.BoxGeometry(hw * 2 - 0.6, 0.16, 0.42).toNonIndexed()
    g.translate(0, 0.08, 0)
    const pos = g.getAttribute('position')
    const c: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const k = col(pos.getY(i) > 0.12 ? RIB_TOP : RIB)
      c.push(k.r, k.g, k.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
    out.push(onTrack(g, track, s, 0, 0))
  }
  return out
}
