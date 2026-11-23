/**
 * The big set pieces that make each room read at a glance and make the car feel tiny: a
 * giant teddy bear and a block castle in the kid's room, a dining set in the kitchen, a
 * washbasin with its mirror in the bathroom, a tree and a fountain in the garden, the family
 * car's giant wheel and a bicycle in the garage. Placed in the largest free floor spots.
 */
import type { ZoneId } from '../sim/kurguTrack'
import { BOX, CONE, CYL, RBOX, SPHERE, TORUS } from './batch'
import type { PropDef } from './props'

const teddy: PropDef = { r: 34, h: 70, build: (p) => {
  const fur = 0xc98b4f
  p.part('fabric', SPHERE(24), fur, 0, 20, 0, 40, 42, 34)
  p.part('fabric', SPHERE(24), 0xf1d2a8, 0, 18, 12, 24, 26, 14)
  p.part('fabric', SPHERE(24), fur, 0, 52, 2, 30, 28, 28)
  p.part('fabric', SPHERE(20), 0xf1d2a8, 0, 48, 15, 13, 10, 8)
  p.part('plastic', SPHERE(12), 0x3a2418, 0, 51, 19, 4.5, 3.5, 3)
  for (const s of [-1, 1]) {
    p.part('fabric', SPHERE(18), fur, s * 12, 66, 0, 11, 11, 7)
    p.part('fabric', SPHERE(18), 0xa8703c, s * 12, 66, 2.5, 6.5, 6.5, 3)
    p.part('plastic', SPHERE(14), 0x1c1c22, s * 6.5, 56, 13.5, 3.4, 3.8, 2.4)
    p.part('fabric', SPHERE(20), fur, s * 22, 26, 6, 13, 26, 13, 0.3, 0, s * 0.5)
    p.part('fabric', SPHERE(20), fur, s * 12, 7, 18, 14, 13, 22)
    p.part('fabric', SPHERE(16), 0xf1d2a8, s * 12, 7, 28.5, 9, 9, 2)
  }
  p.part('fabric', CONE(16), 0xe8352c, -4, 39, 15, 8, 6, 3, Math.PI / 2, 0, 0.9)
  p.part('fabric', CONE(16), 0xe8352c, 4, 39, 15, 8, 6, 3, Math.PI / 2, 0, -0.9)
  p.part('fabric', SPHERE(12), 0xd8342c, 0, 39, 16, 4, 4, 3)
} }

const castle: PropDef = { r: 34, h: 56, build: (p, rnd) => {
  const cols = [0xff5a5a, 0x3fa9ff, 0xffd23f, 0x4fd16a, 0xa77bff, 0xff9a3c]
  for (const [x, z] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) {
    for (let k = 0; k < 6; k++) p.part('plastic', RBOX(0.12), cols[(k + Math.abs(x)) % cols.length], x, 4 + k * 8, z, 13, 8, 13)
    p.part('plastic', CONE(4), 0xe8352c, x, 58, z, 15, 14, 15, 0, Math.PI / 4, 0)
  }
  for (const [x, z, w, d] of [[0, -22, 32, 8], [0, 22, 32, 8], [-22, 0, 8, 32], [22, 0, 8, 32]]) {
    for (let k = 0; k < 3; k++) p.part('plastic', RBOX(0.1), cols[Math.floor(rnd() * cols.length)], x, 4 + k * 8, z, w, 8, d)
  }
  p.part('plastic', RBOX(0.2), 0x7a4a2a, 0, 8, 26.5, 12, 16, 1)
  p.part('plastic', CYL(4), 0x9a6a4a, 22, 70, 22, 0.6, 16, 0.6)
  p.part('fabric', BOX(), 0xffd23f, 26, 74, 22, 8, 5, 0.3)
} }

const diningSet: PropDef = { r: 44, h: 46, build: (p) => {
  p.part('wood', RBOX(0.05), 0xd3a26a, 0, 29, 0, 54, 2.6, 40)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('wood', CYL(14), 0xb8803f, x * 23, 14, z * 16, 3, 28, 3)
  p.part('fabric', BOX(), 0xfff4e6, 0, 30.5, 0, 30, 0.3, 42)
  for (const [x, z, ry] of [[-38, 0, Math.PI / 2], [38, 0, -Math.PI / 2], [0, -32, 0], [0, 32, Math.PI]] as const) {
    p.part('wood', RBOX(0.1), 0xc98a52, x, 18, z, 18, 2, 18, 0, ry)
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.part('wood', CYL(8), 0xb8773f, x + a * 7.5, 9, z + b * 7.5, 1.8, 18, 1.8)
    const bx = x - Math.sin(ry) * 8
    const bz = z - Math.cos(ry) * 8
    p.part('wood', RBOX(0.1), 0xc98a52, bx, 30, bz, Math.abs(Math.sin(ry)) > 0.5 ? 1.6 : 18, 20, Math.abs(Math.sin(ry)) > 0.5 ? 18 : 1.6)
  }
  p.part('plastic', CYL(20), 0xffffff, 0, 31, 0, 16, 1.2, 16)
  for (const [x, z, c] of [[-3, -2, 0xe8352c], [3, 1, 0xff9a1f], [0, 3, 0x9be15d]] as const) p.part('plastic', SPHERE(16), c, x, 34.5, z, 6, 6, 6)
} }

