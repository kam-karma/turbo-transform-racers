/**
 * Boss races, shared by every cup (spec §9.4). Pure and immutable like the racer step.
 *
 * Chase bosses (Dev Balina Dalgası, Robot Süpürge) run along the track behind the player.
 * Catching the player loses nothing: the player is put back at the last of three
 * checkpoints passed and the boss restarts a little behind it. After three catches the boss
 * turns easy (15 % slower). The player wins by reaching the finish first.
 *
 * Health bosses (Ejderha) fly ahead of the player and are beaten when their health reaches
 * 0 before the player finishes.
 */

export type BossKind = 'chase' | 'health'

export interface BossConfig {
  readonly kind: BossKind
  readonly trackLength: number
  /** Three respawn points along the track (s, ascending). */
  readonly checkpoints: readonly number[]
  /** Chase speed in m/s before rubber-banding (the player's top speed is about 42). */
  readonly pace: number
  /** Metres behind the player's start where the boss begins. */
  readonly startGap: number
  /** Metres behind the respawn point where the boss restarts after a catch. */
  readonly respawnGap: number
  /** The player is caught when the boss is this close behind. */
  readonly catchDist: number
  /** Distance under which a 'near' warning fires (once per approach). */
  readonly nearDist: number
  /** Beyond this gap the boss speeds up, so it always stays in sight. */
  readonly maxGap: number
  /** Seconds the boss waits at the start and after each catch. */
  readonly graceS: number
  /** Easy boss from the start (chosen after three defeats, spec §9.4). */
  readonly easy: boolean
  /** Rewarded-video shield: the first catch does not count. */
  readonly shield: boolean
  /** Health bosses only. */
  readonly maxHealth: number
  /** Health bosses only: metres the boss flies ahead of the player. */
  readonly lead: number
}

export type BossOutcome = 'racing' | 'won' | 'lost'

export interface BossState {
  /** Boss position along the track (may be negative behind the start). */
  readonly s: number
  /** Seconds since the race started. */
  readonly t: number
  /** Seconds the boss still waits before moving. */
  readonly hold: number
  readonly startS: number
  readonly catches: number
  readonly easy: boolean
  readonly shieldUsed: boolean
  /** Index of the last checkpoint passed (-1 = none yet). */
  readonly lastCheckpoint: number
  readonly health: number
  readonly near: boolean
  readonly outcome: BossOutcome
}

export type BossEvent =
  | { readonly kind: 'caught'; readonly respawnS: number }
  | { readonly kind: 'checkpoint'; readonly index: number }
  | { readonly kind: 'near' }
  | { readonly kind: 'easy' }
  | { readonly kind: 'shield' }
  | { readonly kind: 'hit'; readonly health: number }
  | { readonly kind: 'won' }
  | { readonly kind: 'lost' }

export interface BossStepInput {
  readonly playerS: number
  readonly playerSpeed: number
  readonly dt: number
  readonly playerFinished: boolean
}

export interface BossStep {
  readonly st: BossState
  readonly events: readonly BossEvent[]
}

/** Speed multiplier of the easy boss. */
export const EASY_MUL = 0.85
/** Catches (in a race) or straight defeats (across races) before the boss turns easy. */
export const EASY_AFTER = 3
const RUBBER = 0.6
const MAX_RUBBER_MUL = 1.8
/** Close behind the player the boss only gains slowly: a tense near miss, not a lunge. */
const CLOSE_GAIN = 4
const NEAR_RESET = 15

/** Three checkpoints at a quarter, half and three quarters, optionally moved to safe road. */
export function bossCheckpoints(trackLength: number, safe: (s: number) => number = (s) => s): number[] {
  return [0.25, 0.5, 0.75].map((k) => safe(trackLength * k))
}

export function chaseConfig(trackLength: number, checkpoints: readonly number[] = bossCheckpoints(trackLength)): BossConfig {
  return {
    kind: 'chase',
    trackLength,
    checkpoints,
    pace: 36,
    startGap: 50,
    respawnGap: 45,
    catchDist: 3,
    nearDist: 25,
    maxGap: 70,
    graceS: 1,
    easy: false,
    shield: false,
    maxHealth: 0,
    lead: 0,
  }
}

export function healthConfig(trackLength: number, maxHealth: number): BossConfig {
  return { ...chaseConfig(trackLength), kind: 'health', maxHealth, lead: 35 }
}

/** Should the "kolay boss" choice be offered after this many straight defeats? */
export const offerEasy = (straightDefeats: number): boolean => straightDefeats >= EASY_AFTER

