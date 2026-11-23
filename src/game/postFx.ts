/**
 * Optional post-processing for High quality: a subtle bloom so street lamps, headlights, the
 * moon and the sun glow, then three's OutputPass for ACES tone mapping and sRGB.
 *
 * Only the game loop renders through it; the garage keeps calling renderer.render on its own
 * scene and never touches the composer. When disabled (Low) render() is a plain render.
 */
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

export interface PostFx {
  /** True while frames go through the composer (tone mapping happens at the end). */
  readonly active: boolean
  setEnabled(on: boolean): void
  setSize(width: number, height: number): void
  /** 0 by day … 1 at night: lights bloom more after dark. */
  setNight(night: number): void
  render(): void
  /** Renders another scene/camera through the same chain (each race brings its own scene). */
  renderScene(scene: THREE.Scene, camera: THREE.Camera): void
  dispose(): void
}

/**
 * Only radiance above the threshold (linear HDR) blooms: the world's emissive glows (lips,
 * boost pads, coins, turbo) sit at 2-3, a sunlit wall stays below 1.6.
 */
const DAY_THRESHOLD = 1.6
const NIGHT_THRESHOLD = 1.2
const DAY_STRENGTH = 0.32
const NIGHT_STRENGTH = 0.45
/** Small radius: a tight glow round each lamp, not a haze over the frame. */
const RADIUS = 0.3

export function createPostFx(renderer: THREE.WebGLRenderer, scene0: THREE.Scene, camera0: THREE.Camera): PostFx {
  let scene = scene0
  let camera = camera0
  let pass: RenderPass | null = null
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  let enabled = false
  let night = 0

  const tune = (): void => {
    if (bloom === null) return
    bloom.strength = DAY_STRENGTH + (NIGHT_STRENGTH - DAY_STRENGTH) * night
    bloom.threshold = DAY_THRESHOLD + (NIGHT_THRESHOLD - DAY_THRESHOLD) * night
  }

  const build = (): EffectComposer => {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    // Multisampled so edges stay as smooth as the canvas' own antialiasing.
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 })
    const c = new EffectComposer(renderer, target)
    pass = new RenderPass(scene, camera)
    c.addPass(pass)
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), DAY_STRENGTH, RADIUS, DAY_THRESHOLD)
    tune()
    c.addPass(bloom)
    c.addPass(new OutputPass())
    return c
  }

  const fit = (): void => {
    if (composer === null) return
    const css = renderer.getSize(new THREE.Vector2())
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(css.x, css.y)
  }

  return {
    get active() {
      return enabled
    },
    setEnabled(on) {
      enabled = on
      if (on && composer === null) composer = build()
      fit()
    },
    setSize() {
      fit()
    },
    setNight(n) {
      night = n
      tune()
    },
    render() {
      if (enabled && composer !== null) composer.render()
      else renderer.render(scene, camera)
    },
    renderScene(sc, cam) {
      scene = sc
      camera = cam
      if (pass !== null) {
        pass.scene = sc
        pass.camera = cam
      }
      this.render()
    },
    dispose() {
      composer?.dispose()
      bloom?.dispose()
      composer = null
      bloom = null
      enabled = false
    },
  }
}
