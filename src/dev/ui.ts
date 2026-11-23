/**
 * Dev-only UI test bench: the real App with mock races (no real track), a dev save
 * (separate storage key) and the local ad stand-in. window.__ui exposes hooks:
 *   __ui.tick(sec)        advance the app by hand (the pane may be hidden)
 *   __ui.go({name:'garage'}) / __ui.race('adalar-bronz-1') / __ui.finish(place)
 *   __ui.save(fn)         edit the dev save, __ui.reset()
 */
import * as THREE from 'three'
import { App } from '../app/app'
import type { RaceKit } from '../app/appTypes'
import { loadCarModel } from '../game/car'
import { SaveStore, type StorageLike } from '../meta/save'
import type { SaveData } from '../meta/save'
import type { RaceMode, RaceOutcome, RaceSpec } from '../modes/types'
import { createAdFlow } from '../platform/adFlow'
import { createLocalAds } from '../platform/ads'
import { FORMS } from '../sim/forms'
import { Input } from '../ui/input'
import { loadSettings, type Settings } from '../ui/settings'

const devStorage: StorageLike = {
  getItem: (k) => localStorage.getItem(`dev-ui-${k}`),
  setItem: (k, v) => localStorage.setItem(`dev-ui-${k}`, v),
  removeItem: (k) => localStorage.removeItem(`dev-ui-${k}`),
}

const SKY: Record<string, number> = { adalar: 0x6fc3ff, 'dev-ev': 0xffc078, neon: 0x120838 }
const GROUND: Record<string, number> = { adalar: 0x3a3f52, 'dev-ev': 0xff8a1f, neon: 0x1a1240 }

/** A stand-in race: a moving striped road, the player car, a scripted race feeding the HUD. */
function mockRace(spec: RaceSpec, kit: RaceKit, car: THREE.Object3D | null, control: { finishPlace: number | null; length: number }): RaceMode {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY[spec.world])
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8866aa, 2), new THREE.DirectionalLight(0xffffff, 2))
  const tex = (() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 256
    const x = c.getContext('2d')!
    x.fillStyle = `#${GROUND[spec.world].toString(16).padStart(6, '0')}`
    x.fillRect(0, 0, 64, 256)
    x.fillStyle = spec.world === 'neon' ? '#39f2ff' : '#ffffff'
    x.fillRect(29, 0, 6, 120)
    x.fillRect(0, 0, 4, 256)
    x.fillRect(60, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 20)
    return t
  })()
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), new THREE.MeshStandardMaterial({ map: tex }))
  road.rotation.x = -Math.PI / 2
  road.position.z = -150
  scene.add(road)
  const props = new THREE.Group()
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1 + (i % 3), 16, 12), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((i * 0.13) % 1, 0.8, 0.6) }))
    m.position.set((i % 2 ? 1 : -1) * (12 + (i % 5) * 3), 1, -i * 10)
    props.add(m)
  }
  scene.add(props)
  if (car !== null) {
    const wrap = new THREE.Group()
    const box = new THREE.Box3().setFromObject(car)
    car.scale.setScalar(3.3 / Math.max(0.01, box.max.z - box.min.z))
    wrap.add(car)
    wrap.rotation.y = Math.PI
    scene.add(wrap)
    kit.applyLook(car)
  }
  const forms = kit.hud.formButtons((f) => forms.setActive(f))
  let t = -1
  let started = false
  let finished = false
  let lastCount = 4
  let combo = 0
  const rivals = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, color: ['#ff4b5c', '#2fa8ff', '#7dff5a', '#ff9a2e', '#c84dff'][i], speed: 0.9 + i * 0.05 }))
  const mode: RaceMode = {
    scene,
    get finished() {
      return finished
    },
    start() {
      started = true
      t = 0
      lastCount = 4
      kit.hud.setModePanel(spec.world === 'adalar' ? forms.el : null)
      if (spec.world === 'neon') kit.hud.meter('ŞOK', '#39f2ff').set(0.6)
      if (spec.boss) kit.hud.meter('BOSS', '#ff4b5c').set(0.8)
    },
    frame(dt) {
      kit.camera.position.set(0, 3.2, 8)
      kit.camera.lookAt(0, 1.2, -6)
      if (!started) return
      t += dt
      const race = t - 3
      if (race < 0) {
        const n = Math.ceil(-race)
        if (n !== lastCount) {
          lastCount = n
          kit.hud.countdown(n)
        }
        return
      }
      if (lastCount !== 0) {
        lastCount = 0
        kit.hud.countdown(0)
      }
      tex.offset.y += dt * 2.5
      props.position.z = (props.position.z + dt * 40) % 100
      const p = Math.min(1, race / control.length)
      if (Math.floor(race / 4) > combo && combo < 4) {
        combo++
        kit.hud.pop(combo >= 2 ? `MÜKEMMEL! ×${combo}` : 'MÜKEMMEL!', combo >= 3 ? 'combo' : 'perfect')
        forms.hint(FORMS[combo % 4])
      }
      kit.hud.update({ place: Math.max(1, 6 - Math.floor(p * 5)), of: 6, time: race, kmh: 120 + Math.sin(race) * 30, coins: Math.floor(race * 2), progress: p, rivals: rivals.map((r) => ({ id: r.id, color: r.color, progress: Math.min(1, p * r.speed + 0.02) })), combo, lap: spec.world === 'neon' ? { n: 1 + Math.floor(p * 3), of: 3 } : undefined })
      if (control.finishPlace !== null || p >= 1) finished = true
    },
    outcome(): RaceOutcome {
      const place = control.finishPlace ?? 1
      const names = ['Zeynep', 'Kaan', 'Elif', 'Mert', 'Ada', 'Can']
      const rows = names.map((n, i) => ({ name: i === place - 1 ? 'Sen' : n, badge: '', time: 70 + i * 2.3, you: i === place - 1, pilot: i !== place - 1 }))
      return { place, of: 6, time: 72.4, coins: 34, stars: [place === 1, true, false], starLabels: ['Birinci bitir', 'Gizli şekeri bul', '3 mükemmel dönüşüm'], bossBeaten: spec.boss ? place === 1 : undefined, rows }
    },
    restart() {
      started = false
      finished = false
      combo = 0
      control.finishPlace = null
      kit.hud.show(spec.world)
    },
    dispose() {
      road.geometry.dispose()
    },
  }
  return mode
}

