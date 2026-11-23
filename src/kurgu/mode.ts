/**
 * Kurgu Kupası (Dev Ev) as a RaceMode: a bare toy car races through the giant house, clicking
 * on toy parts from the pickup lanes; gates ahead need the right part (or take the slow
 * detour), combos go into the album, hard hits knock parts off. Five Kupa Pilotları ghosts
 * race too — or, on the boss race, the Robot Süpürge chases.
 */
import * as THREE from 'three'
import { ChaseCamera } from '../game/chaseCamera'
import { Fx } from '../game/fx'
import { TimeScale } from '../game/timeScale'
import { FX_BOOST, FX_TURBO, fxOf } from '../sim/ghost'
import { PLAYER_SLOT } from '../sim/grid'
import { RaceClock, standings } from '../sim/race'
import { disposeScene } from '../modes/assets'
import type { ModeDev, RaceContext, RaceMode, RaceModeFactory, RaceOutcome, RaceSpec, RearView } from '../modes/types'
import { BossRun } from './bossRun'
import { feedback, type FeedbackDeps } from './feedback'
import { kurguOutcome } from './outcome'
import { recordCombos } from './sim/album'
import { kurguStars } from './sim/stars'
import { KurguRecorder } from './sim/kurguGhost'
import { newKurgu, PICK_R, resetKurguTo, stepKurgu, type KurguState } from './sim/kurguRacer'
import { buildKurguTrack, type KurguTrack } from './sim/kurguTrack'
import { hasPart, SLOTS, type PartId, type Slot } from './sim/parts'
import { BOSS_CHECKPOINTS, kurguDefFor } from './tracks'
import { createPartAssets, KurguCar, type PartAssets } from './view/kurguCar'
import { createPartPanel, type PartPanel } from './view/panel'
import { chooseRivals, detourOffset, loadBest, pilotGhosts, RivalViews, saveBest, type KurguRival } from './view/rivals'
import { buildDevEvWorld, type DevEvWorld } from './world'

/** Optional extra the app may pass: parts kept in the garage's starting slot (spec §9.2). */
export interface KurguContext extends RaceContext {
  readonly kurguStartParts?: readonly PartId[]
}

