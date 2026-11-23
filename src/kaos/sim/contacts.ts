/**
 * Car-to-car contacts in track space. Each car is a box along the track (s) and across it (d);
 * two boxes that overlap are pushed apart along the shallower axis:
 * - side by side: a sideways shove ("push", lateral m/s that the race decays) plus a small
 *   yaw kick, shared by mass so the heavy player car bullies the bots;
 * - nose to tail: a soft inelastic hit along the track (speed traded, momentum kept).
 * Pure: returns what to change, never touches the bodies.
 */
export const CAR_HALF_L = 1.7
export const CAR_HALF_W = 1.0

export interface Body {
  readonly s: number
  readonly d: number
  readonly speed: number
  readonly yaw: number
  readonly mass: number
}

export interface Kick {
  /** Position shifts. */
  readonly ds: number
  readonly dd: number
  readonly dSpeed: number
  /** Lateral velocity to add (m/s, + = left). */
  readonly push: number
  readonly yawKick: number
}

export interface Contact {
  readonly a: Kick
  readonly b: Kick
  /** Closing speed plus a base, for score, shake and sound. */
  readonly force: number
  readonly side: boolean
}

/** Base shove even for a gentle touch, so contact always reads. */
const SIDE_BASE = 3.5
const SIDE_GAIN = 1.3
const YAW_PER_PUSH = 0.045
const RESTITUTION = 0.35
const REAR_YAW = 0.12

export function overlaps(b: Body, s: number, d: number, halfL: number, halfW: number): boolean {
  return Math.abs(b.s - s) < CAR_HALF_L + halfL && Math.abs(b.d - d) < CAR_HALF_W + halfW
}

const lateral = (b: Body): number => b.speed * Math.sin(b.yaw)

function sideHit(a: Body, b: Body, pd: number): Contact {
  const n = a.d < b.d ? -1 : 1
  const m = a.mass + b.mass
  const closing = Math.max(0, (lateral(b) - lateral(a)) * n)
  const shove = SIDE_BASE + SIDE_GAIN * closing
  const pa = n * shove * (2 * b.mass) / m
  const pb = -n * shove * (2 * a.mass) / m
  return {
    side: true,
    force: shove,
    a: { ds: 0, dd: n * pd * (b.mass / m), dSpeed: -0.02 * a.speed, push: pa, yawKick: pa * YAW_PER_PUSH },
    b: { ds: 0, dd: -n * pd * (a.mass / m), dSpeed: -0.02 * b.speed, push: pb, yawKick: pb * YAW_PER_PUSH },
  }
}

function rearHit(a: Body, b: Body, px: number): Contact {
  const aBehind = a.s < b.s
  const rear = aBehind ? a : b
  const front = aBehind ? b : a
  const m = a.mass + b.mass
  const closing = Math.max(0, rear.speed - front.speed)
  // 1-D collision with restitution along the track; momentum is kept.
  const j = ((1 + RESTITUTION) * closing) / (1 / rear.mass + 1 / front.mass)
  const rearKick: Kick = {
    ds: -px * (front.mass / m), dd: 0, dSpeed: -j / rear.mass, push: 0,
    yawKick: (rear.d >= front.d ? 1 : -1) * REAR_YAW,
  }
  const frontKick: Kick = { ds: px * (rear.mass / m), dd: 0, dSpeed: j / front.mass, push: 0, yawKick: 0 }
  return { side: false, force: closing + SIDE_BASE, a: aBehind ? rearKick : frontKick, b: aBehind ? frontKick : rearKick }
}

export function collide(a: Body, b: Body): Contact | null {
  const px = 2 * CAR_HALF_L - Math.abs(a.s - b.s)
  const pd = 2 * CAR_HALF_W - Math.abs(a.d - b.d)
  if (px <= 0 || pd <= 0) return null
  // Scaled so a car mostly alongside counts as a side hit even when slightly ahead.
  return pd * 1.5 <= px ? sideHit(a, b, pd) : rearHit(a, b, px)
}
