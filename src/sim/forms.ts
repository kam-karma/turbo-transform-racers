/**
 * The four forms of the Dönüşüm (transformation) cup, which surface each one is made for,
 * and how a form change is judged against the next surface boundary.
 */
export type Surface = 'road' | 'ice' | 'water' | 'gap' | 'climb'
export type FormId = 'car' | 'boat' | 'glider' | 'climber'

export const FORMS: readonly FormId[] = ['car', 'boat', 'glider', 'climber']

export const FORM_FOR: Readonly<Record<Surface, FormId>> = {
  road: 'car',
  ice: 'car',
  water: 'boat',
  gap: 'glider',
  climb: 'climber',
}

/**
 * Top-speed multiplier of a form on a surface. The gap column only applies while gliding
 * over it; forms that cannot glide simply fall (racer.ts).
 */
const SPEED: Readonly<Record<FormId, Readonly<Record<Surface, number>>>> = {
  car: { road: 1, ice: 1, water: 0.3, gap: 1, climb: 0.25 },
  boat: { road: 0.4, ice: 0.5, water: 1.05, gap: 1, climb: 0.25 },
  glider: { road: 0.55, ice: 0.6, water: 0.3, gap: 1, climb: 0.25 },
  climber: { road: 0.6, ice: 0.6, water: 0.3, gap: 1, climb: 1 },
}

export const formSpeedMul = (form: FormId, surface: Surface): number => SPEED[form][surface]

/** Seconds before a surface change in which switching to the right form is "perfect". */
export const PERFECT_WINDOW = 0.3

export type SwitchVerdict = 'perfect' | 'early' | 'late' | 'none'

/**
 * `timeToBoundary` is in seconds at the current speed: positive before the boundary,
 * negative once past it. Only a switch to the form the next surface needs is judged.
 */
export function judgeSwitch(timeToBoundary: number, newForm: FormId, nextSurface: Surface): SwitchVerdict {
  if (FORM_FOR[nextSurface] !== newForm) return 'none'
  if (timeToBoundary < 0) return 'late'
  return timeToBoundary <= PERFECT_WINDOW ? 'perfect' : 'early'
}
