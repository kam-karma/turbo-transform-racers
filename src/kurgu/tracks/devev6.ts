/**
 * Dev Ev 6 "Büyük Ev Turu": the whole house in one race, a short serpentine through each of
 * the five rooms — kid's room, kitchen, bathroom, garden, garage. Star challenge: a combo.
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_6 = kurguTrack('devev6', 'Büyük Ev Turu', [
  // Kid's room (right-first, x +140)
  { len: 120, surface: 'road', zone: 'cocuk', coins: { n: 5, d: 0 } },
  { len: 110, surface: 'road', turn: -90, row: 'drill|wing|bumper', rowAt: 45 },
  { len: 60, surface: 'road', coins: { n: 3, d: 0 } },
  { len: 220, surface: 'road', turn: 180, coins: { n: 8, d: 3 }, obs: [[150, -3, 'block']] },
  { len: 60, surface: 'road' },
  { len: 90, surface: 'road', wall: true },
  { len: 50, surface: 'road', row: 'treads|rocket|magnet', rowAt: 30 },
  { len: 110, surface: 'road', turn: -90 },
  // Kitchen (left-first)
  { len: 60, surface: 'road', zone: 'mutfak' },
  { len: 110, surface: 'road', turn: 90, coins: { n: 4, d: 0 } },
  { len: 60, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 50, surface: 'road', pitchTo: 0, under: 'counter' },
  { len: 220, surface: 'road', turn: -180, under: 'counter', row: 'wing|float|bigwheel', rowAt: 120 },
  { len: 140, surface: 'road', under: 'counter', coins: { n: 5, d: 0 } },
  { len: 60, surface: 'road', pitchTo: 5, ramp: true, under: 'counter' },
  { len: 110, surface: 'gap', turn: 90, pitchTo: -6, coins: { n: 4, d: 0 } },
  // Bathroom (right-first)
  { len: 60, surface: 'road', zone: 'banyo', pitchTo: -8, under: 'books' },
  { len: 110, surface: 'road', turn: -90, pitchTo: 0, row: 'float|propeller|magnet', rowAt: 60 },
  { len: 60, surface: 'road', under: 'tub' },
  { len: 220, surface: 'road', turn: 180, under: 'tub', obs: [[160, 0, 'duck']] },
  { len: 40, surface: 'road', under: 'tub' },
  { len: 160, surface: 'water', width: 16, under: 'tub', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: -90, pitchTo: -9 },
  // Garden (left-first)
  { len: 60, surface: 'road', zone: 'bahce', pitchTo: 0, hidden: { at: 30, d: 5.5, part: 'treads' } },
  { len: 110, surface: 'road', turn: 90, row: 'drill|bigwheel|wing', rowAt: 50, coins: { n: 4, d: 0 } },
  { len: 60, surface: 'road', obs: [[30, 3, 'pebble']] },
  { len: 220, surface: 'road', turn: -180, coins: { n: 8, d: -3 } },
  { len: 60, surface: 'road', obs: [[30, -3, 'pebble']] },
  { len: 90, surface: 'road', wall: true },
  { len: 50, surface: 'road', row: 'treads|float|rocket', rowAt: 25 },
  { len: 110, surface: 'road', turn: 90 },
  // Garage (right-first)
  { len: 60, surface: 'road', zone: 'garaj' },
  { len: 110, surface: 'road', turn: -90, coins: { n: 4, d: 0 } },
  { len: 60, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 50, surface: 'road', pitchTo: 0, under: 'toolbox' },
  { len: 220, surface: 'road', turn: 180, under: 'toolbox', coins: { n: 6, d: 0 } },
  { len: 200, surface: 'road', pitchTo: -9, under: 'shelf', obs: [[150, 3, 'bolt']] },
  { len: 110, surface: 'road', turn: -90, pitchTo: 0 },
  { len: 100, surface: 'road', pitchTo: -3, coins: { n: 4, d: 0 } },
  { len: 100, surface: 'road', pitchTo: 0, coins: { n: 4, d: 0 } },
], { kind: 'combo' })
