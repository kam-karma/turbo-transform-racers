/**
 * Giant toys and household things, one small builder each, grouped by zone. A builder draws
 * at the placer's origin (local +z = facing) and returns its footprint radius and height so
 * the scatterer can keep it clear of the road.
 */
import { BOX, CONE, CYL, HEX, Placer, RBOX, SPHERE, TORUS } from './batch'
import type { ZoneId } from '../sim/kurguTrack'

export interface PropDef {
  readonly r: number
  readonly h: number
  readonly build: (p: Placer, rnd: () => number) => void
}

const TOY = [0xff5a5a, 0x3fa9ff, 0xffd23f, 0x4fd16a, 0xff9a3c, 0xa77bff, 0xff7eb6, 0x1fc8c8]
const pick = (rnd: () => number): number => TOY[Math.floor(rnd() * TOY.length) % TOY.length]

const block = (p: Placer, c: number, x: number, y: number, z: number, s: number, yaw = 0): void => {
  p.part('plastic', RBOX(0.12), c, x, y + s * 0.4, z, s, s * 0.8, s, 0, yaw)
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('plastic', CYL(10), c, x + a * s * 0.24, y + s * 0.85, z + b * s * 0.24, s * 0.28, s * 0.12, s * 0.28)
}

// --- kid's room ---------------------------------------------------------------------------
const blockTower: PropDef = { r: 14, h: 36, build: (p, rnd) => {
  let y = 0
  for (let i = 0; i < 5; i++) {
    const s = 10 - i * 0.8
    block(p, pick(rnd), (rnd() - 0.5) * 2, y, (rnd() - 0.5) * 2, s, rnd() * 0.6)
    y += s * 0.8
  }
} }
const ball: PropDef = { r: 12, h: 22, build: (p, rnd) => {
  const c = pick(rnd)
  p.part('plastic', SPHERE(24), c, 0, 11, 0, 22, 22, 22)
  p.part('plastic', TORUS(0.08), 0xffffff, 0, 11, 0, 22.3, 22.3, 22.3, Math.PI / 2 + 0.3, 0, 0.4)
} }
const rings: PropDef = { r: 10, h: 34, build: (p) => {
  p.part('wood', CYL(16), 0xf2d09a, 0, 1.5, 0, 18, 3, 18)
  p.part('wood', CYL(12), 0xf2d09a, 0, 16, 0, 2.6, 30, 2.6)
  const cs = [0xff5a5a, 0xff9a3c, 0xffd23f, 0x4fd16a, 0x3fa9ff, 0xa77bff]
  cs.forEach((c, i) => p.part('plastic', TORUS(0.32), c, 0, 4.5 + i * 3.8, 0, 16 - i * 1.8, 16 - i * 1.8, 16 - i * 1.8, Math.PI / 2))
  p.part('plastic', SPHERE(14), 0xff5a5a, 0, 31.5, 0, 4.5, 4.5, 4.5)
} }
const crayons: PropDef = { r: 12, h: 3, build: (p, rnd) => {
  for (let i = 0; i < 6; i++) {
    const c = TOY[i]
    const x = (rnd() - 0.5) * 14
    const z = (rnd() - 0.5) * 14
    const yaw = rnd() * Math.PI
    p.part('matte', CYL(10), c, x, 1, z, 1.8, 11, 1.8, Math.PI / 2, yaw, 0)
    p.part('matte', CONE(10), c, x + Math.sin(yaw) * 6.6, 1, z + Math.cos(yaw) * 6.6, 1.8, 2.2, 1.8, Math.PI / 2, yaw, 0)
  }
} }
const pencil: PropDef = { r: 18, h: 3, build: (p, rnd) => {
  const c = pick(rnd)
  p.part('wood', HEX(), c, 0, 1.4, 0, 2.8, 30, 2.8, Math.PI / 2, 0, 0)
  p.part('wood', CONE(6), 0xf3d1a0, 0, 1.4, 17.2, 2.8, 4.4, 2.8, Math.PI / 2, 0, 0)
  p.part('matte', CONE(6), 0x333333, 0, 1.4, 19.2, 0.9, 1.2, 0.9, Math.PI / 2, 0, 0)
  p.part('metal', CYL(10), 0xd9c07a, 0, 1.4, -15.8, 2.9, 1.8, 2.9, Math.PI / 2, 0, 0)
  p.part('matte', CYL(10), 0xff9ec0, 0, 1.4, -17.6, 2.8, 2.2, 2.8, Math.PI / 2, 0, 0)
} }
const train: PropDef = { r: 20, h: 16, build: (p, rnd) => {
  for (let k = 0; k < 3; k++) {
    const z = k * -13
    const c = k === 0 ? 0xff5a5a : pick(rnd)
    p.part('plastic', RBOX(0.15), c, 0, 4.5, z, 8, 6, 11)
    for (const sx of [-1, 1]) for (const sz of [-3, 3]) p.part('plastic', CYL(14), 0x333a55, sx * 4.4, 2.2, z + sz, 4.4, 1.2, 4.4, 0, 0, Math.PI / 2)
    if (k === 0) {
      p.part('plastic', RBOX(0.15), 0x3fa9ff, 0, 10, z - 2.5, 8.4, 5, 6)
      p.part('plastic', CYL(12), 0x333a55, 0, 10, z + 4, 2.4, 6, 2.4)
    }
  }
} }
const top: PropDef = { r: 9, h: 18, build: (p, rnd) => {
  p.part('plastic', CONE(18), pick(rnd), 0, 5, 0, 16, 10, 16, Math.PI)
  p.part('plastic', SPHERE(18), pick(rnd), 0, 11, 0, 16, 6, 16)
  p.part('wood', CYL(8), 0xf2d09a, 0, 15, 0, 1.6, 7, 1.6)
} }
const wardrobe: PropDef = { r: 26, h: 90, build: (p) => {
  p.part('wood', RBOX(0.03), 0xe9d4b1, 0, 44, 0, 52, 88, 24)
  for (const x of [-13, 13]) {
    p.part('wood', RBOX(0.04), 0xf5e6c8, x, 46, 12.4, 24, 76, 1.2)
    p.part('metal', SPHERE(10), 0xd9b36a, x - Math.sign(x) * 9, 46, 13.6, 2, 2, 2)
  }
  p.part('wood', BOX(), 0xd8bf96, 0, 3, 0, 50, 6, 22)
} }
const bookcase: PropDef = { r: 22, h: 72, build: (p, rnd) => {
  p.part('wood', BOX(), 0xb8773f, 0, 36, -10, 40, 72, 1.2)
  for (const x of [-20, 20]) p.part('wood', BOX(), 0xb8773f, x, 36, 0, 1.6, 72, 20)
  for (let y = 0; y <= 72; y += 18) p.part('wood', BOX(), 0xc98a52, 0, y + 0.8, 0, 40, 1.6, 20)
  for (let y = 0; y < 72; y += 18) {
    let x = -18
    while (x < 17) {
      const w = 1.6 + rnd() * 1.6
      const h = 11 + rnd() * 5
      p.part('wood', RBOX(0.1), pick(rnd), x + w / 2, y + 1.6 + h / 2, 0, w, h, 14)
      x += w + 0.2
    }
  }
} }

