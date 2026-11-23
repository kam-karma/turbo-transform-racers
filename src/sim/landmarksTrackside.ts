/**
 * Where the trackside set pieces go, decided from the track data alone (pure, tested):
 * start / finish gates, arches over the road, rings over glides and boost pads, roadside
 * balconies with props, lamps, flags, corner chevron boards and arrows, form signs before
 * every change of form, bridge piers, buoys and spills along the water channels.
 */
import { FORM_FOR, type FormId, type Surface } from './forms'
import type { ThemeId, Track } from './track'

export type Side = 1 | -1

export interface Spot {
  readonly s: number
}
export interface SideSpot extends Spot {
  readonly side: Side
}

export interface TracksidePlan {
  readonly gates: readonly (Spot & { readonly kind: 'start' | 'finish' })[]
  readonly arches: readonly (Spot & { readonly theme: ThemeId; readonly water: boolean })[]
  readonly rings: readonly (Spot & { readonly kind: 'glide' | 'boost' })[]
  readonly balconies: readonly (SideSpot & { readonly theme: ThemeId })[]
  readonly lamps: readonly (SideSpot & { readonly theme: ThemeId })[]
  readonly flags: readonly SideSpot[]
  /** Chevron boards on the outside of a bend; `left` = the bend turns left. */
  readonly boards: readonly (SideSpot & { readonly left: boolean })[]
  readonly arrows: readonly (Spot & { readonly left: boolean })[]
  /** One per change of form: where the sign stands and the boundary it announces. */
  readonly formSigns: readonly (Spot & { readonly boundary: number; readonly form: FormId; readonly paint: boolean })[]
  readonly piers: readonly Spot[]
  readonly buoys: readonly SideSpot[]
  readonly spills: readonly SideSpot[]
  /** Water channels that end at a gap: a waterfall pours off the end. */
  readonly edgeFalls: readonly Spot[]
}

export const START_GATE_S = 34
const FINISH_BACK = 4
const ARCH_EVERY = 260
const CURVE = 0.0055

const isSolid = (s: Surface): boolean => s === 'road' || s === 'ice'

/** Every surface sampled every 4 m in [s - r, s + r] passes `ok`. */
function around(track: Track, s: number, r: number, ok: (x: Surface) => boolean): boolean {
  for (let x = Math.max(0, s - r); x <= Math.min(track.length, s + r); x += 4) if (!ok(track.surfaceAt(x))) return false
  return true
}

/** s of every change of needed form, with the form after it. */
export function formBoundaries(track: Track): { s: number; form: FormId; surface: Surface }[] {
  const out: { s: number; form: FormId; surface: Surface }[] = []
  let b = track.nextBoundary(0)
  while (b !== null) {
    out.push({ s: b.s, form: FORM_FOR[b.surface], surface: b.surface })
    b = track.nextBoundary(b.s + 0.5)
  }
  return out
}

function sectionSpans(track: Track): { s0: number; s1: number; surface: Surface; boost: readonly (readonly [number, number])[] }[] {
  let acc = 0
  return track.def.sections.map((sec) => {
    const span = { s0: acc, s1: Math.min(track.length, acc + sec.len), surface: sec.surface, boost: sec.boost ?? [] }
    acc += sec.len
    return span
  })
}

const near = (list: readonly Spot[], s: number, r: number): boolean => list.some((x) => Math.abs(x.s - s) < r)

