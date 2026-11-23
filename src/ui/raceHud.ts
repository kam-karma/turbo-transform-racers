/**
 * The in-race HUD API every cup mode calls (contract: docs/plans/B-tam-oyun-sozlesmesi.md).
 * The UI team implements it (createRaceHud); modes only depend on this interface.
 */
import type { FormId } from '../sim/forms'

export type HudWorld = 'adalar' | 'dev-ev' | 'neon'

export interface RaceHudView {
  readonly place: number
  readonly of: number
  readonly time: number
  readonly kmh: number
  readonly coins: number
  /** 0..1 along the track (or the whole race for lapped circuits). */
  readonly progress: number
  readonly rivals: readonly { readonly id: string; readonly progress: number; readonly color: string }[]
  readonly lap?: { readonly n: number; readonly of: number }
  readonly combo?: number
}

export interface FormButtons {
  readonly el: HTMLElement
  setActive(f: FormId): void
  hint(f: FormId | null): void
}

export interface HudMeter {
  readonly el: HTMLElement
  set(v01: number): void
}

export interface RaceHud {
  show(world: HudWorld): void
  hide(): void
  /** 3, 2, 1; 0 = GO */
  countdown(n: number): void
  update(v: RaceHudView): void
  pop(text: string, kind: 'perfect' | 'combo' | 'bad' | 'soft' | 'gold'): void
  flash(color: string): void
  /** Mode-specific controls under the HUD (form buttons, part slots, shock meter). */
  setModePanel(el: HTMLElement | null): void
  formButtons(onForm: (f: FormId) => void): FormButtons
  meter(label: string, color: string): HudMeter
}

export { createRaceHud, type RaceHudExt } from './hudRace'
