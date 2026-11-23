/**
 * Procedural canvas textures for the track surfaces. u runs across the road (left edge 0,
 * right edge 1), v runs along it; each texture covers TEX_LEN metres of road.
 */
import * as THREE from 'three'
import { makeRng } from './islandsGeo'

/** Metres of road one texture repeat covers. */
export const TEX_LEN = 8

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** Speckles + soft blotches so large flat areas never look like plain plastic. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, light: string, dark: string, n: number): void {
  const r = makeRng(seed)
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.5 ? light : dark
    const s = 1 + r() * 2.5
    ctx.fillRect(r() * w, r() * h, s, s)
  }
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string, n: number, size: number): void {
  const r = makeRng(seed)
  for (let i = 0; i < n; i++) {
    const x = r() * w
    const y = r() * h
    const rad = size * (0.4 + r())
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    // Draw wrapped copies so the texture tiles along v without a seam.
    for (const dy of [-h, 0, h]) ctx.fillRect(x - rad, y - rad + dy, rad * 2, rad * 2)
  }
}

/** Warm asphalt, white edge lines, yellow dashed centre line (4 m on, 4 m off). */
export function roadTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 512
  const [c, ctx] = canvas(W, H)
  ctx.fillStyle = '#4a4655'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 7, 'rgba(130,118,140,0.18)', 40, 60)
  blotches(ctx, W, H, 8, 'rgba(24,18,36,0.2)', 30, 50)
  grain(ctx, W, H, 9, 'rgba(255,240,250,0.12)', 'rgba(0,0,0,0.18)', 11000)
  // A few bright flecks catch the sun like the sugar-glazed asphalt of the concept art.
  grain(ctx, W, H, 10, 'rgba(255,255,255,0.35)', 'rgba(255,214,120,0.25)', 500)
  // Soft darker tyre lanes give the surface direction at speed.
  for (const u of [0.3, 0.7]) {
    const g = ctx.createLinearGradient(W * (u - 0.08), 0, W * (u + 0.08), 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, 'rgba(30,20,35,0.16)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(W * (u - 0.08), 0, W * 0.16, H)
  }
  ctx.fillStyle = '#fbf7f2'
  ctx.fillRect(W * 0.03, 0, W * 0.034, H)
  ctx.fillRect(W * 0.936, 0, W * 0.034, H)
  // Thin coloured pin-stripes inside the edge lines.
  ctx.fillStyle = 'rgba(255,95,162,0.85)'
  ctx.fillRect(W * 0.078, 0, W * 0.008, H)
  ctx.fillRect(W * 0.914, 0, W * 0.008, H)
  ctx.fillStyle = '#ffd23f'
  const r = 14
  ctx.beginPath()
  ctx.roundRect(W * 0.5 - 9, H * 0.04, 18, H * 0.42, r)
  ctx.fill()
  return toTexture(c)
}

/** Pale glossy ice with frosty streaks and faint cracks. */
export function iceTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 512
  const [c, ctx] = canvas(W, H)
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, '#a8defb')
  g.addColorStop(0.5, '#6cc4f2')
  g.addColorStop(1, '#a8defb')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 21, 'rgba(235,250,255,0.4)', 30, 70)
  blotches(ctx, W, H, 22, 'rgba(90,170,230,0.20)', 20, 60)
  const r = makeRng(23)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineCap = 'round'
  for (let i = 0; i < 14; i++) {
    const x = r() * W
    const y = r() * H
    const l = 40 + r() * 120
    ctx.lineWidth = 2 + r() * 6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + l * 0.35, y + l)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(70,140,200,0.35)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 10; i++) {
    let x = r() * W
    let y = r() * H
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 50
      y += r() * 40
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillRect(W * 0.035, 0, W * 0.03, H)
  ctx.fillRect(W * 0.935, 0, W * 0.03, H)
  return toTexture(c)
}

/** Orange volcanic rock; the grip ribs themselves are geometry, this adds the rock grain. */
export function climbTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 512
  const [c, ctx] = canvas(W, H)
  ctx.fillStyle = '#e07a35'
  ctx.fillRect(0, 0, W, H)
  blotches(ctx, W, H, 31, 'rgba(255,170,90,0.35)', 40, 55)
  blotches(ctx, W, H, 32, 'rgba(120,40,20,0.28)', 35, 45)
  grain(ctx, W, H, 33, 'rgba(255,220,170,0.18)', 'rgba(60,20,10,0.22)', 7000)
  // Yellow-black chevrons down the middle say "climb here" even before the ribs are seen.
  ctx.fillStyle = 'rgba(255,214,64,0.9)'
  for (let k = 0; k < 4; k++) {
    const y = k * (H / 4) + 20
    ctx.beginPath()
    ctx.moveTo(W * 0.36, y + 60)
    ctx.lineTo(W * 0.5, y)
    ctx.lineTo(W * 0.64, y + 60)
    ctx.lineTo(W * 0.64, y + 88)
    ctx.lineTo(W * 0.5, y + 28)
    ctx.lineTo(W * 0.36, y + 88)
    ctx.closePath()
    ctx.fill()
  }
  return toTexture(c)
}

/**
 * Stripe mask for candy canes and kerbs: diagonal bands of fract(u + v). A strip whose u is
 * constant (kerbs) therefore gets straight bands, a tube (rails) gets a spiral.
 */
export function stripeMask(): THREE.CanvasTexture {
  const N = 128
  const [c, ctx] = canvas(N, N)
  const img = ctx.createImageData(N, N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const f = ((x + y) / N) % 1
      // Soft edges so the stripes stay crisp under mipmapping instead of shimmering.
      const edgeTexels = Math.min(f, Math.abs(f - 0.5), 1 - f) * N
      const v = 0.5 + (f < 0.5 ? 0.5 : -0.5) * Math.min(1, edgeTexels / 1.2)
      const k = Math.round(v * 255)
      const i = (y * N + x) * 4
      img.data[i] = k
      img.data[i + 1] = k
      img.data[i + 2] = k
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return toTexture(c, false)
}
