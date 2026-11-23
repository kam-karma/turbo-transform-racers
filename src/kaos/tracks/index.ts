/**
 * Kaos Kupası tracks: neon1 … neon6. KAOS_TRACKS holds the unrolled race (all laps) as a
 * TrackDef for buildTrack; KAOS_CIRCUITS adds the lap length, goals and palette.
 */
import type { TrackDef } from '../../sim/track'
import { buildCircuit, type Circuit } from '../sim/circuit'
import { NEON_CIRCUITS, type KaosCircuitDef } from './circuits'

export interface KaosCircuit extends Circuit, Omit<KaosCircuitDef, 'spec'> {}

export const KAOS_CIRCUITS: Readonly<Record<string, KaosCircuit>> = Object.fromEntries(
  NEON_CIRCUITS.map((c) => [c.spec.id, { ...buildCircuit(c.spec), goals: c.goals, palette: c.palette, seed: c.seed }]),
)

export const KAOS_TRACKS: Record<string, TrackDef> = Object.fromEntries(Object.entries(KAOS_CIRCUITS).map(([id, c]) => [id, c.def]))

export const KAOS_TRACK_IDS: readonly string[] = NEON_CIRCUITS.map((c) => c.spec.id)
