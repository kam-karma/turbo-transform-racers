/**
 * Kurgu rivals: the Kupa Pilotları drive each track with the Kurgu bots (generated once per
 * track and kept in memory — no shipped ghost files needed), five are picked around the
 * player's best (spec §12.3), and each replays on a KurguCar with its parts and detours.
 * The player's own best run (with its parts) is kept in localStorage and joins as a rival.
 */
import * as THREE from 'three'
import { sampleGhost } from '../../sim/ghost'
import { ghostSlot } from '../../sim/grid'
import { PILOTS } from '../../sim/pilots'
import { pickRivals } from '../../sim/rivals'
import type { RacerParams } from '../../sim/racer'
import { decodeKurguGhost, encodeKurguGhost, slotsAt, type KurguGhost } from '../sim/kurguGhost'
import { kurguSkill, runKurguBot } from '../sim/kurguBot'
import type { KurguTrack } from '../sim/kurguTrack'
import { altPoint } from '../sim/layout'
import { KurguCar, type PartAssets } from './kurguCar'

const RIVAL_CARS = ['rt40', 'r40', 'r245']
const PILOT_PICK = [0, 2, 4, 5, 7, 9, 11, 12, 14]
const BEST_KEY = 'kupa-avcilari-kurgu-best-'

export interface KurguRival {
  readonly kg: KurguGhost
  readonly stretch: number
  readonly name: string
  readonly badge: string
  readonly color: number
  readonly pilot: boolean
  readonly car: string
}

const cache = new Map<string, KurguGhost[]>()

/** The pilots' ghosts on this track (deterministic; computed once per track). */
export function pilotGhosts(kt: KurguTrack, params: RacerParams): KurguGhost[] {
  const hit = cache.get(kt.def.id)
  if (hit !== undefined) return hit
  const out = PILOT_PICK.map((i, k) => {
    const p = PILOTS[i]
    const slot = ghostSlot(k)
    return runKurguBot(kt, kurguSkill(i), 101 + i * 7, { id: p.id, pilot: p.name, car: RIVAL_CARS[k % RIVAL_CARS.length], color: p.color }, params, slot.s, slot.d)
  })
  cache.set(kt.def.id, out)
  return out
}

export function loadBest(trackId: string): KurguGhost | null {
  try {
    const raw = localStorage.getItem(BEST_KEY + trackId)
    return raw === null ? null : decodeKurguGhost(raw)
  } catch {
    return null
  }
}

export function saveBest(trackId: string, kg: KurguGhost): void {
  try {
    localStorage.setItem(BEST_KEY + trackId, encodeKurguGhost(kg))
  } catch (error) {
    console.warn('Kurgu best run could not be saved:', error)
  }
}

export function chooseRivals(ghosts: readonly KurguGhost[], best: KurguGhost | null, firstRace: boolean): KurguRival[] {
  const picks = pickRivals(ghosts.map((g) => ({ id: g.ghost.id, time: g.ghost.time })), firstRace ? null : (best?.ghost.time ?? null))
  const rivals: KurguRival[] = picks.map((p) => {
    const kg = ghosts.find((g) => g.ghost.id === p.id) as KurguGhost
    const pilot = PILOTS.find((x) => x.id === kg.ghost.id)
    return { kg, stretch: p.stretch, name: pilot?.name ?? kg.ghost.pilot, badge: pilot?.badge ?? '', color: pilot?.color ?? kg.ghost.color, pilot: true, car: kg.ghost.car }
  })
  if (best !== null && rivals.length > 0 && !firstRace) {
    rivals.sort((a, b) => a.kg.ghost.time * a.stretch - b.kg.ghost.time * b.stretch)
    rivals[rivals.length - 1] = { kg: { ...best, ghost: { ...best.ghost, id: 'you-best' } }, stretch: 1, name: 'Senin rekorun', badge: '', color: 0xffffff, pilot: false, car: 'rt40' }
  }
  return rivals
}

const NEAR = 6
const FAR = 12
const LABEL_NEAR = 16
const PARTS_FAR = 170

/** Lateral/vertical offset of a detour lane at s for a racer that took gate g's detour. */
export function detourOffset(kt: KurguTrack, s: number, alts: readonly number[], out: THREE.Vector3): THREE.Vector3 | null {
  for (const gi of alts) {
    const g = kt.def.gates[gi]
    if (s < g.s0 - 24 || s > g.s1 + 24) continue
    const a = altPoint(kt, g, s, 0, 0)
    const m = kt.main.toWorld(s, 0, 0)
    return out.set(a.x - m.x, a.y - m.y, a.z - m.z)
  }
  return null
}

export class RivalViews {
  readonly cars: KurguCar[]
  private readonly prevS: number[]
  private readonly off = new THREE.Vector3()

  constructor(scene: THREE.Scene, readonly rivals: readonly KurguRival[], modelFor: (car: string) => THREE.Object3D | null, assets: PartAssets) {
    this.cars = rivals.map((r) => new KurguCar(modelFor(r.car), r.color, assets, scene, { label: r.name, badge: r.badge, shadows: false }))
    this.prevS = rivals.map(() => 0)
    for (const c of this.cars) scene.add(c.root)
  }

  update(raceT: number, kt: KurguTrack, playerPos: THREE.Vector3, dt: number, camPos: THREE.Vector3): void {
    this.rivals.forEach((r, i) => {
      const t = raceT / r.stretch
      const g = sampleGhost(r.kg.ghost, t)
      const speed = dt > 0 ? Math.max(0, (g.s - this.prevS[i]) / dt) : 0
      this.prevS[i] = g.s
      const car = this.cars[i]
      car.setParts(slotsAt(r.kg, t), true)
      const surface = kt.main.surfaceAt(g.s)
      car.update({ s: g.s, d: g.d, y: g.y, yaw: g.yaw, form: 'car', speed, fx: g.fx, surface: surface === 'water' && g.form === 'boat' ? 'road' : surface, formT: 0 }, kt.main, dt, detourOffset(kt, g.s, r.kg.alts, this.off), (g.fx & 4) !== 0)
      const dist = car.worldPos.distanceTo(playerPos)
      let a = dist <= NEAR ? 0.35 : dist >= FAR ? 1 : 0.35 + (0.65 * (dist - NEAR)) / (FAR - NEAR)
      if (car.worldPos.distanceTo(camPos) < camPos.distanceTo(playerPos) + 1) a = Math.min(a, 0.05)
      car.setOpacity(a)
      car.setLabelVisible(dist > LABEL_NEAR)
      car.setPartsVisible(dist < PARTS_FAR)
    })
  }

  positions(raceT: number): { id: string; s: number; finishedAt: number | null }[] {
    return this.rivals.map((r) => {
      const fin = r.kg.ghost.time * r.stretch
      return { id: r.kg.ghost.id, s: sampleGhost(r.kg.ghost, raceT / r.stretch).s, finishedAt: raceT >= fin ? fin : null }
    })
  }

  dispose(): void {
    for (const c of this.cars) c.dispose()
  }
}
