/**
 * One painted 1024² canvas atlas for everything printed on the track: road decals (corner
 * arrows, chevrons, the chequered line, form icons, grid boxes) and sign faces and banners.
 * White artwork is tinted by vertex colour; full-colour cells (banners) use white vertices.
 *
 * Cells are 256² on a 4×4 grid; banners take two cells side by side.
 */
import * as THREE from 'three'
import type { FormId } from '../sim/forms'

export type Cell =
  | 'arrowLeft' | 'arrowRight' | 'chevron' | 'checker'
  | 'car' | 'boat' | 'glider' | 'climber'
  | 'grid' | 'star' | 'boardLeft' | 'boardRight'
  | 'bannerStart' | 'bannerFinish'

const SIZE = 1024
const C = 256

/** Cell origin in cells (x, y from the top-left) and width in cells. */
const LAYOUT: Readonly<Record<Cell, readonly [number, number, number]>> = {
  arrowLeft: [0, 0, 1],
  arrowRight: [1, 0, 1],
  chevron: [2, 0, 1],
  checker: [3, 0, 1],
  car: [0, 1, 1],
  boat: [1, 1, 1],
  glider: [2, 1, 1],
  climber: [3, 1, 1],
  grid: [0, 2, 1],
  star: [1, 2, 1],
  boardLeft: [2, 2, 1],
  boardRight: [3, 2, 1],
  bannerStart: [0, 3, 2],
  bannerFinish: [2, 3, 2],
}

export const FORM_CELL: Readonly<Record<FormId, Cell>> = { car: 'car', boat: 'boat', glider: 'glider', climber: 'climber' }

/** UV rectangle of a cell: [u0, v0, u1, v1] (v up, three.js convention, flipY on). */
export function cellUv(cell: Cell): [number, number, number, number] {
  const [x, y, w] = LAYOUT[cell]
  const pad = 2 / SIZE
  return [(x * C) / SIZE + pad, 1 - ((y + 1) * C) / SIZE + pad, ((x + w) * C) / SIZE - pad, 1 - (y * C) / SIZE - pad]
}

type Ctx = CanvasRenderingContext2D

function inCell(ctx: Ctx, cell: Cell, draw: (w: number, h: number) => void): void {
  const [x, y, w] = LAYOUT[cell]
  ctx.save()
  ctx.translate(x * C, y * C)
  ctx.beginPath()
  ctx.rect(0, 0, w * C, C)
  ctx.clip()
  draw(w * C, C)
  ctx.restore()
}

/** Thick curved arrow bending left (mirrored for right). */
function arrow(ctx: Ctx, w: number, h: number, mirror: boolean): void {
  if (mirror) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 38
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(w * 0.62, h * 0.95)
  ctx.quadraticCurveTo(w * 0.64, h * 0.42, w * 0.32, h * 0.36)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(w * 0.08, h * 0.36)
  ctx.lineTo(w * 0.36, h * 0.12)
  ctx.lineTo(w * 0.36, h * 0.6)
  ctx.closePath()
  ctx.fill()
}

function chevron(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(w * 0.5, h * 0.08)
  ctx.lineTo(w * 0.94, h * 0.6)
  ctx.lineTo(w * 0.94, h * 0.92)
  ctx.lineTo(w * 0.5, h * 0.42)
  ctx.lineTo(w * 0.06, h * 0.92)
  ctx.lineTo(w * 0.06, h * 0.6)
  ctx.closePath()
  ctx.fill()
}

function checker(ctx: Ctx, w: number, n = 8): void {
  const s = w / n
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#1d1b2e'
      ctx.fillRect(i * s, j * s, s, s)
    }
  }
}

/** Round badge with a thick ring; the icon is drawn by `icon` in a 0..1 box. */
function badge(ctx: Ctx, w: number, h: number, icon: () => void): void {
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2)
  ctx.arc(w / 2, h / 2, w * 0.39, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.save()
  ctx.translate(w * 0.2, h * 0.2)
  ctx.scale(w * 0.6, h * 0.6)
  ctx.fillStyle = '#ffffff'
  icon()
  ctx.restore()
}

