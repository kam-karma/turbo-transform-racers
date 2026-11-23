import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type RaceInput } from '../../sim/racer'
import { buildKurguTrack, kurguTrack, type KPiece } from './kurguTrack'
import { newKurgu, resetKurguTo, stepKurgu, type KurguEvent, type KurguState } from './kurguRacer'
import type { PartId } from './parts'

// 0 road(row wing|drill|treads @20) · 200 gap 60 · 260 road(row float|magnet @20, coins) · 460 water 120
// 580 road wall 100 · 680 road 160 (block obstacle @80 d0) · 840 climb 70 · 910 road 120 ramp · 1030 road 300
const pieces: KPiece[] = [
  { len: 200, surface: 'road', row: 'wing|drill|treads', zone: 'cocuk' },
  { len: 60, surface: 'gap' },
  { len: 200, surface: 'road', row: 'float|magnet', coins: { n: 6, d: 4.2 } },
  { len: 120, surface: 'water', zone: 'banyo' },
  { len: 100, surface: 'road', wall: true },
  { len: 160, surface: 'road', obs: [[80, 0, 'block']], hidden: { at: 30, d: -5, part: 'rocket' } },
  { len: 70, surface: 'climb', pitchTo: 28, width: 12 },
  { len: 120, surface: 'road', pitchTo: 7, ramp: true },
  { len: 300, surface: 'road', pitchTo: 0, row: 'rocket|wing' },
]
const kt = buildKurguTrack(kurguTrack('t', 'Test', pieces, { kind: 'combo' }))

const holdD = (target: number) => (k: KurguState): RaceInput => ({
  throttle: 1, brake: 0, form: null, steer: Math.max(-1, Math.min(1, (target - k.r.d) * 0.3 - k.r.yaw * 1.5)),
})

function drive(k: KurguState, until: (k: KurguState) => boolean, input: (k: KurguState) => RaceInput = holdD(0), maxS = 120): { k: KurguState; ev: KurguEvent[] } {
  const ev: KurguEvent[] = []
  for (let t = 0; t < maxS && !until(k) && !k.r.finished; t += 1 / 60) {
    const r = stepKurgu(k, input(k), DEFAULT_PARAMS, kt, 1 / 60)
    k = r.st
    ev.push(...r.events)
  }
  return { k, ev }
}

const kinds = (ev: KurguEvent[]): string[] => ev.map((e) => e.kind)
const withParts = (s: number, parts: PartId[], speed = 30): KurguState => ({ ...newKurgu(kt, s, 0, parts), r: { ...newKurgu(kt, s, 0).r, speed } })

