/**
 * One race from the app's side: build (loading card) → intro card over the live scene →
 * countdown + HUD → finish → results → next. Handles pause (player, modal, hidden tab,
 * portrait phone), the ad flow (gameplayStart/Stop, commercial breaks) and saving the result.
 *
 * Contract notes for modes: frame() is also called before start() (intro card, attract view)
 * and after `finished` (victory roll behind the results); both must be safe.
 */
import type * as THREE from 'three'
import { carById, effectiveStats } from '../meta/catalog'
import { cupById, raceById, type WorldId } from '../meta/cups'
import { canTryCar, dayKey, useCarTrial } from '../meta/daily'
import { applyRaceResult } from '../meta/rewards'
import { equippedMods } from '../meta/shop'
import type { RaceMode, RaceOutcome, RaceSpec } from '../modes/types'
import type { RaceHudExt } from '../ui/hudRace'
import type { RaceKit, RewardReason } from './appTypes'
import { applyCarLook, lookOf } from './carLook'
import { openPauseModal } from './modals'
import type { Ctx, Screen } from './screen'
import { raceIntroScreen, raceLoadingScreen, raceOverlayScreen } from './screens/race'
import { resultsScreen } from './screens/results'

type Phase = 'idle' | 'loading' | 'intro' | 'racing' | 'finishing' | 'results'

/** Seconds the finish keeps rolling before the results card. */
const FINISH_HOLD = 1.6

export class RaceFlow {
  lastWorld: WorldId | null = null
  private phase: Phase = 'idle'
  private mode: RaceMode | null = null
  private raceId = ''
  private world: WorldId = 'adalar'
  private paused = false
  /** What the mode was last told through pause() (engine sound, mode sfx). */
  private halted = false
  private forced = false
  private holdT = 0
  private rocket = false
  private closePause: (() => void) | null = null
  private token = 0

  constructor(
    private readonly ctx: Ctx,
    private readonly hud: RaceHudExt,
    private readonly setScreen: (s: Screen) => void,
  ) {}

  /** A race scene is on screen (intro, racing, results): the app renders it instead of the showroom. */
  get active(): boolean {
    return this.mode !== null && this.phase !== 'idle' && this.phase !== 'loading'
  }

  async play(raceId: string, trialCar?: string): Promise<void> {
    const race = raceById(raceId)
    const cup = race === undefined ? undefined : cupById(race.cup)
    if (race === undefined || cup === undefined) {
      this.ctx.toast('Bu yarış bulunamadı', 'flag')
      this.ctx.go({ name: 'home' })
      return
    }
    this.dispose()
    const token = ++this.token
    this.phase = 'loading'
    this.raceId = raceId
    this.world = cup.world
    this.lastWorld = cup.world
    this.setScreen(raceLoadingScreen(this.ctx, race, cup))
    const d = this.ctx.deps
    let save = this.ctx.save()
    let carId = save.car
    if (trialCar !== undefined && carById(trialCar) !== undefined && canTryCar(save, dayKey(new Date(this.ctx.now())))) {
      save = this.ctx.update((s) => useCarTrial(s, dayKey(new Date(this.ctx.now()))))
      carId = trialCar
    }
    const car = carById(carId) ?? carById(save.car)!
    const look = lookOf(car, equippedMods(save, save.owned.includes(car.id) ? car.id : save.car))
    const spec: RaceSpec = { raceId, cupId: cup.id, trackId: race.trackId, variant: race.variant, boss: race.boss, world: cup.world, firstRace: save.firstRun }
    this.rocket = false
    const kit: RaceKit = {
      hud: this.hud,
      input: d.input,
      camera: d.camera,
      settings: () => this.ctx.settings(),
      car,
      look,
      applyLook: (model: THREE.Object3D) => applyCarLook(model, look),
      stats: effectiveStats(car, save.perf[car.id] ?? {}),
      rewarded: (reason: RewardReason) => this.modeRewarded(reason),
      perks: () => ({ rocketStart: this.rocket }),
    }
    let mode: RaceMode
    try {
      mode = await d.createRace(spec, kit)
    } catch (error) {
      console.error('Race could not be built:', error)
      if (token !== this.token) return
      this.phase = 'idle'
      this.ctx.toast('Yarış yüklenemedi, tekrar dene', 'flag')
      this.ctx.go({ name: 'home' })
      return
    }
    if (token !== this.token) {
      mode.dispose()
      return
    }
    this.mode = mode
    this.phase = 'intro'
    d.input.enabled = false
    this.hud.hide()
    this.setScreen(raceIntroScreen(this.ctx, race, cup, save.firstRun, {
      start: (rocket) => {
        this.rocket = rocket
        this.begin()
      },
      back: () => this.leave({ name: 'cupMap', world: cup.world, tier: cup.tier }),
      goals: mode.goals,
    }))
  }

