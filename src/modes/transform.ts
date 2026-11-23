/**
 * Dönüşüm Kupası (Uçan Adalar) as a RaceMode: one track of the floating islands, the player's
 * transforming car, five Kupa Pilotları ghosts (or the Dev Balina Dalgası on boss races), and
 * the routing of physics events to the HUD, effects, audio, camera and slow motion.
 */
import * as THREE from 'three'
import { CarView } from '../game/car'
import { ChaseCamera } from '../game/chaseCamera'
import { Fx } from '../game/fx'
import { GhostViews, type GhostRacer } from '../game/ghosts'
import { loadBest, saveBest, type PlayerBest } from '../game/bestGhost'
import { TimeScale } from '../game/timeScale'
import { FORM_FOR } from '../sim/forms'
import { GhostRecorder, fxOf, type Ghost } from '../sim/ghost'
import { PLAYER_SLOT } from '../sim/grid'
import { formHint } from '../sim/hint'
import { PILOTS } from '../sim/pilots'
import { RaceClock, standings } from '../sim/race'
import { newRacer, stepRacer, type RacerEvent, type RacerState } from '../sim/racer'
import { pickRivals } from '../sim/rivals'
import { buildTrack, type Track } from '../sim/track'
import { adalarTrack } from '../sim/tracks/index'
import { FORM_UI } from '../ui/hud'
import type { FormButtons } from '../ui/raceHud'
import { buildAdalarWorld, type AdalarWorld } from '../worlds/adalar/index'
import { disposeScene, loadGhosts } from './assets'
import { TransformBoss } from './transformBoss'
import { transformStars } from './transformRules'
import type { ModeDev, RaceContext, RearView, RaceMode, RaceOutcome, RaceSpec, ResultRow } from './types'

