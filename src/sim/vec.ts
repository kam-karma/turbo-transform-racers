/** Small immutable 3D vector helpers for the pure simulation (no Three.js in sim/). */
export interface V3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z })
export const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
export const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
export const scale = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k)
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: V3, b: V3): V3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
export const len = (a: V3): number => Math.hypot(a.x, a.y, a.z)
export const lerp = (a: V3, b: V3, t: number): V3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)

export function norm(a: V3): V3 {
  const l = len(a)
  return l > 1e-12 ? scale(a, 1 / l) : v3(0, 0, 0)
}
