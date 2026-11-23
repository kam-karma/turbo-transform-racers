/**
 * The rest of what lies on the road: gold toy coins (magnet-pulled ones fly to the car),
 * toy obstacles that tumble away when hit, the breakable walls of the drill gates (blocks,
 * cereal boxes, soap bars, logs or cardboard per room) and the gate signs that announce the
 * part a gate needs well ahead ("ileride…"), plus the start and finish arches.
 */
import * as THREE from 'three'
import type { GateKind, KurguTrack, ObstacleKind, ZoneId } from '../sim/kurguTrack'
import { PART_DEFS } from '../sim/parts'
import { Batch, type BatchSink, BOX, CONE, CYL, HEX, Placer, RBOX, SPHERE, TORUS, trs } from './batch'

function drawBlock(b: Batch, c: number): void {
  b.add(RBOX(0.15), trs(0, 1.1, 0, 0, 0, 0, 3, 2.2, 3), c)
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) b.add(CYL(10), trs(x, 2.35, z, 0, 0, 0, 0.8, 0.3, 0.8), c)
}

const OB_DRAW: Readonly<Record<ObstacleKind, (b: Batch) => void>> = {
  block: (b) => drawBlock(b, 0xff5a5a),
  ball: (b) => { b.add(SPHERE(20), trs(0, 1.5, 0, 0, 0, 0, 3, 3, 3), 0x3fa9ff); b.add(TORUS(0.1), trs(0, 1.5, 0, Math.PI / 2, 0, 0, 3.05, 3.05, 3.05), 0xffffff) },
  domino: (b) => { b.add(RBOX(0.12), trs(0, 2, 0, 0, 0, 0, 2.2, 4, 0.8), 0xfdfbf5); for (const y of [1.1, 1.9, 2.9]) b.add(SPHERE(8), trs(0, y, 0.38, 0, 0, 0, 0.4, 0.4, 0.15), 0x222222); b.add(BOX(), trs(0, 2, 0.4, 0, 0, 0, 1.8, 0.1, 0.05), 0x222222) },
  soap: (b) => { b.add(RBOX(0.45), trs(0, 0.8, 0, 0, 0, 0, 3, 1.6, 2), 0xff9ec0) },
  duck: (b) => { b.add(SPHERE(16), trs(0, 1, 0, 0, 0, 0, 2.6, 2, 3.2), 0xffd21f); b.add(SPHERE(16), trs(0, 2.3, 0.8, 0, 0, 0, 1.7, 1.7, 1.7), 0xffd21f); b.add(CONE(10), trs(0, 2.2, 1.9, Math.PI / 2, 0, 0, 0.7, 0.9, 0.5), 0xff8a1f) },
  can: (b) => { b.add(CYL(18), trs(0, 1.7, 0, 0, 0, 0, 2.6, 3.4, 2.6), 0xe8352c); b.add(CYL(18), trs(0, 3.45, 0, 0, 0, 0, 2.2, 0.1, 2.2), 0xc9ced6); b.add(CYL(18), trs(0, 1.7, 0, 0, 0, 0, 2.62, 0.8, 2.62), 0xffffff) },
  bolt: (b) => { b.add(HEX(), trs(0, 0.8, 0, 0, 0, 0, 2.6, 1.6, 2.6), 0xb7bfca); b.add(CYL(14), trs(0, 0.8, 0, 0, 0, 0, 1.1, 1.7, 1.1), 0x6d7480) },
  pebble: (b) => { b.add(SPHERE(12), trs(0, 0.8, 0, 0, 0.6, 0, 3.2, 1.8, 2.6), 0x9c978c) },
}

const WALL_COLORS: Readonly<Record<ZoneId, readonly number[]>> = {
  cocuk: [0xff5a5a, 0x3fa9ff, 0xffd23f, 0x4fd16a, 0xa77bff],
  mutfak: [0xffc93c, 0xff7a3c, 0xf2e3c8, 0xe8352c],
  banyo: [0xff9ec0, 0x9fe8de, 0xfff1a8, 0xc8b6ff],
  bahce: [0x8a5a32, 0xa06a3a, 0x7a4c28],
  garaj: [0xc8955a, 0xb98549, 0xd9a86a],
}

const SIGN_TEXT: Readonly<Record<GateKind, [string, string]>> = {
  gap: ['KANAT', 'ileride boşluk'], water: ['ŞAMANDIRA', 'ileride su'], climb: ['PALET', 'ileride dik duvar'], wall: ['MATKAP', 'ileride duvar'],
}
const SIGN_ICON: Readonly<Record<GateKind, string>> = { gap: 'part-wing', water: 'part-float', climb: 'form-climber', wall: 'part-drill' }

