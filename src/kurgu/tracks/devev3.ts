/**
 * Dev Ev 3 "Köpük Banyosu": from the kitchen tiles into the bathroom — a soap-box wall, up
 * the vanity, a glide over the washbasin, a long float through the bubble bath and a tile
 * run of rubber ducks. Star challenge: lose no part.
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_3 = kurguTrack('devev3', 'Köpük Banyosu', [
  // Kitchen (right-first)
  { len: 160, surface: 'road', zone: 'mutfak', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: -90, row: 'bumper|drill|bigwheel', rowAt: 45 },
  { len: 80, surface: 'road', obs: [[40, 0, 'can']] },
  { len: 220, surface: 'road', turn: 180, coins: { n: 8, d: 3 } },
  { len: 300, surface: 'road', obs: [[80, -3, 'can'], [150, 3, 'can'], [220, -3, 'can']], coins: { n: 8, d: 0 } },
  { len: 220, surface: 'road', turn: -180, row: 'float|wing|treads', rowAt: 150 },
  { len: 300, surface: 'road', coins: { n: 8, d: 3 } },
  { len: 220, surface: 'road', turn: 180 },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: -90 },
  // Bathroom (left-first)
  { len: 60, surface: 'road', zone: 'banyo' },
  { len: 110, surface: 'road', turn: 90, row: 'drill|magnet|bumper', rowAt: 40, coins: { n: 4, d: 0 } },
  { len: 90, surface: 'road', wall: true },
  { len: 220, surface: 'road', turn: -180, row: 'treads|wing|float', rowAt: 120, obs: [[60, 3, 'soap']] },
  { len: 90, surface: 'road', obs: [[40, -3, 'duck']] },
  { len: 60, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 60, surface: 'road', pitchTo: 0, under: 'counter' },
  { len: 30, surface: 'road', pitchTo: 4, ramp: true, under: 'counter' },
  { len: 60, surface: 'gap', pitchTo: -2, coins: { n: 3, d: 0 } },
  { len: 220, surface: 'road', turn: 180, pitchTo: -6, row: 'float|propeller|magnet', rowAt: 150, under: 'books' },
  { len: 120, surface: 'road', pitchTo: 0, under: 'tub', hidden: { at: 60, d: -5.5, part: 'float' } },
  { len: 180, surface: 'water', under: 'tub', width: 16, coins: { n: 6, d: 0 } },
  { len: 220, surface: 'road', turn: -180, pitchTo: -4, coins: { n: 6, d: 0 } },
  { len: 80, surface: 'road', pitchTo: 0, obs: [[30, 3, 'duck'], [60, -3, 'soap']] },
  { len: 110, surface: 'road', turn: 90 },
  { len: 200, surface: 'road', coins: { n: 8, d: 0 } },
], { kind: 'noKnock' })
