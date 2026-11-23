/**
 * Kaos destruction fx: glowing neon shards that burst, tumble, bounce on the deck and fade
 * (one instanced draw), glow sparks and hologram "pixels" from the shared particle pool,
 * and the Şok wave itself: a bright ring racing over the road with a shimmering wall.
 */
import * as THREE from 'three'
import { newSpec, ParticlePool } from '../../game/fxParticles'
import { makeParticleAtlas, SHAPE_CHIP, SHAPE_GLOW, SHAPE_STAR } from '../../game/fxTextures'
import { FOG_FADE } from './materials'

const rnd = (a: number, b: number): number => a + Math.random() * (b - a)
const WHITE = new THREE.Color(1, 1, 1)

const WAVE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const WAVE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uFade;
uniform float uWall;
uniform float uTime;
varying vec2 vUv;
void main() {
  float a;
  if (uWall > 0.5) {
    a = pow(1.0 - vUv.y, 2.0) * (0.55 + 0.45 * sin(vUv.x * 160.0 + uTime * 30.0)) * 0.35;
  } else {
    // ring geometry: uv.x runs inner (0) to outer (1)
    a = smoothstep(0.0, 0.8, vUv.x) * smoothstep(1.0, 0.9, vUv.x) * 1.6 + smoothstep(0.9, 0.95, vUv.x) * smoothstep(1.0, 0.95, vUv.x) * 2.0;
  }
  a *= uFade;
  gl_FragColor = vec4(uColor * a, 0.0);
  ${FOG_FADE}
}
`

export class KaosFx {
  readonly group = new THREE.Group()
  private readonly shards: THREE.InstancedMesh
  private readonly cap: number
  private n = 0
  private readonly p: Float32Array
  private readonly v: Float32Array
  private readonly rot: Float32Array
  private readonly life: Float32Array
  private readonly floor: Float32Array
  private readonly size: Float32Array
  private readonly glow: ParticlePool
  private readonly spec = newSpec()
  private readonly ring: THREE.Mesh
  private readonly wall: THREE.Mesh
  private readonly ringMat: THREE.ShaderMaterial
  private readonly wallMat: THREE.ShaderMaterial
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly e = new THREE.Euler()
  private readonly sv = new THREE.Vector3()
  private readonly pv = new THREE.Vector3()
  private readonly c = new THREE.Color()

  constructor(camera: THREE.PerspectiveCamera, particles: number) {
    this.cap = Math.round(700 * Math.max(0.3, particles))
    const geo = new THREE.TetrahedronGeometry(0.22)
    geo.scale(1, 0.35, 1.6)
    this.shards = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.6) }), this.cap)
    this.shards.count = 0
    this.shards.frustumCulled = false
    this.shards.setColorAt(0, new THREE.Color(1, 1, 1))
    this.p = new Float32Array(this.cap * 3)
    this.v = new Float32Array(this.cap * 3)
    this.rot = new Float32Array(this.cap * 6)
    this.life = new Float32Array(this.cap * 2)
    this.floor = new Float32Array(this.cap)
    this.size = new Float32Array(this.cap)
    this.glow = new ParticlePool(1400 * Math.max(0.3, particles), makeParticleAtlas(), true, camera)
    const mk = (wall: boolean): THREE.ShaderMaterial => new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.6, 1.6, 3.2) }, uFade: { value: 0 }, uWall: { value: wall ? 1 : 0 }, uTime: { value: 0 }, ...THREE.UniformsLib.fog },
      vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
    this.ringMat = mk(false)
    this.wallMat = mk(true)
    const ringGeo = new THREE.RingGeometry(0.86, 1, 96, 1)
    // RingGeometry's uv is planar; store the radial fraction in uv.x instead
    const pos = ringGeo.getAttribute('position')
    const uv = ringGeo.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) uv.setX(i, (Math.hypot(pos.getX(i), pos.getY(i)) - 0.86) / 0.14)
    ringGeo.rotateX(-Math.PI / 2)
    this.ring = new THREE.Mesh(ringGeo, this.ringMat)
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, 0.5, 0), this.wallMat)
    for (const o of [this.ring, this.wall]) {
      o.visible = false
      o.frustumCulled = false
    }
    this.group.add(this.shards, this.glow.points, this.ring, this.wall)
  }

  /** Neon shards + sparks bursting from `at` in `color`; `push` carries the car's velocity. */
  burst(at: THREE.Vector3, color: THREE.Color, count: number, push: THREE.Vector3, floorY: number, power = 1, flash = 3.2): void {
    for (let k = 0; k < count && this.n < this.cap; k++) {
      const i = this.n++
      this.p.set([at.x + rnd(-0.6, 0.6), at.y + rnd(-0.5, 0.6), at.z + rnd(-0.6, 0.6)], i * 3)
      this.v.set([push.x * 0.55 + rnd(-7, 7) * power, rnd(3, 11) * power, push.z * 0.55 + rnd(-7, 7) * power], i * 3)
      this.rot.set([rnd(0, 6), rnd(0, 6), rnd(0, 6), rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)], i * 6)
      this.life.set([0, rnd(0.9, 1.6)], i * 2)
      this.floor[i] = floorY
      this.size[i] = rnd(0.5, 1.15)
      this.c.copy(color).multiplyScalar(rnd(0.8, 1.4))
      if (Math.random() < 0.15) this.c.lerp(WHITE, 0.5)
      this.shards.setColorAt(i, this.c)
    }
    if (this.shards.instanceColor !== null) this.shards.instanceColor.needsUpdate = true
    const s = this.spec
    for (let k = 0; k < count * 2; k++) {
      s.x = at.x + rnd(-0.5, 0.5); s.y = at.y + rnd(-0.3, 0.5); s.z = at.z + rnd(-0.5, 0.5)
      s.vx = push.x * 0.5 + rnd(-9, 9) * power; s.vy = rnd(1, 9) * power; s.vz = push.z * 0.5 + rnd(-9, 9) * power
      this.tint(color, rnd(2, 4))
      s.life = rnd(0.3, 0.8); s.size0 = rnd(0.25, 0.6); s.size1 = 0.05; s.alpha = 1
      s.shape = k % 3 === 0 ? SHAPE_STAR : SHAPE_GLOW; s.gravity = 9; s.drag = 1.5; s.rot = rnd(0, 6); s.spin = rnd(-6, 6)
      this.glow.emit(s)
    }
    if (flash > 0) this.flash(at, color, flash * power, 0.25)
  }

  /** Hologram dissolve: square pixels drifting up and flickering out. */
  glitch(at: THREE.Vector3, color: THREE.Color, count: number): void {
    const s = this.spec
    for (let k = 0; k < count; k++) {
      s.x = at.x + rnd(-1.4, 1.4); s.y = at.y + rnd(-1.2, 1.2); s.z = at.z + rnd(-0.4, 0.4)
      s.vx = rnd(-1.5, 1.5); s.vy = rnd(1, 4); s.vz = rnd(-1.5, 1.5)
      this.tint(color, rnd(2, 3.5))
      s.life = rnd(0.4, 1.1); s.size0 = rnd(0.2, 0.45); s.size1 = 0.02; s.alpha = 1
      s.shape = SHAPE_CHIP; s.gravity = -1; s.drag = 2; s.rot = 0; s.spin = 0
      this.glow.emit(s)
    }
  }

  /** A soft flash of light at a point. */
  flash(at: THREE.Vector3, color: THREE.Color, size: number, life: number): void {
    const s = this.spec
    s.x = at.x; s.y = at.y; s.z = at.z; s.vx = 0; s.vy = 0; s.vz = 0
    this.tint(color, 2.5)
    s.life = life; s.size0 = size; s.size1 = size * 1.8; s.alpha = 0.9; s.shape = SHAPE_GLOW; s.gravity = 0; s.drag = 0; s.rot = 0; s.spin = 0
    this.glow.emit(s)
  }

  /** A trail puff (dragon blocks in flight). */
  trail(at: THREE.Vector3, color: THREE.Color, size: number): void {
    const s = this.spec
    s.x = at.x + rnd(-0.3, 0.3); s.y = at.y + rnd(-0.3, 0.3); s.z = at.z + rnd(-0.3, 0.3)
    s.vx = rnd(-0.5, 0.5); s.vy = rnd(-0.5, 0.5); s.vz = rnd(-0.5, 0.5)
    this.tint(color, 2.5)
    s.life = 0.45; s.size0 = size; s.size1 = 0.05; s.alpha = 0.9; s.shape = SHAPE_GLOW; s.gravity = 0; s.drag = 1; s.rot = 0; s.spin = 0
    this.glow.emit(s)
  }

  private tint(c: THREE.Color, k: number): void {
    const s = this.spec
    s.r0 = c.r * k; s.g0 = c.g * k; s.b0 = c.b * k
    s.r1 = c.r * k * 0.5; s.g1 = c.g * k * 0.5; s.b1 = c.b * k * 0.5
  }

  /** Places the shock ring (radius r, 0 = hidden) around the player, flat on the deck. */
  wave(at: THREE.Vector3, up: THREE.Vector3, r: number, fade: number, t: number): void {
    const on = r > 0.1 && fade > 0.01
    this.ring.visible = on
    this.wall.visible = on
    if (!on) return
    this.q.setFromUnitVectors(this.sv.set(0, 1, 0), up)
    this.ring.position.copy(at).addScaledVector(up, 0.25)
    this.ring.quaternion.copy(this.q)
    this.ring.scale.setScalar(r)
    this.wall.position.copy(at)
    this.wall.quaternion.copy(this.q)
    this.wall.scale.set(r, 3 + 3 * fade, r)
    this.ringMat.uniforms.uFade.value = fade
    this.wallMat.uniforms.uFade.value = fade * 0.7
    this.wallMat.uniforms.uTime.value = t
  }

  update(dt: number): void {
    const h = Math.min(Math.max(dt, 0), 0.1)
    for (let i = 0; i < this.n; i++) {
      this.life[i * 2] += h
      if (this.life[i * 2] >= this.life[i * 2 + 1]) {
        this.kill(i)
        i--
        continue
      }
      const i3 = i * 3
      this.v[i3 + 1] -= 22 * h
      for (let k = 0; k < 3; k++) this.p[i3 + k] += this.v[i3 + k] * h
      if (this.p[i3 + 1] < this.floor[i] + 0.1 && this.v[i3 + 1] < 0) {
        this.p[i3 + 1] = this.floor[i] + 0.1
        this.v[i3 + 1] *= -0.35
        this.v[i3] *= 0.7
        this.v[i3 + 2] *= 0.7
      }
      for (let k = 0; k < 3; k++) this.rot[i * 6 + k] += this.rot[i * 6 + 3 + k] * h
      const age = this.life[i * 2] / this.life[i * 2 + 1]
      const sc = this.size[i] * (age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3)
      this.e.set(this.rot[i * 6], this.rot[i * 6 + 1], this.rot[i * 6 + 2])
      this.m.compose(this.pv.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]), this.q.setFromEuler(this.e), this.sv.setScalar(sc))
      this.shards.setMatrixAt(i, this.m)
    }
    this.shards.count = this.n
    this.shards.instanceMatrix.needsUpdate = true
    this.glow.update(h)
  }

  /** Swap-remove shard i with the last one. */
  private kill(i: number): void {
    const j = --this.n
    if (i === j) return
    this.p.copyWithin(i * 3, j * 3, j * 3 + 3)
    this.v.copyWithin(i * 3, j * 3, j * 3 + 3)
    this.rot.copyWithin(i * 6, j * 6, j * 6 + 6)
    this.life.copyWithin(i * 2, j * 2, j * 2 + 2)
    this.floor[i] = this.floor[j]
    this.size[i] = this.size[j]
    this.shards.getColorAt(j, this.c)
    this.shards.setColorAt(i, this.c)
    if (this.shards.instanceColor !== null) this.shards.instanceColor.needsUpdate = true
  }

  reset(): void {
    this.n = 0
    this.shards.count = 0
    this.glow.clear()
    this.ring.visible = false
    this.wall.visible = false
  }

  dispose(): void {
    this.shards.geometry.dispose()
    ;(this.shards.material as THREE.Material).dispose()
    this.ring.geometry.dispose()
    this.wall.geometry.dispose()
    this.ringMat.dispose()
    this.wallMat.dispose()
    this.glow.points.geometry.dispose()
    ;(this.glow.points.material as THREE.Material).dispose()
  }
}
