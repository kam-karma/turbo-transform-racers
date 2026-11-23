/**
 * Continuous emitters that run every frame from the racer's state: exhaust (puffs, turbo,
 * boost, combo flame), boat spray, ice dust, climber grit, glider wingtip trails, rail sparks.
 * Rates are per second and go through accumulators, so the look does not depend on frame rate.
 */
import type { RacerState } from '../sim/racer'
import { burstWall } from './fxBursts'
import { FOAM, FORM_RGB, ROCK, SMOKE, SNOW, rnd, type FxKit } from './fxKit'
import { SHAPE_CHIP, SHAPE_GLOW, SHAPE_PUFF, SHAPE_STAR } from './fxTextures'

/** Exhaust pipe placement relative to the car origin (metres): behind, up, either side. */
export const PIPE_BACK = 1.9
export const PIPE_UP = 0.05
export const PIPE_SIDE = 0.42
/** Glider wing tips, metres to each side. */
const WING_TIP = 2.5

type Slot = 'puff' | 'flame' | 'spray' | 'grit' | 'wing' | 'wall'

export class FxTrails {
  private readonly acc: Record<Slot, number> = { puff: 0, flame: 0, spray: 0, grit: 0, wing: 0, wall: 0 }
  private flip = 1

  constructor(private readonly k: FxKit) {}

  /** How many to emit this frame at `rate` per second (quality-scaled). */
  private take(slot: Slot, rate: number, dt: number): number {
    const a = this.acc[slot] + rate * this.k.scale * dt
    const n = Math.floor(a)
    this.acc[slot] = a - n
    return Math.min(n, 40)
  }

  update(dt: number, st: RacerState): void {
    if (st.respawnT > 0 || dt <= 0) return
    const onWater = st.surface === 'water' && !st.airborne
    this.exhaust(dt, st, onWater)
    if (onWater) this.spray(dt, st)
    if (!st.airborne && st.speed > 12 && (st.surface === 'ice' || (st.form === 'climber' && st.surface === 'climb'))) this.grit(dt, st)
    if (st.form === 'glider' && st.airborne) this.wings(dt)
    const sparks = st.onWall ? this.take('wall', 80, dt) : 0
    for (let i = 0; i < sparks; i++) burstWall(this.k, this.k.pos, st.d > 0 ? 1 : -1, st.speed, 1)
  }

  private exhaust(dt: number, st: RacerState, onWater: boolean): void {
    const k = this.k
    const fire = st.combo >= 3
    const hot = fire || st.turbo > 0 || st.boost > 0
    if (hot) {
      const n = this.take('flame', fire ? 110 : 85, dt)
      for (let i = 0; i < n; i++) this.flame(dt, st, fire, i)
    }
    // Light cartoon puffs from the pipes, thicker at low speed (the reference's white puffs).
    if (onWater && st.form === 'boat') return
    if (st.form === 'glider' && st.airborne) return
    const rate = hot ? 4 : st.speed < 22 ? 16 : 7
    const n = this.take('puff', rate, dt)
    for (let i = 0; i < n; i++) {
      this.flip = -this.flip
      k.at(k.pos, this.flip * PIPE_SIDE, PIPE_UP + 0.1, -PIPE_BACK).back(Math.random() * dt)
        .v(0.45, rnd(-0.6, 0.6), rnd(0.6, 1.4), -rnd(1, 3), 0.3)
        .tint(SMOKE, 1, 0.95).look(rnd(0.5, 0.8), 0.28, rnd(0.9, 1.3), 0.55, SHAPE_PUFF, -0.6, 2.2).upright()
      k.puffOut()
    }
  }

  private flame(dt: number, st: RacerState, fire: boolean, i: number): void {
    const k = this.k
    this.flip = -this.flip
    const size = fire ? 1.15 : 0.6
    k.at(k.pos, this.flip * PIPE_SIDE, PIPE_UP + 0.05, -PIPE_BACK).back(Math.random() * dt)
      .v(0.88, rnd(-0.4, 0.4), rnd(-0.1, 0.5), -rnd(3, 6), 0.3)
    if (fire) k.col(1.7, 1, 0.15, 1.3, 0.12, 0.02)
    else if (st.turbo > 0) k.col(1.8, 0.75, 1.2, 1.3, 0.08, 0.6)
    else k.col(0.45, 1.2, 1.9, 0.03, 0.25, 1.5)
    // The combo flame is a longer tongue that licks upwards; turbo / boost stay tight jets.
    k.look(fire ? rnd(0.22, 0.38) : rnd(0.16, 0.28), size * rnd(0.8, 1.2), size * 0.25, 1, SHAPE_GLOW, fire ? -5 : -2, 1)
    k.glowOut()
    // Embers and a hot core make the combo flame read as fire, not as a coloured glow.
    if (fire && i % 3 === 0) {
      k.at(k.pos, this.flip * PIPE_SIDE, PIPE_UP + 0.2, -PIPE_BACK - 0.3)
        .v(0.6, rnd(-1.5, 1.5), rnd(1, 3), -rnd(3, 6), 0.5)
        .col(2, 1.3, 0.3, 1.5, 0.2, 0).look(rnd(0.35, 0.6), rnd(0.2, 0.32), 0.05, 1, SHAPE_STAR, -1.5, 0.8).spin(8)
      k.glowOut()
    }
    if (i === 0) {
      k.at(k.pos, 0, PIPE_UP + 0.05, -PIPE_BACK - 0.2).v(1, 0, 0, 0, 0)
      if (fire) k.col(1.9, 0.9, 0.2, 1.2, 0.3, 0.05)
      else if (st.turbo > 0) k.col(1.6, 0.5, 1.1, 1, 0.2, 0.7)
      else k.col(0.35, 1, 1.9, 0.1, 0.4, 1.3)
      k.look(0.07, 1.3 * size, 1.6 * size, 0.6, SHAPE_GLOW).glowOut()
    }
  }