export function newBoss(cfg: BossConfig, playerStartS: number): BossState {
  const health = cfg.kind === 'health' ? (cfg.easy ? Math.round(cfg.maxHealth * EASY_MUL) : cfg.maxHealth) : 0
  return {
    s: cfg.kind === 'health' ? playerStartS + cfg.lead : playerStartS - cfg.startGap,
    t: 0,
    hold: cfg.graceS,
    startS: playerStartS,
    catches: 0,
    easy: cfg.easy,
    shieldUsed: false,
    lastCheckpoint: -1,
    health,
    near: false,
    outcome: 'racing',
  }
}

/** Boss speed for the current gap to the player. */
function chaseSpeed(st: BossState, cfg: BossConfig, gap: number, playerSpeed: number): number {
  const base = cfg.pace * (st.easy ? EASY_MUL : 1)
  let v = base
  if (gap > cfg.maxGap) v = Math.min(base * MAX_RUBBER_MUL, base + (gap - cfg.maxGap) * RUBBER)
  if (gap < cfg.nearDist) v = Math.min(v, Math.max(0, playerSpeed) + CLOSE_GAIN)
  return v
}

export function stepBoss(st: BossState, cfg: BossConfig, inp: BossStepInput): BossStep {
  if (st.outcome !== 'racing') return { st, events: [] }
  const events: BossEvent[] = []
  let m: { -readonly [K in keyof BossState]: BossState[K] } = { ...st, t: st.t + inp.dt }

  // Checkpoints are passed by the player, whoever the boss is.
  while (m.lastCheckpoint + 1 < cfg.checkpoints.length && inp.playerS >= cfg.checkpoints[m.lastCheckpoint + 1]) {
    m.lastCheckpoint++
    events.push({ kind: 'checkpoint', index: m.lastCheckpoint })
  }

  if (inp.playerFinished) {
    m.outcome = cfg.kind === 'chase' || m.health <= 0 ? 'won' : 'lost'
    events.push({ kind: m.outcome === 'won' ? 'won' : 'lost' })
    return { st: m, events }
  }

  if (cfg.kind === 'health') {
    m.s = inp.playerS + cfg.lead
    return { st: m, events }
  }

  if (m.hold > 0) {
    m.hold = Math.max(0, m.hold - inp.dt)
    return { st: m, events }
  }

  const gap0 = inp.playerS - m.s
  m.s += chaseSpeed(m, cfg, gap0, inp.playerSpeed) * inp.dt
  const gap = inp.playerS - m.s
  if (!m.near && gap < cfg.nearDist) {
    m.near = true
    events.push({ kind: 'near' })
  } else if (m.near && gap > cfg.nearDist + NEAR_RESET) m.near = false

  if (gap <= cfg.catchDist) {
    m.near = false
    m.hold = cfg.graceS
    if (cfg.shield && !m.shieldUsed) {
      m.shieldUsed = true
      m.s = inp.playerS - cfg.respawnGap
      events.push({ kind: 'shield' })
      return { st: m, events }
    }
    const respawnS = m.lastCheckpoint >= 0 ? cfg.checkpoints[m.lastCheckpoint] : m.startS
    m.catches++
    m.s = respawnS - cfg.respawnGap
    events.push({ kind: 'caught', respawnS })
    if (!m.easy && m.catches >= EASY_AFTER) {
      m.easy = true
      events.push({ kind: 'easy' })
    }
  }
  return { st: m, events }
}

/** A hit on a health boss (shock wave, boost ram...). */
export function damageBoss(st: BossState, cfg: BossConfig, amount: number): BossStep {
  if (cfg.kind !== 'health' || st.outcome !== 'racing') return { st, events: [] }
  const health = Math.max(0, st.health - amount)
  const events: BossEvent[] = [{ kind: 'hit', health }]
  if (health === 0) events.push({ kind: 'won' })
  return { st: { ...st, health, outcome: health === 0 ? 'won' : 'racing' }, events }
}

/** Decides a boss race when the player crosses the line (same rule as a step with playerFinished). */
export function finishBoss(st: BossState, cfg: BossConfig): BossState {
  if (st.outcome !== 'racing') return st
  return { ...st, outcome: cfg.kind === 'chase' || st.health <= 0 ? 'won' : 'lost' }
}

/** 0 (boss far) … 1 (boss about to catch): for HUD danger meters and music intensity. */
export function bossDanger(st: BossState, cfg: BossConfig, playerS: number): number {
  if (cfg.kind !== 'chase') return 0
  const gap = playerS - st.s
  return Math.max(0, Math.min(1, 1 - (gap - cfg.catchDist) / (cfg.maxGap - cfg.catchDist)))
}
