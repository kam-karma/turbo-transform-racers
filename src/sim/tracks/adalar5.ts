/**
 * Uçan Adalar 5 ("Gökkuşağı Köprüsü"): the fast flying track. Three jumps of rising length,
 * the last a long curving glide, with quick water and ice links and a volcano step between.
 */
import { pathTrack, type Piece } from '../trackPath'

export const ADALAR_5_PIECES: readonly Piece[] = [
  { len: 220, surface: 'road', theme: 'candy', coins: { n: 8, d: 0 } },
  { len: 110, surface: 'road', pitchTo: 8, ramp: true, boost: true },
  { len: 60, surface: 'gap', pitchTo: -6, coins: { n: 3, d: 0 } },
  { len: 160, surface: 'road', pitchTo: 0, turn: -40, coins: { n: 5, d: -3 } },
  { len: 150, surface: 'road', turn: 45, coins: { n: 5, d: 3 } },
  { len: 180, surface: 'road', turn: 60 },
  { len: 200, surface: 'water', turn: -40, width: 16, theme: 'water', coins: { n: 6, d: 0 } },
  { len: 150, surface: 'road', turn: 30, boost: true },
  { len: 100, surface: 'road', pitchTo: 9, ramp: true },
  { len: 100, surface: 'gap', pitchTo: -9, coins: { n: 5, d: 0 } },
  { len: 160, surface: 'road', pitchTo: 0, turn: -30, theme: 'ice' },
  { len: 200, surface: 'ice', turn: 65, coins: { n: 6, d: 3 } },
  { len: 180, surface: 'ice', turn: -55 },
  { len: 160, surface: 'ice', turn: 50, pitchTo: -3, coins: { n: 5, d: 0 } },
  { len: 140, surface: 'road', turn: 20, pitchTo: 0, theme: 'volcano', coins: { n: 4, d: 0 } },
  { len: 90, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 100, surface: 'road', pitchTo: 0, turn: -15 },
  { len: 100, surface: 'road', pitchTo: 9, ramp: true, boost: true },
  { len: 160, surface: 'gap', pitchTo: -12, turn: -50, theme: 'candy', coins: { n: 9, d: 0 } },
  { len: 170, surface: 'road', pitchTo: -3, turn: 30 },
  { len: 170, surface: 'water', turn: 40, pitchTo: 0, width: 16, theme: 'water', coins: { n: 5, d: 3 } },
  { len: 160, surface: 'road', turn: -50, theme: 'candy', boost: true },
  { len: 270, surface: 'road', coins: { n: 10, d: 0 } },
]

export const ADALAR_5 = pathTrack('adalar5', 'Gökkuşağı Köprüsü', ADALAR_5_PIECES)
