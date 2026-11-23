/**
 * Canvas textures for Neon Şehir: the hologram billboard atlas (pictograms and short Turkish
 * words, glowing outlines on dark glass) and the far skyline strip. Drawn once, cached.
 */
import * as THREE from 'three'

export const ATLAS_COLS = 4
export const ATLAS_ROWS = 2
export const ATLAS_CELLS = ATLAS_COLS * ATLAS_ROWS
const CELL = 512

type G = CanvasRenderingContext2D

const FONT = '900 {px}px "Baloo 2", "Nunito", "Arial Black", system-ui, sans-serif'
const font = (px: number): string => FONT.replace('{px}', String(px))

function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g === null) throw new Error('2D canvas unavailable')
  return [c, g]
}

/** Stroke with a soft glow under a bright core line. */
function glowStroke(g: G, color: string, width: number, draw: () => void): void {
  g.save()
  g.strokeStyle = color
  g.shadowColor = color
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const [w, blur] of [[width * 2.2, width * 3], [width, width * 1.5]] as const) {
    g.lineWidth = w
    g.shadowBlur = blur
    g.globalAlpha = w > width ? 0.35 : 1
    g.beginPath()
    draw()
    g.stroke()
  }
  g.lineWidth = Math.max(1, width * 0.35)
  g.strokeStyle = '#ffffff'
  g.shadowBlur = 0
  g.globalAlpha = 0.85
  g.beginPath()
  draw()
  g.stroke()
  g.restore()
}

function glowText(g: G, text: string, x: number, y: number, px: number, color: string): void {
  g.save()
  g.font = font(px)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = color
  g.shadowBlur = px * 0.35
  g.fillStyle = color
  g.fillText(text, x, y)
  g.shadowBlur = 0
  g.lineWidth = px * 0.05
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.strokeText(text, x, y)
  g.restore()
}

function panel(g: G, x: number, y: number, a: string, b: string): void {
  const grad = g.createLinearGradient(x, y, x, y + CELL)
  grad.addColorStop(0, '#0d0a2a')
  grad.addColorStop(1, '#1a0b3a')
  g.fillStyle = grad
  g.beginPath()
  g.roundRect(x + 10, y + 10, CELL - 20, CELL - 20, 46)
  g.fill()
  glowStroke(g, a, 9, () => g.roundRect(x + 22, y + 22, CELL - 44, CELL - 44, 38))
  // corner ticks in the second colour
  glowStroke(g, b, 7, () => {
    for (const [cx, cy, sx, sy] of [[x + 40, y + 40, 1, 1], [x + CELL - 40, y + 40, -1, 1], [x + 40, y + CELL - 40, 1, -1], [x + CELL - 40, y + CELL - 40, -1, -1]]) {
      g.moveTo(cx, cy + sy * 46)
      g.lineTo(cx, cy)
      g.lineTo(cx + sx * 46, cy)
    }
  })
}

function bolt(g: G, cx: number, cy: number, s: number): void {
  const p = [[0.1, -1], [-0.45, 0.12], [-0.02, 0.12], [-0.15, 1], [0.45, -0.18], [0.02, -0.18]]
  g.moveTo(cx + p[0][0] * s, cy + p[0][1] * s)
  for (const [x, y] of p.slice(1)) g.lineTo(cx + x * s, cy + y * s)
  g.closePath()
}

function car(g: G, cx: number, cy: number, s: number): void {
  g.moveTo(cx - s, cy + 0.25 * s)
  g.lineTo(cx - s, cy - 0.05 * s)
  g.quadraticCurveTo(cx - 0.75 * s, cy - 0.2 * s, cx - 0.45 * s, cy - 0.25 * s)
  g.quadraticCurveTo(cx - 0.2 * s, cy - 0.62 * s, cx + 0.25 * s, cy - 0.55 * s)
  g.quadraticCurveTo(cx + 0.55 * s, cy - 0.3 * s, cx + 0.9 * s, cy - 0.18 * s)
  g.quadraticCurveTo(cx + 1.05 * s, cy - 0.05 * s, cx + s, cy + 0.25 * s)
  g.closePath()
  for (const wx of [-0.55, 0.55]) {
    g.moveTo(cx + wx * s + 0.2 * s, cy + 0.3 * s)
    g.arc(cx + wx * s, cy + 0.3 * s, 0.2 * s, 0, Math.PI * 2)
  }
}

