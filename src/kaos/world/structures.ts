/**
 * Static road furniture merged into one neon-metal mesh: guard rails on posts with a glowing
 * gold top strip along both edges, and the support pillars that hold the elevated light
 * ribbons above the city floor (each with a glowing collar under the deck).
 */
import * as THREE from 'three'
import type { Frame, Track } from '../../sim/track'
import type { KaosCircuit } from '../tracks/index'
import { neonMetal } from './materials'

const RAIL_STEP = 3.5
const PILLAR_STEP = 42

class Builder {
  readonly pos: number[] = []
  readonly nor: number[] = []
  readonly col: number[] = []
  readonly glow: number[] = []

  /** Quad a-b-c-d (counter-clockwise seen from outside). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color, g: number): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize()
    for (const p of [a, b, c, a, c, d]) {
      this.pos.push(p.x, p.y, p.z)
      this.nor.push(n.x, n.y, n.z)
      this.col.push(color.r, color.g, color.b)
      this.glow.push(g)
    }
  }

  /** A box given its 8 corners: bottom 0-3 and top 4-7, both counter-clockwise from above. */
  box(c: readonly THREE.Vector3[], color: THREE.Color, g: number, topColor = color, topGlow = g): void {
    this.quad(c[4], c[5], c[6], c[7], topColor, topGlow)
    this.quad(c[3], c[2], c[1], c[0], color, g)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      this.quad(c[i], c[j], c[j + 4], c[i + 4], color, g)
    }
  }

  geometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1))
    geo.computeBoundingSphere()
    return geo
  }
}

const at = (f: Frame, d: number, y: number, ahead = 0): THREE.Vector3 =>
  new THREE.Vector3(f.pos.x + f.left.x * d + f.up.x * y + f.t.x * ahead, f.pos.y + f.left.y * d + f.up.y * y + f.t.y * ahead, f.pos.z + f.left.z * d + f.up.z * y + f.t.z * ahead)

/** Box spanning two frames across [d0, d1] and up [y0, y1]. */
function span(b: Builder, fa: Frame, fb: Frame, d0: number, d1: number, y0: number, y1: number, color: THREE.Color, g: number, top?: THREE.Color, topGlow?: number): void {
  const corners = [at(fa, d0, y0), at(fa, d1, y0), at(fb, d1, y0), at(fb, d0, y0), at(fa, d0, y1), at(fa, d1, y1), at(fb, d1, y1), at(fb, d0, y1)]
  b.box(corners, color, g, top, topGlow)
}

export function buildStructures(track: Track, c: KaosCircuit, groundY: number): THREE.Mesh {
  const b = new Builder()
  const L = c.lapLen
  const hw = c.spec.width / 2 + 0.45
  const metal = new THREE.Color(0x1b1f33)
  const post = new THREE.Color(0x2a2f48)
  const gold = new THREE.Color(0xffb02e)
  const n = Math.floor(L / RAIL_STEP)
  for (let i = 0; i < n; i++) {
    const fa = track.frameAt(L + i * RAIL_STEP)
    const fb = track.frameAt(L + (i + 1) * RAIL_STEP)
    for (const side of [1, -1]) {
      const d0 = side * hw
      const d1 = side * (hw + 0.28)
      span(b, fa, fb, d0, d1, 0.55, 0.92, metal, 0, gold, 2.6)
      const p0 = track.frameAt(L + i * RAIL_STEP)
      span(b, p0, track.frameAt(L + i * RAIL_STEP + 0.22), side * (hw + 0.05), side * (hw + 0.24), 0, 0.98, post, 0)
    }
  }
  const pa = new THREE.Color(c.palette.a)
  const pillarCol = new THREE.Color(0x14162a)
  for (let s = L + 10; s < 2 * L; s += PILLAR_STEP) {
    const f = track.frameAt(s)
    const top = f.pos.y - 1.7
    if (top - groundY < 4) continue
    const fa = track.frameAt(s - 1.3)
    const fb = track.frameAt(s + 1.3)
    const w = 1.4
    const flat = (fr: Frame, d: number, y: number): THREE.Vector3 => new THREE.Vector3(fr.pos.x + fr.left.x * d, y, fr.pos.z + fr.left.z * d)
    const box = (y0: number, y1: number, k: number): THREE.Vector3[] => [flat(fa, -w * k, y0), flat(fa, w * k, y0), flat(fb, w * k, y0), flat(fb, -w * k, y0), flat(fa, -w * k, y1), flat(fa, w * k, y1), flat(fb, w * k, y1), flat(fb, -w * k, y1)]
    b.box(box(groundY, top, 1), pillarCol, 0)
    b.box(box(top - 1.2, top - 0.7, 1.15), pa, 2.2)
    b.box(box(groundY + 3, groundY + 3.4, 1.12), pa, 1.4)
  }
  const mesh = new THREE.Mesh(b.geometry(), neonMetal({ roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide }))
  mesh.frustumCulled = false
  return mesh
}
