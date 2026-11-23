/**
 * Game-feel effects: speed lines, exhaust flames, spray, dust, sparks, ring bursts, sparkles,
 * confetti. Everything comes from fixed pools sized by the quality profile (two THREE.Points
 * draw calls, one speed-line mesh, a few ring quads) and nothing is allocated per frame.
 *
 * Events are queued and played in the next update(), where the car's frame and the racer's
 * state (new form, surface, combo) are known, so the caller may call onEvent before or after
 * update in a frame.
 */
import * as THREE from 'three'
import type { RacerEvent, RacerEventKind, RacerState } from '../sim/racer'
import type { QualityProfile } from './quality'
import {
  burstBoost, burstCoin, burstEarly, burstFall, burstFinish, burstJump, burstLand, burstPerfect, burstRespawn,
  burstSplash, burstTransform, burstWall, burstWrong,
} from './fxBursts'
import { FxKit } from './fxKit'
import { ParticlePool } from './fxParticles'
import { RingPool } from './fxRings'
import { SpeedLines } from './fxSpeedLines'
import { makeParticleAtlas, makeRingTexture } from './fxTextures'
import { FxTrails } from './fxTrails'
import { ModTrail, type TrailMod } from './fxModTrail'

/** Pool sizes at particles = 1 (High). Low (0.5) halves them, and every burst with them. */
export const FX_BUDGET = { glow: 1400, puff: 1000, speedLines: 72, rings: 6 } as const

const QUEUE = 32
const WORLD_UP = new THREE.Vector3(0, 1, 0)

export class Fx {
  private readonly kit: FxKit
  private readonly trails: FxTrails
  private readonly lines: SpeedLines
  private readonly kinds: RacerEventKind[] = new Array<RacerEventKind>(QUEUE).fill('coin')
  private readonly values = new Float64Array(QUEUE)
  private readonly ats = new Float32Array(QUEUE * 3)
  private queued = 0
  private readonly lastPos = new THREE.Vector3()
  private hasLast = false
  private readonly at = new THREE.Vector3()
  private readonly puffPoints: THREE.Object3D
  private modTrail: ModTrail | null = null

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: QualityProfile) {
    const scale = Math.max(0.2, Math.min(1.5, q.particles))
    const atlas = makeParticleAtlas()
    const glow = new ParticlePool(FX_BUDGET.glow * scale, atlas, true, camera)
    const puff = new ParticlePool(FX_BUDGET.puff * scale, atlas, false, camera)
    const rings = new RingPool(FX_BUDGET.rings, makeRingTexture())
    this.kit = new FxKit(glow, puff, rings, scale)
    this.trails = new FxTrails(this.kit)
    this.lines = new SpeedLines(FX_BUDGET.speedLines * scale)
    scene.add(puff.points, glow.points, rings.group, this.lines.group)
    this.puffPoints = puff.points
  }

  /** The garage trail mod behind the player's car (null = none). */
  setTrail(mod: TrailMod | null): void {
    this.modTrail = mod === null ? null : new ModTrail(this.kit, mod)
  }

  /** Dust and exhaust puffs (the non-glowing pool) on/off: night worlds look cleaner without. */
  setPuffs(on: boolean): void {
    this.puffPoints.visible = on
  }

  onEvent(e: RacerEvent, at: THREE.Vector3): void {
    if (this.queued >= QUEUE) return
    const i = this.queued++
    this.kinds[i] = e.kind
    this.values[i] = e.value ?? 0
    this.ats[i * 3] = at.x
    this.ats[i * 3 + 1] = at.y
    this.ats[i * 3 + 2] = at.z
  }

  update(dt: number, carPos: THREE.Vector3, carForward: THREE.Vector3, st: RacerState): void {
    const h = Math.min(Math.max(dt, 0), 0.1)
    this.frame(h, carPos, carForward, st)
    for (let i = 0; i < this.queued; i++) {
      this.at.set(this.ats[i * 3], this.ats[i * 3 + 1], this.ats[i * 3 + 2])
      // Events usually carry last frame's car position; snap those to where the car is now so
      // car-borne bursts are centred on it. A respawn always plays where the car reappeared.
      if (this.kinds[i] === 'respawn' || this.at.distanceToSquared(this.kit.pos) < 16) this.at.copy(this.kit.pos)
      this.play(this.kinds[i], this.values[i], st)
    }
    this.queued = 0
    this.trails.update(h, st)
    this.modTrail?.update(h, st)
    this.kit.glow.update(h)
    this.kit.puff.update(h)
    this.kit.rings.update(h, this.kit.pos, this.kit.fwd)
    this.speedLines(h, st)
  }

  /** Drop every live particle (race restart). */
  reset(): void {
    this.kit.glow.clear()
    this.kit.puff.clear()
    this.queued = 0
    this.hasLast = false
  }

  /** The car's frame for this update: forward, left (model +X), and a velocity for inheritance. */
  private frame(dt: number, carPos: THREE.Vector3, carForward: THREE.Vector3, st: RacerState): void {
    const k = this.kit
    k.pos.copy(carPos)
    k.fwd.copy(carForward)
    if (k.fwd.lengthSq() < 1e-6) k.fwd.set(0, 0, 1)
    k.fwd.normalize()
    k.left.crossVectors(WORLD_UP, k.fwd)
    if (k.left.lengthSq() < 1e-6) k.left.set(1, 0, 0)
    k.left.normalize()
    k.vel.copy(k.fwd).multiplyScalar(st.speed)
    // Vertical motion (ramps, jumps) is not in `speed`: take it from the last frame unless
    // the car was teleported (respawn).
    if (this.hasLast && dt > 0) {
      const vy = (carPos.y - this.lastPos.y) / dt
      if (Math.abs(vy) < 40) k.vel.y = vy
    }
    this.lastPos.copy(carPos)
    this.hasLast = true
  }

  private play(kind: RacerEventKind, value: number, st: RacerState): void {
    const k = this.kit
    const at = this.at
    switch (kind) {
      case 'perfect': return burstPerfect(k, at, value, st.form)
      case 'coin': return burstCoin(k, at)
      case 'land': return burstLand(k, at, value, st.surface)
      case 'splash': return burstSplash(k, at, value)
      case 'wall': return burstWall(k, at, st.d > 0 ? 1 : -1, value, 34)
      case 'respawn':
        this.hasLast = false
        return burstRespawn(k, at)
      case 'fall': return burstFall(k, at)
      case 'transform': return burstTransform(k, at, st.form)
      case 'boost': return burstBoost(k, at)
      case 'wrongForm':
      case 'late': return burstWrong(k, at)
      case 'early': return burstEarly(k, at)
      case 'jump': return burstJump(k, at)
      case 'finish': return burstFinish(k, at)
    }
  }

  private speedLines(dt: number, st: RacerState): void {
    let level = Math.min(1, Math.max(0, (st.speed - 28) / 14))
    let r = 1.5
    let g = 1.55
    let b = 1.7
    if (st.boost > 0) {
      level = Math.max(level, 0.9)
      r = 0.9; g = 1.8; b = 2.6
    }
    if (st.turbo > 0) {
      level = 1
      r = 2.4; g = 1.5; b = 1.9
    }
    if (st.combo >= 3 && level > 0) {
      r = 2.6; g = 1.6; b = 0.8
    }
    if (st.finished || st.respawnT > 0) level = 0
    this.lines.update(dt, st.speed, level, r, g, b)
  }
}
