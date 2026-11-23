/**
 * Turns Kaos race events into the show: shard bursts, hologram glitches, camera shake, slow
 * motion, HUD pops (grouped so a pile of smashes reads as one "+85 YIKIM"), and sounds.
 */
import * as THREE from 'three'
import type { RaceAudio } from '../game/audio'
import type { ChaseCamera } from '../game/chaseCamera'
import type { Fx } from '../game/fx'
import type { TimeScale } from '../game/timeScale'
import type { RaceHud } from '../ui/raceHud'
import type { KaosCars } from './cars'
import type { KaosSfx } from './sfx'
import type { KaosEvent, KaosRace } from './sim/kaosRace'
import type { BossView } from './world/bossView'
import type { BreakView } from './world/breakView'
import type { KaosFx } from './world/shards'
import type { NeonWorld } from './world/world'

export interface ShowDeps {
  readonly hud: RaceHud
  readonly audio: RaceAudio
  readonly sfx: KaosSfx
  readonly cam: ChaseCamera
  readonly time: TimeScale
  readonly fx: Fx
  readonly kfx: KaosFx
  readonly cars: KaosCars
  readonly breaks: BreakView
  readonly world: NeonWorld
  readonly boss: BossView | null
  readonly camera: THREE.Camera
}

const GROUP_S = 0.7
const FAR = 160
const SHARDS = { block: 16, sign: 10, glass: 22 } as const

export class KaosShow {
  private pending = 0
  private pendingT = 0
  private readonly push = new THREE.Vector3()
  private readonly at = new THREE.Vector3()
  private readonly c = new THREE.Color()

  constructor(private readonly d: ShowDeps) {}

  reset(): void {
    this.pending = 0
    this.pendingT = 0
  }

  /** Flushes grouped score pops. */
  tick(dt: number): void {
    if (this.pending <= 0) return
    this.pendingT += dt
    if (this.pendingT >= GROUP_S) {
      this.d.hud.pop(`+${this.pending} YIKIM`, this.pending >= 60 ? 'combo' : 'gold')
      this.pending = 0
      this.pendingT = 0
    }
  }

  private score(n: number): void {
    if (n <= 0) return
    if (this.pending === 0) this.pendingT = 0
    this.pending += n
  }

