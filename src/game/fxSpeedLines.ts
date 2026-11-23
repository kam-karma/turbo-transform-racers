/**
 * Speed lines: thin tapered streaks that rush past the camera at the screen edges. They live
 * in camera space, so they read the same at
 * any speed and on any part of the track.
 */
import * as THREE from 'three'

const NEAR_Z = -1.2
const FAR_Z = -46
/** Keep the middle of the screen (the car) clear: streaks only in an outer ring. */
const R_MIN = 2.6
const R_MAX = 7.5
/** Extra radius per metre of distance. */
const SPREAD = 0.035

export class SpeedLines {
  readonly group = new THREE.Group()
  private readonly n: number
  private readonly ang: Float32Array
  private readonly rad: Float32Array
  private readonly z: Float32Array
  private readonly rate: Float32Array
  private readonly pos: Float32Array
  private readonly posAttr: THREE.BufferAttribute
  private readonly mat: THREE.MeshBasicMaterial
  private readonly mesh: THREE.Mesh
  private level = 0

  constructor(count: number) {
    this.n = Math.max(8, Math.floor(count))
    const n = this.n
    this.ang = new Float32Array(n)
    this.rad = new Float32Array(n)
    this.z = new Float32Array(n)
    this.rate = new Float32Array(n)
    this.pos = new Float32Array(n * 4 * 3)
    const col = new Float32Array(n * 4 * 3)
    const idx = new Uint16Array(n * 6)
    for (let i = 0; i < n; i++) {
      this.respawn(i, FAR_Z + Math.random() * (NEAR_Z - FAR_Z))
      // Vertices 0,1 are the leading (bright) end, 2,3 the fading tail.
      for (let k = 0; k < 2; k++) col.set([1, 1, 1], (i * 4 + k) * 3)
      const b = i * 4
      idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6)
    }
    const geo = new THREE.BufferGeometry()
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', this.posAttr)
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 20
    this.mesh.visible = false
    // Pinned to the rendering camera at draw time (after any camera move this frame), so the
    // streaks never lag a frame behind a fast chase camera.
    this.mesh.onBeforeRender = (_r, _s, cam) => {
      this.mesh.matrixWorld.copy(cam.matrixWorld)
    }
    this.group.add(this.mesh)
  }

  private respawn(i: number, z: number): void {
    // Bias away from the bottom of the screen, where the road and car are.
    let a = Math.random() * Math.PI * 2
    if (Math.sin(a) < -0.55) a = Math.PI - a
    this.ang[i] = a
    this.rad[i] = R_MIN + Math.random() * (R_MAX - R_MIN)
    this.z[i] = z
    this.rate[i] = 0.75 + Math.random() * 0.5
  }

  /**
   * `intensity` 0..1 fades the whole effect; `speed` m/s drives how fast and long the
   * streaks are; `r,g,b` tint them (linear, may exceed 1 for bloom).
   */
  update(dt: number, speed: number, intensity: number, r: number, g: number, b: number): void {
    this.level += (intensity - this.level) * Math.min(1, dt * 6)
    const on = this.level > 0.02
    this.mesh.visible = on
    if (!on) return
    this.mat.opacity = Math.min(1, this.level) * 0.8
    this.mat.color.setRGB(r, g, b)
    // Streaks travel faster than the car so they read as motion even at modest speed.
    const flow = 30 + speed * 2.2
    const len = 2 + speed * 0.16
    for (let i = 0; i < this.n; i++) {
      let z = this.z[i] + flow * this.rate[i] * dt
      if (z > NEAR_Z) {
        this.respawn(i, FAR_Z + Math.random() * 8)
        z = this.z[i]
      }
      this.z[i] = z
      this.writeQuad(i, z, len * this.rate[i])
    }
    this.posAttr.needsUpdate = true
  }

  private writeQuad(i: number, z: number, len: number): void {
    const c = Math.cos(this.ang[i])
    const s = Math.sin(this.ang[i])
    const tail = z - len
    // Radius grows with distance so far streaks stay near the screen edge and every streak
    // points away from the vanishing point, like a classic speed-line burst.
    const rh = this.rad[i] * (1 - z * SPREAD)
    const rt = this.rad[i] * (1 - tail * SPREAD)
    const w = 0.0045 * rh
    const tx = -s * w
    const ty = c * w
    const o = i * 12
    const p = this.pos
    p[o] = c * rh + tx; p[o + 1] = s * rh + ty; p[o + 2] = z
    p[o + 3] = c * rh - tx; p[o + 4] = s * rh - ty; p[o + 5] = z
    p[o + 6] = c * rt + tx * 0.2; p[o + 7] = s * rt + ty * 0.2; p[o + 8] = tail
    p[o + 9] = c * rt - tx * 0.2; p[o + 10] = s * rt - ty * 0.2; p[o + 11] = tail
  }
}