const vanity: PropDef = { r: 34, h: 90, build: (p) => {
  p.part('wood', RBOX(0.04), 0xffffff, 0, 16, 0, 56, 32, 24)
  for (const x of [-14, 14]) {
    p.part('wood', RBOX(0.05), 0x9fdcd6, x, 16, 12.3, 25, 26, 0.8)
    p.part('metal', RBOX(0.4), 0xd9dde3, x - Math.sign(x) * 9, 16, 13.2, 1, 8, 1)
  }
  p.part('plastic', RBOX(0.1), 0xf7f7f7, 0, 33, 0, 60, 2, 26)
  p.part('plastic', CYL(28), 0xe9f3f5, 0, 32.4, 1, 26, 2.4, 16)
  p.part('metal', CYL(10), 0xd9dde3, 0, 38, -8, 2, 10, 2)
  p.part('metal', CYL(10), 0xd9dde3, 0, 42.5, -4.5, 1.6, 8, 1.6, Math.PI / 2)
  p.part('metal', RBOX(0.1), 0xd9dde3, 0, 66, -11.5, 50, 40, 1)
  p.part('glow', RBOX(0.05), 0xcfe8f2, 0, 66, -10.8, 46, 36, 0.3)
  p.part('plastic', CYL(16), 0xff9ec0, 22, 37.5, 4, 5, 7, 5)
  for (const [x, c] of [[19, 0x3fa9ff], [24, 0xffd23f]] as const) p.part('plastic', CYL(8), c, x, 44, 4, 0.9, 12, 0.9, 0.15, 0, (x - 21) * 0.08)
} }

const tree: PropDef = { r: 40, h: 160, build: (p) => {
  p.part('wood', CYL(16), 0x7a5232, 0, 50, 0, 18, 100, 18)
  for (const [x, z, s] of [[0, 0, 80], [-26, 10, 52], [24, -8, 56], [6, 24, 48]]) p.part('matte', SPHERE(18), 0x58b23e, x, 110 + (s - 50) * 0.3, z, s, s * 0.8, s)
  for (const [x, z] of [[-10, 18], [16, 10], [-18, -12]]) p.part('plastic', SPHERE(12), 0xe8352c, x, 96, z, 5, 5, 5)
} }

const fountain: PropDef = { r: 32, h: 34, build: (p) => {
  p.part('matte', CYL(32), 0xb9b4aa, 0, 4, 0, 60, 8, 60)
  p.part('matte', CYL(32), 0x5fc8e8, 0, 7.6, 0, 54, 1, 54)
  p.part('matte', CYL(16), 0xb9b4aa, 0, 18, 0, 6, 24, 6)
  p.part('matte', CYL(24), 0xb9b4aa, 0, 30, 0, 24, 3, 24)
  p.part('glow', SPHERE(14), 0xb8f0ff, 0, 34, 0, 10, 8, 10)
} }

const bigWheel: PropDef = { r: 38, h: 74, build: (p) => {
  p.part('matte', TORUS(0.32), 0x26272c, 0, 36, 0, 64, 64, 64, 0, Math.PI / 2, 0)
  p.part('metal', CYL(28), 0xc9ced6, 0, 36, 0, 36, 22, 36, 0, 0, Math.PI / 2)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    p.part('metal', CYL(10), 0x9aa0aa, 11.6, 36 + Math.sin(a) * 9, Math.cos(a) * 9, 2.4, 1.2, 2.4, 0, 0, Math.PI / 2)
  }
  p.part('matte', BOX(), 0x3a3b40, 0, 70, 0, 26, 4, 80)
} }

const bicycle: PropDef = { r: 46, h: 70, build: (p) => {
  for (const z of [-30, 30]) {
    p.part('matte', TORUS(0.07), 0x26272c, 0, 24, z, 48, 48, 48, 0, Math.PI / 2, 0)
    p.part('metal', CYL(10), 0xc9ced6, 0, 24, z, 2, 4, 2, 0, 0, Math.PI / 2)
  }
  p.part('metal', CYL(10), 0x3fa9ff, 0, 40, -6, 2.4, 50, 2.4, 1.1, 0, 0)
  p.part('metal', CYL(10), 0x3fa9ff, 0, 38, 12, 2.4, 40, 2.4, -0.5, 0, 0)
  p.part('fabric', RBOX(0.4), 0x2a2b30, 0, 56, -16, 6, 3, 14)
  p.part('metal', CYL(10), 0xc9ced6, 0, 62, 22, 1.6, 26, 1.6, 0, 0, Math.PI / 2)
} }

export const ZONE_HEROES: Readonly<Record<ZoneId, readonly PropDef[]>> = {
  cocuk: [teddy, castle],
  mutfak: [diningSet, diningSet],
  banyo: [vanity, vanity],
  bahce: [tree, fountain, tree],
  garaj: [bigWheel, bicycle],
}

