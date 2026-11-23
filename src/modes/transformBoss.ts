/**
 * The Dönüşüm boss race: the Dev Balina Dalgası chases the player down track 6. Rules come
 * from src/sim/boss.ts (chase kind); this file keeps the state, the danger meter and the
 * "three straight defeats ⇒ easier whale" memory (spec §9.4).
 */
import type * as THREE from 'three'
import type { QualityProfile } from '../game/quality'
import { bossDanger, chaseConfig, finishBoss, newBoss, offerEasy, stepBoss, type BossConfig, type BossEvent, type BossState } from '../sim/boss'
import type { RacerState } from '../sim/racer'
import type { Track } from '../sim/track'
import type { HudMeter, RaceHud } from '../ui/raceHud'
import { buildWhaleBoss, type WhaleBossView } from '../worlds/adalar/whaleBoss'

const DEFEATS_KEY = 'ttr-boss-defeats-'
const WAVE_COLOR = '#4fc3ff'

function readDefeats(cupId: string): number {
  try {
    return Number(localStorage.getItem(DEFEATS_KEY + cupId) ?? '0') || 0
  } catch {
    return 0
  }
}

function writeDefeats(cupId: string, n: number): void {
  try {
    localStorage.setItem(DEFEATS_KEY + cupId, String(n))
  } catch {
    // Private mode: the easy whale just won't be remembered.
  }
}

/** The whale gets faster in the Gümüş and Altın cups (m/s added to the chase pace). */
export function tierPace(cupId: string): number {
  if (cupId.endsWith('-altin')) return 4.5
  if (cupId.endsWith('-gumus')) return 2.5
  return 0
}

export class TransformBoss {
  private st: BossState
  private meter: HudMeter | null = null
  private danger = 0
  private recorded = false

  private constructor(
    private readonly view: WhaleBossView,
    private readonly cfg: BossConfig,
    private readonly cupId: string,
  ) {
    this.st = newBoss(cfg, 0)
  }

  static async create(track: Track, q: QualityProfile, cupId: string): Promise<TransformBoss> {
    const view = await buildWhaleBoss(track, q)
    const base = chaseConfig(track.length)
    const cfg = { ...base, pace: base.pace + tierPace(cupId), easy: offerEasy(readDefeats(cupId)) }
    return new TransformBoss(view, cfg, cupId)
  }

  get group(): THREE.Group {
    return this.view.group
  }

  get won(): boolean {
    return this.st.outcome === 'won'
  }

  /** 0 (far) … 1 (about to catch). */
  get dangerLevel(): number {
    return this.st.outcome === 'racing' ? this.danger : 0
  }

  get catches(): number {
    return this.st.catches
  }

  reset(playerS: number): void {
    this.st = newBoss(this.cfg, playerS)
    this.danger = 0
    this.recorded = false
  }

  showMeter(hud: RaceHud): void {
    this.meter = hud.meter('DALGA', WAVE_COLOR)
    this.meter.set(0)
  }

  step(player: RacerState, dt: number): readonly BossEvent[] {
    const r = stepBoss(this.st, this.cfg, { playerS: player.s, playerSpeed: player.speed, dt, playerFinished: player.finished })
    this.st = r.st
    this.danger = bossDanger(this.st, this.cfg, player.s)
    this.meter?.set(this.danger)
    return r.events
  }

  finish(): void {
    this.st = finishBoss(this.st, this.cfg)
  }

  /** Remembers straight defeats for the easy-whale offer (once per race). */
  record(won: boolean): void {
    if (this.recorded) return
    this.recorded = true
    writeDefeats(this.cupId, won ? 0 : readDefeats(this.cupId) + 1)
  }

  update(timeS: number, playerS: number): void {
    this.view.update(timeS, this.st.s, this.st.outcome === 'racing' ? this.danger : Math.max(0, 1 - (playerS - this.st.s) / 80))
  }

  dot(trackLength: number): { id: string; progress: number; color: string } {
    return { id: 'whale', progress: Math.max(0, this.st.s / trackLength), color: WAVE_COLOR }
  }

  dispose(): void {
    this.view.dispose()
  }
}