// --- kitchen ------------------------------------------------------------------------------
const chair: PropDef = { r: 16, h: 40, build: (p) => {
  p.part('wood', RBOX(0.1), 0xc98a52, 0, 18, 0, 20, 2, 20)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('wood', CYL(10), 0xb8773f, x * 8.5, 9, z * 8.5, 2, 18, 2)
  p.part('wood', RBOX(0.1), 0xc98a52, 0, 30, -9, 20, 4, 1.6)
  for (const x of [-8.5, 8.5]) p.part('wood', CYL(10), 0xb8773f, x, 28, -9, 2, 20, 2)
} }
const fruit: PropDef = { r: 12, h: 12, build: (p, rnd) => {
  p.part('plastic', SPHERE(20), 0xe8352c, 0, 5, 0, 10, 9.5, 10)
  p.part('wood', CYL(6), 0x6b4423, 0, 10.5, 0, 0.6, 2.4, 0.6)
  p.part('matte', SPHERE(10), 0x4fd16a, 1.4, 11, 0, 3, 0.6, 1.6, 0, 0, 0.4)
  p.part('plastic', SPHERE(20), 0xff9a1f, 9 + rnd() * 2, 4.2, 4, 8.4, 8.4, 8.4)
} }
const cereal: PropDef = { r: 12, h: 28, build: (p) => {
  p.part('matte', BOX(), 0xffc93c, 0, 14, 0, 18, 28, 6)
  p.part('matte', BOX(), 0xff5a5a, 0, 20, 3.05, 14, 8, 0.2)
  p.part('matte', SPHERE(12), 0xffffff, 0, 10, 3.1, 8, 8, 0.3)
} }
const fridge: PropDef = { r: 22, h: 96, build: (p) => {
  p.part('plastic', RBOX(0.06), 0xf4f9ff, 0, 48, 0, 40, 96, 32)
  p.part('plastic', BOX(), 0xd5dde6, 0, 62, 16.1, 40, 0.6, 0.4)
  for (const y of [40, 76]) p.part('metal', RBOX(0.4), 0xc9ced6, -15, y, 17, 1.6, 14, 1.6)
  p.part('plastic', RBOX(0.3), 0xff6b5a, 6, 80, 16.4, 5, 5, 0.6)
  p.part('plastic', RBOX(0.3), 0x3fa9ff, 12, 72, 16.4, 4, 6, 0.6)
} }
const stove: PropDef = { r: 22, h: 40, build: (p) => {
  p.part('plastic', RBOX(0.04), 0xfafafa, 0, 18, 0, 36, 36, 26)
  p.part('matte', BOX(), 0x2a2d36, 0, 36.4, 0, 34, 0.8, 24)
  for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) p.part('metal', TORUS(0.12), 0x777b85, x, 37, z, 9, 9, 9, Math.PI / 2)
  p.part('matte', BOX(), 0x2a2d36, 0, 16, 13.1, 26, 16, 0.4)
  p.part('metal', CYL(10), 0xc9ced6, 0, 27, 14, 1, 22, 1, 0, 0, Math.PI / 2)
  p.part('metal', CYL(20), 0xd9dde3, -8, 42, -6, 14, 10, 14)
} }

