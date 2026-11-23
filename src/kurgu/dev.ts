/**
 * Throwaway dev page for Kurgu Kupası: runs the mode standalone with a minimal fake RaceHud.
 * http://localhost:5185/src/kurgu/dev.html?track=devev1&q=high&variant=normal&boss=0
 * The Browser pane may be hidden (no rAF): add &manual=1, drive it with
 * window.__k.tick(seconds) and save frames with window.__k.snap(name) through the local
 * relay (assets/snaps/).
 */
import * as THREE from 'three'
import { RaceAudio } from '../game/audio'
import { createPostFx } from '../game/postFx'
import { profileFor } from '../game/quality'
import { cloneModel, raceSized, rivalModel, warmRivals } from '../modes/assets'
import { rng } from '../sim/bot'
import type { FormId } from '../sim/forms'
import { DEFAULT_PARAMS, type RaceInput } from '../sim/racer'
import type { RaceHud, RaceHudView } from '../ui/raceHud'
import { DEFAULT_SETTINGS } from '../ui/settings'
import { createKurguMode } from './mode'
import { kurguBotInput, kurguSkill, newKurguBotMemory } from './sim/kurguBot'
import type { KurguState } from './sim/kurguRacer'
import type { KurguTrack } from './sim/kurguTrack'

const qs = new URLSearchParams(location.search)
const quality = qs.get('q') === 'low' ? 'low' : 'high'
const q = profileFor(quality, window.devicePixelRatio)
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(q.pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = q.bloom
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 6000)

const $ = (s: string): HTMLElement => document.querySelector(s) as HTMLElement
const hud: RaceHud = {
  show: () => undefined,
  hide: () => undefined,
  countdown: (n) => {
    $('#hud .cd').textContent = n > 0 ? String(n) : 'BAŞLA!'
    if (n === 0) setTimeout(() => { $('#hud .cd').textContent = '' }, 700)
  },
  update: (v: RaceHudView) => { $('#hud .top').textContent = `${v.place}/${v.of} · ${v.time.toFixed(1)} s · ${v.kmh.toFixed(0)} km/s · ${v.coins} altın` },
  pop: (text) => {
    const e = $('#hud .pop')
    e.textContent = text
    setTimeout(() => { if (e.textContent === text) e.textContent = '' }, 900)
  },
  flash: (c) => {
    const e = $('#hud .flash')
    e.style.background = c
    e.style.opacity = '0.35'
    setTimeout(() => { e.style.opacity = '0' }, 120)
  },
  setModePanel: (el) => { $('#hud .panel').replaceChildren(...(el === null ? [] : [el])) },
  formButtons: () => ({ el: document.createElement('div'), setActive: () => undefined, hint: () => undefined }),
  meter: (_label, color) => {
    const m = document.createElement('div')
    m.className = 'meter'
    const i = document.createElement('i')
    i.style.background = color
    m.appendChild(i)
    $('#hud').appendChild(m)
    return { el: m, set: (v) => { i.style.width = `${Math.round(v * 100)}%` } }
  },
}

const keys = new Set<string>()
addEventListener('keydown', (e) => keys.add(e.key))
addEventListener('keyup', (e) => keys.delete(e.key))
let auto: ((dt: number) => RaceInput) | null = null
const input = {
  read(dt: number): RaceInput {
    if (auto !== null) return auto(dt)
    const steer = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)
    return { throttle: keys.has('ArrowDown') ? 0 : 1, brake: keys.has('ArrowDown') ? 1 : 0, steer, form: null }
  },
  pressForm: (_f: FormId) => undefined,
}

async function boot(): Promise<void> {
  const [model] = await Promise.all([cloneModel('./models/hero.glb', true), warmRivals()])
  const mode = await createKurguMode({
    renderer, camera, quality: q, hud, input, audio: new RaceAudio(),
    playerCar: { model: raceSized(model), carId: 'kivilcim', params: DEFAULT_PARAMS },
    settings: () => DEFAULT_SETTINGS,
    modelFor: (car) => rivalModel(car),
  }, {
    raceId: 'dev', cupId: 'dev-ev-bronz', trackId: qs.get('track') ?? 'devev1', variant: (qs.get('variant') ?? 'normal') as 'normal',
    boss: qs.get('boss') === '1', world: 'dev-ev', firstRace: false,
  })
  const post = createPostFx(renderer, mode.scene, camera)
  post.setEnabled(q.bloom)
  const render = (): void => post.render()
  const dev = (mode as unknown as { dev: { kurgu: KurguState; kt: KurguTrack; teleport(s: number): void } }).dev
  mode.start()
  let last = performance.now()
  let frames = 0
  let fps = 0
  let fpsT = last
  const info = $('#info')
  const loop = (): void => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    mode.frame(dt)
    renderer.info.autoReset = false
    renderer.info.reset()
    render()
    frames++
    if (now - fpsT > 500) {
      fps = (frames * 1000) / (now - fpsT)
      frames = 0
      fpsT = now
    }
    const k = dev.kurgu
    info.textContent = `${quality} s=${k.r.s.toFixed(0)} calls=${renderer.info.render.calls} tris=${(renderer.info.render.triangles / 1000).toFixed(0)}k fps=${fps.toFixed(0)} zone=${dev.kt.zoneAt(k.r.s)}`
  }
  if (!qs.has('manual')) renderer.setAnimationLoop(loop)
  ;(window as unknown as { __k: unknown }).__k = {
    mode, dev, camera, renderer,
    tick(seconds: number): number {
      for (let i = 0; i < Math.round(seconds * 60); i++) mode.frame(1 / 60)
      render()
      return dev.kurgu.r.s
    },
    autopilot(on: boolean, pilot = 0): void {
      if (!on) {
        auto = null
        return
      }
      const rand = rng(5)
      const mem = newKurguBotMemory()
      auto = (dt) => kurguBotInput(dev.kurgu, dev.kt, kurguSkill(pilot), rand, mem, dt)
    },
    teleport: (s: number) => dev.teleport(s),
    /** Renders from a free camera (overview shots); the next tick puts the chase camera back. */
    view(x: number, y: number, z: number, lx: number, ly: number, lz: number): void {
      camera.position.set(x, y, z)
      camera.up.set(0, 1, 0)
      camera.lookAt(lx, ly, lz)
      render()
    },
    calls(): number {
      renderer.info.autoReset = false
      renderer.info.reset()
      render()
      return renderer.info.render.calls
    },
    async snap(name: string): Promise<string> {
      render()
      const blob = await new Promise<Blob | null>((res) => renderer.domElement.toBlob(res, 'image/jpeg', 0.86))
      if (blob === null) return 'no blob'
      const r = await fetch(`http://127.0.0.1:5199/?name=${encodeURIComponent(name)}.jpg`, { method: 'POST', body: blob })
      return r.text()
    },
  }
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    post.setSize(innerWidth, innerHeight)
  })
}

boot().catch((error: unknown) => {
  console.error('Kurgu dev page failed:', error)
  $('#info').textContent = `Hata: ${String(error)}`
})
