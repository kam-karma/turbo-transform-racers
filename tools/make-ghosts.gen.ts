/**
 * Makes the shipped ghosts: each Kupa Pilotu drives every Uçan Adalar track (and its reverse
 * and mirror variants, which have their own layouts) with three seeds; the median run is kept,
 * so times spread naturally from the best pilot to the beginner. Night keeps the normal layout.
 * Optional filter: GHOST_TRACKS=adalar2,adalar3-reverse npm run ghosts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { it } from 'vitest'
import { runBot } from '../src/sim/bot'
import { encodeGhost } from '../src/sim/ghost'
import { ghostSlot } from '../src/sim/grid'
import { PILOTS } from '../src/sim/pilots'
import { buildTrack, type TrackDef } from '../src/sim/track'
import { adalarTrack, TRACKS } from '../src/sim/tracks/index'

const CARS = ['rt40', 'r245', 'r40']
const only = (process.env.GHOST_TRACKS ?? '').split(',').filter((x) => x !== '')

const DEFS: readonly TrackDef[] = Object.keys(TRACKS).flatMap((id) => (['normal', 'reverse', 'mirror'] as const).map((v) => adalarTrack(id, v)))

it('makes ghosts', () => {
  mkdirSync('public/ghosts', { recursive: true })
  for (const def of DEFS) {
    if (only.length > 0 && !only.includes(def.id)) continue
    const track = buildTrack(def)
    const out = PILOTS.map((pilot, i) => {
      const slot = ghostSlot(i)
      const runs = [11, 22, 33].map((seed) => runBot(track, pilot.skill, seed * (i + 1), undefined, slot.d, slot.s))
      runs.sort((a, b) => a.time - b.time)
      const g = { ...runs[1], id: pilot.id, pilot: pilot.name, car: CARS[i % CARS.length], color: pilot.color }
      return encodeGhost(g)
    })
    const times = out.map((g) => (JSON.parse(g) as { time: number }).time)
    console.log(`${def.id.padEnd(18)} ${Math.min(...times).toFixed(1)}s … ${Math.max(...times).toFixed(1)}s`)
    writeFileSync(`public/ghosts/${def.id}.json`, JSON.stringify(out.map((g) => JSON.parse(g))))
  }
})
