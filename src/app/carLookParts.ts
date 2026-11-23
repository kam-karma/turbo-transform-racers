/**
 * Procedural attachments for car mods: neon underglow, side decals and a garage trail preview
 * (spoilers and rims are Blender models: carParts.ts). Everything is sized from the car's local bounding box (nose = +Z), so
 * it fits a 1 m Tripo export and a 3.3 m race car alike.
 */
import * as THREE from 'three'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'

export interface CarBox {
  readonly min: THREE.Vector3
  readonly max: THREE.Vector3
  readonly size: THREE.Vector3
  readonly center: THREE.Vector3
}

/** Bounding box of `root`'s meshes in root-local space (attachments excluded). */
export function localBox(root: THREE.Object3D): CarBox {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.kupaAttachment === true) return
    if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox()
    tmp.copy(mesh.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
    box.union(tmp)
  })
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.45, 0, -1), new THREE.Vector3(0.45, 0.6, 1))
  return { min: box.min.clone(), max: box.max.clone(), size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) }
}

const tag = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    c.userData.kupaAttachment = true
  })
  return o
}


/** Catalog part ids (src/meta/mods.ts) → procedural style. */
const PART_STYLE: Readonly<Record<string, string>> = {
  'spoiler-kanatcik': 'classic', 'spoiler-ordek': 'ducktail', 'spoiler-spor': 'wing', 'spoiler-cift': 'twin',
  'spoiler-roket': 'rocket', 'spoiler-yarasa': 'swan', 'spoiler-jet': 'gt', 'spoiler-dev': 'gt',
  'wheel-yildiz': 'star', 'wheel-papatya': 'flower', 'wheel-disli': 'mesh', 'wheel-spor': 'spoke', 'wheel-tombul': 'disc',
  'wheel-sekerleme': 'flower', 'wheel-krom': 'spoke', 'wheel-neon': 'turbo', 'wheel-dev': 'disc', 'wheel-altin': 'star',
  'decal-serit': 'stripes', 'decal-numara': 'number', 'decal-yildiz': 'stars', 'decal-alev': 'flame', 'decal-yildirim': 'bolt',
  'decal-dama': 'checker', 'decal-balina': 'wave', 'decal-vida': 'cloud', 'decal-devre': 'bolt', 'decal-ejderha': 'tiger',
}