interface Fly { idx: number; t: number; vel: THREE.Vector3; spin: THREE.Vector3; base: THREE.Matrix4 }

export interface ItemsView {
  readonly group: THREE.Group
  collectCoin(i: number, to: THREE.Vector3 | null): void
  hitObstacle(i: number, forward: THREE.Vector3): void
  breakWall(gate: number, forward: THREE.Vector3): void
  /** Back to the start: every coin ahead of `startS` shown, walls whole, obstacles back. */
  reset(startS: number): void
  update(t: number, dt: number, carPos: THREE.Vector3): void
  dispose(): void
}

function signTexture(kind: GateKind): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 192
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  const color = PART_DEFS[kind === 'gap' ? 'wing' : kind === 'water' ? 'float' : kind === 'climb' ? 'treads' : 'drill'].color
  const draw = (icon: HTMLImageElement | null): void => {
    c.clearRect(0, 0, 512, 192)
    c.fillStyle = '#fffaf0'
    c.beginPath(); c.roundRect(6, 6, 500, 180, 34); c.fill()
    c.lineWidth = 12; c.strokeStyle = color; c.stroke()
    c.fillStyle = color
    c.beginPath(); c.arc(100, 96, 70, 0, Math.PI * 2); c.fill()
    if (icon !== null) c.drawImage(icon, 38, 34, 124, 124)
    else { c.fillStyle = '#fff'; c.font = 'bold 84px sans-serif'; c.textAlign = 'center'; c.fillText(SIGN_TEXT[kind][0][0], 100, 126) }
    c.textAlign = 'left'
    c.fillStyle = '#3a2a5a'
    c.font = '900 64px "Baloo 2", "Fredoka", sans-serif'
    c.fillText(SIGN_TEXT[kind][0], 186, 104)
    c.font = '700 34px "Baloo 2", "Fredoka", sans-serif'
    c.fillStyle = '#7a6a8a'
    c.fillText(SIGN_TEXT[kind][1], 188, 150)
  }
  draw(null)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const img = new Image()
  img.onload = () => { draw(img); tex.needsUpdate = true }
  img.src = `./ui/icons/${SIGN_ICON[kind]}.png`
  return tex
}

