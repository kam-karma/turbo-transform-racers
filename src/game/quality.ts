// Graphics quality: the automatic first pick, what each level means, and an FPS watchdog.
import type { Quality } from '../ui/settings'

export interface QualityProfile {
  /** Renderer pixel ratio. */
  readonly pixelRatio: number
  /** Share of the island decoration that is built (0..1). */
  readonly decor: number
  /** Particle budget multiplier. */
  readonly particles: number
  /** Bloom post-processing (neon / turbo glow). */
  readonly bloom: boolean
}

/** What each level means. `dpr` is window.devicePixelRatio; `scale` < 1 trims resolution further. */
export function profileFor(q: Quality, dpr: number, scale = 1): QualityProfile {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  return q === 'high'
    ? { pixelRatio: Math.min(d, 1.5) * scale, decor: 1, particles: 1, bloom: true }
    : { pixelRatio: Math.min(d, 1) * scale, decor: 0.5, particles: 0.5, bloom: false }
}

const WEAK_GPU = /mali-[t4]|mali-g(31|51|52|57)|adreno \(tm\) ?[2-5]\d\d|adreno [2-5]\d\d|powervr|sgx|videocore|swiftshader|llvmpipe|software|intel\(r\) hd graphics [2-5]\d\d\b|intel hd graphics [2-5]\d\d\b/i

/** GPU name from WebGL, when the browser shares it. A throwaway context; it is released at once. */
function gpuName(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    if (gl === null) return ''
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info === null ? '' : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return ''
  }
}

/**
 * First-run pick when the player has no stored choice: phones, tablets and weak machines
 * start on Low; everything else on High (the FPS watchdog still steps in if that was wrong).
 */
export function autoQuality(touch: boolean): Quality {
  if (touch) return 'low'
  const nav = navigator as Navigator & { deviceMemory?: number }
  if ((nav.hardwareConcurrency ?? 8) <= 4) return 'low'
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return 'low'
  return WEAK_GPU.test(gpuName()) ? 'low' : 'high'
}

/** Frames per second below which a stretch of play counts as struggling. */
const SLOW_FPS = 30
/** On Low, below this the resolution is trimmed as a last resort. */
const VERY_SLOW_FPS = 22
const WINDOW_MS = 1000
/** Consecutive slow seconds before stepping down. */
const SLOW_WINDOWS = 4
/** Ignore the first seconds after play (re)starts: shader compiles and loading hitches. */
const GRACE_MS = 3000

export type FpsVerdict = 'ok' | 'lower-quality' | 'lower-resolution'

/**
 * Watches the frame rate while the game is actually being played. Says 'lower-quality' once
 * when High cannot hold 30 FPS for a few seconds, then 'lower-resolution' once if even Low
 * stays very slow.
 */
export class FpsGuard {
  private frames = 0
  private windowStart = -1
  private activeSince = -1
  private slow = 0
  private veryslow = 0
  private qualityDone = false
  private resolutionDone = false
  /** Last measured frames per second (0 until measured). */
  fps = 0

  /** Call every frame; `active` is false while paused, hidden or on a menu. */
  frame(now: number, active: boolean, quality: Quality): FpsVerdict {
    if (!active) {
      this.activeSince = -1
      this.windowStart = -1
      return 'ok'
    }
    if (this.activeSince < 0) this.activeSince = now
    if (now - this.activeSince < GRACE_MS) return 'ok'
    if (this.windowStart < 0) {
      this.windowStart = now
      this.frames = 0
      return 'ok'
    }
    this.frames++
    const span = now - this.windowStart
    if (span < WINDOW_MS) return 'ok'
    this.fps = (this.frames * 1000) / span
    this.windowStart = now
    this.frames = 0
    this.slow = this.fps < SLOW_FPS ? this.slow + 1 : 0
    this.veryslow = this.fps < VERY_SLOW_FPS ? this.veryslow + 1 : 0
    if (quality === 'high' && !this.qualityDone && this.slow >= SLOW_WINDOWS) {
      this.qualityDone = true
      this.slow = 0
      this.veryslow = 0
      this.activeSince = now
      return 'lower-quality'
    }
    if (quality === 'low' && !this.resolutionDone && this.veryslow >= SLOW_WINDOWS + 1) {
      this.resolutionDone = true
      return 'lower-resolution'
    }
    return 'ok'
  }
}