function dragonHead(g: G, cx: number, cy: number, s: number): void {
  // stylised side view: snout, jaw, horn sweep, eye
  g.moveTo(cx - 0.9 * s, cy - 0.1 * s)
  g.quadraticCurveTo(cx - 0.4 * s, cy - 0.7 * s, cx + 0.3 * s, cy - 0.45 * s)
  g.lineTo(cx + 0.95 * s, cy - 0.2 * s)
  g.lineTo(cx + 0.8 * s, cy + 0.05 * s)
  g.lineTo(cx + 0.2 * s, cy + 0.05 * s)
  g.lineTo(cx + 0.75 * s, cy + 0.35 * s)
  g.lineTo(cx - 0.1 * s, cy + 0.45 * s)
  g.quadraticCurveTo(cx - 0.6 * s, cy + 0.4 * s, cx - 0.9 * s, cy - 0.1 * s)
  g.moveTo(cx - 0.35 * s, cy - 0.5 * s)
  g.quadraticCurveTo(cx - 0.9 * s, cy - 1.05 * s, cx - 1.1 * s, cy - 0.6 * s)
  g.moveTo(cx + 0.05 * s + 0.09 * s, cy - 0.25 * s)
  g.arc(cx + 0.05 * s, cy - 0.25 * s, 0.09 * s, 0, Math.PI * 2)
}

function star(g: G, cx: number, cy: number, r: number, spikes = 5): void {
  for (let i = 0; i <= spikes * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / spikes
    const rr = i % 2 === 0 ? r : r * 0.45
    if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  g.closePath()
}

type Cell = (g: G, x: number, y: number) => void

const CELLS: readonly Cell[] = [
  (g, x, y) => {
    panel(g, x, y, '#ff3df2', '#22e6ff')
    glowStroke(g, '#ffe03a', 10, () => bolt(g, x + 256, y + 200, 120))
    glowText(g, 'KAOS', x + 256, y + 400, 120, '#ff3df2')
  },
  (g, x, y) => {
    panel(g, x, y, '#b6ff2e', '#22e6ff')
    glowStroke(g, '#b6ff2e', 9, () => dragonHead(g, x + 270, y + 230, 150))
    glowText(g, 'EJDERHA', x + 256, y + 420, 74, '#b6ff2e')
  },
  (g, x, y) => {
    panel(g, x, y, '#ffe03a', '#ff3df2')
    glowStroke(g, '#ffe03a', 10, () => g.arc(x + 256, y + 220, 130, 0, Math.PI * 2))
    glowStroke(g, '#22e6ff', 10, () => bolt(g, x + 256, y + 220, 95))
    glowText(g, 'ŞOK!', x + 256, y + 420, 110, '#ffe03a')
  },
  (g, x, y) => {
    panel(g, x, y, '#22e6ff', '#ff9a1f')
    glowStroke(g, '#22e6ff', 9, () => car(g, x + 276, y + 230, 150))
    glowStroke(g, '#ff9a1f', 7, () => {
      for (const [dy, l] of [[-40, 90], [0, 130], [40, 90]]) {
        g.moveTo(x + 70, y + 230 + dy)
        g.lineTo(x + 70 + l * 0.6, y + 230 + dy)
      }
    })
    glowText(g, 'TURBO', x + 256, y + 420, 100, '#22e6ff')
  },
  (g, x, y) => {
    panel(g, x, y, '#ff9a1f', '#b6ff2e')
    glowStroke(g, '#ff3df2', 6, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        g.moveTo(x + 256 + Math.cos(a) * 70, y + 220 + Math.sin(a) * 70)
        g.lineTo(x + 256 + Math.cos(a) * 160, y + 220 + Math.sin(a) * 160)
      }
    })
    glowStroke(g, '#ffe03a', 9, () => star(g, x + 256, y + 220, 70))
    glowText(g, 'YIK!', x + 256, y + 420, 120, '#ff9a1f')
  },
  (g, x, y) => {
    panel(g, x, y, '#7a5cff', '#ff3df2')
    // friendly robot face
    glowStroke(g, '#22e6ff', 9, () => g.roundRect(x + 136, y + 110, 240, 200, 50))
    glowStroke(g, '#ff3df2', 10, () => {
      g.moveTo(x + 216 + 22, y + 190)
      g.arc(x + 216, y + 190, 22, 0, Math.PI * 2)
      g.moveTo(x + 296 + 22, y + 190)
      g.arc(x + 296, y + 190, 22, 0, Math.PI * 2)
      g.moveTo(x + 200, y + 250)
      g.quadraticCurveTo(x + 256, y + 290, x + 312, y + 250)
      g.moveTo(x + 256, y + 110)
      g.lineTo(x + 256, y + 70)
    })
    glowText(g, 'ROBO', x + 256, y + 420, 110, '#7a5cff')
  },
  (g, x, y) => {
    panel(g, x, y, '#22e6ff', '#b6ff2e')
    glowStroke(g, '#b6ff2e', 14, () => {
      for (let i = 0; i < 3; i++) {
        const cx = x + 150 + i * 105
        g.moveTo(cx - 40, y + 130)
        g.lineTo(cx + 30, y + 220)
        g.lineTo(cx - 40, y + 310)
      }
    })
    glowText(g, 'HIZLAN', x + 256, y + 420, 90, '#22e6ff')
  },
  (g, x, y) => {
    panel(g, x, y, '#ff3df2', '#7a5cff')
    glowStroke(g, '#ff9a1f', 9, () => g.arc(x + 256, y + 220, 90, 0, Math.PI * 2))
    glowStroke(g, '#ff3df2', 8, () => g.ellipse(x + 256, y + 220, 175, 48, -0.25, 0, Math.PI * 2))
    glowStroke(g, '#ffe03a', 6, () => {
      star(g, x + 110, y + 100, 22, 4)
      star(g, x + 410, y + 330, 18, 4)
    })
    glowText(g, 'GECE', x + 256, y + 420, 110, '#ff3df2')
  },
]

