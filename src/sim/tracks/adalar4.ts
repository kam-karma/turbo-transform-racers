/**
 * Uçan Adalar 4 ("Şelale Slalomu"): the water track. Long canal slaloms broken by short
 * glides from one waterfall channel down to the next (boat → glider → boat), an icy hairpin,
 * a short volcano wall with a jump and a candy finish.
 */
import { pathTrack, type Piece } from '../trackPath'

export const ADALAR_4_PIECES: readonly Piece[] = [
  { len: 200, surface: 'road', theme: 'water', coins: { n: 8, d: 0 } },
  { len: 140, surface: 'road', turn: 30, boost: true },
  { len: 170, surface: 'water', turn: -50, width: 16, coins: { n: 6, d: -3 } },
  { len: 160, surface: 'water', turn: 55, width: 16, coins: { n: 5, d: 3 } },
  { len: 150, surface: 'water', turn: -55, width: 16, pitchTo: -3 },
  { len: 60, surface: 'gap', pitchTo: -9, coins: { n: 3, d: 0 } },
  { len: 170, surface: 'water', turn: 40, width: 16, pitchTo: -2, coins: { n: 6, d: 3 } },
  { len: 150, surface: 'water', turn: -45, width: 16 },
  { len: 70, surface: 'gap', pitchTo: -9, coins: { n: 4, d: 0 } },
  { len: 150, surface: 'water', width: 16, pitchTo: 0, coins: { n: 5, d: 0 } },
  { len: 140, surface: 'water', turn: 45, width: 16 },
  { len: 150, surface: 'road', turn: 40, theme: 'ice' },
  { len: 200, surface: 'ice', turn: 120, coins: { n: 7, d: 3 } },
  { len: 170, surface: 'ice', turn: -60, boost: true },
  { len: 150, surface: 'road', turn: 35, pitchTo: -3, coins: { n: 5, d: 0 } },
  { len: 130, surface: 'road', turn: 25, pitchTo: 0, theme: 'volcano', coins: { n: 4, d: 0 } },
  { len: 80, surface: 'climb', pitchTo: 26, width: 12 },
  { len: 140, surface: 'road', pitchTo: 0, turn: -35 },
  { len: 90, surface: 'road', pitchTo: 9, ramp: true },
  { len: 90, surface: 'gap', pitchTo: -9, coins: { n: 5, d: 0 } },
  { len: 160, surface: 'road', pitchTo: -3, turn: 30, theme: 'candy', boost: true },
  { len: 200, surface: 'road', pitchTo: 0, turn: -70, coins: { n: 8, d: -3 } },
  { len: 200, surface: 'road', turn: 40, coins: { n: 8, d: 3 } },
  { len: 220, surface: 'road', coins: { n: 10, d: 0 } },
]

export const ADALAR_4 = pathTrack('adalar4', 'Şelale Slalomu', ADALAR_4_PIECES)
