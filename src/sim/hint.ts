/**
 * Which form button to flash (first race, or with hints switched on). It must never teach a
 * move that fails where the car is now: over a gap or up the climb the next form is shown
 * only inside the perfect window, and a car that already switched for the coming surface is
 * never told to switch back.
 */
import { FORM_FOR, PERFECT_WINDOW, type FormId, type Surface } from './forms'
import type { RacerState } from './racer'
import type { Track } from './track'

/** On road, ice or water an early switch costs nothing, so the cue can come this early. */
const SAFE_LEAD_S = 1
/** Already wearing the coming form this long before the boundary counts as switched early. */
const PRE_SWITCH_S = 2

/** Surfaces you cannot leave early: the car falls (gap) or slides back (climb). */
const committed = (s: Surface): boolean => s === 'gap' || s === 'climb'

export function formHint(st: RacerState, track: Track): FormId | null {
  const here = track.surfaceAt(st.s)
  const needNow = FORM_FOR[here]
  const next = track.nextBoundary(st.s)
  const ttb = next === null ? Infinity : (next.s - st.s) / Math.max(st.speed, 1)
  if (st.form !== needNow) {
    if (next !== null && st.form === FORM_FOR[next.surface] && ttb <= PRE_SWITCH_S) return null
    return needNow
  }
  if (next === null) return null
  const lead = committed(here) ? PERFECT_WINDOW : SAFE_LEAD_S
  return ttb <= lead ? FORM_FOR[next.surface] : null
}