const ROCKET_SPEED = 0.8
const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`

const fwd = new THREE.Vector3()
const up = new THREE.Vector3()

class TransformMode implements RaceMode {
  readonly scene = new THREE.Scene()
  private readonly clock = new RaceClock()
  private time = new TimeScale()
  private readonly car: CarView
  private readonly fx: Fx
  private readonly cam: ChaseCamera
  private readonly forms: FormButtons
  private st: RacerState
  private ghostViews: GhostViews | null = null
  private recorder = new GhostRecorder()
  private best: PlayerBest | null
  private lastCount = -1
  private perfects = 0
  private throttle = 0
  private elapsed = 0
  private result: RaceOutcome | null = null
  private readonly rearCam = new THREE.PerspectiveCamera(70, 2, 0.5, 4000)
  private rearAmt = 0
  private done = false

  constructor(
    private readonly ctx: RaceContext,
    private readonly spec: RaceSpec,
    private readonly track: Track,
    private readonly world: AdalarWorld,
    private readonly ghosts: readonly Ghost[],
    private readonly boss: TransformBoss | null,
    private readonly rocketStart: () => boolean,
  ) {
    this.scene.add(world.group)
    world.attach(this.scene)
    if (boss !== null) this.scene.add(boss.group)
    this.car = new CarView(ctx.playerCar.model, PLAYER_COLOR, { shadows: ctx.renderer.shadowMap.enabled })
    this.rearCam.userData.noFollow = true
    // The look recolours the body only: the transform parts keep their own flashing materials.
    ctx.playerCar.applyLook?.(this.car.bodyModel)
    this.scene.add(this.car.root)
    this.fx = new Fx(this.scene, ctx.camera, ctx.quality)
    this.fx.setTrail(ctx.playerCar.trail ?? null)
    this.cam = new ChaseCamera(ctx.camera)
    this.best = boss === null ? loadBest(track.def.id) : null
    this.st = newRacer(track, PLAYER_SLOT.s, PLAYER_SLOT.d)
    this.forms = ctx.hud.formButtons((f) => ctx.input.pressForm?.(f))
    this.place()
    this.cam.snap()
    this.cam.update(this.car.worldPos, fwd, up, this.st, 1 / 60)
  }

  get finished(): boolean {
    return this.done
  }

  get goals(): readonly [string, string, string] {
    return transformStars({ boss: this.boss !== null, place: 1, coins: 0, totalCoins: this.track.def.coins.length, perfects: 0, catches: 0, bossWon: false }).labels
  }

  /** Boss races: a rear-view mirror fades in while the wave closes in. */
  get rear(): RearView | null {
    return this.boss === null ? null : { camera: this.rearCam, amount: this.rearAmt }
  }

  /** Dev hooks (autopilot, teleport): the live track and racer state. */
  get dev(): ModeDev {
    const mode = this
    return {
      track: this.track,
      get state() {
        return mode.st
      },
      teleport: (s: number) => mode.respawnAt(s),
    }
  }

  start(): void {
    const { ctx, track } = this
    this.st = newRacer(track, PLAYER_SLOT.s, PLAYER_SLOT.d)
    this.recorder = new GhostRecorder()
    this.lastCount = -1
    this.perfects = 0
    this.result = null
    this.done = false
    this.rearAmt = 0
    this.time = new TimeScale()
    this.elapsed = 0
    this.ghostViews?.dispose(this.scene)
    this.ghostViews = this.boss === null ? new GhostViews(this.scene, this.rivals()) : null
    this.boss?.reset(this.st.s)
    this.world.resetCoins()
    this.fx.reset()
    ctx.hud.setModePanel(this.forms.el)
    this.forms.setActive(this.st.form)
    if (this.boss !== null) this.boss.showMeter(ctx.hud)
    this.cam.snap()
    this.clock.start()
  }

  restart(): void {
    this.start()
  }

  pause(on: boolean): void {
    if (on) this.ctx.audio.idle()
  }

  private rivals(): GhostRacer[] {
    const picks = pickRivals(this.ghosts.map((g) => ({ id: g.id, time: g.time })), this.spec.firstRace ? null : (this.best?.ghost.time ?? null))
    const racers: GhostRacer[] = picks.map((p) => {
      const g = this.ghosts.find((x) => x.id === p.id) as Ghost
      const pilot = PILOTS.find((x) => x.id === g.id)
      return { ghost: g, stretch: p.stretch, name: pilot?.name ?? g.pilot, badge: pilot?.badge ?? '🏎️', color: pilot?.color ?? g.color, pilot: true, model: this.ctx.modelFor(g.car) }
    })
    if (!this.spec.firstRace && this.best !== null && racers.length > 0) {
      // The player's own record replaces the slowest pilot.
      racers.sort((a, b) => a.ghost.time * a.stretch - b.ghost.time * b.stretch)
      racers[racers.length - 1] = { ghost: this.best.ghost, stretch: 1, name: 'Senin rekorun', badge: '👻', color: 0xffffff, pilot: false, model: this.ctx.modelFor('rt40') }
    }
    return racers
  }

  frame(realDt: number): void {
    const { ctx, track } = this
    const dt = this.time.step(realDt)
    this.elapsed += dt
    const raceDt = this.clock.tick(dt)
    const phase = this.clock.phase
    if (phase === 'countdown') {
      const n = this.clock.countdown
      if (n !== this.lastCount) {
        this.lastCount = n
        ctx.hud.countdown(n)
        ctx.audio.countdown(n)
      }
      this.throttle = ctx.input.read(dt).throttle
    } else if (phase === 'racing' && !this.done) {
      if (this.lastCount !== 0) this.go()
      const inp = ctx.input.read(raceDt)
      this.throttle = inp.throttle
      const r = stepRacer(this.st, inp, ctx.playerCar.params, track, raceDt)
      this.st = r.st
      this.recorder.push(this.st)
      for (const e of r.events) this.onEvent(e)
      if (this.boss !== null && !this.done) this.stepBoss(raceDt)
      this.forms.setActive(this.st.form)
      this.forms.hint(this.spec.firstRace || ctx.settings().formHints ? formHint(this.st, track) : null)
    }
    this.place(dt)
    const raceT = this.clock.raceT
    this.ghostViews?.update(raceT, track, this.car.worldPos, dt, this.cam.position)
    this.boss?.update(this.elapsed, this.st.s)
    this.world.update(this.elapsed, this.st.s, this.st.speed)
    this.fx.update(dt, this.car.worldPos, fwd, this.st)
    ctx.audio.update(this.st, phase === 'racing' ? this.throttle : this.throttle * 0.5)
    this.cam.update(this.car.worldPos, fwd, up, this.st, dt)
    if (this.boss !== null) this.updateRear(dt)
    if (phase !== 'intro') this.updateHud(raceT)
  }

  private updateRear(dt: number): void {
    const want = this.boss !== null && !this.done && this.clock.phase === 'racing' && this.boss.dangerLevel > 0.3 ? 1 : 0
    this.rearAmt += (want - this.rearAmt) * Math.min(1, 5 * dt)
    const p = this.car.worldPos
    this.rearCam.position.copy(p).addScaledVector(fwd, 2).addScaledVector(up, 3.2)
    this.rearCam.up.copy(up)
    this.rearCam.lookAt(p.x - fwd.x * 22 + up.x * 3, p.y - fwd.y * 22 + up.y * 3, p.z - fwd.z * 22 + up.z * 3)
  }

  /** GO: the HUD and audio cue, and the rocket start bought on the intro card. */
  private go(): void {
    this.lastCount = 0
    this.ctx.hud.countdown(0)
    this.ctx.audio.countdown(0)
    if (this.rocketStart() || this.ctx.perks?.().rocketStart === true) {
      this.st = { ...this.st, speed: this.ctx.playerCar.params.vmax * ROCKET_SPEED }
      this.ctx.hud.pop('ROKET START!', 'gold')
      this.cam.shake(0.4)
      this.time.trigger()
    }
  }

  private stepBoss(dt: number): void {
    const boss = this.boss as TransformBoss
    for (const e of boss.step(this.st, dt)) {
      if (e.kind === 'near') this.ctx.hud.pop('Dalga geliyor!', 'bad')
      else if (e.kind === 'checkpoint') this.ctx.hud.pop('Kontrol noktası!', 'soft')
      else if (e.kind === 'easy') this.ctx.hud.pop('Balina biraz yavaşladı', 'soft')
      else if (e.kind === 'caught') {
        this.ctx.hud.pop('Dalga yakaladı!', 'bad')
        this.ctx.hud.flash('#4fc3ff')
        this.cam.shake(0.7)
        this.respawnAt(e.respawnS)
      }
    }
  }

  private respawnAt(s: number): void {
    this.st = { ...this.st, s, d: 0, y: 0, vy: 0, speed: 0, airborne: false, yaw: 0, form: FORM_FOR[this.track.surfaceAt(s)] }
    this.cam.snap()
  }

  /** Places the player's car and refreshes the shared forward/up vectors. */
  private place(dt = 1 / 60): void {
    const f = this.track.frameAt(this.st.s)
    const c = Math.cos(this.st.yaw)
    const s = Math.sin(this.st.yaw)
    fwd.set(f.t.x * c + f.left.x * s, f.t.y * c + f.left.y * s, f.t.z * c + f.left.z * s).normalize()
    up.set(f.up.x, f.up.y, f.up.z)
    this.car.update({ s: this.st.s, d: this.st.d, y: this.st.y, yaw: this.st.yaw, form: this.st.form, speed: this.st.speed, fx: fxOf(this.st), surface: this.st.surface, formT: this.st.formT }, this.track, dt)
  }

  private onEvent(e: RacerEvent): void {
    const { hud, audio } = this.ctx
    this.fx.onEvent(e, this.car.worldPos)
    audio.onEvent(e)
    switch (e.kind) {
      case 'perfect': {
        this.perfects++
        const combo = e.value ?? 1
        hud.pop(combo >= 2 ? `MÜKEMMEL! ×${combo}` : 'MÜKEMMEL!', combo >= 3 ? 'combo' : 'perfect')
        hud.flash(FORM_UI[this.st.form].color)
        this.cam.shake(0.25)
        if (this.perfects === 1) this.time.trigger()
        break
      }
      case 'early': hud.pop('Erken', 'soft'); break
      case 'late': hud.pop('Geç!', 'bad'); break
      case 'wrongForm': hud.pop(`${FORM_UI[FORM_FOR[this.st.surface]].icon} Yanlış form!`, 'bad'); break
      case 'boost': hud.pop('HIZ!', 'soft'); break
      case 'jump': if ((e.value ?? 0) > 25) this.time.trigger(); break
      case 'land': this.cam.shake(Math.min(0.8, (e.value ?? 0) * 0.08)); break
      case 'wall': this.cam.shake(Math.min(0.6, (e.value ?? 0) * 0.02)); break
      case 'fall': hud.pop('Düştün!', 'bad'); break
      case 'respawn': this.cam.snap(); break
      case 'coin': this.world.collectCoin(e.value ?? -1); break
      case 'finish': this.onFinish(); break
      default: break
    }
  }

  private onFinish(): void {
    this.clock.finish()
    this.forms.hint(null)
    this.boss?.finish()
    let newBest = false
    if (this.boss === null) {
      const ghost = this.recorder.finish({ id: 'you', pilot: 'Sen', car: 'rt40', color: PLAYER_COLOR, time: this.st.time }, this.st)
      if (this.best === null || ghost.time < this.best.ghost.time) {
        newBest = true
        this.best = { ghost: { ...ghost, id: 'you-best' } }
        saveBest(this.track.def.id, ghost)
      }
    }
    this.result = this.outcome0(newBest)
    this.done = true
  }

  private order(raceT: number): string[] {
    const entries = [{ id: 'you', s: this.st.s, finishedAt: this.st.finished ? this.st.time : null }, ...(this.ghostViews?.positions(raceT) ?? [])]
    return standings(entries)
  }

  private updateHud(raceT: number): void {
    const len = this.track.length
    const racers = this.ghostViews?.racers ?? []
    const pos = this.ghostViews?.positions(raceT) ?? []
    const order = this.order(raceT)
    const rivals = racers.map((r, i) => ({ id: r.ghost.id, progress: (pos[i]?.s ?? 0) / len, color: hex(r.color) }))
    if (this.boss !== null) rivals.push(this.boss.dot(len))
    this.ctx.hud.update({
      place: this.boss !== null ? 1 : order.indexOf('you') + 1,
      of: this.boss !== null ? 1 : order.length,
      time: this.st.time,
      kmh: this.st.speed * 3.6,
      coins: this.st.coins,
      progress: Math.max(0, Math.min(1, this.st.s / len)),
      rivals,
      combo: this.st.combo,
    })
  }

  private outcome0(newBest: boolean): RaceOutcome {
    const racers = this.ghostViews?.racers ?? []
    const finishOf = (id: string): number => {
      if (id === 'you') return this.st.time
      const r = racers.find((x) => x.ghost.id === id)
      return r === undefined ? Infinity : r.ghost.time * r.stretch
    }
    const ids = ['you', ...racers.map((r) => r.ghost.id)].sort((a, b) => finishOf(a) - finishOf(b))
    const rows: ResultRow[] = ids.map((id) => {
      if (id === 'you') return { name: 'Sen', badge: '⭐', time: this.st.time, you: true, pilot: false }
      const r = racers.find((x) => x.ghost.id === id) as GhostRacer
      return { name: r.name, badge: r.badge, time: r.ghost.time * r.stretch, you: false, pilot: r.pilot }
    })
    const boss = this.boss
    const bossWon = boss?.won ?? false
    const place = boss !== null ? (bossWon ? 1 : 2) : ids.indexOf('you') + 1
    const { stars, labels } = transformStars({
      boss: boss !== null, place, coins: this.st.coins, totalCoins: this.track.def.coins.length, perfects: this.perfects, catches: boss?.catches ?? 0, bossWon,
    })
    if (boss !== null) boss.record(bossWon)
    return {
      place, of: boss !== null ? 2 : ids.length, time: this.st.time, coins: this.st.coins, stars, starLabels: labels,
      bossBeaten: boss !== null ? bossWon : undefined,
      extra: { perfects: this.perfects, bestCombo: this.st.bestCombo, newBest: newBest ? 1 : 0, catches: boss?.catches ?? 0 },
      rows: boss !== null ? [{ name: 'Sen', badge: '⭐', time: this.st.time, you: true, pilot: false }, { name: 'Dev Balina Dalgası', badge: '🐋', time: null, you: false, pilot: false }] : rows,
    }
  }

  outcome(): RaceOutcome | null {
    return this.result
  }

  dispose(): void {
    this.ghostViews?.dispose(this.scene)
    this.car.dispose()
    this.boss?.dispose()
    this.world.dispose()
    this.ctx.hud.setModePanel(null)
    disposeScene(this.scene)
  }
}

const PLAYER_COLOR = 0xffd23f

export async function createTransformMode(ctx: RaceContext, spec: RaceSpec, rocketStart: () => boolean = () => false): Promise<RaceMode> {
  const track = buildTrack(adalarTrack(spec.trackId, spec.variant))
  const [world, ghosts, boss] = await Promise.all([
    buildAdalarWorld(track, ctx.quality, spec.variant),
    spec.boss ? Promise.resolve([]) : loadGhosts(track.def.id),
    spec.boss ? TransformBoss.create(track, ctx.quality, spec.cupId) : Promise.resolve(null),
  ])
  return new TransformMode(ctx, spec, track, world, ghosts, boss, rocketStart)
}
