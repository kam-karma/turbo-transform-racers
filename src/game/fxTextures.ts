/**
 * Procedural sprite textures for the effects: one 2×2 atlas shared by every particle (so all
 * particles of a blend mode go out in a single draw call) and a soft ring for shock waves.
 */
import * as THREE from 'three'

/** Atlas cells, in the order the particle shader indexes them. */
export const SHAPE_GLOW = 0
export const SHAPE_STAR = 1
export const SHAPE_PUFF = 2
export const SHAPE_CHIP = 3

const CELL = 128

function canvas2d(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g === null) throw new Error('2D canvas is not available for effect textures')
  return g
}

function drawGlow(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const r = CELL / 2
  const grad = g.createRadialGradient(ox + r, oy + r, 0, ox + r, oy + r, r)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.25)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(ox, oy, CELL, CELL)
}

/** Four-point cartoon twinkle with a small halo: reads as "sparkle" even when tiny. */
function drawStar(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const c = CELL / 2
  const halo = g.createRadialGradient(ox + c, oy + c, 0, ox + c, oy + c, c * 0.55)
  halo.addColorStop(0, 'rgba(255,255,255,0.9)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = halo
  g.fillRect(ox, oy, CELL, CELL)
  g.fillStyle = '#ffffff'
  g.beginPath()
  const arm = c * 0.96
  const waist = c * 0.13
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2
    const rr = i % 2 === 0 ? arm : waist
    const x = ox + c + Math.cos(a) * rr
    const y = oy + c + Math.sin(a) * rr
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.fill()
}

/**
 * Puffy cartoon cloud blob: overlapping circles, white on top and a cool shade underneath so
 * smoke and dust read as volume, not as flat discs. Tinted per particle in the shader.
 */
function drawPuff(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const blobs: readonly (readonly [number, number, number])[] = [
    [0.5, 0.56, 0.3], [0.32, 0.6, 0.2], [0.68, 0.6, 0.21], [0.42, 0.4, 0.22], [0.6, 0.42, 0.19], [0.5, 0.68, 0.22],
  ]
  g.save()
  g.beginPath()
  for (const [x, y, r] of blobs) {
    g.moveTo(ox + (x + r) * CELL, oy + y * CELL)
    g.arc(ox + x * CELL, oy + y * CELL, r * CELL, 0, Math.PI * 2)
  }
  g.clip()
  const shade = g.createLinearGradient(0, oy + CELL * 0.2, 0, oy + CELL * 0.9)
  shade.addColorStop(0, '#ffffff')
  shade.addColorStop(0.55, '#f3f6fb')
  shade.addColorStop(1, '#ccd6e6')
  g.fillStyle = shade
  g.fillRect(ox, oy, CELL, CELL)
  // Soft rim towards the edge so overlapping puffs blend instead of cutting hard lines.
  const rim = g.createRadialGradient(ox + CELL / 2, oy + CELL / 2, CELL * 0.22, ox + CELL / 2, oy + CELL / 2, CELL * 0.5)
  rim.addColorStop(0, 'rgba(0,0,0,0)')
  rim.addColorStop(1, 'rgba(0,0,0,1)')
  g.globalCompositeOperation = 'destination-out'
  g.globalAlpha = 0.55
  g.fillStyle = rim
  g.fillRect(ox, oy, CELL, CELL)
  g.restore()
}

/** Rounded chip: confetti, droplets and rock bits. */
function drawChip(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const pad = CELL * 0.2
  const w = CELL - pad * 2
  const h = w * 0.62
  const x = ox + pad
  const y = oy + (CELL - h) / 2
  const r = h * 0.3
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
  g.fill()
}

export function makeParticleAtlas(): THREE.CanvasTexture {
  const g = canvas2d(CELL * 2, CELL * 2)
  drawGlow(g, 0, 0)
  drawStar(g, CELL, 0)
  drawPuff(g, 0, CELL)
  drawChip(g, CELL, CELL)
  const tex = new THREE.CanvasTexture(g.canvas)
  // No mipmaps: at small sizes they would bleed neighbouring cells into each other.
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

/** Crisp cartoon band with a faint inner glow, for hoops and shock waves. */
export function makeRingTexture(): THREE.CanvasTexture {
  const size = 256
  const g = canvas2d(size, size)
  const c = size / 2
  const grad = g.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.06)')
  grad.addColorStop(0.8, 'rgba(255,255,255,0.3)')
  grad.addColorStop(0.83, 'rgba(255,255,255,1)')
  grad.addColorStop(0.93, 'rgba(255,255,255,1)')
  grad.addColorStop(0.97, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(g.canvas)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}