function checkerTexture(text: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 160
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  for (let x = 0; x < 1024; x += 40) for (let y = 0; y < 160; y += 40) {
    c.fillStyle = ((x + y) / 40) % 2 === 0 ? '#ffffff' : '#262636'
    c.fillRect(x, y, 40, 40)
  }
  c.fillStyle = '#ffcf3a'
  c.beginPath(); c.roundRect(332, 22, 360, 116, 30); c.fill()
  c.fillStyle = '#3a2a5a'
  c.font = '900 84px "Baloo 2", "Fredoka", sans-serif'
  c.textAlign = 'center'
  c.fillText(text, 512, 112)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildItems(kt: KurguTrack, batches: BatchSink): ItemsView {
  const group = new THREE.Group()
  const owned: { dispose(): void }[] = []
  // Coins.
  const coinGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.24, 18)
  coinGeo.rotateX(Math.PI / 2)
  const rim = new THREE.CylinderGeometry(0.9, 0.9, 0.34, 18, 1, true)
  rim.rotateX(Math.PI / 2)
  const cb = new Batch()
  cb.add(coinGeo, new THREE.Matrix4(), 0xffc93c)
  cb.add(rim, new THREE.Matrix4(), 0xffe27a)
  cb.add(coinGeo, trs(0, 0, 0, 0, 0, 0, 0.62, 0.62, 1.12), 0xffd86a)
  const coinMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.65, roughness: 0.22, emissive: 0x6a3c00, emissiveIntensity: 0.35, envMapIntensity: 1.4 })
  const coins = kt.def.coins
  const coinMesh = new THREE.InstancedMesh(cb.build(), coinMat, Math.max(1, coins.length))
  coinMesh.frustumCulled = false
  owned.push(coinGeo, rim, coinMat, coinMesh.geometry)
  const coinState = coins.map(() => ({ on: true, fly: -1, from: new THREE.Vector3() }))
  group.add(coinMesh)

  // Obstacles: one instanced mesh per kind.
  const obMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, envMapIntensity: 1 })
  owned.push(obMat)
  const obBase: THREE.Matrix4[] = []
  const obRef: { mesh: THREE.InstancedMesh; j: number }[] = []
  const kinds = [...new Set(kt.def.obstacles.map((o) => o.kind))]
  for (const k of kinds) {
    const b = new Batch()
    OB_DRAW[k](b)
    const list = kt.def.obstacles.map((o, i) => ({ o, i })).filter((x) => x.o.kind === k)
    const mesh = new THREE.InstancedMesh(b.build(), obMat, list.length)
    owned.push(mesh.geometry)
    list.forEach(({ o, i }, j) => {
      const f = kt.main.frameAt(o.s)
      const p = kt.main.toWorld(o.s, o.d, 0)
      const mtx = trs(p.x, p.y, p.z, 0, Math.atan2(f.t.x, f.t.z) + i * 0.7, 0, 1, 1, 1).clone()
      obBase[i] = mtx
      obRef[i] = { mesh, j }
      mesh.setMatrixAt(j, mtx)
    })
    mesh.castShadow = true
    group.add(mesh)
  }

  // Breakable walls of the drill gates.
  const wallGates = kt.def.gates.filter((g) => g.kind === 'wall')
  const blockGeo = new THREE.BufferGeometry()
  {
    const b = new Batch()
    drawBlock(b, 0xffffff)
    blockGeo.copy(b.build())
  }
  const per = 6 * 4
  const wallMesh = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ roughness: 0.32, envMapIntensity: 1 }), Math.max(1, wallGates.length * per))
  owned.push(blockGeo, wallMesh.material as THREE.Material)
  const wallBase: THREE.Matrix4[] = []
  wallGates.forEach((g, wi) => {
    const zone = kt.zoneAt(g.s0)
    const cols = WALL_COLORS[zone]
    const f = kt.main.frameAt(g.s0 + 3)
    const yaw = Math.atan2(f.t.x, f.t.z)
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 6; k++) {
        const d = -6.6 + k * 2.64 + (row % 2) * 0.6
        const p = kt.main.toWorld(g.s0 + 3, d, row * 2.3)
        const tall = zone === 'mutfak' ? 1.3 : 1
        const mtx = trs(p.x, p.y, p.z, 0, yaw, 0, 0.88, tall * 1.05, 0.9).clone()
        const i = wi * per + row * 6 + k
        wallBase[i] = mtx
        wallMesh.setMatrixAt(i, mtx)
        wallMesh.setColorAt(i, new THREE.Color(cols[(row + k) % cols.length]))
      }
    }
  })
  wallMesh.castShadow = true
  if (wallGates.length > 0) group.add(wallMesh)

  // Gate signs and gate frames.
  const boards = new Map<GateKind, { geo: THREE.BufferGeometry[]; tex: THREE.CanvasTexture }>()
  for (const g of kt.def.gates) {
    const sS = Math.max(20, g.s0 - 140)
    const f = kt.main.frameAt(sS)
    const yaw = Math.atan2(f.t.x, f.t.z)
    const base = kt.main.toWorld(sS, 0, 0)
    const p = new Placer(batches, base.x, base.y, base.z, yaw)
    const col = PART_DEFS[g.need].color
    for (const sx of [-1, 1]) {
      p.part('wood', HEX(), 0xffcf3a, sx * 10.2, 6, 0, 1.2, 12, 1.2)
      p.part('wood', CONE(6), 0xf3d1a0, sx * 10.2, 12.8, 0, 1.2, 1.6, 1.2)
    }
    p.part('plastic', RBOX(0.2), col, 0, 14.5, -0.5, 21, 0.8, 0.6)
    const entry = kt.main.frameAt(g.s0)
    const ep = kt.main.toWorld(g.s0, 0, 0)
    const pe = new Placer(batches, ep.x, ep.y, ep.z, Math.atan2(entry.t.x, entry.t.z))
    for (const sx of [-1, 1]) pe.part('plastic', RBOX(0.3), col, sx * 9.4, 4, 0, 1.4, 8, 1.4)
    pe.part('plastic', RBOX(0.3), col, 0, 8.4, 0, 20.2, 1.4, 1.4)
    let entryB = boards.get(g.kind)
    if (entryB === undefined) {
      entryB = { geo: [], tex: signTexture(g.kind) }
      boards.set(g.kind, entryB)
    }
    const pg = new THREE.PlaneGeometry(17, 6.4)
    pg.rotateY(Math.PI)
    pg.applyMatrix4(trs(base.x, base.y + 11, base.z, 0, yaw, 0, 1, 1, 1))
    entryB.geo.push(pg)
  }
  for (const b of boards.values()) {
    const merged = mergePlanes(b.geo)
    const mat = new THREE.MeshBasicMaterial({ map: b.tex, transparent: true, side: THREE.DoubleSide })
    owned.push(merged, mat, b.tex)
    group.add(new THREE.Mesh(merged, mat))
  }

  // Start and finish arches.
  for (const [s, text] of [[40, 'BAŞLA'], [kt.length - 12, 'BİTİŞ']] as const) {
    const f = kt.main.frameAt(s)
    const yaw = Math.atan2(f.t.x, f.t.z)
    const base = kt.main.toWorld(s, 0, 0)
    const p = new Placer(batches, base.x, base.y, base.z, yaw)
    for (const sx of [-1, 1]) {
      p.part('plastic', RBOX(0.3), 0x3fa9ff, sx * 10.5, 7, 0, 2.2, 14, 2.2)
      p.part('plastic', SPHERE(16), 0xffcf3a, sx * 10.5, 14.8, 0, 3, 3, 3)
    }
    const tex = checkerTexture(text)
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    const geo = new THREE.PlaneGeometry(19, 3)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(base.x, base.y + 12, base.z)
    mesh.rotation.y = yaw + Math.PI
    owned.push(tex, mat, geo)
    group.add(mesh)
  }

  const flies: Fly[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const pos = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const startFly = (idx: number, base: THREE.Matrix4, forward: THREE.Vector3): void => {
    const vel = forward.clone().multiplyScalar(18 + Math.random() * 10).add(new THREE.Vector3((Math.random() - 0.5) * 16, 14 + Math.random() * 8, (Math.random() - 0.5) * 16))
    flies.push({ idx, t: 0, vel, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), base: base.clone() })
  }

  return {
    group,
    collectCoin(i, to) {
      const st = coinState[i]
      if (st === undefined || !st.on) return
      st.on = false
      if (to !== null) {
        const c = coins[i]
        const w = kt.main.toWorld(c.s, c.d, 1.4)
        st.from.set(w.x, w.y, w.z)
        st.fly = 0
      }
    },
    hitObstacle(i, forward) {
      const r = obRef[i]
      if (r === undefined) return
      startFly(-1 - i, obBase[i], forward)
    },
    breakWall(gate, forward) {
      const wi = wallGates.findIndex((g) => g.index === gate)
      if (wi < 0) return
      for (let k = 0; k < per; k++) startFly(wi * per + k, wallBase[wi * per + k], forward)
    },
    reset(startS) {
      coinState.forEach((s, i) => { s.on = coins[i].s > startS + 1; s.fly = -1 })
      flies.length = 0
      obRef.forEach((r, i) => r.mesh.setMatrixAt(r.j, obBase[i]))
      for (const r of new Set(obRef.map((x) => x.mesh))) r.instanceMatrix.needsUpdate = true
      wallBase.forEach((b, i) => wallMesh.setMatrixAt(i, b))
      wallMesh.instanceMatrix.needsUpdate = true
    },
    update(t, dt, carPos) {
      coins.forEach((c, i) => {
        const st = coinState[i]
        const w = kt.main.toWorld(c.s, c.d, 1.5 + Math.sin(t * 3 + i) * 0.15)
        let s = st.on ? 1 : 0
        pos.set(w.x, w.y, w.z)
        if (!st.on && st.fly >= 0) {
          st.fly += dt / 0.22
          const k = Math.min(1, st.fly)
          pos.copy(st.from).lerp(tmp.copy(carPos).setY(carPos.y + 1), k * k)
          s = 1 - k * 0.6
          if (k >= 1) st.fly = -1
        }
        e.set(0, t * 3 + i * 0.4, 0)
        m.compose(pos, q.setFromEuler(e), sc.setScalar(Math.max(1e-4, s)))
        coinMesh.setMatrixAt(i, m)
      })
      coinMesh.instanceMatrix.needsUpdate = true
      for (let k = flies.length - 1; k >= 0; k--) {
        const f = flies[k]
        f.t += dt
        f.vel.y -= 40 * dt
        const target = f.idx >= 0 ? { mesh: wallMesh, j: f.idx } : obRef[-1 - f.idx]
        const base = new THREE.Vector3().setFromMatrixPosition(f.base)
        pos.copy(base).addScaledVector(f.vel, f.t)
        pos.y = Math.max(base.y - 20, pos.y)
        e.set(f.spin.x * f.t, f.spin.y * f.t, f.spin.z * f.t)
        const fade = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 0.5)
        m.compose(pos, q.setFromEuler(e), sc.setScalar(Math.max(1e-4, fade)))
        target.mesh.setMatrixAt(target.j, m)
        target.mesh.instanceMatrix.needsUpdate = true
        if (f.t > 1.4) flies.splice(k, 1)
      }
    },
    dispose() {
      for (const o of owned) o.dispose()
    },
  }
}

function mergePlanes(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (const g of gs) {
    const base = pos.length / 3
    const p = g.getAttribute('position')
    const t = g.getAttribute('uv')
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      uv.push(t.getX(i), t.getY(i))
    }
    const ix = g.getIndex()
    if (ix !== null) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  out.setIndex(idx)
  out.computeBoundingSphere()
  return out
}
