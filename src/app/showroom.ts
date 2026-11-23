/**
 * The menu showroom: the current car on a glossy turntable, soft studio lights, and the current
 * world's card art as a softened backdrop (canvas-blurred, cover-fit). Used by the home page and
 * the garage (different camera framing). Light: one podium, one car, a few sparkles.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { WorldId } from '../meta/cups'
import { partsLoader } from './carParts'
import { worldTheme } from './theme'

export type ShowroomView = 'home' | 'garage' | 'results'

/** Car length in showroom units. */
const CAR_LEN = 4

interface Framing { readonly pos: THREE.Vector3; readonly target: THREE.Vector3; readonly fov: number }

/** Camera per view; `shift` > 0 moves the car left on screen (fraction of view width). */
const VIEWS: Readonly<Record<ShowroomView, { framing: Framing; shift: number }>> = {
  home: { framing: { pos: new THREE.Vector3(8.2, 4.2, 11.6), target: new THREE.Vector3(0, 0.25, 0), fov: 30 }, shift: 0 },
  garage: { framing: { pos: new THREE.Vector3(9.6, 4.6, 13.4), target: new THREE.Vector3(0, 0.3, 0), fov: 30 }, shift: 0.2 },
  results: { framing: { pos: new THREE.Vector3(0, 2.4, 9.5), target: new THREE.Vector3(0, 1.2, 0), fov: 36 }, shift: 0 },
}

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, 'rgba(20,8,60,.55)')
  g.addColorStop(0.6, 'rgba(20,8,60,.25)')
  g.addColorStop(1, 'rgba(20,8,60,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** World art → blurred, vignetted canvas; gradient fallback when the jpg is missing. */
function backdrop(world: WorldId, onReady: (t: THREE.CanvasTexture) => void): void {
  const theme = worldTheme(world)
  const c = document.createElement('canvas')
  c.width = 960
  c.height = 540
  const x = c.getContext('2d')!
  const finish = (): void => {
    const v = x.createRadialGradient(480, 300, 120, 480, 300, 620)
    v.addColorStop(0, 'rgba(255,255,255,0)')
    v.addColorStop(1, theme.vignette)
    x.fillStyle = v
    x.fillRect(0, 0, 960, 540)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    onReady(t)
  }
  const grad = x.createLinearGradient(0, 0, 0, 540)
  theme.sky.forEach((col, i) => grad.addColorStop(i / (theme.sky.length - 1), col))
  x.fillStyle = grad
  x.fillRect(0, 0, 960, 540)
  finish()
  const img = new Image()
  img.onload = () => {
    if (img.naturalWidth === 0) return
    x.filter = 'blur(7px) saturate(1.15)'
    x.drawImage(img, -20, -20, 1000, 580)
    x.filter = 'none'
    x.fillStyle = theme.tint
    x.fillRect(0, 0, 960, 540)
    finish()
  }
  img.src = `./ui/worlds/${world}.jpg`
}

export class Showroom {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200)
  private readonly turntable = new THREE.Group()
  private readonly carHolder = new THREE.Group()
  private readonly ringMat: THREE.MeshStandardMaterial
  private readonly sparkles: THREE.Points
  private car: THREE.Object3D | null = null
  private view: ShowroomView = 'home'
  private world: WorldId | null = null
  private bgTex: THREE.Texture | null = null
  private spin = 0
  private dragV = 0
  private t = 0
  private readonly camPos = new THREE.Vector3()
  private readonly camTarget = new THREE.Vector3()
  private shift = 0
  private poseT = 1
  /** Height of the car on the deck: tall cars (monster truck, van) get a wider, higher shot. */
  private carH = 1.6
  private readonly env: THREE.Texture
  /** World-tinted materials of the Blender podium (accent paint and LED glow). */
  private readonly tinted: THREE.MeshStandardMaterial[] = []
  private readonly glows: THREE.MeshStandardMaterial[] = []

  constructor(renderer: THREE.WebGLRenderer) {
    const pm = new THREE.PMREMGenerator(renderer)
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    pm.dispose()
    this.scene.environment = this.env
    this.scene.environmentIntensity = 0.55

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6a4aa0, 1.3)
    const key = new THREE.DirectionalLight(0xfff1dc, 2.4)
    key.position.set(4, 8, 5)
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6)
    rim.position.set(-6, 4, -6)
    this.scene.add(hemi, key, rim)

    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.4, 0.36, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05 }))
    top.position.y = -0.18
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.75, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x3b2490, roughness: 0.4 }))
    skirt.position.y = -0.55
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0xff5fc8, emissive: 0xff5fc8, emissiveIntensity: 1.2, roughness: 0.3 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.07, 10, 96), this.ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.3
    const stripes = new THREE.Group()
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.06, 0.22, 2, 0.03), this.ringMat)
      const a = (i / 12) * Math.PI * 2
      s.position.set(Math.cos(a) * 2.85, 0.005, Math.sin(a) * 2.85)
      s.rotation.y = -a + Math.PI / 2
      stripes.add(s)
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.012
    this.turntable.add(top, stripes, shadow, this.carHolder)
    this.loadPodium([top, stripes], [skirt, ring])
    const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }))
    floorShadow.rotation.x = -Math.PI / 2
    floorShadow.position.y = -0.79
    this.scene.add(this.turntable, skirt, ring, floorShadow)

    const n = 70
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 3 + Math.random() * 6
      pos.set([Math.cos(a) * r, Math.random() * 5, Math.sin(a) * r - 2], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.sparkles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false }))
    this.scene.add(this.sparkles)
    this.setView('home', true)
  }

  /**
   * The detailed podium (tools/blender/make_podium.py) replaces the simple procedural one once
   * loaded; the procedural pieces stay as the fallback when the files are missing.
   */
  private loadPodium(deckParts: THREE.Object3D[], baseParts: THREE.Object3D[]): void {
    const loader = partsLoader()
    Promise.all([loader.loadAsync('./models/parts/podium-base.glb'), loader.loadAsync('./models/parts/podium-top.glb')])
      .then(([base, deck]) => {
        for (const g of [base.scene, deck.scene]) {
          g.traverse((o) => {
            const m = o as THREE.Mesh
            if (!m.isMesh) return
            const mat = m.material as THREE.MeshStandardMaterial
            const key = mat.name.replace(/\.\d+$/, '')
            if (key === 'accent') this.tinted.push(mat)
            if (key === 'glow') this.glows.push(mat)
            if (key === 'deck') mat.envMapIntensity = 1.4
            if (key === 'chrome') mat.envMapIntensity = 2.2
          })
        }
        for (const o of [...deckParts, ...baseParts]) o.visible = false
        this.scene.add(base.scene)
        this.addBeams(base.scene)
        this.turntable.add(deck.scene)
        if (this.world !== null) this.tint(worldTheme(this.world).accent)
      })
      .catch((error: unknown) => console.warn('Podium models could not load, keeping the simple one:', error))
  }

  /** Soft additive light beams from the podium spotlights up to the car. */
  private addBeams(base: THREE.Object3D): void {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 128
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.7, 'rgba(255,255,255,.35)')
    g.addColorStop(1, 'rgba(255,255,255,.75)')
    x.fillStyle = g
    x.fillRect(0, 0, 4, 128)
    const tex = new THREE.CanvasTexture(c)
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xfff4dc, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    this.beamMat = mat
    base.updateMatrixWorld(true)
    const target = new THREE.Vector3(0, 1.4, 0)
    base.traverse((o) => {
      if (!/^lens\d/.test(o.name)) return
      const from = o.getWorldPosition(new THREE.Vector3())
      const len = from.distanceTo(target)
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.12, len, 24, 1, true), mat)
      cone.position.copy(from).lerp(target, 0.5)
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(from).normalize())
      cone.renderOrder = 3
      this.scene.add(cone)
    })
  }

  private beamMat: THREE.MeshBasicMaterial | null = null

  private tint(accent: string): void {
    for (const m of this.tinted) m.color.set(accent)
    for (const m of this.glows) {
      m.color.set(accent)
      m.emissive.set(accent)
    }
  }

  setWorld(world: WorldId): void {
    if (world === this.world) return
    this.world = world
    const theme = worldTheme(world)
    this.ringMat.color.set(theme.accent)
    this.ringMat.emissive.set(theme.accent)
    this.tint(theme.accent)
    backdrop(world, (t) => {
      if (this.world !== world) return
      this.bgTex?.dispose()
      this.bgTex = t
      this.scene.background = t
      this.fitBackground()
    })
  }

  /** Puts a car on the turntable (normalised to CAR_LEN, wheels on the deck). */
  setCar(model: THREE.Object3D | null): void {
    if (this.car !== null) this.carHolder.remove(this.car)
    this.car = model
    if (model === null) return
    const wrap = new THREE.Group()
    wrap.add(model)
    model.position.set(0, 0, 0)
    model.scale.setScalar(1)
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const len = Math.max(box.max.z - box.min.z, box.max.x - box.min.x)
    const s = len > 0 ? CAR_LEN / len : 1
    model.scale.setScalar(s)
    model.updateMatrixWorld(true)
    const b2 = new THREE.Box3().setFromObject(model)
    const c = b2.getCenter(new THREE.Vector3())
    model.position.set(-c.x, -b2.min.y, -c.z)
    this.carH = b2.max.y - b2.min.y
    this.car = wrap
    this.carHolder.add(wrap)
    this.pose()
  }

  /** A little hop + spin when something on the car changes (spec §14.7 "photo pose"). */
  pose(): void {
    this.poseT = 0
  }

  setView(view: ShowroomView, instant = false): void {
    this.view = view
    if (instant) {
      const v = VIEWS[view]
      this.camPos.copy(v.framing.pos)
      this.camTarget.copy(v.framing.target)
      this.shift = v.shift
    }
  }

  /** Drag to spin the turntable (garage). `dx` in px. */
  drag(dx: number): void {
    this.dragV = dx * 0.012
    this.spin += this.dragV
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    this.fitBackground()
  }

  private fitBackground(): void {
    const t = this.bgTex
    if (t === null) return
    const img = 16 / 9
    const a = this.camera.aspect
    t.repeat.set(a > img ? 1 : a / img, a > img ? img / a : 1)
    t.offset.set((1 - t.repeat.x) / 2, (1 - t.repeat.y) / 2)
  }

  frame(dt: number): void {
    this.t += dt
    const v = VIEWS[this.view]
    const k = 1 - Math.exp(-dt * 4)
    this.camPos.lerp(v.framing.pos, k)
    this.camTarget.lerp(v.framing.target, k)
    this.shift += (v.shift - this.shift) * k
    // Narrow screens: pull back so the car still fits.
    const tall = Math.max(0, this.carH - 1.7)
    const pull = (this.camera.aspect < 1.5 ? 1.25 : 1) * (1 + tall * 0.22)
    const aim = this.camTarget.clone()
    aim.y += tall * 0.45
    this.camera.position.copy(aim).addScaledVector(this.camPos.clone().sub(this.camTarget), pull)
    this.camera.lookAt(aim)
    this.camera.fov = v.framing.fov
    const w = this.camera.aspect * 1000
    this.camera.setViewOffset(w, 1000, this.shift * w, 0, w, 1000)
    this.camera.updateProjectionMatrix()

    this.dragV *= Math.exp(-dt * 3)
    this.spin += dt * (Math.abs(this.dragV) > 0.002 ? 0 : 0.35)
    this.poseT = Math.min(1, this.poseT + dt / 0.9)
    const hop = Math.sin(Math.min(1, this.poseT * 1.6) * Math.PI) * 0.35 * (1 - this.poseT)
    this.turntable.rotation.y = this.spin + (1 - this.poseT) ** 2 * Math.PI * 0.8
    this.carHolder.position.y = hop
    this.ringMat.emissiveIntensity = 1 + 0.35 * Math.sin(this.t * 2.2)
    for (const g of this.glows) g.emissiveIntensity = 1.6 + 0.6 * Math.sin(this.t * 2.2)
    if (this.beamMat !== null) this.beamMat.opacity = 0.16 + 0.06 * Math.sin(this.t * 1.3)
    this.sparkles.rotation.y = this.t * 0.04
    ;(this.sparkles.material as THREE.PointsMaterial).opacity = 0.55 + 0.25 * Math.sin(this.t * 1.7)
  }

  dispose(): void {
    this.bgTex?.dispose()
    this.env.dispose()
  }
}
