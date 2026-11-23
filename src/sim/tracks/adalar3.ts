/**
 * Uçan Adalar 3 ("Lav Tırmanışı"): the volcano track. Two climbing walls with a lava
 * plateau between them, a long curving glide down from the summit to the water, a winding
 * canal, an ice bend with a jump and a candy sprint to the line.
 */
import { pathTrack, type Piece } from '../trackPath'

export const ADALAR_3_PIECES: readonly Piece[] = [
  { len: 220, surface: 'road', theme: 'candy', coins: { n: 8, d: 0 } },
  { len: 170, surface: 'road', turn: -50, boost: true, coins: { n: 5, d: -3 } },
  { len: 160, surface: 'road', turn: 40, coins: { n: 5, d: 3 } },
  { len: 150, surface: 'road', turn: 45, theme: 'volcano' },
  { len: 80, surface: 'climb', pitchTo: 28, width: 12 },
  { len: 140, surface: 'road', pitchTo: 0, turn: -30, coins: { n: 5, d: 0 } },
  { len: 160, surface: 'road', turn: 80, pitchTo: -5, coins: { n: 6, d: 3 } },
  { len: 100, surface: 'climb', pitchTo: 32, width: 12 },
  { len: 120, surface: 'road', pitchTo: 0, turn: -20 },
  { len: 80, surface: 'road', pitchTo: 7, ramp: true },
  { len: 150, surface: 'gap', pitchTo: -14, turn: 35, coins: { n: 8, d: 0 } },
  { len: 160, surface: 'water', pitchTo: -6, width: 16, theme: 'water', coins: { n: 5, d: 0 } },
  { len: 170, surface: 'water', turn: 55, pitchTo: -3, width: 16, coins: { n: 5, d: 3 } },
  { len: 170, surface: 'water', turn: -60, width: 16, coins: { n: 5, d: -3 } },
  { len: 150, surface: 'water', turn: 50, width: 16 },
  { len: 150, surface: 'road', turn: 30, pitchTo: 0, theme: 'ice', boost: true },
  { len: 220, surface: 'ice', turn: -75, coins: { n: 8, d: 0 } },
  { len: 160, surface: 'ice', turn: 50 },
  { len: 100, surface: 'road', pitchTo: 8, ramp: true },
  { len: 80, surface: 'gap', pitchTo: -8, coins: { n: 5, d: 0 } },
  { len: 160, surface: 'road', pitchTo: -4, turn: 35, theme: 'candy', boost: true },
  { len: 200, surface: 'road', pitchTo: 0, turn: -60, coins: { n: 8, d: -3 } },
  { len: 280, surface: 'road', turn: 20, coins: { n: 10, d: 0 } },
]

export const ADALAR_3 = pathTrack('adalar3', 'Lav Tırmanışı', ADALAR_3_PIECES)
