/**
 * Turbo Transform Racers: boots the renderer, audio, save, Poki ads and the app shell (home,
 * cup map, garage, races of all three cups). Races are built by src/modes/registry.ts.
 */
import * as THREE from 'three'
import { App } from './app/app'
import { RaceAudio } from './game/audio'
import type { SongId } from './game/audioMusic'
import { createPostFx } from './game/postFx'
import { autoQuality, FpsGuard, profileFor } from './game/quality'
import type { CarDef } from './meta/catalog'
import { SaveStore } from './meta/save'
import { cloneModel, loadGhosts, loadModel, warmRivals } from './modes/assets'
import { createRace, currentRace, setPauseListener } from './modes/registry'
import { RearMirror } from './game/rearMirror'
import { createAds } from './platform/ads'
import { createAdFlow } from './platform/adFlow'
import { DevInput } from './dev/devInput'
import { Input } from './ui/input'
import { loadSettings, type Settings } from './ui/settings'

/** Phones and tablets: a coarse pointer and no mouse. Touch laptops keep the keyboard layout. */
const isTouch = (): boolean => window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches

function makeRenderer(canvas: HTMLCanvasElement, settings: Settings): THREE.WebGLRenderer {
  const profile = profileFor(settings.quality, window.devicePixelRatio)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV })
  renderer.setPixelRatio(profile.pixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = settings.quality === 'high'
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  return renderer
}

async function boot(): Promise<void> {
  const touch = isTouch()
  let settings: Settings = loadSettings(autoQuality(touch))
  const canvas = document.getElementById('game') as HTMLCanvasElement
  const renderer = makeRenderer(canvas, settings)
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 6000)
  const post = createPostFx(renderer, new THREE.Scene(), camera)
  post.setEnabled(profileFor(settings.quality, window.devicePixelRatio).bloom)

  const audio = new RaceAudio()
  audio.setMuted(!settings.sound)
  // The public demo (VITE_DEMO=1, GitHub Pages) has no ad portal: rewarded videos are granted.
  const demo = import.meta.env.VITE_DEMO === '1'
  const ads = createAds(demo ? { sdk: null, dev: true } : {})
  const adFlow = createAdFlow(ads)
  const adsReady = ads.init()
  // Ads and a hidden tab both silence the game (and stop the music scheduler bursting).
  let adRunning = false
  const syncSuspend = (): void => audio.suspend(adRunning || document.hidden)
  adFlow.onAdChange((running) => {
    adRunning = running
    syncSuspend()
  })
  document.addEventListener('visibilitychange', syncSuspend)

  const input = import.meta.env.DEV ? new DevInput(() => settings) : new Input(() => settings)
  const save = new SaveStore()
  const guard = new FpsGuard()
  let racing = false
  /** The race is paused (menu, modal, hidden tab): the FPS guard must not measure. */
  let racePaused = false
  setPauseListener((on) => {
    racePaused = on
  })
  /** Set while the game lowers its own quality, so onSettings does not reload the page. */
  let autoDrop = false
  let app: App | null = null
  const mirror = new RearMirror(renderer, document.getElementById('ui') as HTMLElement)

  const startAudio = (): void => audio.start()
  input.onAny(startAudio)
  window.addEventListener('pointerdown', startAudio)

  app = new App({
    root: document.getElementById('ui') as HTMLElement,
    renderer,
    camera,
    render: (scene, cam) => {
      racing = true
      post.renderScene(scene, cam)
      const race = currentRace()
      mirror.draw(scene, race !== null && race.scene === scene ? race.rear : null)
      const verdict = guard.frame(performance.now(), !racePaused && !document.hidden && !adRunning, settings.quality)
      if (verdict === 'lower-quality') {
        // Through the app, so its settings screen (and the next save) know about the drop.
        autoDrop = true
        app?.applySettings({ ...settings, quality: 'low' })
        autoDrop = false
        post.dispose()
        renderer.shadowMap.enabled = false
        renderer.setPixelRatio(profileFor('low', window.devicePixelRatio).pixelRatio)
      } else if (verdict === 'lower-resolution') {
        renderer.setPixelRatio(profileFor('low', window.devicePixelRatio, 0.75).pixelRatio)
      }
    },
    save,
    ads: adFlow,
    input,
    touch,
    settings,
    createRace: (spec, kit) => createRace({
      renderer,
      audio,
      setNight: (n) => post.setNight(n),
      takeKurguParts: () => {
        const keep = save.get().kurguKeep ?? []
        if (keep.length > 0) save.update((s) => ({ ...s, kurguKeep: [] }))
        return keep
      },
      quality: () => profileFor(settings.quality, window.devicePixelRatio) }, spec, kit),
    loadCar: (car: CarDef) => cloneModel(car.model, true),
    preload: async (progress) => {
      let done = 0
      const steps: Promise<unknown>[] = [adsReady, loadModel('./models/hero.glb', true), warmRivals(), loadGhosts('adalar1')]
      await Promise.all(steps.map((p) => p.then(() => progress(++done / steps.length))))
      ads.loadingFinished()
    },
    onSettings: (s, prev) => {
      settings = s
      audio.setMuted(!s.sound)
      if (s.quality !== prev.quality && !autoDrop) window.location.reload()
    },
    sound: (cue) => audio.ui(cue),
    horn: (id, pitch) => audio.horn(id, pitch),
    music: (track) => {
      if (track !== 'race') {
        racing = false
        guard.frame(performance.now(), false, settings.quality)
        audio.idle()
        mirror.hide()
      }
      const song: SongId | null = track === null ? null : track === 'menu' ? 'menu' : (app?.hud.world ?? 'adalar')
      audio.playMusic(song)
    },
  })

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    post.setSize(window.innerWidth, window.innerHeight)
  })

  app.start()

  if (import.meta.env.DEV) {
    const { installDevHooks } = await import('./dev/appHooks')
    installDevHooks({ app, renderer, input: input as DevInput, fps: () => guard.fps, racing: () => racing })
  }
}

boot().catch((error: unknown) => {
  console.error('Boot failed:', error)
  const ui = document.getElementById('ui')
  if (ui !== null) ui.textContent = 'Oyun yüklenemedi. Sayfayı yenilemeyi dene.'
})
