import { describe, expect, it } from 'vitest'
import { bossCheckpoints, chaseConfig, damageBoss, finishBoss, healthConfig, newBoss, offerEasy, stepBoss, type BossState, type BossStepInput } from './boss'

const LEN = 3600

/** Runs the boss for `seconds` with a player moving at `speed` from `s0`. */
function run(st: BossState, cfg = chaseConfig(LEN), seconds: number, s0: number, speed: number): { st: BossState; kinds: string[]; playerS: number } {
  let s = st
  let p = s0
  const kinds: string[] = []
  const dt = 1 / 30
  for (let t = 0; t < seconds; t += dt) {
    p += speed * dt
    const inp: BossStepInput = { playerS: p, playerSpeed: speed, dt, playerFinished: p >= LEN }
    const r = stepBoss(s, cfg, inp)
    s = r.st
    for (const e of r.events) {
      kinds.push(e.kind)
      if (e.kind === 'caught') p = e.respawnS
    }
  }
  return { st: s, kinds, playerS: p }
}

describe('boss checkpoints', () => {
  it('spreads three checkpoints evenly over the track', () => {
    const cps = bossCheckpoints(LEN)
    expect(cps).toHaveLength(3)
    expect(cps[0]).toBeCloseTo(LEN / 4, 0)
    expect(cps[2]).toBeCloseTo((3 * LEN) / 4, 0)
  })

  it('can snap checkpoints to safe road positions', () => {
    const cps = bossCheckpoints(LEN, (s) => Math.floor(s / 100) * 100)
    expect(cps).toEqual([900, 1800, 2700])
  })
})