export function pickStyle<T extends string>(part: string, styles: readonly T[]): T {
  const mapped = PART_STYLE[part]
  if (mapped !== undefined && (styles as readonly string[]).includes(mapped)) return mapped as T
  const direct = styles.find((s) => part.includes(s))
  if (direct !== undefined) return direct
  let h = 0
  for (let i = 0; i < part.length; i++) h = (h * 33 + part.charCodeAt(i)) >>> 0
  return styles[h % styles.length]
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const grad = x.createRadialGradient(64, 64, 6, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = grad
  x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

let glowTex: THREE.CanvasTexture | null = null

export interface Animated {
  readonly obj: THREE.Object3D
  update(t: number): void
}

export function buildNeon(color: number, anim: string, b: CarBox): Animated {
  glowTex ??= glowTexture()
  const m = new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(b.size.x * 1.9, b.size.z * 1.35), m)
  plane.rotation.x = -Math.PI / 2
  plane.position.set(b.center.x, b.min.y + 0.01 * b.size.y, b.center.z)
  plane.renderOrder = 2
  const tube = new THREE.Mesh(new THREE.BoxGeometry(b.size.x * 0.8, b.size.y * 0.02, b.size.z * 0.75), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
  tube.position.set(b.center.x, b.min.y + b.size.y * 0.08, b.center.z)
  const g = tag(new THREE.Group())
  g.add(plane, tube)
  tag(g)
  const base = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  return {
    obj: g,
    update(t) {
      if (anim === 'pulse') m.opacity = 0.55 + 0.45 * Math.sin(t * 4)
      else if (anim === 'rainbow') {
        m.color.setHSL((hsl.h + t * 0.25) % 1, 1, 0.55)
        ;(tube.material as THREE.MeshBasicMaterial).color.copy(m.color)
      } else if (anim === 'flash' || anim === 'blink') m.opacity = Math.sin(t * 9) > 0 ? 1 : 0.25
      else if (anim === 'chase') m.opacity = 0.6 + 0.4 * Math.sin(t * 12)
      else m.opacity = 0.95
    },
  }
}

const DECALS = ['flame', 'bolt', 'stars', 'stripes', 'number', 'heart', 'wave', 'checker', 'tiger', 'cloud'] as const

function decalTexture(style: (typeof DECALS)[number], color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const x = c.getContext('2d')!
  x.lineJoin = 'round'
  x.lineWidth = 8
  x.strokeStyle = '#2b1460'
  x.fillStyle = color
  const shape = (draw: () => void): void => {
    x.beginPath()
    draw()
    x.fill()
    x.stroke()
  }
  switch (style) {
    case 'flame':
      shape(() => {
        x.moveTo(250, 64)
        for (let i = 0; i < 5; i++) x.quadraticCurveTo(170 - i * 35, 10 + (i % 2) * 18, 140 - i * 30, 40 + (i % 2) * 6)
        x.quadraticCurveTo(10, 64, 120, 92)
        for (let i = 0; i < 4; i++) x.quadraticCurveTo(160 + i * 20, 118 - (i % 2) * 12, 190 + i * 15, 96)
        x.closePath()
      })
      break
    case 'bolt':
      shape(() => {
        x.moveTo(10, 40); x.lineTo(130, 30); x.lineTo(115, 60); x.lineTo(246, 50); x.lineTo(110, 105); x.lineTo(126, 74); x.lineTo(10, 86); x.closePath()
      })
      break
    case 'stripes':
    case 'checker':
      for (let i = 0; i < (style === 'checker' ? 8 : 3); i++) {
        x.fillStyle = i % 2 === 0 ? color : '#ffffff'
        if (style === 'checker') shape(() => x.rect(i * 32, 32 + (i % 2) * 32, 32, 32))
        else shape(() => x.rect(0, 28 + i * 26, 256, 16))
      }
      break
    case 'number':
      x.beginPath(); x.arc(128, 64, 54, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill(); x.stroke()
      x.font = '900 76px Kupa, Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color
      x.strokeText('7', 128, 68); x.fillText('7', 128, 68)
      break
    default: {
      const n = style === 'stars' ? 3 : style === 'heart' ? 2 : 3
      for (let i = 0; i < n; i++) {
        const cx = 50 + i * 78
        const cy = 64 + (i % 2 ? -10 : 10)
        const r = 34 - i * 4
        shape(() => {
          if (style === 'heart') {
            x.moveTo(cx, cy + r); x.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.3, cx, cy - r * 0.4); x.bezierCurveTo(cx + r * 0.6, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r)
          } else if (style === 'stars') {
            for (let k = 0; k < 10; k++) {
              const a = -Math.PI / 2 + (k * Math.PI) / 5
              const rr = k % 2 === 0 ? r : r * 0.45
              x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
            }
          } else {
            x.ellipse(cx, cy, r * 1.2, r * 0.6, 0.3 * i, 0, Math.PI * 2)
          }
          x.closePath()
        })
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Side decals projected onto the car's biggest mesh (both flanks). */
export function buildDecal(part: string, b: CarBox, root: THREE.Object3D, color: number): THREE.Object3D | null {
  let target: THREE.Mesh | null = null
  let most = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || m.userData.kupaAttachment === true) return
    const n = m.geometry.getAttribute('position')?.count ?? 0
    if (n > most) {
      most = n
      target = m
    }
  })
  if (target === null) return null
  const mesh = target as THREE.Mesh
  const style = pickStyle(part, DECALS)
  const tex = decalTexture(style, `#${color.toString(16).padStart(6, '0')}`)
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.4 })
  const g = new THREE.Group()
  root.updateMatrixWorld(true)
  const scale = new THREE.Vector3()
  root.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale)
  for (const sx of [-1, 1]) {
    const local = new THREE.Vector3(b.center.x + sx * b.size.x * 0.5, b.min.y + b.size.y * 0.42, b.center.z - b.size.z * 0.04)
    const world = local.clone().applyMatrix4(root.matrixWorld)
    const rootQ = new THREE.Quaternion()
    root.getWorldQuaternion(rootQ)
    const orient = new THREE.Euler().setFromQuaternion(rootQ.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (sx * Math.PI) / 2, 0))))
    const size = new THREE.Vector3(b.size.z * 0.62 * scale.z, b.size.y * 0.34 * scale.y, b.size.x * 0.9 * scale.x)
    const geo = new DecalGeometry(mesh, world, orient, size)
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
    geo.applyMatrix4(inv)
    g.add(new THREE.Mesh(geo, m))
  }
  return tag(g)
}

/** A short glowing ribbon behind the car so the garage can show the trail effect. */
export function buildTrailPreview(color: number, b: CarBox): Animated {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 32
  const x = c.getContext('2d')!
  const grad = x.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(1, 'rgba(255,255,255,1)')
  x.fillStyle = grad
  x.fillRect(0, 4, 256, 24)
  const tex = new THREE.CanvasTexture(c)
  const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  const g = new THREE.Group()
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(b.size.z * 1.4, b.size.y * 0.16), m)
    p.rotation.y = -Math.PI / 2
    p.position.set(b.center.x + sx * b.size.x * 0.32, b.min.y + b.size.y * 0.15, b.min.z - b.size.z * 0.7)
    g.add(p)
  }
  tag(g)
  return { obj: g, update: (t) => { m.opacity = 0.75 + 0.25 * Math.sin(t * 7) } }
}
