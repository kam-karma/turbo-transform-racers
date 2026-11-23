/**
 * Canvas-drawn textures for the giant house: floors per zone, wallpapers, the star rug, the
 * toy-track deck, window views, light shafts, soft contact shadows. No image files needed.
 */
import * as THREE from 'three'
import type { ZoneId } from '../sim/kurguTrack'

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void

function canvasTex(w: number, h: number, draw: Draw, repeat = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  draw(c, w, h)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/** Deterministic noise speckle. */
function speckle(c: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, seed = 1): void {
  let a = seed
  const rnd = (): number => ((a = (a * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    c.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${alpha * rnd()})` : `rgba(255,255,255,${alpha * rnd()})`
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2)
  }
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  c.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  c.closePath()
}

/** Toy-track deck: glossy violet moulded plastic, one 16 m piece per texture tile (v). */
export const deckTexture = (): THREE.CanvasTexture => canvasTex(256, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, '#6a4fd8')
  g.addColorStop(0.12, '#8a6cf2')
  g.addColorStop(0.5, '#9a7ef8')
  g.addColorStop(0.88, '#8a6cf2')
  g.addColorStop(1, '#6a4fd8')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  speckle(c, w, h, 2000, 0.04, 3)
  // Two moulded lane grooves with a light catch on one edge.
  for (const x of [0.3, 0.7]) {
    c.fillStyle = 'rgba(40,20,110,0.35)'
    c.fillRect(x * w - 6, 0, 12, h)
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.fillRect(x * w + 5, 0, 2, h)
  }
  // Edge lines and centre dashes.
  c.fillStyle = 'rgba(255,255,255,0.8)'
  c.fillRect(10, 0, 6, h)
  c.fillRect(w - 16, 0, 6, h)
  c.fillStyle = '#ffd34d'
  for (let y = 48; y < h; y += 128) {
    c.beginPath(); c.roundRect(w / 2 - 6, y, 12, 52, 6); c.fill()
  }
  // The joint between two pieces, with puzzle tabs and rivets.
  c.fillStyle = 'rgba(30,10,80,0.55)'
  c.fillRect(0, 0, w, 6)
  c.fillStyle = '#9a7ef8'
  for (const x of [0.18, 0.82]) {
    c.beginPath(); c.arc(x * w, 7, 13, 0, Math.PI); c.fill()
    c.strokeStyle = 'rgba(30,10,80,0.5)'; c.lineWidth = 3; c.stroke()
  }
  c.fillStyle = 'rgba(255,255,255,0.55)'
  for (const x of [0.06, 0.94]) for (const y of [26, h - 20]) { c.beginPath(); c.arc(x * w, y, 4, 0, Math.PI * 2); c.fill() }
})

/** Climb deck: treads moulded across the track. */
export const climbTexture = (): THREE.CanvasTexture => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#ffd36b'
  c.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 32) {
    c.fillStyle = '#e0a93a'
    c.fillRect(0, y, w, 12)
    c.fillStyle = 'rgba(255,255,255,0.5)'
    c.fillRect(0, y + 12, w, 3)
  }
})

const FLOOR: Readonly<Record<ZoneId, Draw>> = {
  cocuk: (c, w, h) => {
    // Honey oak planks.
    const rows = 8
    for (let i = 0; i < rows; i++) {
      const tone = [0xd9a066, 0xcf955c, 0xe0aa72, 0xc98d55][i % 4]
      c.fillStyle = `#${tone.toString(16)}`
      c.fillRect(0, (i * h) / rows, w, h / rows)
      c.strokeStyle = 'rgba(110,60,25,0.25)'
      for (let k = 0; k < 14; k++) {
        c.beginPath()
        const y = (i * h) / rows + 4 + ((k * 7) % (h / rows - 8))
        c.moveTo(0, y)
        c.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 1)
        c.stroke()
      }
      c.fillStyle = 'rgba(80,40,15,0.55)'
      c.fillRect(0, (i * h) / rows, w, 3)
      c.fillRect(((i * 37) % 8) * (w / 8), (i * h) / rows, 3, h / rows)
    }
  },
  mutfak: (c, w, h) => {
    const n = 4
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        c.fillStyle = (i + j) % 2 === 0 ? '#f4efe6' : '#3e6f8f'
        c.fillRect((i * w) / n, (j * h) / n, w / n, h / n)
      }
    }
    c.strokeStyle = 'rgba(60,50,40,0.35)'
    c.lineWidth = 3
    for (let i = 0; i <= n; i++) {
      c.beginPath(); c.moveTo((i * w) / n, 0); c.lineTo((i * w) / n, h); c.stroke()
      c.beginPath(); c.moveTo(0, (i * h) / n); c.lineTo(w, (i * h) / n); c.stroke()
    }
    speckle(c, w, h, 3000, 0.05, 5)
  },
  banyo: (c, w, h) => {
    c.fillStyle = '#cfeee9'
    c.fillRect(0, 0, w, h)
    const n = 8
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        c.fillStyle = (i * 3 + j * 5) % 7 === 0 ? '#9fdcd6' : '#e2f6f3'
        c.fillRect((i * w) / n + 2, (j * h) / n + 2, w / n - 4, h / n - 4)
      }
    }
    speckle(c, w, h, 2000, 0.04, 7)
  },
  bahce: (c, w, h) => {
    c.fillStyle = '#6dbb45'
    c.fillRect(0, 0, w, h)
    let a = 9
    const rnd = (): number => ((a = (a * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 7000; i++) {
      const x = rnd() * w
      const y = rnd() * h
      c.strokeStyle = ['#4f9a33', '#86d05a', '#5fae3b', '#9be06c'][i % 4]
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + (rnd() - 0.5) * 4, y - 4 - rnd() * 6)
      c.stroke()
    }
  },
  garaj: (c, w, h) => {
    c.fillStyle = '#7f888f'
    c.fillRect(0, 0, w, h)
    speckle(c, w, h, 9000, 0.14, 11)
    c.fillStyle = 'rgba(30,30,40,0.22)'
    for (const [x, y, r] of [[0.3, 0.6, 50], [0.75, 0.25, 34]]) {
      c.beginPath(); c.ellipse(x * w, y * h, r, r * 0.7, 0.4, 0, Math.PI * 2); c.fill()
    }
    // Painted parking stripe and slab joints.
    c.fillStyle = 'rgba(255,205,60,0.85)'
    c.fillRect(w * 0.47, 0, w * 0.06, h)
    c.strokeStyle = 'rgba(40,40,50,0.45)'
    c.lineWidth = 3
    c.strokeRect(0, 0, w, h)
  },
}

