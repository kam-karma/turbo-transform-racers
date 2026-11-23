/**
 * A fixed-size particle pool drawn as one THREE.Points. Particles live in flat typed arrays
 * (no objects, no per-frame allocation); dead ones are swap-removed so the live ones stay
 * packed at the front and the draw range covers exactly them.
 */
import * as THREE from 'three'

/** What to spawn. Callers keep one of these and overwrite its fields: no garbage per emit. */
export interface EmitSpec {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  /** seconds */
  life: number
  /** world metres at birth and death */
  size0: number; size1: number
  /** linear colour at birth / death; values > 1 glow under bloom */
  r0: number; g0: number; b0: number
  r1: number; g1: number; b1: number
  alpha: number
  /** atlas cell, see fxTextures SHAPE_* */
  shape: number
  /** m/s² pulled down along world -Y (negative floats up) */
  gravity: number
  /** 1/s velocity damping */
  drag: number
  rot: number
  spin: number
}

export function newSpec(): EmitSpec {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size0: 1, size1: 1,
    r0: 1, g0: 1, b0: 1, r1: 1, g1: 1, b1: 1, alpha: 1, shape: 0, gravity: 0, drag: 0, rot: 0, spin: 0,
  }
}

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute vec3 aParams;
uniform float uScale;
varying vec4 vColor;
varying float vRot;
varying float vShape;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aParams.x * uScale / max(0.2, -mv.z), 512.0);
  vColor = aColor;
  vRot = aParams.y;
  vShape = aParams.z;
}
`

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec4 vColor;
varying float vRot;
varying float vShape;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
  p = clamp(p, 0.01, 0.99);
  vec2 cell = vec2(mod(vShape, 2.0), floor(vShape / 2.0 + 0.01));
  vec4 t = texture2D(uMap, vec2((p.x + cell.x) * 0.5, 1.0 - (p.y + cell.y) * 0.5));
  float a = t.a * vColor.a;
  if (a < 0.003) discard;
  #ifdef GLOW
  // Premultiplied "additive with some cover": adds light like a glow but also covers part of
  // what is behind, so sparkles still read against a bright daytime sky.
  gl_FragColor = vec4(vColor.rgb * t.rgb * a, a * 0.7);
  #else
  gl_FragColor = vec4(vColor.rgb * t.rgb, a);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const drawSize = new THREE.Vector2()

export class ParticlePool {
  readonly points: THREE.Points
  readonly capacity: number
  private n = 0
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly par: Float32Array
  private readonly vel: Float32Array
  /** age, life, size0, size1 */
  private readonly time: Float32Array
  /** r0 g0 b0 r1 g1 b1 alpha */
  private readonly tint: Float32Array
  /** gravity, drag, spin */
  private readonly phys: Float32Array
  private readonly posAttr: THREE.BufferAttribute
  private readonly colAttr: THREE.BufferAttribute
  private readonly parAttr: THREE.BufferAttribute
  private readonly uScale = { value: 800 }
  private readonly ranges = new Map<THREE.BufferAttribute, { start: number; count: number }>()

  constructor(capacity: number, atlas: THREE.Texture, additive: boolean, camera: THREE.PerspectiveCamera) {
    this.capacity = Math.max(16, Math.floor(capacity))
    const c = this.capacity
    this.pos = new Float32Array(c * 3)
    this.col = new Float32Array(c * 4)
    this.par = new Float32Array(c * 3)
    this.vel = new Float32Array(c * 3)
    this.time = new Float32Array(c * 4)
    this.tint = new Float32Array(c * 7)
    this.phys = new Float32Array(c * 3)
    const geo = new THREE.BufferGeometry()
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)
    this.parAttr = new THREE.BufferAttribute(this.par, 3).setUsage(THREE.DynamicDrawUsage)
    for (const a of [this.posAttr, this.colAttr, this.parAttr]) this.ranges.set(a, { start: 0, count: 0 })
    geo.setAttribute('position', this.posAttr)
    geo.setAttribute('aColor', this.colAttr)
    geo.setAttribute('aParams', this.parAttr)
    geo.setDrawRange(0, 0)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas }, uScale: this.uScale },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      defines: additive ? { GLOW: 1 } : {},
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    this.points = new THREE.Points(geo, mat)
    // Particles roam the whole track; a bounding sphere would only be stale.
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 11 : 10
    // Point sizes are in pixels, so world-metre sizes need the real drawing-buffer height.
    this.points.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(drawSize)
      this.uScale.value = (drawSize.y * 0.5) / Math.tan((camera.fov * Math.PI) / 360)
    }
  }

  get count(): number {
    return this.n
  }

  /** Returns false when the pool is full (the new particle is simply dropped). */
  emit(e: EmitSpec): boolean {
    if (this.n >= this.capacity) return false
    const i = this.n++
    const i3 = i * 3
    this.pos[i3] = e.x
    this.pos[i3 + 1] = e.y
    this.pos[i3 + 2] = e.z
    this.vel[i3] = e.vx
    this.vel[i3 + 1] = e.vy
    this.vel[i3 + 2] = e.vz
    const i4 = i * 4
    this.time[i4] = 0
    this.time[i4 + 1] = Math.max(0.02, e.life)
    this.time[i4 + 2] = e.size0
    this.time[i4 + 3] = e.size1
    const i7 = i * 7
    this.tint[i7] = e.r0
    this.tint[i7 + 1] = e.g0
    this.tint[i7 + 2] = e.b0
    this.tint[i7 + 3] = e.r1
    this.tint[i7 + 4] = e.g1
    this.tint[i7 + 5] = e.b1
    this.tint[i7 + 6] = e.alpha
    this.phys[i3] = e.gravity
    this.phys[i3 + 1] = e.drag
    this.phys[i3 + 2] = e.spin
    this.par[i3 + 1] = e.rot
    this.par[i3 + 2] = e.shape
    this.par[i3] = 0
    return true
  }

  clear(): void {
    this.n = 0
    this.points.geometry.setDrawRange(0, 0)
  }

  update(dt: number): void {
    let i = 0
    while (i < this.n) {
      const i4 = i * 4
      const age = this.time[i4] + dt
      if (age >= this.time[i4 + 1]) {
        this.kill(i)
        continue
      }
      this.time[i4] = age
      this.step(i, age / this.time[i4 + 1], dt)
      i++
    }
    const geo = this.points.geometry
    geo.setDrawRange(0, this.n)
    if (this.n > 0) {
      this.markDirty(this.posAttr, this.n * 3)
      this.markDirty(this.colAttr, this.n * 4)
      this.markDirty(this.parAttr, this.n * 3)
    }
  }

  /** Upload only the live prefix. The range objects are reused: addUpdateRange would allocate. */
  private markDirty(a: THREE.BufferAttribute, len: number): void {
    const r = this.ranges.get(a)
    if (r === undefined) return
    r.count = len
    a.updateRanges.length = 0
    a.updateRanges.push(r)
    a.needsUpdate = true
  }

  private step(i: number, t: number, dt: number): void {
    const i3 = i * 3
    const damp = Math.max(0, 1 - this.phys[i3 + 1] * dt)
    const vx = this.vel[i3] * damp
    const vy = this.vel[i3 + 1] * damp - this.phys[i3] * dt
    const vz = this.vel[i3 + 2] * damp
    this.vel[i3] = vx
    this.vel[i3 + 1] = vy
    this.vel[i3 + 2] = vz
    this.pos[i3] += vx * dt
    this.pos[i3 + 1] += vy * dt
    this.pos[i3 + 2] += vz * dt
    const i4 = i * 4
    const i7 = i * 7
    // Quick fade-in hides the pop of birth; the ease-out tail keeps puffs soft as they go.
    const fade = Math.min(1, t * 14) * (1 - t) * (1 + t)
    this.col[i4] = this.tint[i7] + (this.tint[i7 + 3] - this.tint[i7]) * t
    this.col[i4 + 1] = this.tint[i7 + 1] + (this.tint[i7 + 4] - this.tint[i7 + 1]) * t
    this.col[i4 + 2] = this.tint[i7 + 2] + (this.tint[i7 + 5] - this.tint[i7 + 2]) * t
    this.col[i4 + 3] = this.tint[i7 + 6] * fade
    const ease = 1 - (1 - t) * (1 - t)
    this.par[i3] = this.time[i4 + 2] + (this.time[i4 + 3] - this.time[i4 + 2]) * ease
    this.par[i3 + 1] += this.phys[i3 + 2] * dt
  }

  /** Move the last live particle into slot i. */
  private kill(i: number): void {
    const last = --this.n
    if (i === last) return
    copy(this.pos, 3, last, i)
    copy(this.vel, 3, last, i)
    copy(this.col, 4, last, i)
    copy(this.par, 3, last, i)
    copy(this.time, 4, last, i)
    copy(this.tint, 7, last, i)
    copy(this.phys, 3, last, i)
  }
}

function copy(a: Float32Array, stride: number, from: number, to: number): void {
  a.copyWithin(to * stride, from * stride, from * stride + stride)
}
