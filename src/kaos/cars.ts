/**
 * The six cars of a Kaos race on screen: CarViews placed from the live race state, neon name
 * tags over the rivals (hidden up close), underglow and tail-light trails.
 */
import * as THREE from 'three'
import { CarView } from '../game/car'
import { fxOf } from '../sim/ghost'
import type { Track } from '../sim/track'
import type { KaosRace } from './sim/kaosRace'
import { CarFx, neonLabel } from './world/carFx'

const PLAYER_COLOR = 0xffd23f
const LABEL_NEAR = 14
const LABEL_Y = 2.7

export interface CarModels {
  readonly player: THREE.Object3D | null
  readonly applyLook?: (root: THREE.Object3D) => void
  readonly modelFor: (car: string) => THREE.Object3D | null
}

export class KaosCars {
  readonly group = new THREE.Group()
  readonly views: CarView[]
  private readonly labels: (THREE.Sprite | null)[]
  private readonly fx: CarFx
  /** Player frame for camera and effects. */
  readonly fwd = new THREE.Vector3(0, 0, 1)
  readonly up = new THREE.Vector3(0, 1, 0)
  private readonly f = new THREE.Vector3()
  private readonly u = new THREE.Vector3()
  private snapNext = true

  constructor(race: KaosRace, models: CarModels) {
    this.views = race.racers.map((r, i) => {
      const v = new CarView(i === 0 ? models.player : models.modelFor(r.info.car), i === 0 ? PLAYER_COLOR : r.info.color, { shadows: false })
      if (i === 0) models.applyLook?.(v.bodyModel)
      return v
    })
    this.labels = race.racers.map((r, i) => {
      if (i === 0) return null
      const s = neonLabel(r.info.name, r.info.color)
      s.position.y = LABEL_Y
      this.views[i].root.add(s)
      return s
    })
    this.fx = new CarFx(race.racers.map((r, i) => (i === 0 ? 0xff3d7a : r.info.color)))
    for (const v of this.views) this.group.add(v.root)
    this.group.add(this.fx.group)
  }

  get playerPos(): THREE.Vector3 {
    return this.views[0].worldPos
  }

  /** Trails restart (race restart). */
  snap(): void {
    this.snapNext = true
  }

  update(race: KaosRace, track: Track, dt: number, camPos?: THREE.Vector3): void {
    const player = this.views[0].worldPos
    race.racers.forEach((r, i) => {
      const st = r.st
      const v = this.views[i]
      v.update({ s: st.s, d: st.d, y: st.y, yaw: st.yaw, form: 'car', speed: st.speed, fx: fxOf(st), surface: st.surface, formT: 0 }, track, dt)
      const fr = track.frameAt(st.s)
      const c = Math.cos(st.yaw)
      const s = Math.sin(st.yaw)
      this.f.set(fr.t.x * c + fr.left.x * s, fr.t.y * c + fr.left.y * s, fr.t.z * c + fr.left.z * s).normalize()
      this.u.set(fr.up.x, fr.up.y, fr.up.z)
      if (i === 0) {
        this.fwd.copy(this.f)
        this.up.copy(this.u)
      }
      this.fx.update(i, v.worldPos, this.f, this.u, st.speed, dt, this.snapNext || st.respawnT > 0)
      const label = this.labels[i]
      if (label !== null) label.visible = v.worldPos.distanceTo(player) > LABEL_NEAR
      // a rival between the camera and the player would hide the player's own car
      if (i > 0 && camPos !== undefined) {
        const toCam = v.worldPos.distanceTo(camPos)
        const block = toCam < camPos.distanceTo(player) + 0.5 && toCam < 9
        v.setOpacity(block ? 0.22 : 1)
      }
    })
    this.snapNext = false
    this.fx.commit()
  }

  dispose(): void {
    for (const v of this.views) v.dispose()
    for (const l of this.labels) {
      if (l === null) continue
      l.material.map?.dispose()
      l.material.dispose()
    }
    this.fx.dispose()
  }
}
