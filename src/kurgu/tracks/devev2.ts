/**
 * Dev Ev 2 "Mutfak Macerası": out of the playroom past a toy-block wall, into the kitchen —
 * up the cupboard to the worktop, through the sink, a glide to the dining table and a
 * cereal-box wall on the way down. Star challenge: every gate with its part.
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_2 = kurguTrack('devev2', 'Mutfak Macerası', [
  // Playroom (left-first serpentine)
  { len: 160, surface: 'road', zone: 'cocuk', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: 90, row: 'bumper|drill|magnet', rowAt: 45 },
  { len: 80, surface: 'road', coins: { n: 3, d: 3 } },
  { len: 220, surface: 'road', turn: -180, coins: { n: 8, d: -3 } },
  { len: 110, surface: 'road', obs: [[50, -3.5, 'block'], [85, 3.5, 'ball']] },
  { len: 90, surface: 'road', wall: true },
  { len: 100, surface: 'road', coins: { n: 4, d: 0 } },
  { len: 220, surface: 'road', turn: 180, coins: { n: 6, d: 0 } },
  { len: 300, surface: 'road', obs: [[40, 0, 'domino'], [100, 3, 'domino'], [140, -3, 'domino']], row: 'treads|bigwheel|wing', rowAt: 230, coins: { n: 8, d: -3 } },
  { len: 220, surface: 'road', turn: -180 },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: 90 },
  // Kitchen (right-first)
  { len: 60, surface: 'road', zone: 'mutfak' },
  { len: 110, surface: 'road', turn: -90, coins: { n: 4, d: 0 } },
  { len: 60, surface: 'climb', pitchTo: 32, width: 12 },
  { len: 60, surface: 'road', pitchTo: 0, under: 'counter' },
  { len: 220, surface: 'road', turn: 180, under: 'counter', row: 'float|propeller|rocket', rowAt: 60, coins: { n: 6, d: 3 } },
  { len: 60, surface: 'road', under: 'counter', hidden: { at: 30, d: 5.5, part: 'propeller' } },
  { len: 90, surface: 'water', under: 'sink', width: 15 },
  { len: 80, surface: 'road', under: 'counter', coins: { n: 3, d: 0 } },
  { len: 70, surface: 'road', pitchTo: 5, ramp: true, under: 'counter' },
  { len: 220, surface: 'road', turn: -180, pitchTo: -3, row: 'wing|drill|magnet', rowAt: 40, coins: { n: 6, d: 0 } },
  { len: 70, surface: 'gap', pitchTo: -4 },
  { len: 90, surface: 'road', pitchTo: 0, under: 'table', coins: { n: 4, d: 0 } },
  { len: 140, surface: 'road', pitchTo: -10, under: 'books' },
  { len: 220, surface: 'road', turn: 180, pitchTo: 0, coins: { n: 6, d: -3 } },
  { len: 90, surface: 'road', wall: true },
  { len: 110, surface: 'road', turn: -90 },
  { len: 200, surface: 'road', coins: { n: 8, d: 0 } },
], { kind: 'gates' })
