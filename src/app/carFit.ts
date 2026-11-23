/**
 * Where garage parts go on each car. The numbers come from Blender (tools/blender/
 * analyze_cars.py → public/models/car-fit.json) as fractions of the car's bounding box, so
 * they hold for the 1 m showroom model and the 3.3 m race car alike.
 */

export interface WheelFit {
  /** Outer face of the tyre: -0.5 (left side) or +0.5 (right side) of the width. */
  readonly x: number
  /** Wheel centre height above the lowest point, as a fraction of the car height. */
  readonly y: number
  /** Wheel centre from the rear (0) to the nose (1), as a fraction of the length. */
  readonly z: number
  /** Wheel radius as a fraction of the length. */
  readonly r: number
}

export interface CarFit {
  readonly box: readonly [number, number, number]
  readonly wheels: readonly (WheelFit | null)[]
  /** Highest point of the tail near the centre line (spoiler mount without a stock wing). */
  readonly rearTop: { readonly y: number; readonly z: number }
  /** The tail edge (trunk lip): where a ducktail goes. */
  readonly tail?: { readonly y: number; readonly z: number }
}

export type CarFits = Readonly<Record<string, CarFit>>

interface V3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Box3Like {
  readonly min: V3
  readonly max: V3
}

/** The fit of a car; cars without their own model drive the hero car (kivilcim). */
export function fitFor(fits: CarFits, carId: string): CarFit | null {
  return fits[carId] ?? fits.kivilcim ?? null
}

export interface RimPlacement {
  readonly x: number
  readonly y: number
  readonly z: number
  /** -1 left (rim faces -X), +1 right. */
  readonly side: -1 | 1
  /** Rim radius: covers the hub inside the tyre. */
  readonly radius: number
  /** The whole wheel's radius (for a fat tyre around it). */
  readonly wheelRadius: number
}

const RIM_OF_WHEEL = 0.68
/** Rims sit a hair outside the tyre wall so they never z-fight with it. */
const OUTSET = 0.012

export function rimPlacements(fit: CarFit, box: Box3Like): RimPlacement[] {
  const W = box.max.x - box.min.x
  const H = box.max.y - box.min.y
  const L = box.max.z - box.min.z
  const cx = (box.min.x + box.max.x) / 2
  const out: RimPlacement[] = []
  for (const w of fit.wheels) {
    if (w === null) continue
    const side = w.x < 0 ? -1 : 1
    const wheelRadius = w.r * L
    out.push({
      x: cx + w.x * W + side * OUTSET * W,
      y: box.min.y + w.y * H,
      z: box.min.z + w.z * L,
      side,
      radius: wheelRadius * RIM_OF_WHEEL,
      wheelRadius,
    })
  }
  return out
}

export interface SpoilerMount {
  readonly x: number
  readonly y: number
  readonly z: number
  /** Wing span the part is scaled to. */
  readonly span: number
}

/**
 * The stock wing's base and width when the car has one (the part replaces it), otherwise
 * the tail top, 90 % of the car width.
 */
export function spoilerMount(fit: CarFit, box: Box3Like, stock: Box3Like | null, lip = false): SpoilerMount {
  const W = box.max.x - box.min.x
  const H = box.max.y - box.min.y
  const L = box.max.z - box.min.z
  const cx = (box.min.x + box.max.x) / 2
  if (lip && fit.tail !== undefined) {
    return { x: cx, y: box.min.y + fit.tail.y * H, z: box.min.z + Math.max(0.03, fit.tail.z) * L, span: W * 0.86 }
  }
  if (stock !== null) {
    return {
      x: (stock.min.x + stock.max.x) / 2,
      y: stock.min.y,
      z: (stock.min.z + stock.max.z) / 2,
      span: (stock.max.x - stock.min.x) * 1.08,
    }
  }
  return { x: cx, y: box.min.y + fit.rearTop.y * H, z: box.min.z + Math.max(0.06, fit.rearTop.z) * L, span: W * 0.9 }
}