describe('chase boss', () => {
  it('starts behind the player and waits out the grace period', () => {
    const cfg = chaseConfig(LEN)
    const st = newBoss(cfg, 26)
    expect(st.s).toBeLessThan(26)
    const r = stepBoss(st, cfg, { playerS: 26, playerSpeed: 0, dt: 0.5, playerFinished: false })
    expect(r.st.s).toBe(st.s)
  })

  it('never catches a player who keeps top speed, and the player wins at the finish', () => {
    const cfg = chaseConfig(LEN)
    const { st, kinds } = run(newBoss(cfg, 26), cfg, 120, 26, 42)
    expect(kinds).not.toContain('caught')
    expect(kinds).toContain('won')
    expect(st.outcome).toBe('won')
  })

  it('catches a slow player, respawns them at the last checkpoint passed, behind which the boss restarts', () => {
    const cfg = chaseConfig(LEN)
    let st = newBoss(cfg, 26)
    // Fast to just past the first checkpoint, then crawl.
    const fast = run(st, cfg, (cfg.checkpoints[0] + 40 - 26) / 42, 26, 42)
    st = fast.st
    let p = fast.playerS
    let caught: number | null = null
    for (let i = 0; i < 30 * 40 && caught === null; i++) {
      p += 8 / 30
      const r = stepBoss(st, cfg, { playerS: p, playerSpeed: 8, dt: 1 / 30, playerFinished: false })
      st = r.st
      for (const e of r.events) if (e.kind === 'caught') caught = e.respawnS
    }
    expect(caught).toBe(cfg.checkpoints[0])
    expect(st.catches).toBe(1)
    expect(st.s).toBeLessThan(cfg.checkpoints[0] - cfg.respawnGap + 1)
    expect(st.lastCheckpoint).toBe(0)
  })

  it('respawns at the start when caught before any checkpoint', () => {
    const cfg = chaseConfig(LEN)
    const { kinds, st } = run(newBoss(cfg, 26), cfg, 20, 26, 3)
    expect(kinds).toContain('caught')
    expect(st.lastCheckpoint).toBe(-1)
  })

  it('turns easy (15 % slower) after three catches', () => {
    const cfg = chaseConfig(LEN)
    const { st, kinds } = run(newBoss(cfg, 26), cfg, 120, 26, 3)
    expect(st.catches).toBeGreaterThanOrEqual(3)
    expect(kinds).toContain('easy')
    expect(st.easy).toBe(true)
    expect(kinds.filter((k) => k === 'easy')).toHaveLength(1)
  })

  it('easy mode makes the boss 15 % slower from the start when asked for', () => {
    const cfg = chaseConfig(LEN)
    const easy = { ...cfg, easy: true }
    const inp = { playerS: 200, playerSpeed: 30, dt: 1, playerFinished: false }
    const a = stepBoss({ ...newBoss(cfg, 26), s: 150, hold: 0 }, cfg, inp).st
    const b = stepBoss({ ...newBoss(easy, 26), s: 150, hold: 0 }, easy, inp).st
    expect(a.s - 150).toBeCloseTo(cfg.pace, 5)
    expect(b.s - 150).toBeCloseTo(cfg.pace * 0.85, 5)
  })

  it('a shield absorbs the first catch without a respawn', () => {
    const cfg = { ...chaseConfig(LEN), shield: true }
    const { kinds, st } = run(newBoss(cfg, 26), cfg, 12, 26, 3)
    expect(kinds.filter((k) => k === 'shield' || k === 'caught')[0]).toBe('shield')
    expect(st.shieldUsed).toBe(true)
  })

  it('warns once when it closes in, and again after falling back', () => {
    const cfg = chaseConfig(LEN)
    const { kinds } = run(newBoss(cfg, 26), cfg, 8, 26, 3)
    expect(kinds).toContain('near')
  })

  it('reports checkpoints in order', () => {
    const cfg = chaseConfig(LEN)
    const { kinds } = run(newBoss(cfg, 26), cfg, 100, 26, 42)
    expect(kinds.filter((k) => k === 'checkpoint')).toHaveLength(3)
  })

  it('does not move after the race is decided', () => {
    const cfg = chaseConfig(LEN)
    const done = finishBoss(newBoss(cfg, 26), cfg)
    expect(done.outcome).toBe('won')
    const r = stepBoss(done, cfg, { playerS: 100, playerSpeed: 0, dt: 1, playerFinished: false })
    expect(r.st).toBe(done)
    expect(r.events).toHaveLength(0)
  })

  it('stays within sight: rubber-bands forward when far behind', () => {
    const cfg = chaseConfig(LEN)
    const st = { ...newBoss(cfg, 26), s: 0, t: 10, hold: 0 }
    const r = stepBoss(st, cfg, { playerS: 400, playerSpeed: 42, dt: 1, playerFinished: false })
    expect(r.st.s).toBeGreaterThan(cfg.pace * 1.2)
  })
})

describe('health boss', () => {
  it('flies ahead of the player and is beaten when its health runs out', () => {
    const cfg = healthConfig(LEN, 3)
    let st = newBoss(cfg, 26)
    st = stepBoss(st, cfg, { playerS: 500, playerSpeed: 40, dt: 1 / 30, playerFinished: false }).st
    expect(st.s).toBeGreaterThan(500)
    let r = damageBoss(st, cfg, 1)
    expect(r.st.health).toBe(2)
    expect(r.events.map((e) => e.kind)).toEqual(['hit'])
    r = damageBoss(r.st, cfg, 5)
    expect(r.st.health).toBe(0)
    expect(r.st.outcome).toBe('won')
    expect(r.events.map((e) => e.kind)).toEqual(['hit', 'won'])
  })

  it('is lost when the player finishes with the boss still alive', () => {
    const cfg = healthConfig(LEN, 3)
    const st = finishBoss(newBoss(cfg, 26), cfg)
    expect(st.outcome).toBe('lost')
  })

  it('easy mode takes 15 % of its health away', () => {
    const cfg = { ...healthConfig(LEN, 20), easy: true }
    expect(newBoss(cfg, 26).health).toBe(17)
  })
})

describe('easy offer', () => {
  it('is offered after three straight defeats', () => {
    expect(offerEasy(2)).toBe(false)
    expect(offerEasy(3)).toBe(true)
  })
})