export const floorTexture = (zone: ZoneId): THREE.CanvasTexture => canvasTex(512, 512, FLOOR[zone])

/** The blue star rug of the kid's room (concept art). */
export const rugTexture = (): THREE.CanvasTexture => canvasTex(1024, 1024, (c, w, h) => {
  c.fillStyle = '#2f5fb8'
  c.fillRect(0, 0, w, h)
  speckle(c, w, h, 40000, 0.1, 13)
  c.strokeStyle = '#ffd34d'
  c.lineWidth = 18
  c.strokeRect(30, 30, w - 60, h - 60)
  c.strokeStyle = '#7fb2ff'
  c.lineWidth = 6
  c.strokeRect(62, 62, w - 124, h - 124)
  let a = 17
  const rnd = (): number => ((a = (a * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 26; i++) {
    c.fillStyle = i % 5 === 0 ? '#fff3b0' : '#ffc93a'
    star(c, 110 + rnd() * (w - 220), 110 + rnd() * (h - 220), 26 + rnd() * 34, rnd() * 3)
    c.fill()
  }
}, false)

const WALL: Readonly<Record<ZoneId, Draw>> = {
  cocuk: (c, w, h) => {
    c.fillStyle = '#f5cf7a'
    c.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 64) {
      c.fillStyle = 'rgba(255,248,225,0.45)'
      c.fillRect(x, 0, 26, h)
    }
    for (let i = 0; i < 6; i++) {
      c.fillStyle = 'rgba(255,170,80,0.28)'
      star(c, 40 + ((i * 97) % (w - 80)), 50 + ((i * 151) % (h - 100)), 12, i)
      c.fill()
    }
  },
  mutfak: (c, w, h) => {
    c.fillStyle = '#fbf3e4'
    c.fillRect(0, 0, w, h)
    const n = 8
    c.strokeStyle = 'rgba(120,150,170,0.35)'
    c.lineWidth = 2
    for (let i = 0; i <= n; i++) {
      c.beginPath(); c.moveTo((i * w) / n, 0); c.lineTo((i * w) / n, h); c.stroke()
      c.beginPath(); c.moveTo(0, (i * h) / n); c.lineTo(w, (i * h) / n); c.stroke()
    }
  },
  banyo: (c, w, h) => {
    c.fillStyle = '#bfe6ef'
    c.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 32) {
      c.fillStyle = 'rgba(255,255,255,0.4)'
      c.fillRect(0, y, w, 2)
    }
    for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 2, h)
  },
  bahce: (c, w, h) => {
    // Fence boards.
    c.fillStyle = '#f3efe4'
    c.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 64) {
      c.fillStyle = 'rgba(160,140,110,0.4)'
      c.fillRect(x, 0, 4, h)
    }
  },
  garaj: (c, w, h) => {
    c.fillStyle = '#c4c9cf'
    c.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 64) {
      for (let x = (y / 64) % 2 === 0 ? 0 : -64; x < w; x += 128) {
        c.strokeStyle = 'rgba(90,95,105,0.35)'
        c.lineWidth = 3
        c.strokeRect(x + 2, y + 2, 124, 60)
      }
    }
    speckle(c, w, h, 4000, 0.08, 19)
  },
}

