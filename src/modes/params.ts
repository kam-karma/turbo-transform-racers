/**
 * Garage stats (1..10, upgrades add up to +2) into racer physics. 5/5/5 is the A0-tuned car,
 * so the starter feels exactly like the prototype and every point is a small, honest step.
 */
import { DEFAULT_PARAMS, type RacerParams } from '../sim/racer'

export interface StatLike {
  readonly speed: number
  readonly accel: number
  readonly handling: number
}

const MAX_STAT = 12
const clampStat = (v: number): number => Math.max(1, Math.min(MAX_STAT, v))

export function paramsFromStats(stats: StatLike): RacerParams {
  const sp = clampStat(stats.speed) - 5
  const ac = clampStat(stats.accel) - 5
  const ha = clampStat(stats.handling) - 5
  return {
    ...DEFAULT_PARAMS,
    vmax: DEFAULT_PARAMS.vmax + sp * 1.2,
    accel: DEFAULT_PARAMS.accel + ac * 0.9,
    steerRate: DEFAULT_PARAMS.steerRate + ha * 0.12,
    grip: DEFAULT_PARAMS.grip + ha * 0.035,
  }
}