  on(e: KaosEvent, race: KaosRace): void {
    const d = this.d
    switch (e.kind) {
      case 'racer':
        if (e.who !== 0) return
        // dust puffs and splashes belong to the islands; neon keeps sparks, boosts and coins
        if (e.e.kind !== 'land' && e.e.kind !== 'jump') d.fx.onEvent(e.e, d.cars.playerPos)
        d.audio.onEvent(e.e)
        if (e.e.kind === 'coin') d.world.collectCoin(e.e.value ?? 0)
        else if (e.e.kind === 'wall') d.cam.shake(Math.min(0.6, (e.e.value ?? 0) * 0.02))
        else if (e.e.kind === 'boost') d.hud.pop('HIZ!', 'soft')
        else if (e.e.kind === 'land') d.cam.shake(Math.min(0.7, (e.e.value ?? 0) * 0.08))
        return
      case 'smash': return this.smash(e.id, e.item, e.who, e.score, race)
      case 'rebuild': {
        const p = d.breaks.centres[e.id]
        d.breaks.rebuild(e.id)
        if (p.distanceTo(d.camera.position) < FAR) d.kfx.glitch(p, d.breaks.colors[e.id], 10)
        return
      }
      case 'bump': {
        const a = d.cars.views[e.a].worldPos
        const b = d.cars.views[e.b].worldPos
        this.at.copy(a).add(b).multiplyScalar(0.5)
        this.at.y += 0.6
        if (this.at.distanceTo(d.camera.position) < FAR) d.kfx.burst(this.at, this.c.setRGB(1, 0.6, 0.2), Math.min(10, 3 + Math.round(e.force)), this.push.set(0, 0, 0), this.at.y - 0.6, 0.5)
        if (e.a === 0 || e.b === 0) {
          d.cam.shake(Math.min(0.7, e.force * 0.05))
          d.sfx.bump(e.force)
          if (e.score > 0) {
            d.hud.pop('ÇARP!', 'combo')
            this.score(e.score)
          }
        }
        return
      }
      case 'shock':
        d.sfx.shock()
        d.hud.flash('#22e6ff')
        d.hud.pop('ŞOK DALGASI!', 'perfect')
        d.cam.shake(1.1)
        d.time.trigger(0.5, 0.4)
        d.kfx.burst(this.at.copy(d.cars.playerPos).setY(d.cars.playerPos.y + 1), this.c.set(0x22e6ff), 30, this.push.copy(d.cars.fwd).multiplyScalar(race.player.st.speed), d.cars.playerPos.y, 1.6, 0.8)
        return
      case 'shockHit': {
        const p = d.cars.views[e.who].worldPos
        d.kfx.burst(this.at.copy(p).setY(p.y + 1), this.c.set(race.racers[e.who].info.color), 24, this.push.set(0, 0, 0), p.y, 1.3)
        d.hud.pop('SAVRULDU!', 'combo')
        this.score(e.score)
        return
      }
      case 'meterFull':
        d.sfx.ready()
        d.hud.pop('ŞOK HAZIR!', 'perfect')
        return
      case 'lap':
        if (e.who !== 0) return
        d.world.resetCoins()
        d.sfx.lap(e.n === race.cfg.circuit.laps)
        d.hud.pop(e.n === race.cfg.circuit.laps ? 'SON TUR!' : `TUR ${e.n}`, 'perfect')
        return
      case 'finish':
        if (e.who === 0) d.hud.pop(`${e.place}. oldun!`, e.place === 1 ? 'perfect' : 'gold')
        return
      case 'dragon': return this.dragon(e.e, race)
    }
  }

  private smash(id: number, item: 'block' | 'sign' | 'glass', who: number, score: number, race: KaosRace): void {
    const d = this.d
    d.breaks.smash(id)
    const p = d.breaks.centres[id]
    const near = p.distanceTo(d.camera.position) < FAR
    if (near) {
      const st = race.racers[who].st
      const car = d.cars.views[who].worldPos
      this.push.copy(p).sub(car).setY(0).normalize().multiplyScalar(st.speed * 0.6)
      d.kfx.burst(p, d.breaks.colors[id], SHARDS[item], this.push, p.y - (item === 'sign' ? 2.2 : item === 'glass' ? 0.9 : 1.3))
      if (item === 'sign') d.kfx.glitch(p, d.breaks.colors[id], 26)
    }
    if (who !== 0) return
    d.sfx.smash(item)
    d.cam.shake(item === 'glass' ? 0.3 : 0.2)
    this.score(score)
  }

  private dragon(e: import('./sim/dragon').DragonEvent, race: KaosRace): void {
    const d = this.d
    const dr = race.dragon
    if (d.boss === null || dr === null) return
    d.boss.onEvent(e, dr)
    switch (e.kind) {
      case 'throw': d.sfx.throwBlock(); return
      case 'crush':
        d.sfx.crush()
        d.cam.shake(1)
        d.hud.flash('#ff3df2')
        d.hud.pop('EYVAH!', 'bad')
        return
      case 'bounce':
        d.sfx.bounce()
        if (!e.byShock) d.hud.pop('GERİ YOLLA!', 'perfect')
        return
      case 'damage':
        d.sfx.dragonHit()
        d.cam.shake(0.4)
        d.hud.pop('ISABET!', 'combo')
        return
      case 'enrage':
        d.sfx.roar()
        d.hud.pop(e.phase === 2 ? 'EJDERHA ÇILDIRDI!' : 'EJDERHA KIZDI!', 'bad')
        return
      case 'beaten':
        d.sfx.roar()
        d.sfx.victory()
        d.hud.flash('#b6ff2e')
        d.hud.pop('EJDERHA YENİLDİ!', 'perfect')
        d.time.trigger(0.5, 0.4)
        return
      default:
        return
    }
  }
}