// --- bathroom -----------------------------------------------------------------------------
const duck: PropDef = { r: 9, h: 14, build: (p) => {
  p.part('plastic', SPHERE(18), 0xffd21f, 0, 5, 0, 12, 9, 15)
  p.part('plastic', SPHERE(18), 0xffd21f, 0, 11.5, 4, 8, 8, 8)
  p.part('plastic', CONE(12), 0xff8a1f, 0, 11, 9, 3, 4, 2.4, Math.PI / 2)
  for (const x of [-1.8, 1.8]) p.part('glow', SPHERE(8), 0x222222, x, 13, 7.2, 1.2, 1.2, 1.2)
} }
const soap: PropDef = { r: 10, h: 6, build: (p) => {
  p.part('plastic', RBOX(0.45), 0xff9ec0, 0, 2.8, 0, 16, 5.6, 10)
  for (let k = 0; k < 4; k++) p.part('plastic', SPHERE(10), 0xffffff, -6 + k * 4, 6 + (k % 2) * 1.6, 2, 3, 3, 3)
} }
const toilet: PropDef = { r: 20, h: 44, build: (p) => {
  p.part('plastic', CYL(24), 0xffffff, 0, 8, 4, 16, 16, 20)
  p.part('plastic', TORUS(0.25), 0xffffff, 0, 16.5, 4, 22, 26, 8, Math.PI / 2)
  p.part('plastic', RBOX(0.12), 0xffffff, 0, 28, -9, 24, 24, 9)
  p.part('metal', RBOX(0.3), 0xc9ced6, 6, 37, -9, 4, 1, 3)
} }
const towel: PropDef = { r: 20, h: 50, build: (p) => {
  p.part('metal', CYL(10), 0xc9ced6, 0, 46, 0, 1.2, 36, 1.2, 0, 0, Math.PI / 2)
  p.part('fabric', RBOX(0.2), 0x58c7b8, -6, 34, 0.8, 14, 24, 2)
  p.part('fabric', RBOX(0.2), 0xff9ec0, 8, 36, 0.8, 12, 20, 2)
} }

