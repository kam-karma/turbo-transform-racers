/**
 * Builds the race for a cup: Dönüşüm (transform) here, Kurgu (build) and Kaos (chaos) from
 * their teams' folders, each loaded on demand so the first race does not wait for the others.
 * The app hands a RaceKit; modes get the RaceContext of the contract (types.ts).
 */
import type * as THREE from 'three'
import type { RaceKit } from '../app/appTypes'
import type { RaceAudio } from '../game/audio'
import type { TrailMod } from '../game/fxModTrail'
import type { QualityProfile } from '../game/quality'
import { cupById, type CupMode } from '../meta/cups'
import { CAR_LENGTH, cloneModel, raceSized, rivalModel, warmRivals } from './assets'
import { paramsFromStats } from './params'
import type { RaceContext, RaceMode, RaceModeFactory, RaceSpec, RearView } from './types'

export interface RaceEnv {
  readonly renderer: THREE.WebGLRenderer
  /** Bloom tuned for night (night variants, the neon city). */
  readonly setNight: (night: number) => void
  /** Kurgu parts kept with a video for this race (taken once: the save is cleared). */
  readonly takeKurguParts?: () => readonly string[]
  readonly quality: () => QualityProfile
  readonly audio: RaceAudio
}

async function factoryFor(mode: CupMode, rocketStart: () => boolean): Promise<RaceModeFactory> {
  if (mode === 'build') return (await import('../kurgu/mode')).createKurguMode
  if (mode === 'chaos') return (await import('../kaos/mode')).createKaosMode
  const { createTransformMode } = await import('./transform')
  return (ctx, spec) => createTransformMode(ctx, spec, rocketStart)
}

/** The player's car model at race size: the car's own GLB, else the hero car. */
export async function playerModel(url: string): Promise<THREE.Object3D | null> {
  const own = await cloneModel(url, true)
  if (own !== null) return raceSized(own, CAR_LENGTH)
  return raceSized(await cloneModel('./models/hero.glb', true), CAR_LENGTH)
}

/** Live car-look handles of one race (animated paints, neon): updated with the race, freed with it. */
interface LookHandle {
  update(t: number): void
  dispose(): void
}

/** Told when the current race pauses / resumes (main.ts: FPS guard). */
let onPause: ((on: boolean) => void) | null = null
export const setPauseListener = (fn: ((on: boolean) => void) | null): void => {
  onPause = fn
}

let current: (RaceMode & { readonly rear: RearView | null }) | null = null

/** The race built last (rear-view inset, dev hooks). */
export const currentRace = (): (RaceMode & { readonly rear: RearView | null }) | null => current

function withLooks(mode: RaceMode, looks: LookHandle[]): RaceMode & { readonly dev: unknown; readonly rear: RearView | null } {
  let t = 0
  const wrapper: RaceMode & { readonly dev: unknown; readonly rear: RearView | null } = {
    get dev() {
      return (mode as { dev?: unknown }).dev
    },
    get rear() {
      return (mode as { rear?: RearView | null }).rear ?? null
    },
    get scene() {
      return mode.scene
    },
    get finished() {
      return mode.finished
    },
    get goals() {
      return mode.goals
    },
    start: () => mode.start(),
    frame: (dt) => {
      t += dt
      for (const l of looks) l.update(t)
      mode.frame(dt)
    },
    outcome: () => mode.outcome(),
    restart: () => mode.restart(),
    pause: (on) => {
      onPause?.(on)
      mode.pause?.(on)
    },
    dispose: () => {
      for (const l of looks) l.dispose()
      looks.length = 0
      if (current === wrapper) current = null
      mode.dispose()
    },
  }
  return wrapper
}

/** The trail mod's fx settings, or null for none / 'trail-none'. */
function trailOf(v: Readonly<Record<string, number | string>> | undefined): TrailMod | null {
  if (v === undefined || typeof v.part !== 'string' || v.part === 'none' || v.part === 'trail-none') return null
  return { part: v.part, color: typeof v.color === 'number' ? v.color : 0xffffff, color2: typeof v.color2 === 'number' ? v.color2 : 0xffffff }
}

export async function createRace(env: RaceEnv, spec: RaceSpec, kit: RaceKit): Promise<RaceMode> {
  const cup = cupById(spec.cupId)
  if (cup === undefined) throw new Error(`Unknown cup ${spec.cupId}`)
  const rocketStart = (): boolean => kit.perks().rocketStart
  const [factory, model] = await Promise.all([factoryFor(cup.mode, rocketStart), playerModel(kit.car.model), warmRivals()])
  const looks: LookHandle[] = []
  const ctx: RaceContext = {
    renderer: env.renderer,
    camera: kit.camera,
    quality: env.quality(),
    hud: kit.hud,
    input: kit.input,
    audio: env.audio,
    playerCar: {
      model,
      carId: kit.car.id,
      applyLook: (root) => {
        looks.push(kit.applyLook(root))
      },
      params: paramsFromStats(kit.stats),
      trail: trailOf(kit.look.mods.trail?.value),
    },
    settings: kit.settings,
    rewarded: kit.rewarded,
    perks: kit.perks,
    modelFor: (car) => rivalModel(car),
  }
  env.setNight(spec.variant === 'night' || spec.world === 'neon' ? 1 : 0)
  kit.hud.setPlayerColor(`hsl(${kit.car.hue} 90% 60%)`)
  // Kurgu starts with the parts the player kept from an earlier race (KurguContext).
  const modeCtx = cup.mode === 'build' ? { ...ctx, kurguStartParts: env.takeKurguParts?.() ?? [] } : ctx
  current = withLooks(await factory(modeCtx, spec), looks)
  return current
}
