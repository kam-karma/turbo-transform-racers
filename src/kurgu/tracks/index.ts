/**
 * The Kurgu Kupası tracks (Dev Ev world). Each room of a track is a serpentine of lanes
 * along x that moves the race along +z, so the generated house (sim/layout.ts) can wall
 * the rooms off one after another; elevations follow the furniture the road lies on.
 */
import type { TrackDef } from '../../sim/track'
import { mirrorKurgu, type KurguTrackDef } from '../sim/kurguTrack'
import { DEVEV_1 } from './devev1'
import { DEVEV_2 } from './devev2'
import { DEVEV_3 } from './devev3'
import { DEVEV_4 } from './devev4'
import { DEVEV_5 } from './devev5'
import { DEVEV_6 } from './devev6'
import { DEVEV_BOSS, BOSS_CHECKPOINTS } from './devevBoss'

export const KURGU_BOSS_TRACK = 'devevboss'

export const KURGU_DEFS: Readonly<Record<string, KurguTrackDef>> = {
  devev1: DEVEV_1, devev2: DEVEV_2, devev3: DEVEV_3, devev4: DEVEV_4, devev5: DEVEV_5, devev6: DEVEV_6, devevboss: DEVEV_BOSS,
}

/** Contract export: every Kurgu track as a plain TrackDef (they carry the Kurgu extras too). */
export const KURGU_TRACKS: Readonly<Record<string, TrackDef>> = KURGU_DEFS

export { BOSS_CHECKPOINTS }

/**
 * The layout a race is driven on. 'mirror' flips it; 'reverse' would turn climbs into
 * drops and ramps backwards, so it is also driven mirrored (and 'night' lights it).
 */
export function kurguDefFor(trackId: string, variant: string, boss: boolean): KurguTrackDef {
  const def = KURGU_DEFS[trackId] ?? (boss ? DEVEV_BOSS : DEVEV_1)
  return variant === 'mirror' || variant === 'reverse' ? mirrorKurgu(def) : def
}
