import { describe, expect, it } from 'vitest'
import type { FormId } from './forms'
import { formHint } from './hint'
import { newRacer } from './racer'
import { buildTrack } from './track'
import { pathTrack } from './trackPath'

// road 0-400 · water 400-700 · road 700-900 · ramp road 900-1000 · gap 1000-1070
// road 1070-1370 · climb 1370-1460 · road 1460-1660
const track = buildTrack(pathTrack('test', 'Test', [
  { len: 400, surface: 'road' },
  { len: 300, surface: 'water' },
  { len: 200, surface: 'road' },
  { len: 100, surface: 'road', pitchTo: 9, ramp: true },
  { len: 70, surface: 'gap', pitchTo: -6 },
  { len: 300, surface: 'road', pitchTo: 0 },
  { len: 90, surface: 'climb', pitchTo: 30, width: 12 },
  { len: 200, surface: 'road', pitchTo: 0 },
]))

const at = (s: number, speed: number, form: FormId) => ({ ...newRacer(track, s, 0), speed, form })

describe('formHint (review C3: the tutorial must never teach a fatal move)', () => {
  it('stays quiet while gliding over the middle of a gap', () => {
    expect(formHint(at(1030, 30, 'glider'), track)).toBeNull()
  })

  it('asks for the car only inside the perfect window at the end of a gap', () => {
    expect(formHint(at(1064, 30, 'glider'), track)).toBe('car')
    expect(formHint(at(1050, 30, 'glider'), track)).toBeNull()
  })

  it('does not ask a freshly respawned glider to switch back to the car before the gap', () => {
    expect(formHint(at(970, 25, 'glider'), track)).toBeNull()
  })

  it('asks for the climber only in the window, and never the car halfway up the wall', () => {
    expect(formHint(at(1420, 10, 'climber'), track)).toBeNull()
    expect(formHint(at(1457, 10, 'climber'), track)).toBe('car')
  })

  it('on road, flashes the coming form about a second ahead, not earlier', () => {
    expect(formHint(at(370, 40, 'car'), track)).toBe('boat')
    expect(formHint(at(280, 40, 'car'), track)).toBeNull()
  })

  it('asks for the right form when the car is plainly in the wrong one', () => {
    expect(formHint(at(100, 30, 'boat'), track)).toBe('car')
    expect(formHint(at(500, 30, 'car'), track)).toBe('boat')
  })
})
