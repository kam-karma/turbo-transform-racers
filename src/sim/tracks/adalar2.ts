/**
 * Uçan Adalar 2 ("Kristal Virajlar"): starts on the ice island with long sliding S-curves,
 * a double gap over two candy islets, a water slalom, then a volcano wall that ends in a
 * jump off the top, and a fast icy run home.
 */
import { pathTrack, type Piece } from '../trackPath'

export const ADALAR_2_PIECES: readonly Piece[] = [
  { len: 200, surface: 'road', theme: 'ice', coins: { n: 8, d: 0 } },
  { len: 180, surface: 'ice', turn: 55, coins: { n: 5, d: 3 } },
  { len: 180, surface: 'ice', turn: -65 },
  { len: 170, surface: 'ice', turn: 55, boost: true, coins: { n: 5, d: -3 } },
  { len: 150, surface: 'ice', turn: -40, pitchTo: -3 },
  { len: 130, surface: 'road', turn: -25, pitchTo: 0, theme: 'candy' },
  { len: 90, surface: 'road', pitchTo: 8, ramp: true },
  { len: 60, surface: 'gap', pitchTo: -5, coins: { n: 3, d: 0 } },
  { len: 50, surface: 'road', pitchTo: 7, ramp: true, coins: { n: 2, d: 0 } },
  { len: 70, surface: 'gap', pitchTo: -7, coins: { n: 4, d: 0 } },
  { len: 150, surface: 'road', pitchTo: 0, turn: 30, boost: true },
  { len: 180, surface: 'water', turn: -45, width: 16, theme: 'water', coins: { n: 6, d: -3 } },
  { len: 160, surface: 'water', turn: 50, width: 16, coins: { n: 5, d: 3 } },
  { len: 160, surface: 'water', turn: -50, width: 16, coins: { n: 5, d: -3 } },
  { len: 150, surface: 'road', turn: 25, theme: 'volcano', coins: { n: 5, d: 0 } },
  { len: 90, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 60, surface: 'road', pitchTo: 3 },
  { len: 70, surface: 'road', pitchTo: 8, ramp: true },
  { len: 110, surface: 'gap', pitchTo: -10, coins: { n: 6, d: 0 } },
  { len: 170, surface: 'road', pitchTo: -5, turn: -40, boost: true },
  { len: 120, surface: 'road', turn: 35, pitchTo: -2, coins: { n: 4, d: 0 } },
  { len: 220, surface: 'road', pitchTo: 0, turn: 70, coins: { n: 8, d: 3 } },
  { len: 210, surface: 'ice', turn: -60, pitchTo: -3, theme: 'ice', coins: { n: 6, d: 0 } },
  { len: 180, surface: 'road', turn: 30, pitchTo: 0, theme: 'candy', boost: true },
  { len: 260, surface: 'road', coins: { n: 10, d: 0 } },
]

export const ADALAR_2 = pathTrack('adalar2', 'Kristal Virajlar', ADALAR_2_PIECES)
