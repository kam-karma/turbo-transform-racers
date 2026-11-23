// Throwaway test bench for Fx + RaceAudio: a dummy car circling a plane, buttons for every
// event and sound, toggles for the continuous states. Open /src/dev/fx.html on the dev server.
import * as THREE from 'three'
import type { FormId, Surface } from '../sim/forms'
import type { RacerEventKind, RacerState } from '../sim/racer'
import { RaceAudio } from '../game/audio'
import { ChaseCamera } from '../game/chaseCamera'
import { Fx } from '../game/fx'
import { createPostFx } from '../game/postFx'
import { profileFor } from '../game/quality'

const params = new URLSearchParams(location.search)
const quality = params.get('q') === 'low' ? 'low' : 'high'
const profile = profileFor(quality, window.devicePixelRatio)

const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(profile.pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x6fc3ff)
scene.fog = new THREE.Fog(0xbfe6ff, 150, 900)
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 4000)
const post = createPostFx(renderer, scene, camera)
post.setEnabled(profile.bloom)
scene.add(new THREE.HemisphereLight(0xdff3ff, 0x8a7a6a, 1.6))
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2)
sun.position.set(80, 140, 40)
scene.add(sun)

const R = 140
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), new THREE.MeshStandardMaterial({ color: 0x9fd88a }))
ground.rotation.x = -Math.PI / 2
ground.position.y = -0.36
scene.add(ground)
const roadMat = new THREE.MeshStandardMaterial({ color: 0x55565e })
const road = new THREE.Mesh(new THREE.RingGeometry(R - 7, R + 7, 160), roadMat)
road.rotation.x = -Math.PI / 2
road.position.y = -0.34
scene.add(road)
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff5a8a : 0xffffff }))
  post.position.set(Math.cos(a) * (R + 9), 1.2, Math.sin(a) * (R + 9))
  scene.add(post)
}

const car = new THREE.Group()
const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.6), new THREE.MeshStandardMaterial({ color: 0x2ad1c9 }))
body.position.y = 0.3
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.6), new THREE.MeshStandardMaterial({ color: 0xff8a3a }))
cabin.position.set(0, 0.9, -0.2)
car.add(body, cabin)
for (const [x, z] of [[0.9, 1.2], [-0.9, 1.2], [0.9, -1.2], [-0.9, -1.2]]) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0x222222 }))
  w.rotation.z = Math.PI / 2
  w.position.set(x, 0, z)
  car.add(w)
}
scene.add(car)

const fx = new Fx(scene, camera, profile)
const audio = new RaceAudio()
const chase = new ChaseCamera(camera)

type Mut = { -readonly [K in keyof RacerState]: RacerState[K] }
const st: Mut = {
  s: 0, d: 0, y: 0, vy: 0, yaw: 0, speed: 35, form: 'car', formT: 0, turbo: 0, boost: 0, combo: 0, bestCombo: 0, perfects: 0,
  airborne: false, airT: 0, respawnT: 0, crossT: Infinity, wrongFlagged: false, lastBoundaryS: -1, judgedS: -1, onWall: false, surface: 'road', coins: 0,
  nextCoin: 0, finished: false, time: 0,
}
const ui = { turbo: false, boost: false, throttle: 1, timeScale: 1 }
let angle = 0

// ---- panel ------------------------------------------------------------------------------
const panel = document.getElementById('panel') as HTMLDivElement
const h = (t: string): void => { panel.insertAdjacentHTML('beforeend', `<h3>${t}</h3>`) }
const btn = (label: string, fn: () => void, cls = ''): void => {
  const b = document.createElement('button')
  b.textContent = label
  b.className = cls
  b.onclick = () => {
    audio.start()
    fn()
  }
  panel.appendChild(b)
}
const slider = (label: string, min: number, max: number, val: number, fn: (v: number) => void): void => {
  const l = document.createElement('label')
  l.textContent = `${label} `
  const i = document.createElement('input')
  i.type = 'range'
  i.min = String(min)
  i.max = String(max)
  i.value = String(val)
  const out = document.createElement('span')
  out.textContent = String(val)
  i.oninput = () => {
    fn(Number(i.value))
    out.textContent = i.value
  }
  l.append(i, out)
  panel.appendChild(l)
}
const check = (label: string, fn: (on: boolean) => void): void => {
  const l = document.createElement('label')
  const i = document.createElement('input')
  i.type = 'checkbox'
  i.onchange = () => fn(i.checked)
  l.append(i, ` ${label}`)
  panel.appendChild(l)
}
const select = (label: string, opts: readonly string[], fn: (v: string) => void): void => {
  const l = document.createElement('label')
  l.textContent = `${label} `
  const s = document.createElement('select')
  for (const o of opts) s.add(new Option(o, o))
  s.onchange = () => fn(s.value)
  l.appendChild(s)
  panel.appendChild(l)
}

