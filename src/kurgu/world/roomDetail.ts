/**
 * Room finishing that sells "a real house, seen from a toy's height": wainscot panels and
 * chair rails on the long walls, crown moulding, and what hangs from each ceiling — glow
 * stars and a planet mobile in the kid's room, pendant lamps over the kitchen, round lights
 * in the bathroom, long tube lights in the garage.
 */
import * as THREE from 'three'
import type { ZoneId } from '../sim/kurguTrack'
import type { HouseLayout, Room } from '../sim/layout'
import { BOX, type BatchSink, CONE, CYL, Placer, RBOX, SPHERE, TORUS } from './batch'

const WAINSCOT: Partial<Record<ZoneId, number>> = { cocuk: 0x7fb6f0, mutfak: 0xf2ede4, banyo: 0x8fd8cf, garaj: 0x8a96a6 }

let starGeo: THREE.BufferGeometry | null = null
function star(): THREE.BufferGeometry {
  if (starGeo !== null) return starGeo
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? 0.5 : 0.22
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false })
  starGeo.rotateX(Math.PI / 2)
  return starGeo
}

function walls(p: Placer, lay: HouseLayout, room: Room, side: number): void {
  const D = room.z1 - room.z0
  const c = WAINSCOT[room.zone]
  const x = side < 0 ? lay.x0 : lay.x1
  const local = (dx: number): number => (x === lay.x0 ? dx : -dx)
  if (c !== undefined) {
    p.part('wood', BOX(), c, local(0.7) + x, 15, 0, 1.2, 26, D)
    for (let z = -D / 2 + 20; z < D / 2 - 10; z += 24) p.part('wood', RBOX(0.1), c, local(1.4) + x, 15, z, 0.4, 18, 18)
    p.part('wood', RBOX(0.2), 0xfffaf0, local(1.5) + x, 28.5, 0, 2, 2.2, D)
  }
  p.part('wood', RBOX(0.2), 0xfffaf0, local(1.6) + x, lay.height - 2, 0, 3.2, 4, D)
}

function ceiling(batches: BatchSink, lay: HouseLayout, room: Room): void {
  const H = lay.height
  const cx = (lay.x0 + lay.x1) / 2
  const W = lay.x1 - lay.x0
  const D = room.z1 - room.z0
  let a = Math.floor(room.z0 * 13 + 7) >>> 0
  const rnd = (): number => ((a = (a * 1103515245 + 12345) >>> 0) % 10000) / 10000
  const p = new Placer(batches, cx, 0, (room.z0 + room.z1) / 2, 0)
  switch (room.zone) {
    case 'cocuk': {
      for (let i = 0; i < 46; i++) {
        const s = 3 + rnd() * 5
        p.part('glow', star(), [0xfff3a0, 0xd8ffb0, 0xffd0f0][i % 3], (rnd() - 0.5) * W * 0.9, H - 0.4, (rnd() - 0.5) * D * 0.9, s, 1, s, 0, rnd() * 6)
      }
      // A planet mobile.
      for (const mz of [-D * 0.22, D * 0.24]) {
        p.part('wood', CYL(8), 0xc98a52, 0, H - 9, mz, 0.6, 18, 0.6)
        p.part('wood', CYL(8), 0xc98a52, 0, H - 18, mz, 0.5, 40, 0.5, 0, 0, Math.PI / 2)
        const planets: [number, number, number][] = [[-18, 0xff8a3d, 7], [18, 0x5aaeff, 6], [0, 0xffd23f, 9]]
        for (const [px, col, r] of planets) {
          const drop = 12 + Math.abs(px) * 0.4
          p.part('matte', CYL(6), 0xffffff, px, H - 18 - drop / 2, mz, 0.15, drop, 0.15)
          p.part('plastic', SPHERE(20), col, px, H - 18 - drop - r / 2, mz, r, r, r)
          if (px === 18) p.part('plastic', TORUS(0.06), 0xffffff, px, H - 18 - drop - r / 2, mz, r * 1.9, r * 1.9, r * 1.9, 1.2)
        }
      }
      break
    }
    case 'mutfak':
      for (const z of [-D * 0.25, 0, D * 0.25]) for (const x of [-W * 0.2, W * 0.2]) {
        p.part('matte', CYL(6), 0x333333, x, H - 10, z, 0.3, 20, 0.3)
        p.part('plastic', CONE(24), 0xe86a5a, x, H - 23, z, 14, 8, 14)
        p.part('glow', SPHERE(12), 0xfff0c8, x, H - 27.5, z, 4, 4, 4)
      }
      break
    case 'banyo':
      for (const z of [-D * 0.25, D * 0.25]) for (const x of [-W * 0.18, W * 0.18]) {
        p.part('plastic', CYL(24), 0xffffff, x, H - 1, z, 18, 2, 18)
        p.part('glow', CYL(24), 0xf0fbff, x, H - 2.2, z, 14, 0.6, 14)
      }
      break
    case 'garaj':
      for (const z of [-D * 0.3, -D * 0.1, D * 0.1, D * 0.3]) for (const x of [-W * 0.22, W * 0.22]) {
        p.part('metal', BOX(), 0xb8c0ca, x, H - 3, z, 6, 2, 60)
        p.part('glow', CYL(10), 0xf4fbff, x, H - 4.3, z, 2, 56, 2, Math.PI / 2)
      }
      break
    default:
      break
  }
}

export function buildRoomDetail(lay: HouseLayout, batches: BatchSink): void {
  for (const room of lay.rooms) {
    const cz = (room.z0 + room.z1) / 2
    if (room.zone !== 'bahce') {
      for (const side of [-1, 1]) walls(new Placer(batches, 0, 0, cz, 0), lay, room, side)
      ceiling(batches, lay, room)
    }
  }
}
