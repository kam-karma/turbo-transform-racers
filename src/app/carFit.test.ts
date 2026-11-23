import { describe, expect, it } from 'vitest'
import { fitFor, rimPlacements, spoilerMount, type CarFit, type Box3Like } from './carFit'

const box: Box3Like = { min: { x: -1, y: 0, z: -2 }, max: { x: 1, y: 1.5, z: 2 } }
const fit: CarFit = {
  box: [2, 1.5, 4],
  wheels: [
    { x: -0.5, y: 0.2, z: 0.25, r: 0.1 },
    { x: -0.5, y: 0.2, z: 0.75, r: 0.1 },
    { x: 0.5, y: 0.2, z: 0.25, r: 0.1 },
    { x: 0.5, y: 0.2, z: 0.75, r: 0.1 },
  ],
  rearTop: { y: 0.6, z: 0.05 },
  tail: { y: 0.45, z: 0.02 },
}

describe('rimPlacements', () => {
  it('puts a rim on each measured wheel, just outside the tyre wall', () => {
    const rims = rimPlacements(fit, box)
    expect(rims).toHaveLength(4)
    const rearLeft = rims[0]!
    expect(rearLeft.x).toBeLessThan(-1)
    expect(rearLeft.y).toBeCloseTo(0.3)
    expect(rearLeft.z).toBeCloseTo(-1)
    expect(rearLeft.side).toBe(-1)
    expect(rims[3]!.side).toBe(1)
    // the rim covers the hub, not the tyre: smaller than the wheel radius (0.4)
    expect(rearLeft.radius).toBeGreaterThan(0.2)
    expect(rearLeft.radius).toBeLessThan(0.4)
  })

  it('fits no rims on a car without wheels', () => {
    expect(rimPlacements({ ...fit, wheels: [] }, box)).toEqual([])
  })

  it('reports the full wheel radius for fat tyres', () => {
    expect(rimPlacements(fit, box)[0]!.wheelRadius).toBeCloseTo(0.4)
  })
})

describe('spoilerMount', () => {
  it('mounts on the trunk top when the car has no stock spoiler', () => {
    const m = spoilerMount(fit, box, null)
    expect(m.y).toBeCloseTo(0.9)
    expect(m.z).toBeLessThan(-1.5)
    expect(m.span).toBeCloseTo(1.8, 1)
  })

  it('takes the stock spoiler place and width when there is one', () => {
    const stock: Box3Like = { min: { x: -0.7, y: 1.0, z: -1.9 }, max: { x: 0.7, y: 1.3, z: -1.6 } }
    const m = spoilerMount(fit, box, stock)
    expect(m.y).toBeCloseTo(1.0)
    expect(m.z).toBeCloseTo(-1.75)
    expect(m.span).toBeCloseTo(1.4 * 1.08, 2)
  })
})

describe('spoilerMount for a lip (ducktail)', () => {
  it('sits on the tail edge, even when the car has a stock wing', () => {
    const stock: Box3Like = { min: { x: -0.7, y: 1.0, z: -1.9 }, max: { x: 0.7, y: 1.3, z: -1.6 } }
    const m = spoilerMount(fit, box, stock, true)
    expect(m.y).toBeCloseTo(0.675)
    expect(m.z).toBeCloseTo(-1.88)
  })
})

describe('fitFor', () => {
  const all = { kivilcim: fit }
  it('uses the hero car fit for cars without their own model', () => {
    expect(fitFor(all, 'kartal')).toBe(fit)
    expect(fitFor(all, 'kivilcim')).toBe(fit)
  })
})
