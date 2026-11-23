/** Shared types for screens and the context the app gives them. */
import type { CupTier, WorldId } from '../meta/cups'
import type { SaveData } from '../meta/save'
import type { RaceOutcome } from '../modes/types'
import type { Settings } from '../ui/settings'
import type { AppDeps, RewardReason, UiSound } from './appTypes'
import type { CarLookHandle } from './carLook'
import type { Showroom, ShowroomView } from './showroom'

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'cupMap'; readonly world: WorldId; readonly tier?: CupTier }
  | { readonly name: 'garage'; readonly tab?: 'cars' | 'perf' | 'look'; readonly gift?: string }
  | { readonly name: 'race'; readonly raceId: string; readonly trialCar?: string }

export interface Screen {
  readonly el: HTMLElement
  /** Showroom framing while this screen is up (null = no showroom: race / map backdrop). */
  readonly showroom: ShowroomView | null
  frame?(dt: number): void
  /** Esc / back button. Return false to let the app handle it. */
  back?(): boolean
  dispose?(): void
}

export interface Ctx {
  readonly deps: AppDeps
  readonly touch: boolean
  save(): SaveData
  update(fn: (s: SaveData) => SaveData): SaveData
  go(route: Route): void
  toast(text: string, iconName?: string): void
  /** Opens a modal; returns a closer. */
  modal(content: HTMLElement, opts?: { onClose?: () => void; dismissable?: boolean }): () => void
  sound(cue: UiSound): void
  readonly showroom: Showroom
  /** Shows a car (current one by default) on the turntable with its saved look; the handle previews other looks. */
  showCar(carId?: string): Promise<CarLookHandle | null>
  settings(): Settings
  openSettings(): void
  openChest(): void
  openTasks(): void
  now(): number
  /** Rewarded video with app bookkeeping (music/pause handled by adFlow). */
  rewarded(reason: RewardReason): Promise<boolean>
}

export interface ResultsInput {
  readonly raceId: string
  readonly outcome: RaceOutcome
}
