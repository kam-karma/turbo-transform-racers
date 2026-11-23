/**
 * The contract every cup mode (Dönüşüm, Kurgu, Kaos) implements, so the app shell can run any
 * race the same way: build → countdown → frame → outcome → dispose.
 */
import type * as THREE from 'three'
import type { QualityProfile } from '../game/quality'
import type { RaceAudio } from '../game/audio'
import type { FormId } from '../sim/forms'
import type { RaceInput, RacerParams } from '../sim/racer'
import type { RaceHud } from '../ui/raceHud'
import type { Settings } from '../ui/settings'

export type WorldId = 'adalar' | 'dev-ev' | 'neon'
export type Variant = 'normal' | 'reverse' | 'night' | 'mirror'

export interface RaceSpec {
  readonly raceId: string
  readonly cupId: string
  readonly trackId: string
  readonly variant: Variant
  readonly boss: boolean
  readonly world: WorldId
  /** The player's very first race ever: hints on, slower rivals (spec §6). */
  readonly firstRace: boolean
}

export interface PlayerCar {
  readonly model: THREE.Object3D | null
  readonly carId: string
  /** Applies the car's paint and parts to a freshly built car view (garage look). */
  readonly applyLook?: (root: THREE.Object3D) => void
  readonly params: RacerParams
  /** The garage trail mod: pass to fx.setTrail() (null = none). */
  readonly trail?: import('../game/fxModTrail').TrailMod | null
}

export interface RaceContext {
  readonly renderer: THREE.WebGLRenderer
  readonly camera: THREE.PerspectiveCamera
  readonly quality: QualityProfile
  readonly hud: RaceHud
  readonly input: { read(dt: number): RaceInput; pressForm?(f: FormId): void }
  readonly audio: RaceAudio
  readonly playerCar: PlayerCar
  readonly settings: () => Settings
  /** Rewarded video from inside a race (Kaos "kaldığın yerden devam"); pauses the race around the ad. */
  readonly rewarded?: (reason: import('../platform/ads').RewardReason) => Promise<boolean>
  /** Perks bought on the intro card, read at GO (rocket start = rewarded video). */
  readonly perks?: () => { readonly rocketStart: boolean }
  /** Ghost/rival models by car id (lod models), or null for a procedural car. */
  readonly modelFor: (car: string) => THREE.Object3D | null
}

export interface ResultRow {
  readonly name: string
  readonly badge: string
  readonly time: number | null
  readonly you: boolean
  readonly pilot: boolean
}

export interface RaceOutcome {
  readonly place: number
  readonly of: number
  readonly time: number
  readonly coins: number
  readonly stars: readonly [boolean, boolean, boolean]
  readonly starLabels: readonly [string, string, string]
  readonly bossBeaten?: boolean
  readonly extra?: Readonly<Record<string, number>>
  readonly rows: readonly ResultRow[]
}

export interface RaceMode {
  /** The mode builds and owns its scene (world, cars, effects). */
  readonly scene: THREE.Scene
  start(): void
  frame(realDt: number): void
  readonly finished: boolean
  outcome(): RaceOutcome | null
  restart(): void
  /** Optional: the three star goals of this race, shown on the intro card before start(). */
  readonly goals?: readonly [string, string, string]
  /** Optional: the race is paused (menu, ad, hidden tab) or resumed — silence loops and sfx. */
  pause?(on: boolean): void
  dispose(): void
}

/** A rear-view inset a mode can ask for (boss chases): the app draws it over the frame. */
export interface RearView {
  readonly camera: THREE.PerspectiveCamera
  /** 0 = hidden … 1 = fully shown. */
  readonly amount: number
}

/** Optional dev-only view of a mode's player (browser tests: autopilot, teleport). */
export interface ModeDev {
  readonly track: import('../sim/track').Track
  readonly state: import('../sim/racer').RacerState
  teleport(s: number): void
}

export type RaceModeFactory = (ctx: RaceContext, spec: RaceSpec) => Promise<RaceMode>
