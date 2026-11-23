/**
 * Puffy cartoon clouds: a painted 2×2 atlas of cumulus shapes and one instanced billboard
 * mesh for all of them, sorted back-to-front now and then so the soft edges blend right.
 */
import * as THREE from 'three'
import { makeRng, type Rng } from './islandsGeo'

const TILE = 256

function drawCloud(ctx: CanvasRenderingContext2D, ox: number, oy: number, r: Rng): void {
  const S = TILE
  const puffs: [number, number, number][] = []
  const n = 6 + Math.floor(r() * 4)
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1)
    const bump = Math.sin(Math.PI * k)
    const rad = S * (0.08 + 0.11 * bump * (0.75 + 0.5 * r()))
    puffs.push([ox + S * (0.16 + 0.68 * k) + (r() - 0.5) * S * 0.04, oy + S * 0.7 - rad * 0.55 - bump * S * 0.12, rad])
  }
  const tops = 2 + Math.floor(r() * 3)
  for (let i = 0; i < tops; i++) {
    const rad = S * (0.1 + r() * 0.07)
    puffs.push([ox + S * (0.3 + r() * 0.4), oy + S * (0.36 + r() * 0.1), rad])
  }
  const circles = (dx: number, dy: number, k: number, fill: string): void => {
    ctx.fillStyle = fill
    for (const [x, y, rad] of puffs) {
      ctx.beginPath()
      ctx.arc(x + rad * dx, y + rad * dy, rad * k, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, S, S)
  ctx.clip()
  ctx.filter = 'blur(2.5px)'
  // Cool shadowed body, then the sunlit white on top, then a warm rim of highlight.
  circles(0, 0.1, 1, '#a9bde6')
  circles(-0.06, -0.12, 0.84, '#f4f8ff')
  circles(-0.14, -0.26, 0.55, '#ffffff')
  ctx.filter = 'none'
  // Flat-ish cloud base: fade the lowest part out.
  ctx.globalCompositeOperation = 'destination-out'
  const g = ctx.createLinearGradient(0, oy + S * 0.68, 0, oy + S * 0.8)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = g
  ctx.fillRect(ox, oy + S * 0.68, S, S * 0.32)
  ctx.restore()
}

export function cloudAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = TILE * 2
  c.height = TILE * 2
  const ctx = c.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  const r = makeRng(4242)
  for (let i = 0; i < 4; i++) drawCloud(ctx, (i % 2) * TILE, Math.floor(i / 2) * TILE, r)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const VERT = /* glsl */ `
attribute vec3 iCenter;
attribute vec2 iSize;
attribute vec2 iTile;
uniform float uTime;
uniform float uWrap;
uniform float uFollow;
varying vec2 vUv;
varying float vDist;
void main() {
  vec3 c = iCenter + vec3(uTime * 1.5, 0.0, uTime * 0.6);
  // Either ride along with the camera (horizon ring) or tile an endless field around it.
  if (uFollow > 0.5) c.xz += cameraPosition.xz;
  else if (uWrap > 0.0) c.xz = cameraPosition.xz + mod(c.xz - cameraPosition.xz + 0.5 * uWrap, uWrap) - 0.5 * uWrap;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  vDist = length(mv.xyz);
  mv.xy += position.xy * iSize;
  vUv = (uv + vec2(iTile.x, 1.0 - iTile.y)) * 0.5;
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uHaze;
uniform float uHazeFar;
uniform float uOpacity;
uniform vec3 uTint;
varying vec2 vUv;
varying float vDist;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.01) discard;
  // Distant clouds sink into the horizon haze but never vanish (they frame the sky).
  vec3 c = mix(t.rgb * uTint, uHaze, clamp(vDist / uHazeFar, 0.0, 0.6));
  gl_FragColor = vec4(c, t.a * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export interface CloudSpec {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
  readonly h: number
  readonly tile: number
}

export interface CloudLayer {
  readonly mesh: THREE.Mesh
  /** Re-sorts back-to-front for the given camera position. */
  sort(cam: THREE.Vector3): void
}

export interface CloudLayerOptions {
  /** Haze distance: clouds this far are 60 % haze colour. */
  readonly hazeFar: number
  /** Tile size of the endless field around the camera (0 = fixed in the world). */
  readonly wrap: number
  /** Positions are relative to the camera (a horizon ring that is never reached). */
  readonly follow: boolean
  /** Multiplies the painted cloud colour (night grading); shared, so it can be changed live. */
  readonly tint?: THREE.Color
}

const wrapTo = (v: number, cam: number, size: number): number => cam + ((((v - cam + size / 2) % size) + size) % size) - size / 2

export function cloudLayer(specs: readonly CloudSpec[], map: THREE.Texture, haze: THREE.Color, time: { value: number }, o: CloudLayerOptions): CloudLayer {
  const quad = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.setAttribute('position', quad.getAttribute('position'))
  geo.setAttribute('uv', quad.getAttribute('uv'))
  const n = specs.length
  const center = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  const size = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2)
  const tile = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2)
  geo.setAttribute('iCenter', center)
  geo.setAttribute('iSize', size)
  geo.setAttribute('iTile', tile)
  geo.instanceCount = n
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uHaze: { value: haze }, uHazeFar: { value: o.hazeFar }, uOpacity: { value: 1 }, uTint: { value: o.tint ?? new THREE.Color(1, 1, 1) }, uTime: time, uWrap: { value: o.wrap }, uFollow: { value: o.follow ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  const order = specs.map((_, i) => i)
  const write = (): void => {
    order.forEach((src, i) => {
      const s = specs[src]
      center.setXYZ(i, s.x, s.y, s.z)
      size.setXY(i, s.w, s.h)
      tile.setXY(i, s.tile % 2, Math.floor(s.tile / 2))
    })
    center.needsUpdate = true
    size.needsUpdate = true
    tile.needsUpdate = true
  }
  write()
  return {
    mesh,
    sort(cam) {
      const d = specs.map((s) => {
        const x = o.follow ? s.x + cam.x : o.wrap > 0 ? wrapTo(s.x, cam.x, o.wrap) : s.x
        const z = o.follow ? s.z + cam.z : o.wrap > 0 ? wrapTo(s.z, cam.z, o.wrap) : s.z
        return (x - cam.x) ** 2 + (s.y - cam.y) ** 2 + (z - cam.z) ** 2
      })
      order.sort((a, b) => d[b] - d[a])
      write()
    },
  }
}