function round(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

const ICONS: Readonly<Record<FormId, (ctx: Ctx) => void>> = {
  car: (ctx) => {
    round(ctx, 0.04, 0.42, 0.92, 0.26, 0.1)
    round(ctx, 0.22, 0.22, 0.5, 0.26, 0.12)
    ctx.globalCompositeOperation = 'destination-out'
    round(ctx, 0.3, 0.28, 0.16, 0.14, 0.04)
    round(ctx, 0.5, 0.28, 0.15, 0.14, 0.04)
    ctx.globalCompositeOperation = 'source-over'
    circle(ctx, 0.27, 0.74, 0.12)
    circle(ctx, 0.75, 0.74, 0.12)
  },
  boat: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(0.02, 0.46)
    ctx.lineTo(0.98, 0.46)
    ctx.lineTo(0.8, 0.7)
    ctx.lineTo(0.18, 0.7)
    ctx.closePath()
    ctx.fill()
    round(ctx, 0.3, 0.26, 0.36, 0.2, 0.06)
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.lineWidth = 0.06
      ctx.strokeStyle = '#ffffff'
      ctx.moveTo(0.02 + k * 0.33, 0.86)
      ctx.quadraticCurveTo(0.18 + k * 0.33, 0.76, 0.34 + k * 0.33, 0.86)
      ctx.stroke()
    }
  },
  glider: (ctx) => {
    ctx.beginPath()
    ctx.moveTo(0.5, 0.1)
    ctx.lineTo(0.98, 0.62)
    ctx.lineTo(0.6, 0.56)
    ctx.lineTo(0.5, 0.8)
    ctx.lineTo(0.4, 0.56)
    ctx.lineTo(0.02, 0.62)
    ctx.closePath()
    ctx.fill()
  },
  climber: (ctx) => {
    round(ctx, 0.06, 0.56, 0.88, 0.3, 0.15)
    ctx.globalCompositeOperation = 'destination-out'
    for (let k = 0; k < 4; k++) circle(ctx, 0.2 + k * 0.2, 0.71, 0.07)
    ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath()
    ctx.moveTo(0.5, 0.04)
    ctx.lineTo(0.78, 0.34)
    ctx.lineTo(0.6, 0.34)
    ctx.lineTo(0.6, 0.5)
    ctx.lineTo(0.4, 0.5)
    ctx.lineTo(0.4, 0.34)
    ctx.lineTo(0.22, 0.34)
    ctx.closePath()
    ctx.fill()
  },
}

function star(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const r = k % 2 === 0 ? w * 0.46 : w * 0.2
    ctx.lineTo(w / 2 + Math.cos(a) * r, h * 0.53 + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
}

/** Chevron board: candy-striped frame, big arrow (left) on a white field. */
function board(ctx: Ctx, w: number, h: number, mirror: boolean): void {
  if (mirror) {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  ctx.fillStyle = '#ffffff'
  round(ctx, 4, 40, w - 8, h - 80, 26)
  ctx.fillStyle = '#ff2f6d'
  round(ctx, 16, 52, w - 32, h - 104, 18)
  ctx.fillStyle = '#ffffff'
  for (let k = 0; k < 2; k++) {
    const x = 60 + k * 80
    ctx.beginPath()
    ctx.moveTo(x, h / 2)
    ctx.lineTo(x + 56, 70)
    ctx.lineTo(x + 92, 70)
    ctx.lineTo(x + 36, h / 2)
    ctx.lineTo(x + 92, h - 70)
    ctx.lineTo(x + 56, h - 70)
    ctx.closePath()
    ctx.fill()
  }
}

/** A glossy candy banner with chunky outlined lettering. */
function banner(ctx: Ctx, w: number, h: number, text: string, a: string, b: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  ctx.fillStyle = g
  round(ctx, 6, 30, w - 12, h - 60, 40)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  round(ctx, 30, 42, w - 60, (h - 60) * 0.28, 20)
  // Chequered end caps.
  for (const x0 of [22, w - 22 - 64]) {
    ctx.save()
    ctx.translate(x0, 62)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#1d1b2e'
      ctx.fillRect(i * 16, j * 16.5, 16, 16.5)
    }
    ctx.restore()
  }
  ctx.font = '900 112px "Arial Black", "Segoe UI Black", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 22
  ctx.strokeStyle = '#3a1a5a'
  ctx.strokeText(text, w / 2, h / 2 + 6, w - 200)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, w / 2, h / 2 + 6, w - 200)
}

let cached: THREE.CanvasTexture | null = null

export function trackAtlas(): THREE.CanvasTexture {
  if (cached !== null) return cached
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  ctx.clearRect(0, 0, SIZE, SIZE)
  inCell(ctx, 'arrowLeft', (w, h) => arrow(ctx, w, h, false))
  inCell(ctx, 'arrowRight', (w, h) => arrow(ctx, w, h, true))
  inCell(ctx, 'chevron', (w, h) => chevron(ctx, w, h))
  inCell(ctx, 'checker', (w) => checker(ctx, w))
  for (const f of ['car', 'boat', 'glider', 'climber'] as const) inCell(ctx, f, (w, h) => badge(ctx, w, h, () => ICONS[f](ctx)))
  inCell(ctx, 'grid', (w, h) => {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 18
    ctx.strokeRect(24, 24, w - 48, h - 48)
  })
  inCell(ctx, 'star', (w, h) => star(ctx, w, h))
  inCell(ctx, 'boardLeft', (w, h) => board(ctx, w, h, false))
  inCell(ctx, 'boardRight', (w, h) => board(ctx, w, h, true))
  inCell(ctx, 'bannerStart', (w, h) => banner(ctx, w, h, 'BAŞLA', '#ff5fa8', '#d61f6f'))
  inCell(ctx, 'bannerFinish', (w, h) => banner(ctx, w, h, 'BİTİŞ', '#ffcf3a', '#ff8a1a'))
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  cached = t
  return t
}

/**
 * Lit, vertex-tinted material for decals, signs and banners. Alpha-tested so it sorts like
 * an opaque mesh; polygon offset keeps road decals off the asphalt.
 */
export function atlasMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: trackAtlas(),
    vertexColors: true,
    roughness: 0.45,
    metalness: 0,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}
