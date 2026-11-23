/**
 * Dev view of the Uçan Adalar world (buildAdalarWorld) with the hero car parked on the road.
 * Query: ?track=adalar2 &v=night|reverse|mirror &q=low &s=1200 (camera at track position)
 * &orbit=1 &top=1 &boss=1 (whale boss 25 m behind) &h=4.2&back=9 (chase offsets) &car=0.
 *
 * The Browser pane may be hidden (no requestAnimationFrame): window.__world drives it by hand:
 * goto(s), tick(seconds), snap(name) → assets/snaps/name.jpg, stats().
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildTrack } from '../sim/track'
import { adalarTrack } from '../sim/tracks/index'
import type { TrackVariant } from '../sim/tracks/variants'
import { profileFor } from '../game/quality'
import { createPostFx } from '../game/postFx'
import { loadCarModel } from '../game/car'
import { buildAdalarWorld, buildWhaleBoss } from '../worlds/adalar/index'

const qs = new URLSearchParams(location.search)
const num = (k: string, d: number): number => (qs.has(k) ? Number(qs.get(k)) : d)
const quality = qs.get('q') === 'low' ? 'low' : 'high'
const q = profileFor(quality, window.devicePixelRatio)
const variant = (qs.get('v') ?? 'normal') as TrackVariant

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(q.pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = num('exp', 1.05)
renderer.shadowMap.enabled = q.bloom
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 6000)

const t0 = performance.now()
const track = buildTrack(adalarTrack(qs.get('track') ?? 'adalar1', variant))
const world = await buildAdalarWorld(track, q, variant)
scene.add(world.group)
world.attach(scene)
const buildMs = performance.now() - t0

const boss = qs.has('boss') ? await buildWhaleBoss(track, q) : null
if (boss !== null) scene.add(boss.group)

let car: THREE.Object3D | null = null
if (qs.get('car') !== '0') {
  const model = await loadCarModel('./models/hero.glb', true).catch(() => null)
  if (model !== null) {
    const box = new THREE.Box3().setFromObject(model)
    model.scale.setScalar(3.3 / (box.max.z - box.min.z))
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true
    })
    car = new THREE.Group()
    car.add(model)
    scene.add(car)
  }
}

const post = createPostFx(renderer, scene, camera)
post.setEnabled(q.bloom && !qs.has('nopost'))
post.setNight(variant === 'night' ? 1 : 0)

let s = num('s', 26)
let time = num('t', 3)
const back = num('back', 9)
const h = num('h', 4.2)
let controls: OrbitControls | null = null

const basis = new THREE.Matrix4()
function place(): void {
  if (qs.has('top')) {
    const p = track.toWorld(s, 0, 0)
    camera.position.set(p.x + 300, p.y + 500, p.z + 300)
    camera.lookAt(p.x, p.y, p.z)
  } else if (!qs.has('orbit')) {
    const p = track.toWorld(s - back, 0, h)
    const l = track.toWorld(s + 14, 0, 1.2)
    camera.position.set(p.x, p.y, p.z)
    camera.lookAt(l.x, l.y, l.z)
  }
  if (car !== null) {
    const f = track.frameAt(s)
    const p = track.toWorld(s, 0, 0)
    basis.makeBasis(new THREE.Vector3(f.left.x, f.left.y, f.left.z), new THREE.Vector3(f.up.x, f.up.y, f.up.z), new THREE.Vector3(f.t.x, f.t.y, f.t.z))
    car.quaternion.setFromRotationMatrix(basis)
    car.position.set(p.x, p.y, p.z)
  }
}
place()
if (qs.has('orbit')) {
  controls = new OrbitControls(camera, canvas)
  const l = track.toWorld(s, 0, 0)
  camera.position.set(l.x + 40, l.y + 25, l.z - 40)
  controls.target.set(l.x, l.y, l.z)
  controls.update()
}

function frame(dt: number): void {
  time += dt
  world.update(time, s, 40)
  boss?.update(time, s - num('gap', 26), 0.5)
  controls?.update()
}

function render(): { calls: number; tris: number } {
  renderer.info.autoReset = false
  renderer.info.reset()
  post.render()
  return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }
}

const info = document.getElementById('info') as HTMLDivElement
const show = (): void => {
  const r = render()
  info.textContent = `${quality} ${track.def.id}/${variant} s=${s.toFixed(0)} calls=${r.calls} tris=${(r.tris / 1000).toFixed(0)}k build=${buildMs.toFixed(0)}ms ${track.themeAt(s)}/${track.surfaceAt(s)}`
}
frame(0)
render()
show()

const RELAY = 'http://127.0.0.1:5199/?name='
;(window as unknown as { __world: unknown }).__world = {
  renderer, scene, camera, track, world,
  goto(ns: number, opts: { back?: number; h?: number } = {}): void {
    s = ns
    if (opts.back !== undefined || opts.h !== undefined) {
      const p = track.toWorld(s - (opts.back ?? back), 0, opts.h ?? h)
      const l = track.toWorld(s + 14, 0, 1.2)
      camera.position.set(p.x, p.y, p.z)
      camera.lookAt(l.x, l.y, l.z)
      place()
      const p2 = track.toWorld(s - (opts.back ?? back), 0, opts.h ?? h)
      camera.position.set(p2.x, p2.y, p2.z)
      camera.lookAt(l.x, l.y, l.z)
    } else place()
    frame(0.016)
    show()
  },
  look(px: number, py: number, pz: number, tx: number, ty: number, tz: number): void {
    camera.position.set(px, py, pz)
    camera.lookAt(tx, ty, tz)
    show()
  },
  tick(seconds: number): void {
    for (let i = 0; i < Math.round(seconds * 30); i++) frame(1 / 30)
    show()
  },
  stats: () => render(),
  async snap(name: string): Promise<string> {
    show()
    const blob = await new Promise<Blob | null>((res) => renderer.domElement.toBlob(res, 'image/jpeg', 0.85))
    if (blob === null) return 'no blob'
    const r = await fetch(RELAY + encodeURIComponent(name + '.jpg'), { method: 'POST', body: blob })
    return r.text()
  },
}

renderer.setAnimationLoop(() => {
  if (qs.has('run')) {
    s = (s + 35 / 60) % track.length
    place()
  }
  frame(1 / 60)
  show()
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  post.setSize(window.innerWidth, window.innerHeight)
})
