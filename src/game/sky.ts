/**
 * Sky for the floating-island world: a gradient dome with a warm sun (or moon and stars at
 * night), a sea of clouds far below the track, big cumulus around the horizon, the lights,
 * fog and a soft sky environment map. Colours are graded live per island zone (skyPalette).
 *
 * The sky owns the scene-level settings (background, fog, environment): call attach(scene)
 * once, or let update() find the scene the group was added to.
 */
import * as THREE from 'three'
import type { ThemeId } from '../sim/track'
import type { QualityProfile } from './quality'
import { makeRng, range } from './islandsGeo'
import { WORLD_TIME } from './islandsMaterial'
import { cloudAtlas, cloudLayer, type CloudSpec } from './skyClouds'
import { blendPalette, livePalette, paletteFor, type LivePalette } from './skyPalette'
import type { LivePaletteRef } from './skyLifeShaders'
import { DOME_FRAG, DOME_VERT, SEA_FRAG, SEA_VERT } from './skyShaders'

export interface SkyView {
  readonly group: THREE.Group
  readonly night: boolean
  /** Live light colours for custom shaders (sky life). */
  readonly light: LivePaletteRef
  /** Sets background, fog and environment on the scene (idempotent). */
  attach(scene: THREE.Scene): void
  update(camera: THREE.Camera, timeS: number): void
  /** Grades towards a zone's palette; k = share of the way per call (1 = snap). */
  grade(theme: ThemeId, k: number): void
  dispose(): void
}

export interface SkyOptions {
  readonly night?: boolean
  readonly theme?: ThemeId
  /**
   * Follow whatever camera renders the scene (dome, cloud sea, shadow frustum) from the
   * dome's onBeforeRender, so callers without a camera hook need not call update().
   */
  readonly autoFollow?: boolean
}

/** Height of the cloud sea (the track's lowest point is about −60 m). */
export const SEA_Y = -175
const SUN_DIR = new THREE.Vector3(-0.45, 0.72, -0.53).normalize()
const MOON_DIR = new THREE.Vector3(0.35, 0.5, -0.79).normalize()
const DOME_R = 3600

/** Six painted gradients as a cube map; three PMREM-filters it for the standard materials. */
function skyEnvironment(p: LivePalette): THREE.CubeTexture {
  const face = (top: THREE.Color, bottom: THREE.Color): HTMLCanvasElement => {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d')
    if (ctx !== null) {
      const g = ctx.createLinearGradient(0, 0, 0, 32)
      g.addColorStop(0, `#${top.getHexString(THREE.SRGBColorSpace)}`)
      g.addColorStop(1, `#${bottom.getHexString(THREE.SRGBColorSpace)}`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 32, 32)
    }
    return c
  }
  const side = face(p.mid, p.seaTop)
  const tex = new THREE.CubeTexture([side, side, face(p.zenith, p.zenith), face(p.seaTop, p.seaShade), side, side])
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function cloudSpecs(q: QualityProfile): { sky: CloudSpec[]; high: CloudSpec[]; sea: CloudSpec[] } {
  const r = makeRng(99)
  const sky: CloudSpec[] = []
  const high: CloudSpec[] = []
  const sea: CloudSpec[] = []
  // A ring of towering cumulus around the horizon frames every view like the concept art.
  const ring = Math.round(52 * (0.6 + 0.4 * q.decor))
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + r() * 0.1
    const d = range(r, 2300, 3100)
    const w = range(r, 900, 1700)
    sky.push({ x: Math.cos(a) * d, y: range(r, 30, 280), z: Math.sin(a) * d, w, h: w * range(r, 0.6, 0.85), tile: Math.floor(r() * 4) })
  }
  const highCount = Math.round(34 * q.decor)
  for (let i = 0; i < highCount; i++) {
    const w = range(r, 140, 340)
    high.push({ x: range(r, -1700, 1700), y: range(r, 210, 420), z: range(r, -1700, 1700), w, h: w * 0.6, tile: Math.floor(r() * 4) })
  }
  const mounds = Math.round(120 * (0.5 + 0.5 * q.decor))
  for (let i = 0; i < mounds; i++) {
    const w = range(r, 220, 440)
    sea.push({ x: range(r, -2600, 2600), y: SEA_Y + w * 0.04, z: range(r, -2600, 2600), w, h: w * 0.34, tile: Math.floor(r() * 4) })
  }
  return { sky, high, sea }
}

