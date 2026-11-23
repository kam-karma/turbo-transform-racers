import { describe, expect, it } from 'vitest'
import { add, cross, dot, len, lerp, norm, scale, sub, v3 } from './vec'

describe('vec', () => {
  it('normalises a vector to unit length', () => {
    const n = norm(v3(3, 0, 4))
    expect(n.x).toBeCloseTo(0.6)
    expect(n.y).toBeCloseTo(0)
    expect(n.z).toBeCloseTo(0.8)
  })

  it('crosses x and y into z', () => {
    expect(cross(v3(1, 0, 0), v3(0, 1, 0))).toEqual(v3(0, 0, 1))
  })

  it('adds, subtracts, scales, dots, measures and lerps', () => {
    expect(add(v3(1, 2, 3), v3(1, 1, 1))).toEqual(v3(2, 3, 4))
    expect(sub(v3(1, 2, 3), v3(1, 1, 1))).toEqual(v3(0, 1, 2))
    expect(scale(v3(1, 2, 3), 2)).toEqual(v3(2, 4, 6))
    expect(dot(v3(1, 2, 3), v3(4, 5, 6))).toBe(32)
    expect(len(v3(2, 3, 6))).toBe(7)
    expect(lerp(v3(0, 0, 0), v3(10, 20, 30), 0.5)).toEqual(v3(5, 10, 15))
  })

  it('leaves a zero vector at zero instead of NaN', () => {
    expect(norm(v3(0, 0, 0))).toEqual(v3(0, 0, 0))
  })
})
