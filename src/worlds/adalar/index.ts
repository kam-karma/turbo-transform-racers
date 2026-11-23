/**
 * The Uçan Adalar world for one track: sky (zone-graded, day or night), the track with its
 * trackside set pieces, floating islands, sky life and the Tripo landmark islands.
 *
 * The returned group carries its own lights. The sky sets the scene's background, fog and
 * environment the first time the group is rendered inside a scene (or call attach(scene)),
 * and follows whichever camera renders it.
 */
import * as THREE from 'three'
import { buildIslands } from '../../game/islands'
import { WORLD_TIME } from '../../game/islandsMaterial'
import type { QualityProfile } from '../../game/quality'
import { buildSky, type SkyView } from '../../game/sky'
import { buildLife } from '../../game/skyLife'
import { buildTrackMesh, type TrackView } from '../../game/trackMesh'
import { ADALAR_PROPS, buildTripoProps } from '../../game/tripoProps'
import { START_GATE_S } from '../../sim/landmarksTrackside'
import type { Track } from '../../sim/track'
import { isNight, type TrackVariant } from '../../sim/tracks/variants'

export interface WorldView {
  readonly group: THREE.Group
  update(t: number, playerS: number, speed: number): void
  collectCoin(i: number): void
  resetCoins(): void
  dispose(): void
}

export interface AdalarWorld extends WorldView {
  readonly sky: SkyView
  readonly trackView: TrackView
  /** Where the start and finish gates stand (s), e.g. for confetti bursts. */
  readonly gates: { readonly start: number; readonly finish: number }
  /** Sets the scene background, fog and environment now instead of at first render. */
  attach(scene: THREE.Scene): void
}

/** Zone colour grading: how quickly the sky settles into a new zone's palette (1/s). */
const GRADE_RATE = 0.9
/** Grade towards the zone this far ahead, so the mood changes as the zone comes into view. */
const GRADE_AHEAD = 60
/** Island chunks farther than this from the player are skipped (deep in the haze by then). */
const ISLAND_VIEW = 1800
const ISLAND_VIEW_LOW = 700

function seedOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) % 100000
}

export async function buildAdalarWorld(track: Track, q: QualityProfile, variant: TrackVariant = 'normal'): Promise<AdalarWorld> {
  const night = isNight(variant)
  const group = new THREE.Group()
  group.name = `adalar-${track.def.id}`
  const sky = buildSky(null, q, { night, theme: track.themeAt(0), autoFollow: true })
  const trackView = buildTrackMesh(track, q, { night })
  // Seed 7 keeps adalar1's islands as they were tuned in A0; other tracks get their own.
  const islands = buildIslands(track, q, track.def.id === 'adalar1' ? 7 : seedOf(track.def.id))
  const life = buildLife(track, sky.light, { decor: q.decor, partyBalloons: trackView.side.balloons, butterflies: trackView.side.butterflies, night })
  group.add(sky.group, trackView.group, islands, life.group)
  const props = await buildTripoProps(track, ADALAR_PROPS, q.decor)
  group.add(props)

  const islandChunks = islands.children
    .filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && /^island/.test(o.name))
    .map((m) => ({ m, sphere: m.geometry.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), Infinity) }))
  const islandView = q.decor < 1 ? ISLAND_VIEW_LOW : ISLAND_VIEW
  const at = new THREE.Vector3()
  let lastT: number | null = null
  return {
    group,
    sky,
    trackView,
    gates: { start: START_GATE_S, finish: track.length - 4 },
    attach: (scene) => sky.attach(scene),
    update(t, playerS, speed) {
      const dt = lastT === null ? Infinity : Math.max(0, t - lastT)
      lastT = t
      WORLD_TIME.value = t
      trackView.update(t, playerS, speed)
      const p = track.frameAt(playerS).pos
      at.set(p.x, p.y, p.z)
      for (const c of islandChunks) c.m.visible = c.sphere.center.distanceTo(at) - c.sphere.radius < islandView
      const k = dt === Infinity ? 1 : 1 - Math.exp(-dt * GRADE_RATE)
      sky.grade(track.themeAt(Math.min(track.length, playerS + GRADE_AHEAD)), k)
    },
    collectCoin: (i) => trackView.collectCoin(i),
    resetCoins: () => trackView.resetCoins(),
    dispose() {
      trackView.dispose()
      sky.dispose()
      life.dispose()
      for (const root of [islands, props]) {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose()
            const m = o.material as THREE.Material | THREE.Material[]
            for (const x of Array.isArray(m) ? m : [m]) {
              // material.dispose() keeps its textures: free them too (Tripo islands carry 1k maps).
              for (const v of Object.values(x)) if (v instanceof THREE.Texture) v.dispose()
              x.dispose()
            }
            if (o instanceof THREE.InstancedMesh) o.dispose()
          }
        })
      }
      group.removeFromParent()
    },
  }
}

export { buildWhaleBoss, type WhaleBossView } from './whaleBoss'