export function buildSky(scene: THREE.Scene | null, q: QualityProfile, o: SkyOptions = {}): SkyView {
  const night = o.night ?? false
  const theme = o.theme ?? 'candy'
  const live = livePalette(paletteFor(theme, night))
  const group = new THREE.Group()
  group.name = 'sky'
  const background = live.horizon.clone()
  const fog = new THREE.Fog(live.fog, live.fogNear, live.fogFar)
  const env = skyEnvironment(live)

  const hemi = new THREE.HemisphereLight(live.hemiSky, live.hemiGround, live.hemiI)
  hemi.color = live.hemiSky
  hemi.groundColor = live.hemiGround
  group.add(hemi)
  const sun = new THREE.DirectionalLight(live.sun, live.sunI)
  sun.color = live.sun
  const lightDir = night ? MOON_DIR : SUN_DIR
  sun.position.copy(lightDir).multiplyScalar(300)
  group.add(sun, sun.target)
  if (q.bloom) {
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera
    c.left = -55
    c.right = 55
    c.top = 55
    c.bottom = -55
    c.near = 10
    c.far = 700
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.04
  }

  const domeMat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: live.zenith }, uMid: { value: live.mid }, uHorizon: { value: live.horizon }, uBelow: { value: live.seaTop },
      uSunDir: { value: lightDir }, uSunColor: { value: live.sun }, uNight: { value: night ? 1 : 0 }, uTime: WORLD_TIME,
    },
    vertexShader: DOME_VERT,
    fragmentShader: DOME_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 16), domeMat)
  dome.name = 'skyDome'
  dome.renderOrder = -10
  dome.frustumCulled = false
  group.add(dome)

  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: live.seaTop }, uShade: { value: live.seaShade }, uHaze: { value: live.horizon }, uTime: WORLD_TIME },
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
  })
  const sea = new THREE.Mesh(new THREE.CircleGeometry(DOME_R, 48).rotateX(-Math.PI / 2), seaMat)
  sea.name = 'cloudSea'
  sea.position.y = SEA_Y
  sea.frustumCulled = false
  group.add(sea)

  const atlas = cloudAtlas()
  const specs = cloudSpecs(q)
  const tint = night ? new THREE.Color('#6f78c8') : new THREE.Color(1, 1, 1)
  const skyClouds = cloudLayer(specs.sky, atlas, live.horizon, WORLD_TIME, { hazeFar: 4200, wrap: 0, follow: true, tint })
  const highClouds = cloudLayer(specs.high, atlas, live.horizon, WORLD_TIME, { hazeFar: 3000, wrap: 3400, follow: false, tint })
  highClouds.mesh.name = 'highClouds'
  skyClouds.mesh.name = 'clouds'
  skyClouds.mesh.renderOrder = 1
  const seaClouds = cloudLayer(specs.sea, atlas, live.horizon, WORLD_TIME, { hazeFar: 3600, wrap: 5200, follow: false, tint })
  seaClouds.mesh.name = 'seaClouds'
  group.add(skyClouds.mesh, highClouds.mesh, seaClouds.mesh)

  let attached: THREE.Scene | null = null
  const attach = (s: THREE.Scene): void => {
    if (attached === s) return
    attached = s
    s.background = background
    s.fog = fog
    s.environment = env
    s.environmentIntensity = night ? 0.35 : 0.55
  }
  if (scene !== null) attach(scene)

  const camPos = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const lastSort = new THREE.Vector3(Infinity, 0, 0)
  const follow = (camera: THREE.Camera): void => {
    if (attached === null) {
      let root: THREE.Object3D = group
      while (root.parent !== null) root = root.parent
      if (root instanceof THREE.Scene) attach(root)
    }
    camera.getWorldPosition(camPos)
    dome.position.copy(camPos)
    sea.position.set(camPos.x, SEA_Y, camPos.z)
    if (camPos.distanceToSquared(lastSort) > 40 * 40) {
      skyClouds.sort(camPos)
      highClouds.sort(camPos)
      seaClouds.sort(camPos)
      lastSort.copy(camPos)
    }
    // Keep the shadow frustum on what the camera is looking at.
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    sun.target.position.copy(camPos).addScaledVector(fwd, 30)
    sun.target.position.y -= 3
    sun.position.copy(sun.target.position).addScaledVector(lightDir, 300)
  }
  if (o.autoFollow === true) {
    dome.onBeforeRender = (_r, _s, camera) => {
      // A rear-view mirror camera must not drag the sun's shadow box behind the car.
      if (camera.userData.noFollow === true) return
      follow(camera)
      dome.updateMatrixWorld()
      sea.updateMatrixWorld()
      sun.updateMatrixWorld()
      sun.target.updateMatrixWorld()
    }
  }
  return {
    group,
    night,
    light: { hemiSky: live.hemiSky, hemiGround: live.hemiGround, sun: live.sun, sunDir: lightDir, level: { value: night ? 0.6 : 1 } },
    attach,
    update(camera, timeS) {
      WORLD_TIME.value = timeS
      follow(camera)
    },
    grade(th, k) {
      blendPalette(live, paletteFor(th, night), k)
      background.copy(live.horizon)
      fog.near = live.fogNear
      fog.far = live.fogFar
      hemi.intensity = live.hemiI
      sun.intensity = live.sunI
    },
    dispose() {
      group.traverse((x) => {
        if (x instanceof THREE.Mesh) {
          x.geometry.dispose()
          ;(x.material as THREE.Material).dispose()
        }
      })
      atlas.dispose()
      env.dispose()
      sun.shadow.map?.dispose()
      if (attached !== null && attached.fog === fog) {
        attached.fog = null
        attached.environment = null
        attached.background = null
      }
    },
  }
}