  /** Boat: rooster tail off the stern and bow spray to both sides. Sinking cars only foam. */
  private spray(dt: number, st: RacerState): void {
    const k = this.k
    const boat = st.form === 'boat'
    const f = Math.min(1.4, 0.3 + st.speed / 35)
    const n = this.take('spray', boat ? 30 + st.speed * 2.2 : 12, dt)
    for (let i = 0; i < n; i++) {
      this.flip = -this.flip
      if (!boat) {
        k.at(k.pos, rnd(-1, 1), 0.1, rnd(-1.6, 1.6)).v(0.6, rnd(-0.6, 0.6), rnd(0.5, 1.5), 0, 0.3)
          .tint(FOAM, 1, 1).look(rnd(0.4, 0.6), 0.4, 0.9, 0.7, SHAPE_PUFF, 1, 2).upright()
        k.puffOut()
        continue
      }
      if (i % 2 === 0) {
        k.at(k.pos, rnd(-0.25, 0.25), 0.2, -2.1).back(Math.random() * dt)
          .v(0.8, rnd(-0.8, 0.8), rnd(3.5, 6.5) * f, -rnd(1, 3), 0.3)
          .tint(FOAM, 1.1, 1).look(rnd(0.45, 0.7), 0.3, rnd(0.7, 0.9), 0.9, SHAPE_PUFF, 12, 0.6).upright()
      } else {
        k.at(k.pos, this.flip * 1, 0.1, 0.8).back(Math.random() * dt)
          .v(0.75, this.flip * rnd(3, 5.5) * f, rnd(2, 4) * f, -rnd(0, 1.5), 0.3)
          .tint(FOAM, 1.1, 1).look(rnd(0.4, 0.6), 0.25, rnd(0.55, 0.75), 0.9, SHAPE_PUFF, 11, 0.5).upright()
      }
      k.puffOut()
      if (i % 2 === 0) {
        k.at(k.pos, this.flip * rnd(0.5, 1.2), 0.1, rnd(-1.8, 0.8)).v(0.75, this.flip * rnd(1, 4), rnd(3, 6) * f, -rnd(1, 3), 0.5)
          .tint(FOAM, 1.2, 1).look(rnd(0.4, 0.7), rnd(0.12, 0.22), 0.08, 1, SHAPE_GLOW, 14, 0.3)
        k.puffOut()
      }
    }
  }

  /** Ice: powder snow and glints from the tyres. Climber on the wall: little rock chips. */
  private grit(dt: number, st: RacerState): void {
    const k = this.k
    const ice = st.surface === 'ice'
    const n = this.take('grit', ice ? 26 : 18, dt)
    for (let i = 0; i < n; i++) {
      this.flip = -this.flip
      if (ice) {
        k.at(k.pos, this.flip * 0.8, 0, -1.3).back(Math.random() * dt).v(0.45, this.flip * rnd(0, 1), rnd(0.3, 1.2), -rnd(1, 3), 0.3)
          .tint(SNOW, 1, 1).look(rnd(0.4, 0.6), 0.3, rnd(0.8, 1.1), 0.6, SHAPE_PUFF, -0.2, 2).upright()
        k.puffOut()
        if (i % 3 === 0) {
          k.at(k.pos, this.flip * 0.8, -0.2, -1.3).v(0.5, this.flip * rnd(0, 1.5), rnd(1, 2.5), -rnd(1, 3), 0.4)
            .tint(SNOW, 1.6, 1.1).look(rnd(0.3, 0.5), 0.4, 0.08, 1, SHAPE_STAR, 5, 0.5).spin(5)
          k.glowOut()
        }
      } else {
        k.at(k.pos, this.flip * 0.85, -0.3, -1.2).v(0.5, this.flip * rnd(0.5, 2), rnd(1, 3), -rnd(1, 4), 0.5)
          .tint(ROCK, 0.9, 0.7).look(rnd(0.4, 0.7), rnd(0.15, 0.25), 0.12, 1, SHAPE_CHIP, 12, 0.3).spin(10)
        k.puffOut()
      }
    }
  }

  /** Glider: two soft glowing contrails from the wing tips. */
  private wings(dt: number): void {
    const k = this.k
    const c = FORM_RGB.glider
    const n = this.take('wing', 220, dt)
    for (let i = 0; i < n; i++) {
      this.flip = -this.flip
      k.at(k.pos, this.flip * WING_TIP, 0.4, -0.4).back(Math.random() * dt).v(0.55, 0, 0, 0, 0.05)
        .col(0.5 + c[0], 0.5 + c[1], 0.5 + c[2], c[0] * 0.9, c[1] * 0.9, c[2] * 0.9)
        .look(0.45, 0.5, 0.1, 0.6, SHAPE_GLOW)
      k.glowOut()
    }
  }
}
