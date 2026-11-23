/**
 * Car looks: applies a car's equipped mods (paint, wheels, spoiler, neon, decal, trail) to a car
 * object — a textured Tripo model or a legacy `body_paint` model. Re-applying replaces the
 * previous attachments, so the garage can preview mods live. Horn is sound-only (not here).
 *
 * Usage (race or garage):
 *   const look = lookOf(car, equippedMods(save, car.id))
 *   const handle = applyCarLook(model, look)   // once per model instance
 *   handle.update(t)                           // per frame: neon/trail animation
 *   handle.set(otherLook)                      // garage preview
 *   handle.dispose()
 */
import type * as THREE from 'three'
import type { CarDef, ModCategory, ModDef } from '../meta/catalog'
import { paintHueShift } from '../meta/catalog'
import { applyPaint, ownMaterials } from './carPaint'
import { buildDecal, buildNeon, buildTrailPreview, localBox, type Animated } from './carLookParts'
import { fitSpoiler, fitWheels, type FittedPart } from './carParts'

export type ModSet = Partial<Record<ModCategory, ModDef | undefined>>

export interface CarLook {
  readonly car: CarDef
  readonly mods: ModSet
  /** Garage only: show a short trail ribbon behind the car (races draw real trails in fx). */
  readonly trailPreview?: boolean
}

export interface CarLookHandle {
  set(look: CarLook): void
  update(t: number): void
  dispose(): void
}

export const lookOf = (car: CarDef, mods: ModSet, trailPreview = false): CarLook => ({ car, mods, trailPreview })

const num = (v: number | string | undefined, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: number | string | undefined, fallback: string): string => (typeof v === 'string' ? v : fallback)

/** The car colour a mod should use when its own colour is 0 ("body colour"). */
function bodyColor(look: CarLook): number {
  const p = look.mods.paint
  if (p !== undefined && str(p.value.finish, 'factory') !== 'factory') return num(p.value.color, 0xffd21f)
  const h = look.car.hue / 360
  // HSL → hex for the factory hue (bright candy tone).
  const f = (n: number): number => {
    const k = (n + h * 12) % 12
    return Math.round(255 * (0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return (f(0) << 16) | (f(8) << 8) | f(4)
}

export function applyCarLook(root: THREE.Object3D, first: CarLook): CarLookHandle {
  const owned = ownMaterials(root)
  const attachments: THREE.Object3D[] = []
  const fitted: FittedPart[] = []
  const animated: Animated[] = []
  const box = localBox(root)
  /** Bumped on every set(): a part that finishes loading for an older look is dropped. */
  let generation = 0
  let disposed = false

  const clear = (): void => {
    for (const f of fitted) f.restore()
    fitted.length = 0
    for (const a of attachments) {
      a.removeFromParent()
      a.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        // Blender parts share their geometry through the part cache.
        if (m.geometry.userData.sharedPart !== true) m.geometry.dispose()
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose()
      })
    }
    attachments.length = 0
    animated.length = 0
  }

  const add = (o: THREE.Object3D | null): void => {
    if (o === null) return
    root.add(o)
    attachments.push(o)
  }

  /** Adds an async part when it is still wanted. */
  const later = (gen: number, p: Promise<FittedPart | THREE.Object3D | null>): void => {
    void p.then((part) => {
      if (part === null) return
      const obj = 'restore' in part ? part.obj : part
      if (disposed || gen !== generation) {
        if ('restore' in part) part.restore()
        return
      }
      if ('restore' in part) fitted.push(part)
      add(obj)
    })
  }

  const set = (look: CarLook): void => {
    clear()
    const gen = ++generation
    const { mods, car } = look
    const paint = mods.paint
    applyPaint(root, {
      shiftDeg: paint === undefined ? 0 : paintHueShift(car, paint),
      baseHueDeg: car.hue,
      color: num(paint?.value.color, 0xffffff),
      finish: str(paint?.value.finish, 'factory'),
      sat: num(paint?.value.sat, 1),
      light: num(paint?.value.light, 1),
    })
    const body = bodyColor(look)
    const wheels = mods.wheels
    if (wheels !== undefined && str(wheels.value.part, 'wheel-standart') !== 'wheel-standart') {
      later(gen, fitWheels(car.id, box, str(wheels.value.part, ''), num(wheels.value.rim, 0xd8dde6), num(wheels.value.tire, 0x2a2c34), num(wheels.value.size, 1)))
    }
    const spoiler = mods.spoiler
    if (spoiler !== undefined && str(spoiler.value.part, 'none') !== 'none') {
      const c = num(spoiler.value.color, 0)
      later(gen, fitSpoiler(root, car.id, box, str(spoiler.value.part, ''), c === 0 ? body : c, num(spoiler.value.scale, 1)))
    }
    const neon = mods.neon
    if (neon !== undefined && str(neon.value.anim, 'off') !== 'off') {
      const n = buildNeon(num(neon.value.color, 0x29c8ff), str(neon.value.anim, 'steady'), box)
      add(n.obj)
      animated.push(n)
    }
    const decal = mods.decal
    if (decal !== undefined && str(decal.value.part, 'none') !== 'none') {
      try {
        add(buildDecal(str(decal.value.part, ''), box, root, num(decal.value.color, 0xffffff)))
      } catch (error) {
        console.error('Decal could not be projected:', error)
      }
    }
    const trail = mods.trail
    if (look.trailPreview === true && trail !== undefined && str(trail.value.part, 'none') !== 'none') {
      const t = buildTrailPreview(num(trail.value.color, 0xffffff), box)
      add(t.obj)
      animated.push(t)
    }
  }

  set(first)
  return {
    set,
    update(t) {
      for (const a of animated) a.update(t)
    },
    dispose() {
      disposed = true
      clear()
      for (const m of owned) m.dispose()
    },
  }
}