const PLAYER_COLOR = 0xffd23f
const GATE_LOOK = 420
const fwd = new THREE.Vector3()
const up = new THREE.Vector3()
const off = new THREE.Vector3()
const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`

class KurguMode implements RaceMode {
  readonly scene = new THREE.Scene()
  private readonly clock = new RaceClock()
  private readonly time = new TimeScale()
  private readonly car: KurguCar
  private readonly fx: Fx
  private readonly cam: ChaseCamera
  private readonly panel: PartPanel
  private readonly fb: FeedbackDeps
  private k: KurguState
  private views: RivalViews | null = null
  private rivals: KurguRival[] = []
  private recorder = new KurguRecorder()
  private lastCount = -1
  private throttle = 0
  private elapsed = 0
  private result: RaceOutcome | null = null
  private done = false
  private dropsKey = ''
  private readonly rearCam = new THREE.PerspectiveCamera(70, 2, 0.5, 900)
  private rearAmt = 0

  constructor(
    private readonly ctx: KurguContext,
    private readonly spec: RaceSpec,
    private readonly kt: KurguTrack,
    private readonly world: DevEvWorld,
    private readonly ghosts: ReturnType<typeof pilotGhosts>,
    private readonly boss: BossRun | null,
    private readonly assets: PartAssets,
  ) {
    this.scene.add(world.group)
    if (boss !== null) this.scene.add(boss.group)
    this.car = new KurguCar(ctx.playerCar.model, PLAYER_COLOR, assets, this.scene, { shadows: ctx.renderer.shadowMap.enabled, rolling: true })
    ctx.playerCar.applyLook?.(this.car.view.bodyModel)
    this.scene.add(this.car.root)
    this.fx = new Fx(this.scene, ctx.camera, ctx.quality)
    this.fx.setTrail(ctx.playerCar.trail ?? null)
    this.cam = new ChaseCamera(ctx.camera)
    this.panel = createPartPanel()
    this.fb = { hud: ctx.hud, audio: ctx.audio, fx: this.fx, cam: this.cam, time: this.time, world, panel: this.panel, kt }
    this.k = this.fresh()
    world.items.reset(this.k.r.s)
    this.place(1 / 60)
    this.cam.snap()
    this.cam.update(this.car.worldPos, fwd, up, this.k.r, 1 / 60)
  }

  private fresh(): KurguState {
    return newKurgu(this.kt, PLAYER_SLOT.s, PLAYER_SLOT.d, this.ctx.kurguStartParts ?? [])
  }

  /** The three star goals for the intro card. */
  get goals(): readonly [string, string, string] {
    const zero = { place: 0, hidden: false, combos: 0, gatesOk: 0, gatesTotal: this.kt.def.gates.length, coins: 0, knocks: 0, smashes: 0, catches: 0 }
    return kurguStars(this.kt.def.challenge, zero, this.boss !== null).labels
  }

  get finished(): boolean {
    return this.done
  }

  get rear(): RearView | null {
    return this.boss === null ? null : { camera: this.rearCam, amount: this.rearAmt }
  }

  get dev(): ModeDev & { readonly kurgu: KurguState; readonly kt: KurguTrack } {
    const mode = this
    return {
      track: this.kt.main,
      kt: this.kt,
      get state() { return mode.k.r },
      get kurgu() { return mode.k },
      teleport: (s: number) => {
        mode.k = resetKurguTo(mode.k, mode.kt, s, 30)
        mode.cam.snap()
      },
    }
  }

  start(): void {
    const { ctx } = this
    this.k = this.fresh()
    this.recorder = new KurguRecorder()
    this.lastCount = -1
    this.result = null
    this.done = false
    this.views?.dispose()
    this.rivals = this.boss === null ? chooseRivals(this.ghosts, loadBest(this.kt.def.id), this.spec.firstRace) : []
    this.views = this.boss === null ? new RivalViews(this.scene, this.rivals, ctx.modelFor, this.assets) : null
    this.boss?.reset(this.k.r.s)
    this.world.pickups.reset()
    this.world.items.reset(this.k.r.s)
    this.fx.reset()
    ctx.hud.setModePanel(this.panel.el)
    this.car.setParts(this.slots(), false)
    this.panel.setSlots(this.slots(), null, null)
    if (this.boss !== null) this.boss.showMeter(ctx.hud)
    this.cam.snap()
    this.clock.start()
  }

  restart(): void {
    this.start()
  }

  /** The app paused (menu, ad, hidden tab) or resumed the race: silence the engine loop. */
  pause(on: boolean): void {
    if (on) this.ctx.audio.idle()
  }

  private slots(): Record<Slot, { id: PartId; shiny: boolean } | null> {
    const lo = this.k.lo
    return { front: lo.front, side: lo.side, back: lo.back, wheels: lo.wheels }
  }

  frame(realDt: number): void {
    const { ctx } = this
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
      if (this.lastCount !== 0) {
        this.lastCount = 0
        ctx.hud.countdown(0)
        ctx.audio.countdown(0)
        // Rocket start bought on the intro card (rewarded video).
        if (ctx.perks?.().rocketStart === true) {
          this.k = { ...this.k, r: { ...this.k.r, speed: ctx.playerCar.params.vmax * 0.8 } }
          ctx.hud.pop('ROKET START!', 'gold')
          this.cam.shake(0.4)
        }
      }
      this.race(raceDt)
    }
    this.place(dt)
    const raceT = this.clock.raceT
    this.views?.update(raceT, this.kt, this.car.worldPos, dt, this.cam.position)
    this.boss?.update(this.elapsed, dt, this.kt, this.k.r.s)
    this.world.update(this.elapsed, dt, ctx.camera, this.car.worldPos, this.k.r.s)
    this.fx.update(dt, this.car.worldPos, fwd, this.k.r)
    ctx.audio.update(this.k.r, phase === 'racing' ? this.throttle : this.throttle * 0.5)
    this.cam.update(this.car.worldPos, fwd, up, this.k.r, dt)
    if (this.boss !== null) this.updateRear(dt)
    if (phase !== 'intro') this.updateHud(raceT)
  }

  private race(dt: number): void {
    const inp = this.ctx.input.read(dt)
    this.throttle = inp.throttle
    const before = this.k
    const r = stepKurgu(before, inp, this.ctx.playerCar.params, this.kt, dt)
    this.k = r.st
    this.recorder.push(this.k)
    for (let row = before.nextRow; row < this.k.nextRow; row++) {
      const lanes = this.kt.def.rows[row].lanes
      const took = r.events.some((e) => e.kind === 'pickup') ? lanes.findIndex((l) => Math.abs(l.d - this.k.r.d) < PICK_R + 0.6) : -1
      this.world.pickups.passRow(row, took < 0 ? null : took)
    }
    let popped: Slot | null = null
    let lost: Slot | null = null
    for (const e of r.events) {
      feedback(this.fb, e, this.car.worldPos, fwd)
      if (e.kind === 'pickup' && e.part !== undefined) popped = SLOTS.find((s) => this.k.lo[s]?.id === e.part) ?? null
      if (e.kind === 'knock') lost = SLOTS.find((s) => before.lo[s]?.id === e.part) ?? null
      if (e.kind === 'finish') this.onFinish()
    }
    if (popped !== null || lost !== null) {
      this.car.setParts(this.slots(), true)
      this.panel.setSlots(this.slots(), popped, lost)
    }
    const dk = this.k.drops.map((x) => `${x.part}${x.s}`).join()
    if (dk !== this.dropsKey) {
      this.dropsKey = dk
      this.world.pickups.setDrops(this.k.drops)
    }
    if (this.boss !== null && !this.done) this.stepBoss(dt)
    this.gateChip()
  }

  private gateChip(): void {
    const s = this.k.r.s
    const g = this.kt.def.gates.find((x) => x.s1 > s && x.s0 - s < GATE_LOOK && this.k.route?.gate !== x.index)
    if (g === undefined) return this.panel.setGate(null, null, false)
    const ready = hasPart(this.k.lo, g.need) || (g.kind === 'water' && hasPart(this.k.lo, 'propeller'))
    this.panel.setGate(g.kind, g.need, ready)
  }

  private stepBoss(dt: number): void {
    const boss = this.boss as BossRun
    for (const e of boss.step(this.k.r, dt)) {
      if (e.kind === 'near') this.ctx.hud.pop('Süpürge geliyor!', 'bad')
      else if (e.kind === 'checkpoint') this.ctx.hud.pop('Kontrol noktası!', 'soft')
      else if (e.kind === 'easy') this.ctx.hud.pop('Süpürge biraz yavaşladı', 'soft')
      else if (e.kind === 'caught') {
        this.ctx.hud.pop('Süpürge yakaladı!', 'bad')
        this.ctx.hud.flash(hex(0x9b8cff))
        this.cam.shake(0.8)
        this.k = resetKurguTo(this.k, this.kt, e.respawnS, 0)
        this.world.pickups.reset()
        for (let row = 0; row < this.k.nextRow; row++) this.world.pickups.passRow(row, null)
        this.cam.snap()
      }
    }
  }

  private updateRear(dt: number): void {
    const want = !this.done && this.clock.phase === 'racing' && (this.boss?.dangerLevel ?? 0) > 0.3 ? 1 : 0
    this.rearAmt += (want - this.rearAmt) * Math.min(1, 5 * dt)
    const p = this.car.worldPos
    this.rearCam.position.copy(p).addScaledVector(fwd, 2).addScaledVector(up, 3.2)
    this.rearCam.up.copy(up)
    this.rearCam.lookAt(p.x - fwd.x * 30 + up.x * 5, p.y - fwd.y * 30 + up.y * 5, p.z - fwd.z * 30 + up.z * 5)
  }

  /** Places the player's car (with its detour offset) and refreshes forward/up. */
  private place(dt: number): void {
    const st = this.k.r
    const f = this.kt.main.frameAt(st.s)
    const c = Math.cos(st.yaw)
    const s = Math.sin(st.yaw)
    fwd.set(f.t.x * c + f.left.x * s, f.t.y * c + f.left.y * s, f.t.z * c + f.left.z * s).normalize()
    up.set(f.up.x, f.up.y, f.up.z)
    const alt = this.k.route?.alt === true ? detourOffset(this.kt, st.s, [this.k.route.gate], off) : null
    const surface = st.surface === 'water' ? 'road' : st.surface
    const fx = fxOf(st)
    this.car.update({ s: st.s, d: st.d, y: st.y, yaw: st.yaw, form: 'car', speed: st.speed, fx, surface, formT: 0 }, this.kt.main, dt, alt, (fx & (FX_BOOST | FX_TURBO)) !== 0)
  }

  private onFinish(): void {
    this.clock.finish()
    this.boss?.finish()
    let newBest = false
    if (this.boss === null) {
      const kg = this.recorder.finish({ id: 'you', pilot: 'Sen', car: 'rt40', color: PLAYER_COLOR, time: this.k.r.time }, this.k.r)
      const best = loadBest(this.kt.def.id)
      if (best === null || kg.ghost.time < best.ghost.time) {
        newBest = true
        saveBest(this.kt.def.id, kg)
      }
    }
    const added = recordCombos(this.k.combos)
    if (this.boss !== null) this.boss.record(this.boss.won)
    this.result = kurguOutcome({
      k: this.k, rivals: this.rivals, challenge: this.kt.def.challenge, gatesTotal: this.kt.def.gates.length,
      boss: this.boss === null ? null : { won: this.boss.won, catches: this.boss.catches }, newBest, newCombos: added.length,
    })
    this.panel.setGate(null, null, false)
    this.done = true
  }

  private updateHud(raceT: number): void {
    const len = this.kt.length
    const pos = this.views?.positions(raceT) ?? []
    const rivals = this.rivals.map((r, i) => ({ id: r.kg.ghost.id, progress: (pos[i]?.s ?? 0) / len, color: hex(r.color) }))
    if (this.boss !== null) rivals.push(this.boss.dot(len))
    const order = standings([{ id: 'you', s: this.k.r.s, finishedAt: this.k.r.finished ? this.k.r.time : null }, ...pos])
    this.ctx.hud.update({
      place: this.boss !== null ? 1 : order.indexOf('you') + 1,
      of: this.boss !== null ? 1 : order.length,
      time: this.k.r.time,
      kmh: this.k.r.speed * 3.6,
      coins: this.k.r.coins,
      progress: Math.max(0, Math.min(1, this.k.r.s / len)),
      rivals,
      combo: this.k.combos.length,
    })
  }

  outcome(): RaceOutcome | null {
    return this.result
  }

  dispose(): void {
    this.views?.dispose()
    this.car.dispose()
    this.boss?.dispose()
    this.world.dispose()
    this.ctx.hud.setModePanel(null)
    for (const m of [this.assets.mat, this.assets.shinyMat, this.assets.flameMat]) m.dispose()
    this.assets.flameGeo.dispose()
    // Fx pools and anything left: freed once (shared car models are skipped).
    disposeScene(this.scene)
  }
}

export const createKurguMode: RaceModeFactory = async (ctx, spec) => {
  const def = kurguDefFor(spec.trackId, spec.variant, spec.boss)
  const kt = buildKurguTrack(def)
  const night = spec.variant === 'night'
  const scene = new THREE.Scene()
  const [world, boss] = await Promise.all([
    buildDevEvWorld(kt, scene, ctx.renderer, ctx.quality, night),
    spec.boss ? BossRun.create(kt, def.id.startsWith('devevboss') ? BOSS_CHECKPOINTS : kt.def.gates.map((g) => Math.max(30, g.s0 - 160)).slice(0, 3), spec.cupId) : Promise.resolve(null),
  ])
  const ghosts = spec.boss ? [] : pilotGhosts(kt, ctx.playerCar.params)
  const mode = new KurguMode(ctx as KurguContext, spec, kt, world, ghosts, boss, createPartAssets())
  // The world set up lights, fog and environment on a scratch scene: move them over.
  mode.scene.environment = scene.environment
  mode.scene.environmentIntensity = scene.environmentIntensity
  mode.scene.background = scene.background
  mode.scene.fog = scene.fog
  return mode
}