export const wallTexture = (zone: ZoneId): THREE.CanvasTexture => canvasTex(512, 512, WALL[zone])

/** What a window shows: sky, clouds, a sunny garden with a tree and roofs. */
export const windowTexture = (): THREE.CanvasTexture => canvasTex(512, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#5fb8ff')
  g.addColorStop(0.6, '#bfe6ff')
  g.addColorStop(1, '#e9f7ff')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  c.fillStyle = 'rgba(255,255,255,0.9)'
  for (const [x, y, r] of [[120, 120, 40], [170, 110, 52], [220, 125, 36], [380, 80, 30], [420, 72, 40]]) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
  }
  c.fillStyle = '#c96a4a'
  c.fillRect(40, 330, 120, 90)
  c.beginPath(); c.moveTo(30, 330); c.lineTo(100, 280); c.lineTo(170, 330); c.fill()
  c.fillStyle = '#7ec850'
  c.beginPath(); c.arc(360, 330, 90, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#5aa83a'
  c.beginPath(); c.arc(410, 360, 60, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#8fd35e'
  c.fillRect(0, 410, w, h - 410)
}, false)

/** Soft vertical light shaft (white, fading at the ends and edges). */
export const shaftTexture = (): THREE.CanvasTexture => canvasTex(128, 256, (c, w, h) => {
  const img = c.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1)
      const v = y / (h - 1)
      const edge = Math.sin(Math.PI * u) ** 2
      const len = Math.sin(Math.PI * Math.min(1, v * 1.15)) * (1 - v * 0.55)
      const a = Math.max(0, edge * len)
      const i = (y * w + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 236
      img.data[i + 2] = 190
      img.data[i + 3] = Math.round(255 * a)
    }
  }
  c.putImageData(img, 0, 0)
}, false)

/** Round soft contact shadow. */
export const blobTexture = (): THREE.CanvasTexture => canvasTex(128, 128, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(40,20,10,0.55)')
  g.addColorStop(0.55, 'rgba(40,20,10,0.3)')
  g.addColorStop(1, 'rgba(40,20,10,0)')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
}, false)

/** Small round glowing dot (dust motes, sparkles). */
export const dotTexture = (): THREE.CanvasTexture => canvasTex(64, 64, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,245,220,0.6)')
  g.addColorStop(1, 'rgba(255,240,200,0)')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
}, false)

/** Water: soft caustic ripples on a turquoise base (scrolled in the shader). */
export const waterTexture = (): THREE.CanvasTexture => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#3fc7e6'
  c.fillRect(0, 0, w, h)
  c.strokeStyle = 'rgba(255,255,255,0.5)'
  c.lineWidth = 3
  for (let i = 0; i < 26; i++) {
    const x = (i * 71) % w
    const y = (i * 113) % h
    c.beginPath()
    c.ellipse(x, y, 18 + (i % 4) * 6, 8, (i % 3) * 0.6, 0, Math.PI * 2)
    c.stroke()
  }
})

/** Chevron strip for ramp lips and gate signs. */
export const chevronTexture = (a: string, b: string): THREE.CanvasTexture => canvasTex(256, 64, (c, w, h) => {
  c.fillStyle = a
  c.fillRect(0, 0, w, h)
  c.fillStyle = b
  for (let x = -h; x < w + h; x += 64) {
    c.beginPath()
    c.moveTo(x, h); c.lineTo(x + 32, 0); c.lineTo(x + 56, 0); c.lineTo(x + 24, h)
    c.fill()
  }
})
