/**
 * The Robot Süpürge chase for a Kurgu boss race: rules from the shared src/sim/boss.ts
 * (chase kind, checkpoints before the three part gates), the vacuum on screen, its danger
 * meter, and the "three straight defeats ⇒ easier vacuum" memory (spec §9.4).
 */
import type * as THREE from 'three'
import { bossDanger, chaseConfig, finishBoss, newBoss, offerEasy, stepBoss, type BossConfig, type BossEvent, type BossState } from '../sim/boss'
import type { RacerState } from '../sim/racer'
import type { HudMeter, RaceHud } from '../ui/raceHud'
import type { KurguTrack } from './sim/kurguTrack'
import { buildVacuum, type VacuumView } from './view/vacuumView'

const DEFEATS_KEY = 'kupa-avcilari-kurgu-boss-defeats-'
export const VACUUM_COLOR = '#9b8cff'
const VIEW_GAP = 19

function defeats(cupId: string): number {
  try {
    return Number(localStorage.getItem(DEFEATS_KEY + cupId) ?? '0') || 0
  } catch {
    return 0
  }
}

export class BossRun {
  private st: BossState
  private meter: HudMeter | null = null
  private danger = 0
  private recorded = false

  private constructor(readonly view: VacuumView, private readonly cfg: BossConfig, private readonly cupId: string) {
    this.st = newBoss(cfg, 0)
  }

  static async create(kt: KurguTrack, checkpoints: readonly number[], cupId: string): Promise<BossRun> {
    const view = await buildVacuum()
    // The vacuum cruises a touch slower than the whale: detours are what let it catch up.
    const cfg: BossConfig = { ...chaseConfig(kt.length, checkpoints), pace: 37, catchDist: 6, easy: offerEasy(defeats(cupId)) }
    return new BossRun(view, cfg, cupId)
  }

  get group(): THREE.Group {
    return this.view.group
  }

  get won(): boolean {
    return this.st.outcome === 'won'
  }

  get catches(): number {
    return this.st.catches
  }

  get dangerLevel(): number {
    return this.st.outcome === 'racing' ? this.danger : 0
  }

  reset(playerS: number): void {
    this.st = newBoss(this.cfg, playerS)
    this.danger = 0
    this.recorded = false
  }

  showMeter(hud: RaceHud): void {
    this.meter = hud.meter('SÜPÜRGE', VACUUM_COLOR)
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

  record(won: boolean): void {
    if (this.recorded) return
    this.recorded = true
    try {
      localStorage.setItem(DEFEATS_KEY + this.cupId, String(won ? 0 : defeats(this.cupId) + 1))
    } catch {
      // Private mode: the easy vacuum is simply not remembered.
    }
  }

  /** The vacuum is drawn no closer than VIEW_GAP behind the player so it never swallows the camera. */
  update(t: number, dt: number, kt: KurguTrack, playerS: number): void {
    this.view.update(t, dt, Math.min(this.st.s, playerS - VIEW_GAP), this.dangerLevel, kt.main)
  }

  dot(len: number): { id: string; progress: number; color: string } {
    return { id: 'vacuum', progress: Math.max(0, this.st.s / len), color: VACUUM_COLOR }
  }

  dispose(): void {
    this.view.dispose()
  }
}
