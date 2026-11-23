/** Per-world colours shared by the showroom, world cards and the cup map. */
import type { WorldId } from '../meta/cups'

export interface WorldTheme {
  /** Gradient fallback for the backdrop / world card, top → bottom. */
  readonly sky: readonly string[]
  readonly vignette: string
  /** Wash over the blurred world art so menus stay readable. */
  readonly tint: string
  /** Podium ring, highlights. */
  readonly accent: string
  /** Cup map path colour and node glow. */
  readonly path: string
  readonly cupIcon: string
}

const THEMES: Readonly<Record<WorldId, WorldTheme>> = {
  adalar: {
    sky: ['#1a62d8', '#58afff', '#bfe4ff', '#fff4fb'],
    vignette: 'rgba(30,40,140,.55)',
    tint: 'rgba(70,130,255,.12)',
    accent: '#ff5fc8',
    path: '#ffffff',
    cupIcon: 'cup-donusum',
  },
  'dev-ev': {
    sky: ['#ffcf7a', '#ffb45c', '#f08a3c', '#9b4a1e'],
    vignette: 'rgba(90,40,10,.6)',
    tint: 'rgba(255,170,60,.1)',
    accent: '#ffb300',
    path: '#ff8a1f',
    cupIcon: 'cup-kurgu',
  },
  neon: {
    sky: ['#05031a', '#1a0a4a', '#4a1a8a', '#ff4fd8'],
    vignette: 'rgba(5,2,25,.7)',
    tint: 'rgba(40,10,100,.18)',
    accent: '#39f2ff',
    path: '#39f2ff',
    cupIcon: 'cup-kaos',
  },
}

export const worldTheme = (w: WorldId): WorldTheme => THEMES[w]
