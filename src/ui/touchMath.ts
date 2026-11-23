/**
 * Touch driving, kept pure for tests: a finger on the left half of the screen is the gas
 * pedal and the steering wheel at once (drag sideways from where it landed). The right half
 * belongs to the form buttons, so a finger there never drives.
 */

const DEAD_ZONE = 0.02
const FULL_LOCK = 0.18

/** Steering from a drag: −1 right … +1 left, with a small dead zone. */
export function touchSteer(startX: number, x: number, width: number): number {
  const w = Math.max(1, width)
  const dx = (x - startX) / w
  if (Math.abs(dx) <= DEAD_ZONE) return 0
  const v = (Math.abs(dx) - DEAD_ZONE) / (FULL_LOCK - DEAD_ZONE)
  return -Math.sign(dx) * Math.min(1, v)
}

interface Finger {
  readonly startX: number
  x: number
  readonly width: number
}

export class TouchTracker {
  private readonly fingers = new Map<number, Finger>()
  /** Driving fingers in landing order; the oldest one drives. */
  private order: number[] = []

  down(id: number, x: number, width: number): void {
    if (x >= width / 2) return
    this.fingers.set(id, { startX: x, x, width })
    this.order.push(id)
  }

  move(id: number, x: number): void {
    const f = this.fingers.get(id)
    if (f !== undefined) f.x = x
  }

  up(id: number): void {
    this.fingers.delete(id)
    this.order = this.order.filter((o) => o !== id)
  }

  clear(): void {
    this.fingers.clear()
    this.order = []
  }

  state(): { gas: boolean; steer: number } {
    const id = this.order[0]
    const f = id === undefined ? undefined : this.fingers.get(id)
    if (f === undefined) return { gas: false, steer: 0 }
    return { gas: true, steer: touchSteer(f.startX, f.x, f.width) }
  }
}
