/**
 * Light and air of the giant house: warm sunlight from the windows (one shadow-casting sun
 * that follows the player on High), a soft room-bounce hemisphere, an interior environment
 * map for glossy toy plastic, warm depth haze, a sky dome for the garden, and drifting dust
 * motes glinting around the camera. A 'night' preset dims it all to lamp light.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { QualityProfile } from '../../game/quality'
import { dotTexture } from './textures'

export interface Atmosphere {
  readonly group: THREE.Group
  readonly sun: THREE.DirectionalLight
  update(t: number, dt: number, camera: THREE.Camera, focus: THREE.Vector3): void
  dispose(): void
}

const DUST = 420
const DUST_BOX = 70
const MOTE_NEAR = 14

function skyDome(night: boolean): THREE.Mesh {
  const g = new THREE.SphereGeometry(4000, 32, 16)
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(night ? 0x0b1640 : 0x4aa8ff) }, bottom: { value: new THREE.Color(night ? 0x2a3470 : 0xd7f0ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.4 + 0.2, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  })
  const mesh = new THREE.Mesh(g, m)
  mesh.renderOrder = -10
  return mesh
}

export function buildAtmosphere(scene: THREE.Scene, renderer: THREE.WebGLRenderer, q: QualityProfile, night: boolean, sunFromLeft: boolean): Atmosphere {
  const group = new THREE.Group()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environment = env
  scene.environmentIntensity = night ? 0.18 : 0.5
  scene.background = new THREE.Color(night ? 0x10142e : 0xf6e3c4)
  scene.fog = new THREE.Fog(night ? 0x1c2148 : 0xecd2ac, 380, night ? 1200 : 1900)

  const hemi = new THREE.HemisphereLight(night ? 0x5a6ab8 : 0xfff2dc, night ? 0x1a1428 : 0x8a6448, night ? 0.35 : 0.95)
  const sun = new THREE.DirectionalLight(night ? 0x8fa8ff : 0xffe1b0, night ? 0.75 : 1.9)
  const sunDir = new THREE.Vector3(sunFromLeft ? -0.75 : 0.75, 0.62, -0.25).normalize()
  sun.castShadow = q.bloom
  if (sun.castShadow) {
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera
    c.left = -60
    c.right = 60
    c.top = 60
    c.bottom = -60
    c.near = 1
    c.far = 400
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.04
    sun.shadow.radius = 4
  }
  const fill = new THREE.DirectionalLight(night ? 0xffa860 : 0xfff6ea, night ? 0.55 : 0.45)
  fill.position.set(-sunDir.x, 0.8, 0.4)
  group.add(hemi, sun, sun.target, fill)
  group.add(skyDome(night))

  const dustGeo = new THREE.BufferGeometry()
  const p = new Float32Array(DUST * 3)
  for (let i = 0; i < DUST; i++) {
    p[i * 3] = (Math.random() - 0.5) * DUST_BOX * 2
    p[i * 3 + 1] = Math.random() * DUST_BOX
    p[i * 3 + 2] = (Math.random() - 0.5) * DUST_BOX * 2
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(p, 3))
  const dustTex = dotTexture()
  const dustMat = new THREE.PointsMaterial({ map: dustTex, size: 0.45, sizeAttenuation: true, transparent: true, opacity: night ? 0.25 : 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d0 })
  dustGeo.setDrawRange(0, Math.round(DUST * Math.min(1, Math.max(0.3, q.particles))))
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  group.add(dust)
  const base = new Float32Array(p)

  return {
    group,
    sun,
    update(t, _dt, camera, focus) {
      sun.position.copy(focus).addScaledVector(sunDir, 160)
      sun.target.position.copy(focus)
      sun.target.updateMatrixWorld()
      // Motes live in a box that wraps around the camera, drifting slowly.
      const cp = camera.position
      const arr = dustGeo.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < DUST; i++) {
        const wrap = (v: number, c: number): number => c + ((((v - c) % (DUST_BOX * 2)) + DUST_BOX * 3) % (DUST_BOX * 2)) - DUST_BOX
        const bx = base[i * 3] + Math.sin(t * 0.3 + i) * 3 + t * 0.6
        const by = base[i * 3 + 1] + Math.sin(t * 0.2 + i * 1.7) * 2
        const bz = base[i * 3 + 2] + Math.cos(t * 0.25 + i) * 3
        let x = wrap(bx, cp.x)
        let y = Math.max(0.5, wrap(by, cp.y))
        let z = wrap(bz, cp.z)
        // A mote right at the lens would bloom into a white blob: keep them a little away.
        const dx = x - cp.x
        const dy = y - cp.y
        const dz = z - cp.z
        const d = Math.hypot(dx, dy, dz)
        if (d < MOTE_NEAR) {
          const k = MOTE_NEAR / Math.max(d, 1e-3)
          x = cp.x + dx * k
          y = cp.y + dy * k
          z = cp.z + dz * k
        }
        arr.setXYZ(i, x, y, z)
      }
      arr.needsUpdate = true
    },
    dispose() {
      env.dispose()
      dustGeo.dispose()
      dustMat.dispose()
      dustTex.dispose()
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      scene.environment = null
      scene.fog = null
    },
  }
}
