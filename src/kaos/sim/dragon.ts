/**
 * Ejderha, the Kaos Kupası boss (spec §9.3, §9.4): a hologram dragon flies above the circuit
 * ahead of the player and throws neon blocks onto the road. A block that lands on the player
 * crushes their speed; a block the player drives through (or a shock wave reaches) flies back
 * and hurts the dragon. Win by draining its health before the last lap ends.
 *
 * Same shape as a health boss: health / maxHealth / beaten. Track space, deterministic for a
 * given random source.
 */
import { overlaps, type Body } from './contacts'

export type BlockPhase = 'falling' | 'sitting' | 'returning'

export interface DragonBlock {
  readonly id: number
  phase: BlockPhase
  /** Seconds in the current phase. */
  t: number
  /** Landing spot (race s, d). */
  readonly s: number
  readonly d: number
  /** Where the dragon was when it threw the block (for the arc). */
  readonly fromS: number
  readonly fromD: number
  /** True when the shock wave sent it back. */
  byShock: boolean
}

export type DragonEvent =
  | { readonly kind: 'throw' | 'land' | 'crush' | 'expire'; readonly id: number }
  | { readonly kind: 'bounce'; readonly id: number; readonly byShock: boolean }
  | { readonly kind: 'damage'; readonly id: number; readonly health: number }
  | { readonly kind: 'enrage'; readonly phase: number }
  | { readonly kind: 'beaten' }

export interface DragonConfig {
  readonly maxHealth: number
  readonly damage: number
  /** Road width, for where blocks may land. */
  readonly width: number
}

export const OPEN_DELAY = 4
export const FALL_T = 1.2
export const SIT_T = 9
export const RETURN_T = 0.7
export const BLOCK_HALF = 1
const AHEAD: readonly [number, number] = [48, 78]
/** Per phase (calm, angry, furious): seconds between volleys and blocks per volley. */
const INTERVAL = [2.6, 2.1, 1.7] as const
const VOLLEY = [1, 2, 3] as const

export class Dragon {
  health: number
  readonly maxHealth: number
  readonly blocks: DragonBlock[] = []
  beaten = false
  /** Seconds since the race started. */
  t = 0
  /** Where it flies (race s, d, height above the road). */
  s = 0
  d = 0
  h = 22
  crushes = 0
  hits = 0
  private throwT = OPEN_DELAY
  private nextId = 0

  /** 0 calm, 1 angry, 2 furious: from the health left. */
  get phase(): number {
    const frac = this.health / this.maxHealth
    return frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2
  }

  constructor(private readonly cfg: DragonConfig, private readonly rand: () => number) {
    this.maxHealth = cfg.maxHealth
    this.health = cfg.maxHealth
  }

  step(dt: number, player: Body, events: DragonEvent[]): void {
    if (!(dt > 0)) return
    this.t += dt
    this.fly(player)
    for (const b of [...this.blocks]) this.stepBlock(b, dt, player, events)
    if (this.beaten) return
    this.throwT -= dt
    if (this.throwT <= 0) {
      this.throwT += INTERVAL[this.phase]
      for (let i = 0; i < VOLLEY[this.phase]; i++) this.throwBlock(player, i, events)
    }
  }

  /** Bounces every falling or sitting block within r of (s, d) back at the dragon. */
  bounceWithin(s: number, d: number, r: number, events: DragonEvent[]): number {
    let n = 0
    for (const b of this.blocks) {
      if (b.phase === 'returning' || Math.hypot(b.s - s, b.d - d) > r) continue
      this.sendBack(b, true, events)
      n++
    }
    return n
  }

  private fly(player: Body): void {
    const t = this.t
    this.s = player.s + 62 + 12 * Math.sin(0.35 * t)
    this.d = (this.cfg.width / 2 - 3) * Math.sin(0.6 * t)
    this.h = 20 + 4 * Math.sin(0.9 * t)
  }

  private throwBlock(player: Body, i: number, events: DragonEvent[]): void {
    const lim = this.cfg.width / 2 - 1.5
    const ahead = AHEAD[0] + (AHEAD[1] - AHEAD[0]) * this.rand() + i * 9
    const b: DragonBlock = {
      id: this.nextId++, phase: 'falling', t: 0, s: player.s + ahead, d: (this.rand() * 2 - 1) * lim,
      fromS: this.s, fromD: this.d, byShock: false,
    }
    this.blocks.push(b)
    events.push({ kind: 'throw', id: b.id })
  }

  private sendBack(b: DragonBlock, byShock: boolean, events: DragonEvent[]): void {
    b.phase = 'returning'
    b.t = 0
    b.byShock = byShock
    events.push({ kind: 'bounce', id: b.id, byShock })
  }

  private remove(b: DragonBlock): void {
    const i = this.blocks.indexOf(b)
    if (i >= 0) this.blocks.splice(i, 1)
  }

  private stepBlock(b: DragonBlock, dt: number, player: Body, events: DragonEvent[]): void {
    b.t += dt
    const touching = overlaps(player, b.s, b.d, BLOCK_HALF, BLOCK_HALF)
    if (b.phase === 'falling' && b.t >= FALL_T) {
      if (touching) {
        this.crushes++
        events.push({ kind: 'crush', id: b.id })
        return this.remove(b)
      }
      b.phase = 'sitting'
      b.t = 0
      events.push({ kind: 'land', id: b.id })
      return
    }
    if (b.phase === 'sitting') {
      if (touching) return this.sendBack(b, false, events)
      if (b.t >= SIT_T || this.beaten) {
        events.push({ kind: 'expire', id: b.id })
        this.remove(b)
      }
      return
    }
    if (b.phase === 'returning' && b.t >= RETURN_T) {
      this.remove(b)
      this.hurt(b.id, events)
    }
  }

  private hurt(id: number, events: DragonEvent[]): void {
    if (this.beaten) return
    this.hits++
    const before = this.phase
    this.health = Math.max(0, this.health - this.cfg.damage)
    events.push({ kind: 'damage', id, health: this.health })
    if (this.phase > before && this.health > 0) events.push({ kind: 'enrage', phase: this.phase })
    if (this.health <= 0) {
      this.beaten = true
      events.push({ kind: 'beaten' })
    }
  }
}
