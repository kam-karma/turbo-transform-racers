/**
 * Dev Ev 1 "Oyuncak Odası": the kid's bedroom (a toy-block wall, up a book ramp onto the bed,
 * a glide to the desk) and the playroom (a climb up the toy box, the long shelf run).
 * Teaches the three first gates: toy wall (matkap), gap (kanat), climb (palet).
 * Each room is a four-lane serpentine (see README in index.ts).
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_1 = kurguTrack('devev1', 'Oyuncak Odası', [
  // Bedroom
  { len: 160, surface: 'road', zone: 'cocuk', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: -90, row: 'drill|bumper|magnet', rowAt: 45 },
  { len: 80, surface: 'road', coins: { n: 3, d: -3 } },
  { len: 220, surface: 'road', turn: 180, coins: { n: 8, d: 3 } },
  { len: 100, surface: 'road', obs: [[60, 3.5, 'block']] },
  { len: 90, surface: 'road', wall: true },
  { len: 110, surface: 'road', coins: { n: 5, d: 0 }, obs: [[70, -3.5, 'block']] },
  { len: 110, surface: 'road', turn: -90, pitchTo: 9, row: 'wing|rocket|bigwheel', rowAt: 18, under: 'books' },
  { len: 110, surface: 'road', turn: -90, pitchTo: 0, under: 'books' },
  { len: 140, surface: 'road', under: 'bed', coins: { n: 6, d: 0 } },
  { len: 60, surface: 'road', pitchTo: 6, ramp: true, under: 'bed' },
  { len: 60, surface: 'gap', pitchTo: -2, coins: { n: 3, d: 0 } },
  { len: 40, surface: 'road', pitchTo: 0, under: 'desk' },
  { len: 110, surface: 'road', turn: 90, pitchTo: -11, under: 'books' },
  { len: 110, surface: 'road', turn: 90, pitchTo: 0, coins: { n: 4, d: -2 } },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: -90 },
  // Playroom
  { len: 60, surface: 'road', zone: 'cocuk', row: 'treads|float|bigwheel', rowAt: 30 },
  { len: 110, surface: 'road', turn: 90, coins: { n: 4, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 220, surface: 'road', turn: -180, coins: { n: 8, d: -3 }, obs: [[120, 0, 'ball']] },
  { len: 120, surface: 'road', obs: [[50, 3, 'domino'], [90, -3, 'domino']] },
  { len: 60, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 50, surface: 'road', pitchTo: 0, under: 'box' },
  { len: 80, surface: 'road', under: 'shelf' },
  { len: 110, surface: 'road', turn: 90, pitchTo: -8 },
  { len: 110, surface: 'road', turn: 90, pitchTo: 0, coins: { n: 4, d: 2 } },
  { len: 150, surface: 'road', hidden: { at: 80, d: -5.5, part: 'rocket' }, coins: { n: 5, d: 0 } },
  { len: 150, surface: 'road', obs: [[40, -3, 'ball'], [100, 3, 'block']] },
  { len: 110, surface: 'road', turn: -90, pitchTo: -7, coins: { n: 4, d: 0 } },
  { len: 110, surface: 'road', turn: -90, pitchTo: 0, coins: { n: 4, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: 90 },
  { len: 200, surface: 'road', coins: { n: 8, d: 0 } },
], { kind: 'combo' })
