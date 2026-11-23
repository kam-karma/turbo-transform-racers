/** Dev builds only: the normal input, plus an optional autopilot that drives instead. */
import type { RaceInput } from '../sim/racer'
import { Input } from '../ui/input'

export class DevInput extends Input {
  autopilot: ((dt: number) => RaceInput) | null = null

  override read(dt: number): RaceInput {
    const base = super.read(dt)
    if (this.autopilot === null || !this.enabled) return base
    return this.autopilot(dt)
  }
}
