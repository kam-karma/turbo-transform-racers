/**
 * Dev Ev 5 "Garaj Rallisi": from the garden path into the garage — a cardboard-box wall, up
 * the toolbox, a glide between the shelves, a spilled paint pool and a bolt-strewn floor.
 * Star challenge: smash four obstacles.
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_5 = kurguTrack('devev5', 'Garaj Rallisi', [
  // Garden path (right-first)
  { len: 160, surface: 'road', zone: 'bahce', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: -90, row: 'bigwheel|drill|bumper', rowAt: 45 },
  { len: 80, surface: 'road', obs: [[50, 0, 'pebble']] },
  { len: 220, surface: 'road', turn: 180, coins: { n: 8, d: 3 } },
  { len: 300, surface: 'road', obs: [[70, 3, 'pebble'], [150, -3, 'pebble'], [230, 3, 'pebble']], coins: { n: 8, d: 0 } },
  { len: 220, surface: 'road', turn: -180 },
  { len: 300, surface: 'road', row: 'drill|wing|magnet', rowAt: 120, coins: { n: 8, d: -3 } },
  { len: 220, surface: 'road', turn: 180 },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: -90 },
  // Garage (left-first)
  { len: 60, surface: 'road', zone: 'garaj' },
  { len: 90, surface: 'road', wall: true },
  { len: 110, surface: 'road', turn: 90, coins: { n: 4, d: 0 } },
  { len: 80, surface: 'road', row: 'treads|float|rocket', rowAt: 40 },
  { len: 220, surface: 'road', turn: -180, obs: [[110, 0, 'bolt']] },
  { len: 90, surface: 'road', obs: [[40, 3, 'bolt']] },
  { len: 60, surface: 'climb', pitchTo: 32, width: 12 },
  { len: 60, surface: 'road', pitchTo: 0, under: 'toolbox', row: 'wing|rocket|magnet', rowAt: 30 },
  { len: 30, surface: 'road', pitchTo: 4, ramp: true, under: 'toolbox' },
  { len: 60, surface: 'gap', pitchTo: -2, coins: { n: 3, d: 0 } },
  { len: 220, surface: 'road', turn: 180, pitchTo: -8, under: 'shelf', row: 'float|propeller|bigwheel', rowAt: 160 },
  { len: 200, surface: 'road', pitchTo: 0, hidden: { at: 120, d: 5.5, part: 'drill' } },
  { len: 140, surface: 'water', width: 16, coins: { n: 5, d: 0 } },
  { len: 40, surface: 'road' },
  { len: 220, surface: 'road', turn: -180, obs: [[60, 3, 'can'], [140, -3, 'can']] },
  { len: 80, surface: 'road', obs: [[40, 0, 'bolt']] },
  { len: 110, surface: 'road', turn: 90 },
  { len: 200, surface: 'road', coins: { n: 8, d: 0 } },
], { kind: 'smash', n: 4 })