const canvas = document.getElementById('game') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight))
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 2000)
let settings: Settings = loadSettings('high')
const input = new Input(() => settings)
const save = new SaveStore(devStorage)
const ads = createAdFlow(createLocalAds({ grantRewards: true, delayMs: 400 }))
const touch = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
const control = { finishPlace: null as number | null, length: 40 }
const modelCache = new Map<string, Promise<THREE.Object3D | null>>()
const loadCar = (url: string): Promise<THREE.Object3D | null> => {
  let p = modelCache.get(url)
  if (p === undefined) {
    p = loadCarModel(url, true).catch(() => null)
    modelCache.set(url, p)
  }
  return p.then((m) => (m === null ? null : m.clone(true)))
}

const app = new App({
  root: document.getElementById('ui') as HTMLElement,
  renderer,
  camera,
  save,
  ads,
  input,
  touch,
  settings,
  createRace: async (spec, kit) => {
    control.finishPlace = null
    const model = await loadCar(kit.car.model)
    return mockRace(spec, kit, model ?? (await loadCar('./models/hero.glb')), control)
  },
  loadCar: (car) => loadCar(car.model),
  preload: async (progress) => {
    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, location.search.includes('slow') ? 900 : 60))
      progress(i / 5)
    }
    await loadCar('./models/hero.glb')
  },
  onSettings: (s) => {
    settings = s
  },
})
app.start()

;(window as unknown as { __ui: unknown }).__ui = {
  app,
  save,
  tick(sec: number): void {
    const n = Math.max(1, Math.round(sec * 30))
    for (let i = 0; i < n; i++) app.tick(1 / 30)
  },
  go: (r: Parameters<App['go']>[0]) => app.go(r),
  race: (id: string) => app.go({ name: 'race', raceId: id }),
  finish(place = 1): void {
    control.finishPlace = place
  },
  edit(fn: (s: SaveData) => SaveData): void {
    save.update(fn)
  },
  reset(): void {
    save.reset()
  },
}
