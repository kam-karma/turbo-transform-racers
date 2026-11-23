/**
 * Ghost name tag: the racer's initial in a coloured disc + name on a rounded white pill, drawn once
 * to a canvas and shown as a camera-facing sprite above the car.
 */
import * as THREE from 'three'

const W = 512
const H = 128
/** World height of the pill: ~25 px at 30 m on a 1080p screen. */
const WORLD_H = 0.78

export function makeLabel(name: string, badge: string, color: number): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (g === null) throw new Error('2D canvas unavailable')
  const font = (px: number): string => `900 ${px}px "Baloo 2", "Nunito", "Arial Rounded MT Bold", system-ui, sans-serif`
  let px = 64
  g.font = font(px)
  const maxText = W - H - 40
  while (px > 30 && g.measureText(name).width > maxText) {
    px -= 4
    g.font = font(px)
  }
  const textW = Math.min(maxText, g.measureText(name).width)
  const pillW = Math.min(W - 8, H + textW + 44)
  const x0 = (W - pillW) / 2
  const r = (H - 16) / 2
  g.beginPath()
  g.roundRect(x0, 8, pillW, H - 16, r)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.fill()
  g.lineWidth = 6
  g.strokeStyle = 'rgba(30,40,80,0.35)'
  g.stroke()
  // Badge disc in the racer colour so the tag matches the car at a glance.
  const cx = x0 + r + 8
  g.beginPath()
  g.arc(cx, H / 2, r - 6, 0, Math.PI * 2)
  g.fillStyle = `#${new THREE.Color(color).getHexString()}`
  g.fill()
  // The racer's initial, never an emoji: emoji render differently (or not at all) per device.
  const initial = (/^[\p{L}\p{N}]/u.test(badge) ? badge : name).trim().charAt(0).toLocaleUpperCase('tr') || '?'
  g.font = font(Math.round(r * 1.15))
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 8
  g.strokeStyle = 'rgba(30,20,70,0.55)'
  g.strokeText(initial, cx, H / 2 + 5)
  g.fillStyle = '#ffffff'
  g.fillText(initial, cx, H / 2 + 5)
  g.font = font(px)
  g.textAlign = 'left'
  g.fillStyle = '#1e2850'
  g.fillText(name, cx + r + 6, H / 2 + 4, maxText)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  const s = new THREE.Sprite(mat)
  s.scale.set((WORLD_H * W) / H, WORLD_H, 1)
  s.renderOrder = 10
  return s
}
