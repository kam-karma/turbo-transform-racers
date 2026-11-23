/**
 * The rival ghosts on screen: each plays its recording (optionally stretched, spec §6) on a
 * CarView with the pilot's colour and name tag, fading when it drives through the player.
 */
import * as THREE from 'three'
import { sampleGhost, type Ghost } from '../sim/ghost'
import type { Track } from '../sim/track'
import { CarView } from './car'

export interface GhostRacer {
  readonly ghost: Ghost
  readonly stretch: number
  readonly name: string
  readonly badge: string
  readonly color: number
  /** True for the Kupa Pilotları crew; false for the player's own best. */
  readonly pilot: boolean
  readonly model: THREE.Object3D | null
}

const NEAR = 6
const FAR = 12
/** Closer than this the name tag would cover the player's view. */
const LABEL_NEAR = 16

export class GhostViews {
  readonly views: CarView[]
  private readonly prevS: number[]

  constructor(scene: THREE.Scene, readonly racers: readonly GhostRacer[]) {
    this.views = racers.map((r) => new CarView(r.model, r.color, { label: r.name, badge: r.badge, shadows: false }))
    this.prevS = racers.map(() => 0)
    for (const v of this.views) scene.add(v.root)
  }

  update(raceT: number, track: Track, playerPos: THREE.Vector3, dt: number, cameraPos?: THREE.Vector3): void {
    this.racers.forEach((r, i) => {
      const t = raceT / r.stretch
      const g = sampleGhost(r.ghost, t)
      const speed = dt > 0 ? Math.max(0, (g.s - this.prevS[i]) / dt) : 0
      this.prevS[i] = g.s
      const v = this.views[i]
      v.update({ s: g.s, d: g.d, y: g.y, yaw: g.yaw, form: g.form, speed, fx: g.fx, surface: track.surfaceAt(g.s), formT: 0 }, track, dt)
      const dist = v.worldPos.distanceTo(playerPos)
      let a = dist <= NEAR ? 0.35 : dist >= FAR ? 1 : 0.35 + (0.65 * (dist - NEAR)) / (FAR - NEAR)
      // A ghost between the camera and the player would hide the player's own car.
      if (cameraPos !== undefined && v.worldPos.distanceTo(cameraPos) < cameraPos.distanceTo(playerPos) + 1) a = Math.min(a, 0.05)
      v.setOpacity(a)
      v.setLabelVisible(dist > LABEL_NEAR)
    })
  }

  /** For the running order: distance and finish time in race seconds. */
  positions(raceT: number): { id: string; s: number; finishedAt: number | null }[] {
    return this.racers.map((r) => {
      const finishT = r.ghost.time * r.stretch
      return { id: r.ghost.id, s: sampleGhost(r.ghost, raceT / r.stretch).s, finishedAt: raceT >= finishT ? finishT : null }
    })
  }

  dispose(scene: THREE.Scene): void {
    for (const v of this.views) {
      scene.remove(v.root)
      v.dispose()
    }
  }
}
