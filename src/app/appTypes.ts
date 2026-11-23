/**
 * What the app shell needs from the integrator (AppDeps) and what it hands to every race
 * (RaceKit). See app.ts for the screen flow.
 */
import type * as THREE from 'three'
import type { CarDef } from '../meta/catalog'
import type { AdFlow, RewardReason } from '../platform/adFlow'
import type { SaveStore } from '../meta/save'
import type { RaceMode, RaceSpec } from '../modes/types'
import type { Input } from '../ui/input'
import type { RaceHudExt } from '../ui/hudRace'
import type { Settings } from '../ui/settings'
import type { CarLook } from './carLook'

/** The Poki ad flow (src/platform/adFlow.ts createAdFlow). */
export type AdFlowLike = AdFlow
export type { RewardReason }

/** UI sound cues; the integrator maps them to its audio engine (all optional). */
export type UiSound = 'click' | 'back' | 'buy' | 'reward' | 'star' | 'coin' | 'whoosh' | 'error' | 'unlock' | 'tick'

export interface AppDeps {
  /** #ui overlay element (pointer-events: none root; the app enables them per element). */
  readonly root: HTMLElement
  /** The game's WebGL renderer (also used for the 3D showroom). */
  readonly renderer: THREE.WebGLRenderer
  /** The race camera, passed to modes through RaceKit; the app renders mode.scene with it. */
  readonly camera: THREE.PerspectiveCamera
  /** Draw a race frame (post-fx/bloom chain). Defaults to renderer.render(scene, camera). */
  readonly render?: (scene: THREE.Scene, camera: THREE.Camera) => void
  readonly save: SaveStore
  readonly ads: AdFlowLike
  readonly input: Input
  /** Coarse-pointer device (phones/tablets): touch layout, rotate overlay. */
  readonly touch: boolean
  /** Builds a race. Called on "YARIŞ"; the app shows the intro card over mode.scene, then start(). */
  readonly createRace: (spec: RaceSpec, kit: RaceKit) => Promise<RaceMode>
  /**
   * A fresh, uniquely owned car model for the showroom (normalised or not — the showroom fits
   * it). Return null when missing; the app then shows the hero model tinted to the car's hue.
   */
  readonly loadCar: (car: CarDef) => Promise<THREE.Object3D | null>
  /** Asset preloading for the loading screen; report 0..1. */
  readonly preload?: (progress: (f: number) => void) => Promise<void>
  /** Settings changed in the menu (already saved): mute audio, change quality, … */
  readonly onSettings?: (s: Settings, prev: Settings) => void
  readonly sound?: (cue: UiSound) => void
  /** Garage horn preview: the horn mod's `value.sound` id. */
  readonly horn?: (soundId: string, pitch: number) => void
  readonly music?: (track: 'menu' | 'race' | null) => void
  /** Initial settings (from ui/settings loadSettings). */
  readonly settings: Settings
  /** Clock (tests); defaults to Date.now. */
  readonly now?: () => number
}

export interface RaceKit {
  readonly hud: RaceHudExt
  readonly input: Input
  readonly camera: THREE.PerspectiveCamera
  readonly settings: () => Settings
  /** The car the player drives this race (a one-race trial car when the player chose one). */
  readonly car: CarDef
  /** Applies the garage look to the race's player car model: `kit.applyLook(model)`. */
  readonly look: CarLook
  readonly applyLook: (model: THREE.Object3D) => { update(t: number): void; dispose(): void }
  /** Performance-adjusted stats 1..10 (+ upgrades) for RacerParams. */
  readonly stats: { readonly speed: number; readonly accel: number; readonly handling: number }
  /** Mode-side rewarded offers (Kaos "kaldığın yerden devam"): pauses the race around the ad. */
  readonly rewarded: (reason: RewardReason) => Promise<boolean>
  /** Read at start(): perks bought on the intro card (rocket start = video §13 #5). */
  readonly perks: () => { readonly rocketStart: boolean }
}
