/**
 * Neon dressing for every car: a coloured underglow pool on the wet deck, two light-trail
 * ribbons streaming from the tail lights (one draw for all cars) and neon-glass name tags.
 */
import * as THREE from 'three'

const TRAIL_N = 7
const TRAIL_DT = 0.016

const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
flat varying vec3 vCol;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float a = exp(-dot(p * vec2(1.6, 1.0), p * vec2(1.6, 1.0)) * 2.2);
  gl_FragColor = vec4(vCol * a * 1.8, 0.0);
}
`

const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
flat varying vec3 vCol;
void main() {
  vUv = uv;
  vCol = instanceColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

export function neonLabel(name: string, color: number): THREE.Sprite {
  const W = 512
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (g === null) throw new Error('2D canvas unavailable')
  const hex = `#${new THREE.Color(color).getHexString()}`
  g.font = '900 52px "Baloo 2", "Nunito", "Arial Black", system-ui, sans-serif'
  const tw = Math.min(W - 170, g.measureText(name).width)
  const pw = tw + 150
  const x0 = (W - pw) / 2
  g.fillStyle = 'rgba(10,8,30,0.78)'
  g.beginPath()
  g.roundRect(x0, 18, pw, H - 36, 46)
  g.fill()
  g.shadowColor = hex
  g.shadowBlur = 18
  g.strokeStyle = hex
  g.lineWidth = 6
  g.stroke()
  g.shadowBlur = 0
  g.fillStyle = hex
  g.beginPath()
  g.arc(x0 + 52, H / 2, 28, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#0a081e'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 36px "Baloo 2", "Nunito", "Arial Black", system-ui, sans-serif'
  g.fillText(name.charAt(0).toLocaleUpperCase('tr'), x0 + 52, H / 2 + 2)
  g.font = '900 52px "Baloo 2", "Nunito", "Arial Black", system-ui, sans-serif'
  g.textAlign = 'left'
  g.fillStyle = '#ffffff'
  g.fillText(name, x0 + 94, H / 2 + 3, tw)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  s.scale.set(3.6, 0.9, 1)
  s.renderOrder = 12
  return s
}

export class CarFx {
  readonly group = new THREE.Group()
  private readonly glow: THREE.InstancedMesh
  private readonly trailGeo = new THREE.BufferGeometry()
  private readonly tPos: Float32Array
  private readonly tCol: Float32Array
  private readonly hist: Float32Array
  private readonly acc: number[]
  private readonly colors: THREE.Color[]
  private readonly m = new THREE.Matrix4()
  private readonly basis = new THREE.Matrix4()
  private readonly x = new THREE.Vector3()

  constructor(colors: readonly number[]) {
    const n = colors.length
    this.colors = colors.map((c) => new THREE.Color(c))
    const geo = new THREE.PlaneGeometry(3.4, 6.2)
    geo.rotateX(-Math.PI / 2)
    this.glow = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), n)
    this.colors.forEach((c, i) => this.glow.setColorAt(i, c))
    this.glow.frustumCulled = false
    this.glow.renderOrder = 1
    // 2 ribbons per car, TRAIL_N points, 2 vertices each
    const verts = n * 2 * TRAIL_N * 2
    this.tPos = new Float32Array(verts * 3)
    this.tCol = new Float32Array(verts * 3)
    this.hist = new Float32Array(n * 2 * TRAIL_N * 3)
    this.acc = colors.map(() => 0)
    const idx: number[] = []
    for (let r = 0; r < n * 2; r++) {
      for (let k = 0; k < TRAIL_N - 1; k++) {
        const a = (r * TRAIL_N + k) * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage))
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage))
    this.trailGeo.setIndex(idx)
    const trails = new THREE.Mesh(this.trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
    trails.frustumCulled = false
    this.group.add(this.glow, trails)
  }

  /** Car i at pos, facing fwd, deck normal up; `snap` restarts its trail (respawn, restart). */
  update(i: number, pos: THREE.Vector3, fwd: THREE.Vector3, up: THREE.Vector3, speed: number, dt: number, snap = false): void {
    this.x.crossVectors(up, fwd).normalize()
    this.basis.makeBasis(this.x, up, fwd)
    this.m.copy(this.basis).setPosition(pos.x + up.x * 0.06, pos.y + up.y * 0.06, pos.z + up.z * 0.06)
    this.glow.setMatrixAt(i, this.m)
    this.acc[i] += dt
    const shift = snap || this.acc[i] >= TRAIL_DT
    if (shift) this.acc[i] = 0
    const col = this.colors[i]
    const k = Math.min(1, speed / 30)
    for (let side = 0; side < 2; side++) {
      const r = i * 2 + side
      const sx = side === 0 ? 0.62 : -0.62
      const hx = pos.x - fwd.x * 1.75 + this.x.x * sx + up.x * 0.55
      const hy = pos.y - fwd.y * 1.75 + this.x.y * sx + up.y * 0.55
      const hz = pos.z - fwd.z * 1.75 + this.x.z * sx + up.z * 0.55
      const base = r * TRAIL_N * 3
      if (snap) for (let q = 0; q < TRAIL_N; q++) this.hist.set([hx, hy, hz], base + q * 3)
      else if (shift) this.hist.copyWithin(base + 3, base, base + (TRAIL_N - 1) * 3)
      this.hist.set([hx, hy, hz], base)
      for (let q = 0; q < TRAIL_N; q++) {
        const p = base + q * 3
        const fade = (1 - q / (TRAIL_N - 1)) ** 1.6 * k
        const w = 0.13 * (1 - q / TRAIL_N)
        const v = (r * TRAIL_N + q) * 2
        this.tPos.set([this.hist[p] + up.x * w, this.hist[p + 1] + up.y * w, this.hist[p + 2] + up.z * w, this.hist[p] - up.x * w, this.hist[p + 1] - up.y * w, this.hist[p + 2] - up.z * w], v * 3)
        const cr = (side === 0 ? 1.0 : 0.6) * 2.6 * fade
        this.tCol.set([col.r * cr, col.g * cr, col.b * cr, col.r * cr, col.g * cr, col.b * cr], v * 3)
      }
    }
  }

  commit(): void {
    this.glow.instanceMatrix.needsUpdate = true
    ;(this.trailGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.trailGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.glow.geometry.dispose()
    ;(this.glow.material as THREE.Material).dispose()
    this.trailGeo.dispose()
  }
}