// --- garden -------------------------------------------------------------------------------
const flower: PropDef = { r: 12, h: 50, build: (p, rnd) => {
  const h = 30 + rnd() * 18
  p.part('matte', CYL(8), 0x3f8f2f, 0, h / 2, 0, 1.6, h, 1.6)
  p.part('matte', SPHERE(12), 0x58b23e, 4, h * 0.4, 0, 10, 1.2, 5, 0, 0.4, -0.4)
  const c = [0xff5a8a, 0xffd23f, 0xff8a3d, 0xb08cff][Math.floor(rnd() * 4)]
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    p.part('matte', SPHERE(12), c, Math.cos(a) * 4.8, h + 1, Math.sin(a) * 4.8, 7, 1.6, 4.4, 0, -a, 0)
  }
  p.part('matte', SPHERE(12), 0xffc21f, 0, h + 1.8, 0, 4.6, 3, 4.6)
} }
const mushroom: PropDef = { r: 10, h: 18, build: (p) => {
  p.part('matte', CYL(14), 0xfff4e0, 0, 5, 0, 5, 10, 5)
  p.part('plastic', SPHERE(20), 0xe8352c, 0, 11, 0, 16, 9, 16)
  for (const [x, z] of [[3, 2], [-4, 1], [0, -4], [2, -1]]) p.part('matte', SPHERE(8), 0xffffff, x, 15, z, 2.6, 1.2, 2.6)
} }
const stones: PropDef = { r: 12, h: 6, build: (p, rnd) => {
  for (let k = 0; k < 4; k++) p.part('matte', SPHERE(10), [0xa9a59c, 0x8f8a80, 0xc2beb4][k % 3], (rnd() - 0.5) * 16, 2, (rnd() - 0.5) * 16, 6 + rnd() * 5, 4 + rnd() * 2, 6 + rnd() * 4)
} }
const wateringCan: PropDef = { r: 16, h: 26, build: (p) => {
  p.part('metal', CYL(22), 0x3fb58a, 0, 10, 0, 18, 20, 18)
  p.part('metal', CYL(10), 0x3fb58a, 0, 14, 14, 2.4, 20, 2.4, 1.0, 0, 0)
  p.part('metal', CONE(12), 0x3fb58a, 0, 21, 22, 4, 4, 4, -2.2, 0, 0)
  p.part('metal', TORUS(0.12), 0x3fb58a, 0, 22, -4, 14, 12, 12, 0, Math.PI / 2, 0)
} }

// --- garage -------------------------------------------------------------------------------
const tires: PropDef = { r: 14, h: 20, build: (p) => {
  for (let k = 0; k < 3; k++) p.part('matte', TORUS(0.42), 0x2a2b30, (k % 2) * 1.2, 3 + k * 6.2, 0, 20, 20, 20, Math.PI / 2)
} }
const paint: PropDef = { r: 10, h: 14, build: (p, rnd) => {
  const c = pick(rnd)
  p.part('metal', CYL(20), 0xc9ced6, 0, 6, 0, 12, 12, 12)
  p.part('matte', CYL(20), c, 0, 6, 0, 12.2, 7, 12.2)
  p.part('matte', CYL(20), c, 0, 12.1, 0, 10.8, 0.4, 10.8)
  p.part('metal', TORUS(0.08), 0x9aa0aa, 0, 14, 0, 12, 12, 12, 0, 0, 0)
} }
const wrench: PropDef = { r: 18, h: 2, build: (p) => {
  p.part('metal', RBOX(0.3), 0xc9ced6, 0, 0.9, 0, 3.4, 1.6, 26)
  p.part('metal', TORUS(0.3), 0xc9ced6, 0, 0.9, 15, 8, 8, 8, Math.PI / 2)
  p.part('metal', TORUS(0.3), 0xc9ced6, 0, 0.9, -15, 7, 7, 7, Math.PI / 2)
} }
const cone: PropDef = { r: 10, h: 22, build: (p) => {
  p.part('plastic', BOX(), 0xff6a1f, 0, 0.8, 0, 16, 1.6, 16)
  p.part('plastic', CONE(20), 0xff6a1f, 0, 11, 0, 12, 20, 12)
  p.part('plastic', CYL(20), 0xffffff, 0, 10, 0, 7.6, 3, 7.6)
} }
const workbench: PropDef = { r: 30, h: 60, build: (p) => {
  p.part('wood', RBOX(0.04), 0xc98a52, 0, 28, 0, 60, 3, 24)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('metal', BOX(), 0x45505e, x * 27, 13.5, z * 10, 2.4, 27, 2.4)
  p.part('wood', BOX(), 0xd9b98a, 0, 50, -11, 60, 40, 1.2)
  for (let k = 0; k < 5; k++) p.part('metal', RBOX(0.3), [0xd8342c, 0xc9ced6, 0x3fa9ff][k % 3], -22 + k * 11, 48, -10, 2.4, 14, 1.2)
  p.part('metal', RBOX(0.08), 0xd8342c, 14, 33, 0, 20, 7, 10)
} }

export const ZONE_PROPS: Readonly<Record<ZoneId, { readonly floor: readonly PropDef[]; readonly wall: readonly PropDef[] }>> = {
  cocuk: { floor: [blockTower, ball, rings, crayons, pencil, train, top, pencil, blockTower], wall: [wardrobe, bookcase, bookcase] },
  mutfak: { floor: [chair, fruit, cereal, chair, fruit], wall: [fridge, stove, stove] },
  banyo: { floor: [duck, soap, duck, soap], wall: [toilet, towel, towel] },
  bahce: { floor: [flower, flower, mushroom, stones, wateringCan, flower, mushroom, ball], wall: [flower, flower] },
  garaj: { floor: [tires, paint, wrench, cone, paint, tires], wall: [workbench, workbench] },
}
