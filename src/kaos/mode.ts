/**
 * Kaos Kupası race mode (spec §9.3, §9.4): a 3-lap neon circuit against five live bots, or
 * the Ejderha boss race alone. Builds its own Neon Şehir scene and runs countdown → race →
 * outcome through the shared RaceMode contract.
 */
import * as THREE from 'three'
import { ChaseCamera } from '../game/chaseCamera'
import { Fx } from '../game/fx'
import { TimeScale } from '../game/timeScale'
import type { RaceContext, RaceMode, RaceModeFactory, RaceOutcome, RaceSpec } from '../modes/types'
import { RaceClock } from '../sim/race'
import type { RaceInput } from '../sim/racer'
import { buildTrack, type Track } from '../sim/track'
import { KaosCars } from './cars'
import { createKaosPanel, type KaosPanel } from './panel'
import { KaosSfx } from './sfx'
import { KaosShow } from './show'
import { layoutBreakables } from './sim/breakables'
import { KaosRace } from './sim/kaosRace'
import { pickKaosRivals, tierOf } from './sim/rivals'
import { bossStarLabels, bossStars, finalScore, kaosStarLabels, kaosStars } from './sim/score'
import { KAOS_CIRCUITS, type KaosCircuit } from './tracks/index'
import { BossView } from './world/bossView'
import { loadDragonMesh } from './world/dragonModel'
import { BreakView } from './world/breakView'
import { KaosFx } from './world/shards'
import { buildNeonWorld, type NeonWorld } from './world/world'

const RESULTS_DELAY_S = 1.6
const BOSS_END_DELAY_S = 3
const BOSS_HEALTH = [100, 120, 140] as const
const IDLE: RaceInput = { throttle: 0, brake: 0, steer: 0, form: null }

