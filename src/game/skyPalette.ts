/**
 * Colour grading of the Uçan Adalar sky per island zone, by day and by night: sky gradient,
 * cloud sea, fog, hemisphere and sun (moon) light. The world blends towards the palette of
 * the zone the player is in, so candy feels warm and pink, ice cool and crisp, volcano hazy
 * orange, water fresh and teal.
 */
import * as THREE from 'three'
import type { ThemeId } from '../sim/track'

export interface SkyPalette {
  readonly zenith: THREE.Color
  readonly mid: THREE.Color
  readonly horizon: THREE.Color
  readonly seaTop: THREE.Color
  readonly seaShade: THREE.Color
  readonly fog: THREE.Color
  readonly hemiSky: THREE.Color
  readonly hemiGround: THREE.Color
  readonly sun: THREE.Color
  /** Light intensities. */
  readonly hemiI: number
  readonly sunI: number
  readonly fogNear: number
  readonly fogFar: number
}

type Raw = { [K in keyof SkyPalette]: SkyPalette[K] extends THREE.Color ? string : number }

const c = (hex: string): THREE.Color => new THREE.Color(hex)
const make = (r: Raw): SkyPalette => ({
  zenith: c(r.zenith), mid: c(r.mid), horizon: c(r.horizon), seaTop: c(r.seaTop), seaShade: c(r.seaShade), fog: c(r.fog),
  hemiSky: c(r.hemiSky), hemiGround: c(r.hemiGround), sun: c(r.sun), hemiI: r.hemiI, sunI: r.sunI, fogNear: r.fogNear, fogFar: r.fogFar,
})

const DAY_BASE: Raw = {
  zenith: '#1560dc', mid: '#4fb0ff', horizon: '#c4e8ff', seaTop: '#fbfcff', seaShade: '#a2b8ea', fog: '#c8e6ff',
  hemiSky: '#d4eaff', hemiGround: '#ffe8da', sun: '#fff0d4', hemiI: 1.3, sunI: 2.7, fogNear: 900, fogFar: 4400,
}

const NIGHT_BASE: Raw = {
  zenith: '#060a2e', mid: '#152463', horizon: '#3e3a8c', seaTop: '#4c5596', seaShade: '#232a5e', fog: '#2a2d6e',
  hemiSky: '#7c8ae8', hemiGround: '#4a3466', sun: '#bccbff', hemiI: 0.75, sunI: 1.25, fogNear: 420, fogFar: 2600,
}

const DAY: Readonly<Record<ThemeId, SkyPalette>> = {
  candy: make({ ...DAY_BASE, horizon: '#f6dcf2', fog: '#e8ddf6', hemiGround: '#ffd9ea', mid: '#5ab4ff' }),
  ice: make({ ...DAY_BASE, horizon: '#d2f2ff', fog: '#d2eeff', hemiSky: '#d8f2ff', hemiGround: '#d6ecff', sun: '#f6fbff', mid: '#62c2ff' }),
  volcano: make({ ...DAY_BASE, zenith: '#2a58b8', mid: '#7aa6e4', horizon: '#ffd6b4', fog: '#ecd0c4', hemiSky: '#ffe4cc', hemiGround: '#ffb88e', sun: '#ffd8a4', sunI: 2.5 }),
  water: make({ ...DAY_BASE, mid: '#48c0f2', horizon: '#c6f5ee', fog: '#c8eef0', hemiSky: '#d0f4ff', hemiGround: '#d6ffe6', sun: '#fff6dc' }),
}

const NIGHT: Readonly<Record<ThemeId, SkyPalette>> = {
  candy: make({ ...NIGHT_BASE, horizon: '#6a3a8e', fog: '#3e2c72', hemiGround: '#5a3070' }),
  ice: make({ ...NIGHT_BASE, horizon: '#2e4c96', fog: '#24356e', hemiSky: '#8aa6ff' }),
  volcano: make({ ...NIGHT_BASE, horizon: '#7a3a4a', fog: '#4a2a4a', hemiGround: '#7a3a2a', sun: '#ffc8a8' }),
  water: make({ ...NIGHT_BASE, horizon: '#1f5a7e', fog: '#1e3e6a', hemiSky: '#7ad0ff' }),
}

export function paletteFor(theme: ThemeId, night: boolean): SkyPalette {
  return (night ? NIGHT : DAY)[theme]
}

/** A mutable palette the shaders and lights read from (uniform values share these colours). */
export interface LivePalette {
  zenith: THREE.Color
  mid: THREE.Color
  horizon: THREE.Color
  seaTop: THREE.Color
  seaShade: THREE.Color
  fog: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  sun: THREE.Color
  hemiI: number
  sunI: number
  fogNear: number
  fogFar: number
}

export function livePalette(p: SkyPalette): LivePalette {
  return {
    zenith: p.zenith.clone(), mid: p.mid.clone(), horizon: p.horizon.clone(), seaTop: p.seaTop.clone(), seaShade: p.seaShade.clone(), fog: p.fog.clone(),
    hemiSky: p.hemiSky.clone(), hemiGround: p.hemiGround.clone(), sun: p.sun.clone(), hemiI: p.hemiI, sunI: p.sunI, fogNear: p.fogNear, fogFar: p.fogFar,
  }
}

const COLORS = ['zenith', 'mid', 'horizon', 'seaTop', 'seaShade', 'fog', 'hemiSky', 'hemiGround', 'sun'] as const
const NUMBERS = ['hemiI', 'sunI', 'fogNear', 'fogFar'] as const

/** Moves `live` a share k (0..1) of the way towards `target`, in place (colours are shared uniforms). */
export function blendPalette(live: LivePalette, target: SkyPalette, k: number): void {
  for (const key of COLORS) live[key].lerp(target[key], k)
  for (const key of NUMBERS) live[key] += (target[key] - live[key]) * k
}