/** `density` 1 on High, 0.5 on Low (roadside props thin out; set pieces stay). */
export function planTrackside(track: Track, density = 1): TracksidePlan {
  const L = track.length
  const spans = sectionSpans(track)
  const bounds = formBoundaries(track)
  const nearBoundary = (s: number, r: number): boolean => bounds.some((b) => Math.abs(b.s - s) < r)
  const gates = [{ s: START_GATE_S, kind: 'start' as const }, { s: L - FINISH_BACK, kind: 'finish' as const }]

  const rings: (Spot & { kind: 'glide' | 'boost' })[] = []
  const edgeFalls: Spot[] = []
  spans.forEach((sp, i) => {
    const len = sp.s1 - sp.s0
    if (sp.surface === 'gap' && len >= 45) {
      const n = Math.max(1, Math.round(len / 50))
      for (let k = 0; k < n; k++) rings.push({ s: sp.s0 + (len * (k + 0.5)) / n, kind: 'glide' })
    }
    for (const [a] of sp.boost) rings.push({ s: sp.s0 + a + 3, kind: 'boost' })
    if (sp.surface === 'water' && spans[i + 1]?.surface === 'gap') edgeFalls.push({ s: sp.s1 })
  })

  const arches: (Spot & { theme: ThemeId; water: boolean })[] = []
  for (let s0 = 170; s0 < L - 120; s0 += ARCH_EVERY) {
    for (let s = s0; s < s0 + 140; s += 10) {
      const solid = around(track, s, 18, isSolid)
      const water = around(track, s, 18, (x) => x === 'water')
      if (!(solid || water) || nearBoundary(s, 30) || near(gates, s, 90) || near(rings, s, 30) || near(arches, s, 150)) continue
      arches.push({ s, theme: track.themeAt(s), water })
      break
    }
  }

  // A sign only where the run-up to the change is one stretch: right after a gap the next
  // sign would announce the landing while the player still has to glide.
  const formSigns = bounds
    .filter((b, i) => b.s > 100 && (i === 0 || bounds[i - 1].s < b.s - 85))
    .map((b) => ({ s: b.s - 85, boundary: b.s, form: b.form, paint: around(track, b.s - 40, 22, isSolid) }))

  const boards: (SideSpot & { left: boolean })[] = []
  const arrows: (Spot & { left: boolean })[] = []
  let inCurve = 0
  let run = 0
  for (let s = 60; s < L - 30; s += 13) {
    const k = track.frameAt(s).curvH
    const dir = Math.abs(k) > CURVE ? Math.sign(k) : 0
    if (dir !== 0 && dir !== inCurve) {
      run = 0
      if (around(track, s - 28, 6, isSolid) && !near(gates, s - 28, 40)) arrows.push({ s: s - 28, left: dir > 0 })
    }
    inCurve = dir
    if (dir !== 0 && run < 5 && isSolid(track.surfaceAt(s)) && !near(arches, s, 12) && !near(rings, s, 8)) {
      boards.push({ s, side: dir > 0 ? -1 : 1, left: dir > 0 })
      run++
    }
  }

  const step = (m: number): number => m / Math.max(0.25, density)
  const blocked = (s: number): boolean => near(gates, s, 26) || near(arches, s, 12) || near(rings, s, 10) || near(formSigns, s, 8)
  const balconies: (SideSpot & { theme: ThemeId })[] = []
  let side: Side = 1
  for (let s = 70; s < L - 40; s += step(30)) {
    side = side === 1 ? -1 : 1
    const sd = side
    if (!around(track, s, 5, isSolid) || blocked(s) || boards.some((b) => b.side === sd && Math.abs(b.s - s) < 10)) continue
    balconies.push({ s, side: sd, theme: track.themeAt(s) })
  }
  const lamps: (SideSpot & { theme: ThemeId })[] = []
  side = -1
  for (let s = 52; s < L - 20; s += step(46)) {
    side = side === 1 ? -1 : 1
    const sd = side
    if (!around(track, s, 1, (x) => isSolid(x) || x === 'water') || near(gates, s, 14) || near(arches, s, 8) || balconies.some((b) => b.side === sd && Math.abs(b.s - s) < 7)) continue
    lamps.push({ s, side: sd, theme: track.themeAt(s) })
  }
  const flags: SideSpot[] = []
  for (let s = 90; s < L - 40; s += step(75)) {
    const sd: Side = Math.round(s / 75) % 2 === 0 ? 1 : -1
    if (!around(track, s, 1, isSolid) || blocked(s) || lamps.some((l) => Math.abs(l.s - s) < 6) || balconies.some((b) => b.side === sd && Math.abs(b.s - s) < 7)) continue
    flags.push({ s, side: sd })
  }

  const piers: Spot[] = []
  for (let s = 80; s < L - 40; s += 140) if (around(track, s, 4, (x) => isSolid(x) || x === 'water') && !near(gates, s, 30)) piers.push({ s })
  const buoys: SideSpot[] = []
  const spills: SideSpot[] = []
  for (const sp of spans) {
    if (sp.surface !== 'water') continue
    let k = 0
    for (let s = sp.s0 + 10; s < sp.s1 - 6; s += step(18)) buoys.push({ s, side: k++ % 2 === 0 ? 1 : -1 })
    k = 0
    for (let s = sp.s0 + 35; s < sp.s1 - 20; s += 70) spills.push({ s, side: k++ % 2 === 0 ? 1 : -1 })
  }
  return { gates, arches, rings, balconies, lamps, flags, boards, arrows, formSigns, piers, buoys, spills, edgeFalls }
}