class KaosMode implements RaceMode {
  readonly scene: THREE.Scene
  finished = false
  private readonly clock = new RaceClock()
  private readonly time = new TimeScale()
  private readonly cam: ChaseCamera
  private readonly fx: Fx
  private readonly kfx: KaosFx
  private readonly cars: KaosCars
  private readonly breaks: BreakView
  private readonly boss: BossView | null
  private readonly sfx: KaosSfx
  private readonly show: KaosShow
  private readonly panel: KaosPanel
  private lastCount = -1
  private endFor = 0
  private elapsed = 0
  private fireQueued = false
  private result: RaceOutcome | null = null
  private beatenLap: number | null = null
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      this.fireQueued = true
    }
  }

  constructor(private readonly ctx: RaceContext, private readonly circuit: KaosCircuit, private readonly track: Track, readonly race: KaosRace, private readonly world: NeonWorld, scene: THREE.Scene, dragonMesh: THREE.Mesh | null) {
    this.scene = scene
    scene.add(world.group)
    this.cam = new ChaseCamera(ctx.camera)
    this.fx = new Fx(scene, ctx.camera, ctx.quality)
    // The shared Fx's white exhaust puffs read as daytime dust in the neon night.
    this.fx.setPuffs(false)
    this.fx.setTrail(ctx.playerCar.trail ?? null)
    this.kfx = new KaosFx(ctx.camera, ctx.quality.particles)
    this.breaks = new BreakView(track, circuit, race.cfg.items)
    this.cars = new KaosCars(race, { player: ctx.playerCar.model, applyLook: ctx.playerCar.applyLook, modelFor: ctx.modelFor })
    this.boss = race.dragon === null ? null : new BossView(track, this.kfx, dragonMesh)
    world.landmark.setPerchVisible(this.boss === null)
    scene.add(this.breaks.group, this.cars.group, this.kfx.group)
    if (this.boss !== null) scene.add(this.boss.group)
    this.sfx = new KaosSfx(() => ctx.settings().sound)
    this.panel = createKaosPanel(ctx.hud, this.boss !== null, () => {
      this.fireQueued = true
    })
    this.show = new KaosShow({
      hud: ctx.hud, audio: ctx.audio, sfx: this.sfx, cam: this.cam, time: this.time, fx: this.fx, kfx: this.kfx,
      cars: this.cars, breaks: this.breaks, world, boss: this.boss, camera: ctx.camera,
    })
    window.addEventListener('keydown', this.onKey)
    this.place(0)
  }

  start(): void {
    this.race.reset()
    this.breaks.reset()
    this.kfx.reset()
    this.fx.reset()
    this.boss?.reset()
    this.show.reset()
    this.world.resetCoins()
    this.cars.snap()
    this.finished = false
    this.result = null
    this.endFor = 0
    this.lastCount = -1
    this.beatenLap = null
    this.fireQueued = false
    this.ctx.hud.show('neon')
    this.ctx.hud.setModePanel(this.panel.el)
    this.panel.setShock(0)
    this.panel.setScore(0)
    this.panel.setBoss(1)
    this.cam.snap()
    this.clock.start()
    this.place(0)
  }

  restart(): void {
    this.start()
  }

  frame(realDt: number): void {
    const dt = this.time.step(realDt)
    this.elapsed += dt
    const raceDt = this.clock.tick(dt)
    const inp = this.ctx.input.read(dt)
    if (this.clock.phase === 'countdown') {
      const n = this.clock.countdown
      if (n !== this.lastCount) {
        this.lastCount = n
        this.ctx.hud.countdown(n)
        this.ctx.audio.countdown(n)
      }
      this.fireQueued = false
    } else if (this.clock.phase === 'racing' || this.clock.phase === 'finished') {
      if (this.lastCount !== 0) {
        this.lastCount = 0
        this.ctx.hud.countdown(0)
        this.ctx.audio.countdown(0)
        // Rocket start bought on the intro card (rewarded video): a flying start and a full Şok.
        if (this.ctx.perks?.().rocketStart === true) {
          const p = this.race.player
          p.st = { ...p.st, speed: p.params.vmax * 0.8 }
          this.race.meter.add(1)
          this.ctx.hud.pop('ROKET START!', 'gold')
          this.cam.shake(0.4)
        }
      }
      this.step(this.clock.phase === 'racing' ? raceDt : dt, inp)
    }
    this.place(dt)
    this.ctx.audio.update(this.race.player.st, this.clock.phase === 'racing' ? inp.throttle : 0.5)
    if (this.clock.phase !== 'intro') this.hud()
  }

  private step(dt: number, inp: RaceInput): void {
    const race = this.race
    const over = this.clock.phase === 'finished'
    const fire = this.fireQueued && !over
    this.fireQueued = false
    const events = race.step(dt, over ? IDLE : inp, fire, over)
    for (const e of events) {
      this.show.on(e, race)
      if (e.kind === 'racer' && e.who === 0 && e.e.kind === 'finish') this.clock.finish()
      if (e.kind === 'dragon' && e.e.kind === 'beaten') {
        this.beatenLap = race.player.lap
        this.clock.finish()
      }
    }
    if (over) {
      this.endFor += dt
      const wait = this.boss !== null && race.dragon?.beaten === true ? BOSS_END_DELAY_S : RESULTS_DELAY_S
      if (!this.finished && this.endFor >= wait) {
        this.result = this.outcomeNow()
        this.finished = true
      }
    }
    this.show.tick(dt)
  }

  private place(dt: number): void {
    const race = this.race
    this.cars.update(race, this.track, dt, this.ctx.camera.position)
    const t = this.elapsed
    this.world.update(t, dt, this.ctx.camera)
    this.breaks.update(t, dt)
    const dr = race.dragon
    if (this.boss !== null && dr !== null) this.boss.update(dr, t, dt)
    const w = race.wave
    this.kfx.wave(this.cars.playerPos, this.cars.up, w?.radius ?? 0, w === null ? 0 : Math.max(0, 1 - w.t / 0.65), t)
    this.kfx.update(dt)
    this.fx.update(dt, this.cars.playerPos, this.cars.fwd, race.player.st)
    this.cam.update(this.cars.playerPos, this.cars.fwd, this.cars.up, race.player.st, dt)
  }

  private hud(): void {
    const race = this.race
    const p = race.player
    const order = race.order()
    const L = race.length
    this.ctx.hud.update({
      place: order.indexOf(0) + 1,
      of: race.racers.length,
      time: p.finishedAt ?? race.time,
      kmh: p.st.speed * 3.6,
      coins: p.st.coins,
      progress: Math.min(1, p.finishedAt !== null ? 1 : p.st.s / L),
      rivals: race.racers.slice(1).map((r) => ({ id: r.info.id, progress: r.finishedAt !== null ? 1 : Math.min(1, r.st.s / L), color: `#${r.info.color.toString(16).padStart(6, '0')}` })),
      lap: { n: p.lap, of: this.circuit.laps },
    })
    this.panel.setShock(race.meter.value)
    this.panel.setScore(race.destruction)
    if (race.dragon !== null) this.panel.setBoss(race.dragon.health / race.dragon.maxHealth)
  }

  private outcomeNow(): RaceOutcome {
    const race = this.race
    const p = race.player
    const time = p.finishedAt ?? race.time
    if (race.dragon !== null) {
      const beaten = race.dragon.beaten
      const b = { beaten, beatenLap: this.beatenLap, laps: this.circuit.laps, crushes: race.dragon.crushes }
      return {
        place: beaten ? 1 : 2, of: 2, time, coins: p.st.coins, stars: bossStars(b), starLabels: bossStarLabels(this.circuit.laps), bossBeaten: beaten,
        extra: { destruction: race.destruction, dragonHits: race.dragon.hits, crushes: race.dragon.crushes },
        rows: [
          { name: 'Sen', badge: '', time: beaten ? time : null, you: true, pilot: false },
          { name: 'Hologram Ejderha', badge: '', time: beaten ? null : time, you: false, pilot: false },
        ],
      }
    }
    const st = race.stats()
    const order = race.racers.map((_, i) => i).sort((a, b) => race.finishTime(a) - race.finishTime(b))
    return {
      place: st.place, of: st.of, time, coins: p.st.coins,
      stars: kaosStars(st, this.circuit.goals), starLabels: kaosStarLabels(this.circuit.goals),
      extra: { destruction: st.destruction, score: finalScore(st), botHits: st.botHits, shockHits: st.shockHits, smashed: st.smashed.block + st.smashed.sign + st.smashed.glass },
      rows: order.map((i) => {
        const r = race.racers[i]
        return { name: r.info.name, badge: r.info.badge, time: race.finishTime(i), you: i === 0, pilot: i !== 0 }
      }),
    }
  }

  outcome(): RaceOutcome | null {
    return this.result
  }

  get goals(): readonly [string, string, string] {
    return this.boss !== null ? bossStarLabels(this.circuit.laps) : kaosStarLabels(this.circuit.goals)
  }

  pause(on: boolean): void {
    this.sfx.suspend(on)
    if (on) this.ctx.audio.idle()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.ctx.hud.setModePanel(null)
    this.panel.dispose()
    this.sfx.dispose()
    this.cars.dispose()
    this.breaks.dispose()
    this.kfx.dispose()
    this.boss?.dispose()
    this.world.dispose()
    this.scene.clear()
  }

  /** Dev hooks: jump the player along the track, fill the meter. */
  dev(): { teleport: (s: number) => void; fill: () => void } {
    return {
      teleport: (s) => {
        this.race.player.st = { ...this.race.player.st, s, d: 0, y: 0, vy: 0, airborne: false }
        this.cam.snap()
        this.cars.snap()
      },
      fill: () => this.race.meter.add(1),
    }
  }
}

export const createKaosMode: RaceModeFactory = async (ctx: RaceContext, spec: RaceSpec): Promise<RaceMode> => {
  const circuit = KAOS_CIRCUITS[spec.trackId] ?? KAOS_CIRCUITS.neon1
  const track = buildTrack(circuit.def)
  const scene = new THREE.Scene()
  const world = await buildNeonWorld(scene, ctx.renderer, track, circuit, ctx.quality)
  const items = layoutBreakables(circuit.lapLen, circuit.spec.width, circuit.seed)
  const tier = tierOf(spec.cupId)
  const race = new KaosRace({
    circuit, track, items, seed: circuit.seed,
    rivals: spec.boss ? [] : pickKaosRivals(spec.cupId, spec.raceId, spec.firstRace),
    player: { params: ctx.playerCar.params, name: 'Sen', car: ctx.playerCar.carId, color: 0xffd23f },
    boss: spec.boss ? { maxHealth: BOSS_HEALTH[tier], damage: 10, width: circuit.spec.width } : null,
  })
  return new KaosMode(ctx, circuit, track, race, world, scene, spec.boss ? await loadDragonMesh() : null)
}
