/**
 * Throwaway dev page: runs the Kaos mode standalone with a minimal fake RaceHud.
 * Query: ?track=neon1..6 &boss=1 &q=low &auto=1 (bot drives) &nopost=1.
 * The pane may be hidden (no rAF): drive it with window.__kaos.tick(seconds) and save frames
 * with window.__kaos.snap(name) through the local relay.
 */
import * as THREE from 'three'
import { RaceAudio } from '../game/audio'
import { loadCarModel } from '../game/car'
import { createPostFx } from '../game/postFx'
import { profileFor } from '../game/quality'
import type { RaceMode } from '../modes/types'
import { botInput, newBotMemory, rng } from '../sim/bot'
import { PILOTS } from '../sim/pilots'
import { DEFAULT_PARAMS, type RaceInput } from '../sim/racer'
import { Input } from '../ui/input'
import type { HudMeter, RaceHud } from '../ui/raceHud'
import { DEFAULT_SETTINGS } from '../ui/settings'
import { createKaosMode } from './mode'
import type { KaosRace } from './sim/kaosRace'

const qs = new URLSearchParams(location.search)
const quality = qs.get('q') === 'low' ? 'low' : 'high'
const q = profileFor(quality, window.devicePixelRatio)
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement

function fakeHud(): RaceHud {
  const pops = $('pops')
  let panel: HTMLElement | null = null
  return {
    show() {}, hide() {},
    countdown(n) {
      $('count').textContent = n > 0 ? String(n) : 'BAŞLA!'
      if (n === 0) setTimeout(() => ($('count').textContent = ''), 700)
    },
    update(v) {
      $('top').textContent = `${v.place}/${v.of}  TUR ${v.lap?.n ?? 1}/${v.lap?.of ?? 1}  ${v.time.toFixed(1)} sn  ${Math.round(v.kmh)} km/s  altın ${v.coins}`
    },
    pop(text) {
      const d = document.createElement('div')
      d.textContent = text
      pops.appendChild(d)
      setTimeout(() => d.remove(), 1100)
    },
    flash(color) {
      const f = $('flash')
      f.style.background = color
      f.style.transition = 'none'
      f.style.opacity = '0.35'
      requestAnimationFrame(() => {
        f.style.transition = 'opacity 0.35s'
        f.style.opacity = '0'
      })
    },
    setModePanel(el) {
      panel?.remove()
      panel = el
      if (el !== null) $('hud').appendChild(el)
    },
    formButtons() {
      const el = document.createElement('div')
      return { el, setActive() {}, hint() {} }
    },
    meter(label, color): HudMeter {
      const el = document.createElement('div')
      el.className = 'meter'
      el.style.setProperty('--c', color)
      el.textContent = label
      const bar = document.createElement('i')
      el.appendChild(bar)
      return { el, set: (v) => (bar.style.width = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`) }
    },
  }
}

const HERO_LENGTH = 3.3
function heroModel(model: THREE.Object3D | null): THREE.Object3D | null {
  if (model === null) return null
  const box = new THREE.Box3().setFromObject(model)
  const len = box.max.z - box.min.z
  if (!(len > 0)) return null
  model.scale.setScalar(HERO_LENGTH / len)
  const wrap = new THREE.Group()
  wrap.add(model)
  return wrap
}

async function boot(): Promise<void> {
  const canvas = $('c') as HTMLCanvasElement
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(q.pixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 6000)
  const load = (url: string, textured = false): Promise<THREE.Object3D | null> => loadCarModel(url, textured).catch(() => null)
  const [hero, ...lods] = await Promise.all([load('/models/hero.glb', true), load('/models/r40_lod.glb'), load('/models/r245_lod.glb'), load('/models/rt40_lod.glb')])
  const lodBy: Record<string, THREE.Object3D | null> = { r40: lods[0], r245: lods[1], rt40: lods[2] }
  const settings = { ...DEFAULT_SETTINGS, autoGas: true }
  const input = new Input(() => settings)
  let auto: ((dt: number) => RaceInput) | null = null
  const audio = new RaceAudio()
  window.addEventListener('pointerdown', () => audio.start(), { once: true })
  window.addEventListener('keydown', () => audio.start(), { once: true })
  const t0 = performance.now()
  const mode: RaceMode = await createKaosMode({
    renderer, camera, quality: q, hud: fakeHud(), audio, settings: () => settings,
    input: { read: (dt) => (auto !== null ? auto(dt) : input.read(dt)) },
    playerCar: { model: heroModel(hero), carId: 'kivilcim', params: DEFAULT_PARAMS },
    modelFor: (car) => lodBy[car]?.clone(true) ?? null,
  }, {
    raceId: 'dev', cupId: qs.get('cup') ?? 'neon-bronz', trackId: qs.get('track') ?? 'neon1', variant: 'normal',
    boss: qs.has('boss'), world: 'neon', firstRace: false,
  })
  const buildMs = performance.now() - t0
  const race = (mode as unknown as { race: KaosRace }).race
  const dev = (mode as unknown as { dev(): { teleport(s: number): void; fill(): void } }).dev()
  const post = createPostFx(renderer, mode.scene, camera)
  post.setEnabled(q.bloom && !qs.has('nopost'))
  if (qs.has('night')) post.setNight(1)
  const setAuto = (on: boolean): void => {
    if (!on) {
      auto = null
      return
    }
    const rand = rng(5)
    const mem = newBotMemory()
    auto = (dt) => botInput(race.player.st, race.track, PILOTS[1].skill, rand, mem, dt)
  }
  setAuto(qs.has('auto'))
  mode.start()
  const info = $('info')
  let last = performance.now()
  let frames = 0
  let fps = 0
  let fpsT = last
  const render = (): void => post.render()
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000)
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
    const r = renderer.info.render
    info.textContent = `${quality} calls=${r.calls} tris=${(r.triangles / 1000).toFixed(0)}k fps=${fps.toFixed(0)} build=${buildMs.toFixed(0)}ms s=${race.player.st.s.toFixed(0)} destr=${race.destruction}`
  })
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    post.setSize(window.innerWidth, window.innerHeight)
  })
  ;(window as unknown as { __kaos: unknown }).__kaos = {
    mode, race, renderer, camera, scene: mode.scene, setAuto, ...dev,
    tick(seconds: number): number {
      const n = Math.round(seconds * 60)
      for (let i = 0; i < n; i++) mode.frame(1 / 60)
      render()
      return race.player.st.s
    },
    calls(): number {
      renderer.info.autoReset = false
      renderer.info.reset()
      render()
      return renderer.info.render.calls
    },
    async snap(name: string): Promise<string> {
      render()
      const blob = await new Promise<Blob | null>((res) => renderer.domElement.toBlob(res, 'image/jpeg', 0.88))
      if (blob === null) return 'no blob'
      const r = await fetch(`http://127.0.0.1:5199/?name=${encodeURIComponent(name + '.jpg')}`, { method: 'POST', body: blob })
      return r.text()
    },
  }
}

boot().catch((error: unknown) => {
  console.error('Kaos dev boot failed:', error)
  $('info').textContent = `boot failed: ${String(error)}`
})
