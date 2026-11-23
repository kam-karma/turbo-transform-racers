/**
 * The Ejderha boss on screen: a winged hologram dragon flying ahead of the player over the
 * circuit (facing back at them, body trailing away), its neon blocks arcing onto the road,
 * pulsing where they sit and flying back when bounced, hit flashes, an angrier colour as it
 * weakens, and a shattering fall when beaten.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Track } from '../../sim/track'
import { FALL_T, RETURN_T, type Dragon, type DragonEvent } from '../sim/dragon'
import { neonBoxMaterial, solidBuild } from './breakView'
import { dressDragon, type DragonModel } from './dragonModel'
import { HoloDragon } from './holoDragon'
import type { HoloMaterial } from './materials'
import type { KaosFx } from './shards'

const CAP = 32
const PHASE_COLORS: readonly (readonly [number, number])[] = [[0xb6ff2e, 0xfff27a], [0xffc21f, 0xfff0a0], [0xff4f6a, 0xffb0c0]]
const BLOCK_COL = new THREE.Color(0xff3df2)
const CYAN = new THREE.Color(0x22e6ff)

const MARK_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(0.78, 0.86, r) * smoothstep(1.0, 0.92, r);
  float inner = smoothstep(0.5, 0.0, r) * (0.5 + 0.5 * sin(uTime * 14.0));
  vec3 c = vec3(1.0, 0.24, 0.95) * (ring * 3.0 + inner * 1.2);
  gl_FragColor = vec4(c, 0.0);
}
`
const MARK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

export class BossView {
  readonly group = new THREE.Group()
  /** Procedural fallback when dragon.glb is missing. */
  private readonly holo: HoloDragon | null
  private readonly glb: DragonModel | null
  private readonly mat: HoloMaterial
  private readonly root: THREE.Object3D
  private readonly blocks: THREE.InstancedMesh
  private readonly blockMat = neonBoxMaterial(1)
  private readonly head = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly e = new THREE.Euler()
  private readonly one = new THREE.Vector3(1, 1, 1)
  private hitFlash = 0
  /** Landing warnings: a pulsing ring where each block will come down. */
  private readonly marks: THREE.InstancedMesh
  private readonly markMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: MARK_VERT, fragmentShader: MARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  private readonly basis = new THREE.Matrix4()
  private fallT = -1
  private colorPhase = 0

  constructor(private readonly track: Track, private readonly fx: KaosFx, model: THREE.Mesh | null) {
    this.glb = model === null ? null : dressDragon(model, 30, 0xb6ff2e, 0xfff27a, 1.6)
    this.holo = model === null ? new HoloDragon({ color: 0xb6ff2e, color2: 0xfff27a, radius: 3.4, segments: 60, wings: true, intensity: 2.3 }) : null
    this.mat = this.glb?.shell ?? (this.holo as HoloDragon).material
    this.root = this.glb?.group ?? (this.holo as HoloDragon).group
    const geo = new RoundedBoxGeometry(2, 2, 2, 2, 0.25)
    solidBuild(geo, CAP)
    this.blocks = new THREE.InstancedMesh(geo, this.blockMat, CAP)
    this.blocks.count = 0
    this.blocks.frustumCulled = false
    for (let i = 0; i < CAP; i++) this.blocks.setColorAt(i, BLOCK_COL)
    const mg = new THREE.PlaneGeometry(1, 1)
    mg.rotateX(-Math.PI / 2)
    this.marks = new THREE.InstancedMesh(mg, this.markMat, CAP)
    this.marks.count = 0
    this.marks.frustumCulled = false
    this.group.add(this.root, this.blocks, this.marks)
  }

  private get baseAlpha(): number {
    return this.glb !== null ? 0.55 : 1
  }

  get headPos(): THREE.Vector3 {
    return this.head
  }

  reset(): void {
    this.fallT = -1
    this.hitFlash = 0
    this.colorPhase = 0
    this.setColors(0)
    this.mat.uniforms.uAlpha.value = this.baseAlpha
    this.root.visible = true
  }

  private setColors(phase: number): void {
    const [a, b] = PHASE_COLORS[Math.min(2, phase)]
    this.mat.uniforms.uColor.value.set(a).multiplyScalar(2.3)
    this.mat.uniforms.uColor2.value.set(b).multiplyScalar(3)
  }

  onEvent(e: DragonEvent, dr: Dragon): void {
    if (e.kind === 'damage') {
      this.hitFlash = 1
      this.fx.burst(this.head, new THREE.Color(PHASE_COLORS[Math.min(2, dr.phase)][0]), 40, this.tmp.set(0, 0, 0), this.head.y - 30, 1.6)
    } else if (e.kind === 'enrage') {
      this.colorPhase = e.phase
      this.setColors(e.phase)
    } else if (e.kind === 'beaten') {
      this.fallT = 0
    } else if (e.kind === 'land' || e.kind === 'crush') {
      const b = dr.blocks.find((x) => x.id === e.id)
      const p = b !== undefined ? this.track.toWorld(b.s, b.d, 1) : null
      if (p !== null) this.fx.burst(this.tmp.set(p.x, p.y, p.z), BLOCK_COL, e.kind === 'crush' ? 50 : 14, new THREE.Vector3(), p.y - 0.5, e.kind === 'crush' ? 1.4 : 0.6)
    }
  }

  update(dr: Dragon, t: number, dt: number): void {
    const tr = this.track
    const h = tr.toWorld(dr.s, dr.d, dr.h)
    if (this.glb !== null) {
      // hovering a little further up the road, nose turned back at the player, swaying
      const g = this.glb.group
      g.position.set(h.x, h.y + 1.5 * Math.sin(t * 1.7), h.z)
      const look = tr.toWorld(dr.s - 40, dr.d * 0.3, dr.h - 10)
      g.up.set(0, 1, 0)
      g.lookAt(look.x, look.y, look.z)
      g.rotateZ(0.18 * Math.sin(t * 1.1))
      g.rotateX(0.08 * Math.sin(t * 1.7 + 0.5))
      g.updateMatrix()
      this.head.set(0, this.glb.top * 0.55, this.glb.nose * 0.6).applyMatrix4(g.matrix)
      this.mat.uniforms.uTime.value = t
    } else if (this.holo !== null) {
      this.head.set(h.x, h.y, h.z)
      this.holo.setSpine((u, o) => {
        const s = dr.s + u * 58
        const p = tr.toWorld(s, dr.d * (1 - u * 0.5) + 6 * Math.sin(u * 7 - t * 2.4), dr.h + 4 * Math.sin(u * 5 - t * 1.8) + u * 8)
        o.set(p.x, p.y, p.z)
      }, t)
      this.holo.update(t)
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3)
    const u = this.mat.uniforms
    if (this.fallT >= 0) {
      this.fallT += dt
      u.uAlpha.value = Math.max(0, this.baseAlpha * (1 - this.fallT / 1.6))
      if (this.fallT < 1.4 && Math.random() < 0.6) {
        this.tmp.set(h.x + (Math.random() - 0.5) * 30, h.y + (Math.random() - 0.5) * 10, h.z + (Math.random() - 0.5) * 30)
        this.fx.burst(this.tmp, new THREE.Color(PHASE_COLORS[this.colorPhase][0]), 16, new THREE.Vector3(), h.y - 40, 2)
      }
      this.root.visible = u.uAlpha.value > 0.01
      if (this.glb !== null) this.root.scale.setScalar(Math.max(0.01, 1 - this.fallT / 1.6))
    } else {
      u.uAlpha.value = this.baseAlpha + this.hitFlash * 1.5
      if (this.glb !== null) this.root.scale.setScalar(1 + this.hitFlash * 0.08)
    }
    this.blockMat.uniforms.uTime.value = t
    this.placeBlocks(dr, t)
  }

  /** Warning ring k on the road at (s, d), growing to full size as the block arrives. */
  private marker(k: number, s: number, d: number, grow: number, t: number): void {
    if (k >= CAP) return
    const f = this.track.frameAt(s)
    const p = this.track.toWorld(s, d, 0.08)
    const r = 3.6 * (0.4 + 0.6 * grow)
    this.basis.makeBasis(this.tmp.set(f.left.x, f.left.y, f.left.z), new THREE.Vector3(f.up.x, f.up.y, f.up.z), new THREE.Vector3(f.t.x, f.t.y, f.t.z))
    this.basis.multiply(new THREE.Matrix4().makeScale(r, 1, r)).setPosition(p.x, p.y, p.z)
    this.marks.setMatrixAt(k, this.basis)
    this.markMat.uniforms.uTime.value = t
  }

  private placeBlocks(dr: Dragon, t: number): void {
    const tr = this.track
    let n = 0
    let m = 0
    for (const b of dr.blocks) {
      if (n >= CAP) break
      const land = tr.toWorld(b.s, b.d, 1.5)
      let x = land.x
      let y = land.y
      let z = land.z
      let spin = t * 0.6 + b.id
      let scale = 1.5
      if (b.phase === 'falling') {
        const k = Math.min(1, b.t / FALL_T)
        const from = tr.toWorld(b.fromS, b.fromD, dr.h - 2)
        x = from.x + (land.x - from.x) * k
        z = from.z + (land.z - from.z) * k
        y = from.y + (land.y - from.y) * k + 14 * Math.sin(Math.PI * k)
        spin = t * 6 + b.id
        this.fx.trail(this.tmp.set(x, y, z), BLOCK_COL, 2.6)
        this.marker(m++, b.s, b.d, k, t)
      } else if (b.phase === 'returning') {
        const k = Math.min(1, b.t / RETURN_T)
        x = land.x + (this.head.x - land.x) * k
        z = land.z + (this.head.z - land.z) * k
        y = land.y + (this.head.y - land.y) * k + 8 * Math.sin(Math.PI * k)
        spin = t * 10 + b.id
        scale = 1.5 * (1 - 0.3 * k)
        this.fx.trail(this.tmp.set(x, y, z), CYAN, 2.6)
      } else {
        y += 0.15 * Math.sin(t * 5 + b.id)
        scale = 1.5 * (1 + 0.06 * Math.sin(t * 9 + b.id))
        this.marker(m++, b.s, b.d, 1, t)
      }
      this.e.set(spin * 0.7, spin, 0)
      this.m.compose(this.tmp.set(x, y, z), this.q.setFromEuler(this.e), this.one.setScalar(scale))
      this.blocks.setMatrixAt(n, this.m)
      this.blocks.setColorAt(n, b.phase === 'returning' ? CYAN : BLOCK_COL)
      n++
    }
    this.blocks.count = n
    this.marks.count = m
    this.marks.instanceMatrix.needsUpdate = true
    this.blocks.instanceMatrix.needsUpdate = true
    if (this.blocks.instanceColor !== null) this.blocks.instanceColor.needsUpdate = true
  }

  dispose(): void {
    this.holo?.dispose()
    this.glb?.dispose()
    this.blocks.geometry.dispose()
    this.blockMat.dispose()
    this.marks.geometry.dispose()
    this.markMat.dispose()
  }
}