  private begin(): void {
    const mode = this.mode
    if (mode === null) return
    const d = this.ctx.deps
    this.phase = 'racing'
    this.paused = false
    this.hud.show(this.world)
    d.input.clear()
    d.input.enabled = true
    this.setScreen(raceOverlayScreen(this.ctx, this.ctx.save().firstRun, () => this.togglePause()))
    d.music?.('race')
    mode.start()
    d.ads.gameplayStart()
  }

  frame(dt: number): void {
    const mode = this.mode
    if (mode === null) return
    const running = this.phase === 'racing' || this.phase === 'finishing'
    const halted = running && (this.paused || this.forced)
    if (halted !== this.halted) {
      this.halted = halted
      mode.pause?.(halted)
    }
    if (!halted) mode.frame(dt)
    if (this.phase === 'racing' && mode.finished) {
      this.phase = 'finishing'
      this.holdT = 0
      this.ctx.deps.input.enabled = false
      this.ctx.deps.ads.gameplayStop()
    } else if (this.phase === 'finishing') {
      this.holdT += dt
      if (this.holdT >= FINISH_HOLD) this.showResults()
    }
    const d = this.ctx.deps
    if (d.render !== undefined) d.render(mode.scene, d.camera)
    else d.renderer.render(mode.scene, d.camera)
  }

  private showResults(): void {
    const mode = this.mode
    if (mode === null) return
    this.phase = 'results'
    const outcome: RaceOutcome = mode.outcome() ?? { place: 6, of: 6, time: 0, coins: 0, stars: [false, false, false], starLabels: ['Birinci bitir', 'Gizli parçayı bul', 'Pist görevi'], rows: [] }
    const race = raceById(this.raceId)!
    const firstRun = this.ctx.save().firstRun
    const before = this.ctx.save()
    const res = applyRaceResult(before, { place: outcome.place, coins: outcome.coins, stars: outcome.stars, raceId: this.raceId, cupId: race.cup, bossBeaten: outcome.bossBeaten, time: outcome.time }, { now: this.ctx.now() })
    this.ctx.update(() => res.save)
    this.hud.hide()
    const cup = cupById(race.cup)!
    this.setScreen(resultsScreen(this.ctx, { raceId: this.raceId, outcome, breakdown: res.breakdown, goldBefore: before.gold, firstRun }, {
      retry: () => this.breakThen(() => this.retry()),
      next: (raceId) => this.breakThen(() => void this.play(raceId)),
      map: () => this.breakThen(() => this.leave({ name: 'cupMap', world: cup.world, tier: cup.tier })),
      garage: (gift) => this.breakThen(() => this.leave({ name: 'garage', tab: gift === undefined ? 'cars' : 'look', gift })),
    }))
  }

  private retry(): void {
    if (this.mode === null) return
    // begin() calls mode.start(), which resets the race; a rocket start is bought per race.
    this.rocket = false
    this.begin()
  }

  private breakThen(fn: () => void): void {
    void this.ctx.deps.ads.commercialBreak().catch(() => undefined).then(fn)
  }

  private leave(route: Parameters<Ctx['go']>[0]): void {
    this.dispose()
    this.ctx.go(route)
  }

  togglePause(): void {
    if (this.phase !== 'racing') return
    if (this.paused) {
      this.closePause?.()
      return
    }
    this.paused = true
    this.ctx.deps.input.clear()
    this.ctx.deps.ads.gameplayStop()
    this.closePause = openPauseModal(this.ctx, {
      resume: () => undefined,
      restart: () => {
        this.paused = false
        this.retry()
      },
      quit: () => {
        const cup = cupById(raceById(this.raceId)?.cup ?? '')
        this.leave(cup === undefined ? { name: 'home' } : { name: 'cupMap', world: cup.world, tier: cup.tier })
      },
      closed: () => {
        this.closePause = null
        if (!this.paused || this.phase !== 'racing') return
        this.paused = false
        this.ctx.deps.ads.gameplayStart()
      },
    })
  }

  /** Pause forced by modals, hidden tab or portrait phone (no menu). */
  autoPause(on: boolean): void {
    this.forced = on
  }

  private async modeRewarded(reason: RewardReason): Promise<boolean> {
    const was = this.forced
    this.forced = true
    try {
      return await this.ctx.rewarded(reason)
    } finally {
      this.forced = was
    }
  }

  dispose(): void {
    this.token++
    const wasRacing = this.phase === 'racing'
    this.phase = 'idle'
    this.closePause?.()
    if (this.mode !== null) {
      try {
        this.mode.dispose()
      } catch (error) {
        console.error('Race dispose failed:', error)
      }
    }
    if (wasRacing) this.ctx.deps.ads.gameplayStop()
    this.mode = null
    this.paused = false
    this.ctx.deps.input.enabled = false
    this.hud.hide()
  }
}
