/**
 * Dev Ev 4 "Bahçe Turu": out through the back door into the garden — round the flower pots,
 * a twig fence, the pond, a climb up a giant pot, a glide across the flower bed.
 * Star challenge: 60 coins.
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_4 = kurguTrack('devev4', 'Bahçe Turu', [
  // Patio (left-first)
  { len: 160, surface: 'road', zone: 'bahce', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: 90, row: 'drill|magnet|bumper', rowAt: 45, coins: { n: 4, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 220, surface: 'road', turn: -180, coins: { n: 8, d: 3 } },
  { len: 120, surface: 'road', obs: [[50, 0, 'pebble'], [90, -3.5, 'pebble']] },
  { len: 90, surface: 'road', wall: true },
  { len: 90, surface: 'road', coins: { n: 4, d: 0 } },
  { len: 220, surface: 'road', turn: 180, row: 'float|propeller|bigwheel', rowAt: 150, coins: { n: 6, d: -3 } },
  { len: 60, surface: 'road' },
  { len: 160, surface: 'water', width: 16, coins: { n: 6, d: 3 } },
  { len: 80, surface: 'road', coins: { n: 3, d: 0 } },
  { len: 220, surface: 'road', turn: -180 },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: 90 },
  // Flower garden (right-first)
  { len: 60, surface: 'road', zone: 'bahce', row: 'treads|wing|rocket', rowAt: 30 },
  { len: 110, surface: 'road', turn: -90, coins: { n: 4, d: 0 } },
  { len: 60, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 50, surface: 'road', pitchTo: 0, under: 'pot' },
  { len: 220, surface: 'road', turn: 180, under: 'bench', coins: { n: 8, d: 0 }, hidden: { at: 110, d: 5.5, part: 'magnet' } },
  { len: 60, surface: 'road', pitchTo: 5, ramp: true, under: 'bench' },
  { len: 70, surface: 'gap', pitchTo: -3, coins: { n: 3, d: 0 } },
  { len: 170, surface: 'road', pitchTo: -8, row: 'wing|magnet|bigwheel', rowAt: 120, under: 'pot' },
  { len: 220, surface: 'road', turn: -180, pitchTo: 0, coins: { n: 8, d: 3 } },
  { len: 300, surface: 'road', obs: [[60, 3, 'pebble'], [140, -3, 'pebble'], [220, 0, 'pebble']], coins: { n: 10, d: 0 } },
  { len: 220, surface: 'road', turn: 180, coins: { n: 6, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: -90 },
  { len: 200, surface: 'road', coins: { n: 8, d: 0 } },
], { kind: 'coins', n: 60 })