const fire = (kind: RacerEventKind, value?: number): void => {
  const e = value === undefined ? { kind } : { kind, value }
  fx.onEvent(e, car.position)
  audio.onEvent(e)
}

h(`State (quality: ${quality})`)
slider('speed', 0, 70, st.speed, (v) => { st.speed = v })
slider('throttle', 0, 100, 100, (v) => { ui.throttle = v / 100 })
slider('combo', 0, 8, 0, (v) => { st.combo = v })
check('turbo', (on) => { ui.turbo = on })
check('boost', (on) => { ui.boost = on })
check('airborne', (on) => {
  st.airborne = on
  if (!on) fire('land', 9)
  else fire('jump', st.speed)
})
check('on wall (left)', (on) => {
  st.onWall = on
  st.d = on ? 6 : 0
  if (on) fire('wall', st.speed)
})
select('form', ['car', 'boat', 'glider', 'climber'], (v) => {
  st.form = v as FormId
  fire('transform')
})
select('surface', ['road', 'ice', 'water', 'gap', 'climb'], (v) => {
  const was = st.surface
  st.surface = v as Surface
  if (v === 'water' && was !== 'water') fire('splash', st.speed)
})
btn('Low / High quality', () => { location.search = quality === 'high' ? '?q=low' : '' })

h('Events')
btn('perfect', () => {
  st.combo++
  st.turbo = 1
  fire('perfect', st.combo)
})
for (const k of ['early', 'late', 'wrongForm', 'transform', 'boost', 'jump', 'land', 'splash', 'wall', 'fall', 'respawn', 'coin', 'finish'] as const) {
  btn(k, () => {
    if (k === 'boost') st.boost = 1.5
    if (k === 'wrongForm' || k === 'late') st.combo = 0
    fire(k, k === 'land' ? 10 : k === 'coin' ? ++st.coins : st.speed)
  })
}
btn('coin ×6', () => {
  for (let i = 0; i < 6; i++) setTimeout(() => fire('coin', ++st.coins), i * 160)
})

h('Audio')
btn('start audio', () => undefined, 'snd')
btn('3', () => audio.countdown(3), 'snd')
btn('2', () => audio.countdown(2), 'snd')
btn('1', () => audio.countdown(1), 'snd')
btn('GO', () => audio.countdown(0), 'snd')
check('mute', (on) => audio.setMuted(on))
check('suspend', (on) => audio.suspend(on))
const stats = document.createElement('div')
stats.id = 'stats'
panel.appendChild(stats)

// ---- loop -------------------------------------------------------------------------------
const fwd = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const look = new THREE.Vector3()
let last = performance.now()
let frames = 0
let fpsT = 0
let fps = 0

renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000) * ui.timeScale
  last = now
  st.turbo = ui.turbo ? 1 : Math.max(0, st.turbo - dt)
  st.boost = ui.boost ? 1.5 : Math.max(0, st.boost - dt)
  angle += (st.speed / R) * dt
  const r = R + st.d
  const y = st.airborne ? 3 + Math.sin(now / 300) * 1.2 : st.surface === 'water' && st.form !== 'boat' ? -0.5 : 0
  car.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r)
  fwd.set(-Math.sin(angle), 0, Math.cos(angle))
  look.copy(car.position).add(fwd)
  car.lookAt(look)
  roadMat.color.setHex(st.surface === 'water' ? 0x2ea8e0 : st.surface === 'ice' ? 0xcfe9ff : st.surface === 'climb' ? 0xd0743a : 0x55565e)
  fx.update(dt, car.position, fwd, st)
  audio.update(st, ui.throttle)
  chase.update(car.position, fwd, up, st, dt)
  post.render()
  frames++
  fpsT += dt
  if (fpsT > 0.5) {
    fps = Math.round(frames / fpsT)
    frames = 0
    fpsT = 0
    const info = renderer.info.render
    stats.textContent = `fps ${fps}  calls ${info.calls}\ntris ${info.triangles}`
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  post.setSize(window.innerWidth, window.innerHeight)
})
;(window as unknown as { fxBench: unknown }).fxBench = { fx, audio, st, fire, ui }