let atlas: THREE.CanvasTexture | null = null

export function billboardAtlas(): THREE.CanvasTexture {
  if (atlas !== null) return atlas
  const [c, g] = canvas(CELL * ATLAS_COLS, CELL * ATLAS_ROWS)
  CELLS.forEach((draw, i) => draw(g, (i % ATLAS_COLS) * CELL, Math.floor(i / ATLAS_COLS) * CELL))
  atlas = new THREE.CanvasTexture(c)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.anisotropy = 4
  atlas.generateMipmaps = true
  return atlas
}

let skyline: THREE.CanvasTexture | null = null

/** Far city silhouette band: dark towers with lit windows and antenna lights, alpha above. */
export function skylineTexture(): THREE.CanvasTexture {
  if (skyline !== null) return skyline
  const W = 2048
  const H = 512
  const [c, g] = canvas(W, H)
  let seed = 7
  const r = (): number => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const colors = ['#22e6ff', '#ff3df2', '#b6ff2e', '#ffe03a', '#7a5cff', '#ff9a1f']
  for (let layer = 0; layer < 2; layer++) {
    let x = 0
    while (x < W) {
      const w = 30 + r() * 90
      const h = (layer === 0 ? 140 : 80) + r() * (layer === 0 ? 300 : 220)
      g.fillStyle = layer === 0 ? '#0a0a22' : '#120d33'
      g.fillRect(x, H - h, w, h)
      const col = colors[Math.floor(r() * colors.length)]
      g.fillStyle = col
      g.globalAlpha = 0.85
      if (r() < 0.6) g.fillRect(x, H - h, w, 3)
      if (r() < 0.3) g.fillRect(x + w / 2 - 1, H - h - 30 - r() * 40, 2, 40)
      for (let wy = H - h + 12; wy < H - 6; wy += 9) {
        for (let wx = x + 5; wx < x + w - 5; wx += 7) {
          if (r() < 0.22) {
            g.globalAlpha = 0.3 + r() * 0.6
            g.fillStyle = r() < 0.7 ? '#ffd9a0' : col
            g.fillRect(wx, wy, 3, 4)
          }
        }
      }
      g.globalAlpha = 1
      x += w + (layer === 0 ? 4 + r() * 30 : r() * 10)
    }
  }
  skyline = new THREE.CanvasTexture(c)
  skyline.colorSpace = THREE.SRGBColorSpace
  skyline.wrapS = THREE.RepeatWrapping
  return skyline
}
