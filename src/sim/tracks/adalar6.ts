/**
 * Uçan Adalar 6 ("Dev Spiral"): the grand tour. A rising spiral that crosses over its own
 * start on a bridge, an ice canyon with a jump down to a water staircase, a volcano wall
 * straight into a glide, and a winding candy run home.
 */
import { pathTrack, type Piece } from '../trackPath'

export const ADALAR_6_PIECES: readonly Piece[] = [
  { len: 200, surface: 'road', theme: 'candy', coins: { n: 8, d: 0 } },
  { len: 260, surface: 'road', turn: 160, pitchTo: 4, coins: { n: 8, d: 3 } },
  { len: 260, surface: 'road', turn: 170, pitchTo: 4, boost: true },
  { len: 140, surface: 'road', turn: 20, pitchTo: 0, theme: 'ice', coins: { n: 5, d: 0 } },
  { len: 200, surface: 'ice', turn: -60, coins: { n: 6, d: -3 } },
  { len: 180, surface: 'ice', turn: 60 },
  { len: 160, surface: 'ice', turn: -50, coins: { n: 5, d: -3 } },
  { len: 90, surface: 'road', pitchTo: 8, ramp: true },
  { len: 70, surface: 'gap', pitchTo: -10, coins: { n: 4, d: 0 } },
  { len: 160, surface: 'water', pitchTo: -5, width: 16, theme: 'water', coins: { n: 5, d: 0 } },
  { len: 160, surface: 'water', turn: -50, pitchTo: -4, width: 16, coins: { n: 5, d: -3 } },
  { len: 160, surface: 'water', turn: 50, pitchTo: -2, width: 16 },
  { len: 150, surface: 'water', turn: -45, pitchTo: -2, width: 16, coins: { n: 4, d: 3 } },
  { len: 140, surface: 'road', turn: -20, pitchTo: 0, theme: 'volcano', boost: true },
  { len: 90, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 50, surface: 'road', pitchTo: 6, ramp: true },
  { len: 120, surface: 'gap', pitchTo: -12, coins: { n: 6, d: 0 } },
  { len: 160, surface: 'road', pitchTo: -3, turn: 45, coins: { n: 5, d: 3 } },
  { len: 180, surface: 'road', turn: -70, pitchTo: -3, coins: { n: 6, d: -3 } },
  { len: 160, surface: 'road', pitchTo: 0, turn: -60, theme: 'candy' },
  { len: 160, surface: 'road', turn: 50, boost: true, coins: { n: 6, d: 0 } },
  { len: 260, surface: 'road', coins: { n: 10, d: 0 } },
]

export const ADALAR_6 = pathTrack('adalar6', 'Dev Spiral', ADALAR_6_PIECES)