describe('Kurgu racer', () => {
  it('starts bare and never changes the state it is given', () => {
    const k = newKurgu(kt, 5, 0)
    expect(k.lo.front).toBeNull()
    const copy = JSON.stringify(k)
    stepKurgu(k, holdD(0)(k), DEFAULT_PARAMS, kt, 1 / 60)
    expect(JSON.stringify(k)).toBe(copy)
  })

  it('picks up the part in the lane it drives through', () => {
    const { k, ev } = drive(newKurgu(kt, 5, 0), (x) => x.r.s > 40)
    expect(k.lo.front?.id).toBe('drill')
    expect(kinds(ev)).toContain('pickup')
    const left = drive(newKurgu(kt, 5, 4.6), (x) => x.r.s > 40, holdD(4.6)).k
    expect(left.lo.side?.id).toBe('wing')
  })

  it('glides the gap with a wing and takes the slower detour without one, never falling', () => {
    const glide = drive(withParts(150, ['wing']), (x) => x.r.s > 290)
    expect(kinds(glide.ev)).toContain('gate')
    expect(kinds(glide.ev)).not.toContain('fall')
    const bare = drive(withParts(150, []), (x) => x.r.s > 290)
    expect(kinds(bare.ev)).toContain('detour')
    expect(kinds(bare.ev)).not.toContain('fall')
    expect(bare.k.r.time).toBeGreaterThan(glide.k.r.time + 0.5)
  })

  it('floats over water with float wheels, faster than the detour', () => {
    const fl = drive(withParts(420, ['float']), (x) => x.r.s > 600)
    const bare = drive(withParts(420, []), (x) => x.r.s > 600)
    expect(kinds(fl.ev)).toContain('gate')
    expect(bare.k.r.time).toBeGreaterThan(fl.k.r.time + 0.5)
  })

  it('drills through the toy wall; without a drill it goes round', () => {
    expect(kinds(drive(withParts(540, ['drill']), (x) => x.r.s > 700).ev)).toContain('wallBreak')
    const bare = drive(withParts(540, []), (x) => x.r.s > 700).ev
    expect(kinds(bare)).toContain('detour')
    expect(kinds(bare)).not.toContain('wallBreak')
  })

  it('a hard hit knocks off the last part, which lands ahead and can be taken back', () => {
    const start = withParts(720, ['rocket', 'magnet'], 38)
    const hit = drive(start, (x) => x.r.s > 762)
    expect(kinds(hit.ev)).toContain('hit')
    expect(kinds(hit.ev)).toContain('knock')
    expect(hit.k.lo.front).toBeNull()
    expect(hit.k.drops).toHaveLength(1)
    const drop = hit.k.drops[0]
    expect(drop.s).toBeGreaterThan(762)
    const back = drive(hit.k, (x) => x.r.s > drop.s + 2, holdD(drop.d))
    expect(back.k.lo.front?.id).toBe('magnet')
  })

  it('the eraser bumper or the big wheel shrug the obstacle off', () => {
    expect(kinds(drive(withParts(720, ['bumper'], 38), (x) => x.r.s > 790).ev)).not.toContain('hit')
    expect(kinds(drive(withParts(720, ['bigwheel'], 38), (x) => x.r.s > 790).ev)).toContain('smash')
  })

  it('the magnet pulls coins from further away', () => {
    const plain = drive(withParts(250, []), (x) => x.r.s > 455).k.r.coins
    const mag = drive(withParts(250, ['magnet']), (x) => x.r.s > 455).k.r.coins
    expect(plain).toBe(0)
    expect(mag).toBe(6)
  })

  it('climbs with treads faster than the detour', () => {
    const tr = drive(withParts(800, ['treads']), (x) => x.r.s > 920)
    const bare = drive(withParts(800, []), (x) => x.r.s > 920)
    expect(bare.k.r.time).toBeGreaterThan(tr.k.r.time + 0.3)
  })

  it('wing + rocket is the flight combo: it flies off the ramp lip', () => {
    const k0 = newKurgu(kt, 880, 0, ['wing', 'rocket'])
    let maxY = 0
    const { ev } = drive({ ...k0, r: { ...k0.r, speed: 35 } }, (x) => {
      maxY = Math.max(maxY, x.r.y)
      return x.r.s > 1080
    })
    expect(kinds(ev)).toContain('flight')
    expect(maxY).toBeGreaterThan(4)
    const solo = newKurgu(kt, 880, 0, ['rocket'])
    expect(kinds(drive({ ...solo, r: { ...solo.r, speed: 35 } }, (x) => x.r.s > 1040).ev)).toContain('rocket')
  })

  it('announces a new combo when the second part clicks in', () => {
    const k0 = newKurgu(kt, 1040, 4.6, ['wing'])
    const { k, ev } = drive({ ...k0, r: { ...k0.r, speed: 30 } }, (x) => x.r.s > 1080, holdD(4.6))
    expect(k.lo.back?.id).toBe('rocket')
    expect(ev.filter((e) => e.kind === 'combo').map((e) => e.combo)).toEqual(['flight'])
    expect(k.combos).toEqual(['flight'])
  })

  it('finds the hidden part off the racing line', () => {
    const { k, ev } = drive(newKurgu(kt, 690, -5), (x) => x.r.s > 740, holdD(-5))
    expect(kinds(ev)).toContain('hidden')
    expect(k.hidden).toBe(true)
    expect(k.lo.back?.id).toBe('rocket')
  })

  it('reset puts the car back with its parts and fresh lookups', () => {
    const k = drive(newKurgu(kt, 5, 0), (x) => x.r.s > 300).k
    const r = resetKurguTo(k, kt, 100, 20)
    expect(r.r.s).toBe(100)
    expect(r.lo.front?.id).toBe('drill')
    expect(r.route).toBeNull()
    expect(r.nextRow).toBe(1)
  })
})
