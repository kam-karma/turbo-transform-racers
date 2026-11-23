/**
 * "Robot Süpürge" boss race (spec §9.2, §9.4): the giant robot vacuum chases the player from
 * the kid's room into the kitchen. No ghosts. Three gates need the right part — each one is
 * announced by a pickup row offering it — and three checkpoints sit before them.
 */
import { kurguTrack } from '../sim/kurguTrack'

export const DEVEV_BOSS = kurguTrack('devevboss', 'Robot Süpürge', [
  // Kid's room (right-first)
  { len: 160, surface: 'road', zone: 'cocuk', coins: { n: 6, d: 0 } },
  { len: 110, surface: 'road', turn: -90, row: 'magnet|drill|bumper', rowAt: 45 },
  { len: 80, surface: 'road', coins: { n: 3, d: 0 } },
  { len: 220, surface: 'road', turn: 180, coins: { n: 8, d: 3 }, obs: [[150, 3.5, 'block']] },
  { len: 120, surface: 'road', obs: [[60, -3.5, 'block']] },
  { len: 90, surface: 'road', wall: true },
  { len: 90, surface: 'road', coins: { n: 4, d: 0 } },
  { len: 110, surface: 'road', turn: -90, pitchTo: 9, row: 'rocket|wing|float', rowAt: 18, under: 'books' },
  { len: 110, surface: 'road', turn: -90, pitchTo: 0, under: 'books' },
  { len: 140, surface: 'road', under: 'bed', coins: { n: 6, d: 0 }, hidden: { at: 70, d: 5.5, part: 'rocket' } },
  { len: 60, surface: 'road', pitchTo: 6, ramp: true, under: 'bed' },
  { len: 70, surface: 'gap', pitchTo: -2, coins: { n: 3, d: 0 } },
  { len: 30, surface: 'road', pitchTo: 0, under: 'desk' },
  { len: 110, surface: 'road', turn: 90, pitchTo: -11, under: 'books' },
  { len: 110, surface: 'road', turn: 90, pitchTo: 0, coins: { n: 4, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: -90 },
  // Kitchen (left-first)
  { len: 60, surface: 'road', zone: 'mutfak', row: 'bigwheel|treads|magnet', rowAt: 30 },
  { len: 110, surface: 'road', turn: 90, coins: { n: 4, d: 0 } },
  { len: 80, surface: 'road', obs: [[40, -3, 'can']] },
  { len: 220, surface: 'road', turn: -180, coins: { n: 8, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 60, surface: 'climb', pitchTo: 32, width: 12 },
  { len: 60, surface: 'road', pitchTo: 0, under: 'counter' },
  { len: 100, surface: 'road', under: 'counter', coins: { n: 4, d: 0 } },
  { len: 220, surface: 'road', turn: 180, pitchTo: -9, under: 'books' },
  { len: 160, surface: 'road', pitchTo: 0, coins: { n: 6, d: 0 } },
  { len: 140, surface: 'road', obs: [[50, 3, 'can'], [100, -3, 'can']] },
  { len: 220, surface: 'road', turn: -180, coins: { n: 8, d: 0 } },
  { len: 80, surface: 'road' },
  { len: 110, surface: 'road', turn: 90 },
  { len: 200, surface: 'road', coins: { n: 8, d: 0 } },
], { kind: 'gates' })

/** Checkpoints a caught player goes back to: a little before each gate's pickup row. */
export const BOSS_CHECKPOINTS: readonly number[] = DEVEV_BOSS.gates.map((g) => Math.max(30, g.s0 - 160))
