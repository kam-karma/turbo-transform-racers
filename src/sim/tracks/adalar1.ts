/**
 * Uçan Adalar 1 ("Şeker Kanalı"): the A0 feel-prototype track. Candy island start, a water
 * channel, a jump over a gap, the ice island, a volcano wall to climb, a waterfall run and a
 * second, longer gap before the finish straight.
 */
import { pathTrack, type Piece } from '../trackPath'

export const ADALAR_1_PIECES: readonly Piece[] = [
  { len: 220, surface: 'road', theme: 'candy', coins: { n: 8, d: 0 } },
  { len: 160, surface: 'road', turn: 40, boost: true, coins: { n: 5, d: 3 } },
  { len: 140, surface: 'road', turn: -50 },
  { len: 220, surface: 'water', turn: 30, pitchTo: -3, width: 16, theme: 'water', coins: { n: 6, d: -3 } },
  { len: 160, surface: 'road', turn: -40, pitchTo: 0, theme: 'candy' },
  { len: 120, surface: 'road', turn: 60, coins: { n: 6, d: 3 } },
  { len: 100, surface: 'road', pitchTo: 9, ramp: true },
  { len: 70, surface: 'gap', pitchTo: -6, coins: { n: 4, d: 0 } },
  { len: 140, surface: 'road', pitchTo: 0, turn: -30, boost: true },
  { len: 240, surface: 'ice', turn: 70, theme: 'ice', coins: { n: 8, d: 0 } },
  { len: 160, surface: 'ice', turn: -60, coins: { n: 4, d: -4 } },
  { len: 120, surface: 'road', turn: 20, theme: 'volcano' },
  { len: 90, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 120, surface: 'road', pitchTo: 0, coins: { n: 4, d: 0 } },
  { len: 200, surface: 'road', turn: -80, boost: true, coins: { n: 8, d: -3 } },
  { len: 180, surface: 'road', turn: 50, coins: { n: 6, d: 3 } },
  { len: 200, surface: 'water', pitchTo: -4, width: 16, theme: 'water', coins: { n: 6, d: 3 } },
  { len: 120, surface: 'road', pitchTo: 0, turn: 40, theme: 'candy' },
  { len: 100, surface: 'road', pitchTo: 8, ramp: true },
  { len: 90, surface: 'gap', pitchTo: -8, coins: { n: 5, d: 0 } },
  { len: 160, surface: 'road', pitchTo: 0, turn: -20, boost: true },
  { len: 220, surface: 'ice', turn: 70, theme: 'ice', coins: { n: 6, d: 0 } },
  { len: 160, surface: 'road', turn: -40, theme: 'candy' },
  { len: 220, surface: 'road', coins: { n: 10, d: 0 } },
]

export const ADALAR_1 = pathTrack('adalar1', 'Şeker Kanalı', ADALAR_1_PIECES)
