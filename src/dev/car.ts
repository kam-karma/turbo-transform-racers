// Throwaway viewer for CarView: forms 1-4, surfaces, slow motion, opacity, six-car load.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CarView, loadCarModel, type Pose } from '../game/car'
import { partsTriangles } from '../game/carParts'
import { FORMS, type FormId, type Surface } from '../sim/forms'
import type { Frame, Track } from '../sim/track'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
document.body.prepend(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x7cc8ff)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500)
camera.position.set(-5, 3.2, -9)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.9, 0)
scene.add(new THREE.HemisphereLight(0xcfeaff, 0x8a7a5a, 1.6))
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6)
sun.position.set(-8, 14, -6)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
scene.add(sun)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.9 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)
const grid = new THREE.GridHelper(60, 30, 0x888888, 0x999999)
grid.position.y = 0.01
scene.add(grid)
const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2aa8e8, transparent: true, opacity: 0.6, roughness: 0.1 }))
water.rotation.x = -Math.PI / 2
water.position.y = 0.02
scene.add(water)

// A straight flat track along +Z: left = +X, up = +Y.
const frame = (s: number): Frame => ({ s, pos: { x: 0, y: 0, z: s }, t: { x: 0, y: 0, z: 1 }, left: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, pitch: 0, curvV: 0, curvH: 0, width: 14, surface: 'road' })
const track = { frameAt: frame, toWorld: (s: number, d: number, y: number) => ({ x: d, y, z: s }) } as unknown as Track

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const info = $('info')
let cars: CarView[] = []
let form: FormId = 'car'
let timeScale = 1

async function load(kind: string): Promise<void> {
  for (const c of cars) scene.remove(c.root)
  const names = kind === 'six' ? ['rt40', 'rt40_lod', 'r40_lod', 'r245_lod', 'rt40_lod', 'fallback'] : [kind]
  const models = await Promise.all(names.map((n) => (n === 'fallback' ? Promise.resolve(null) : loadCarModel(`/models/${n}.glb`))))
  const colors = [0x2fd3c8, 0xff4f6d, 0x8f5bff, 0xffb02e, 0x45d96b, 0x3d8bff]
  cars = models.map((m, i) => new CarView(m, colors[i], i === 0 && kind !== 'six' ? { shadows: true } : { label: ['Rüzgâr', 'Pıtırcık', 'Kum Böceği', 'Fırtına', 'Zıpzıp', 'Senin rekorun'][i], badge: ['🦊', '🐸', '🐞', '⚡', '🐰', '👻'][i], shadows: true }))
  cars.forEach((c) => scene.add(c.root))
}

function setForm(f: FormId): void {
  form = f
}

document.querySelectorAll<HTMLButtonElement>('button[data-form]').forEach((b) => b.addEventListener('click', () => setForm(b.dataset.form as FormId)))
addEventListener('keydown', (e) => {
  const i = Number(e.key) - 1
  if (i >= 0 && i < 4) setForm(FORMS[i])
  if (e.key === 'p') timeScale = timeScale === 0 ? 1 : 0
})
$<HTMLSelectElement>('model').addEventListener('change', (e) => void load((e.target as HTMLSelectElement).value))

let cycleT = 0
let last = performance.now()
let elapsed = 0
const dev = {
  /** Advance the simulation by dt seconds while paused (for mid-transform screenshots). */
  step: (dt: number) => tick(dt),
  form: (f: FormId) => setForm(f),
  pause: (on: boolean) => { timeScale = on ? 0 : 1 },
  cam: (x: number, y: number, z: number) => { camera.position.set(x, y, z); controls.update() },
}
;(window as unknown as { dev: typeof dev }).dev = dev

function tick(dt: number): void {
  elapsed += dt
  const surface = $<HTMLSelectElement>('surface').value as Surface
  water.visible = surface === 'water'
  ground.visible = surface !== 'water' && surface !== 'gap'
  if ($<HTMLInputElement>('cycle').checked) {
    cycleT += dt
    if (cycleT > 1.5) {
      cycleT = 0
      setForm(FORMS[(FORMS.indexOf(form) + 1) % 4])
    }
  }
  const speed = Number($<HTMLInputElement>('speed').value)
  const yaw = (Number($<HTMLInputElement>('yaw').value) * Math.PI) / 180
  cars.forEach((c, i) => {
    const pose: Pose = { s: (i % 3) * 7 - 7 * (i >= 3 ? 1 : 0), d: i < 3 ? 0 : 5, y: surface === 'gap' ? 1.2 + Math.sin(elapsed) * 0.3 : 0, yaw, form, speed, fx: 0, surface, formT: 0 }
    if (cars.length > 1) pose.d = (i % 3 - 1) * 4.5
    if (cars.length > 1) pose.s = i < 3 ? 0 : -8
    c.update(pose, track, dt)
    c.setOpacity(Number($<HTMLInputElement>('opacity').value) / 100)
  })
}

function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  const scale = timeScale * Number($<HTMLInputElement>('ts').value) / 100
  if (scale > 0) tick(dt * scale)
  controls.update()
  renderer.render(scene, camera)
  const tris = partsTriangles()
  info.textContent = `form ${form}\ndraws ${renderer.info.render.calls} tris ${renderer.info.render.triangles}\nparts ${JSON.stringify(tris)}\nparts total ${Object.values(tris).reduce((a, b) => a + b, 0)}`
  requestAnimationFrame(loop)
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
})
void load('rt40').then(() => requestAnimationFrame(loop))
