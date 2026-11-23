/**
 * Robot Süpürge on screen: a giant round robot vacuum (Tripo model public/models/vacuum.glb
 * when present, else a procedural one after the same sheet — lavender and white shell, a dark
 * face screen with angry cyan eyes, a red beacon, spinning side brushes) rolling down the
 * track behind the player, sucking a stream of dust into its mouth. Its eyes and beacon get
 * hotter as it closes in.
 */
import * as THREE from 'three'
import { tryLoadMesh } from '../../game/tripoProps'
import type { Track } from '../../sim/track'
import { Batch, BOX, CYL, RBOX, TORUS, trs } from '../world/batch'
import { dotTexture } from '../world/textures'

const SIZE = 15
const DUST = 90

export interface VacuumView {
  readonly group: THREE.Group
  update(t: number, dt: number, s: number, danger: number, track: Track): void
  dispose(): void
}

function procedural(): { body: THREE.Object3D; eyes: THREE.MeshBasicMaterial; beacon: THREE.MeshBasicMaterial; brushes: THREE.Object3D[]; owned: { dispose(): void }[] } {
  const b = new Batch()
  const R = SIZE / 2
  // Upright disc facing +z: shell, rim bumpers, face screen, wheel underneath.
  b.add(CYL(48), trs(0, R, 0, Math.PI / 2, 0, 0, SIZE, 7, SIZE), 0xeeeaff)
  b.add(TORUS(0.12), trs(0, R, 0, 0, 0, 0, SIZE * 0.98, SIZE * 0.98, SIZE * 0.9), 0x9b8cff)
  b.add(TORUS(0.08), trs(0, R, 3.4, 0, 0, 0, SIZE * 0.8, SIZE * 0.8, SIZE * 0.5), 0xa89bff)
  b.add(CYL(48), trs(0, R, 3.55, Math.PI / 2, 0, 0, SIZE * 0.66, 0.3, SIZE * 0.66), 0x1b1d33)
  b.add(RBOX(0.3), trs(0, 0.9, 0, 0, 0, 0, 3, 1.8, 3.6), 0x2a2b36)
  b.add(RBOX(0.4), trs(0, SIZE - 0.2, 0, 0, 0, 0, 3.2, 1.2, 2.4), 0x9b8cff)
  for (const sx of [-1, 1]) b.add(RBOX(0.4), trs(sx * (R - 0.6), R, 0, 0, 0, 0, 1.6, SIZE * 0.5, 5), 0x9b8cff)
  b.add(RBOX(0.4), trs(0, 1.6, 3.6, 0, 0, 0, 5, 1.2, 0.8), 0x9b8cff)
  const shellGeo = b.build()
  const shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, envMapIntensity: 1.2 })
  const body = new THREE.Group()
  const shell = new THREE.Mesh(shellGeo, shellMat)
  shell.castShadow = true
  body.add(shell)
  const eyes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 3.2) })
  const eyeGeo = new THREE.SphereGeometry(1, 20, 12)
  const browGeo = new THREE.BoxGeometry(2.6, 0.5, 0.3)
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(eyeGeo, eyes)
    e.scale.set(0.95, 1.35, 0.25)
    e.position.set(sx * 1.9, R + 0.2, 3.8)
    const brow = new THREE.Mesh(browGeo, eyes)
    brow.position.set(sx * 1.9, R + 2.1, 3.8)
    brow.rotation.z = sx * 0.35
    body.add(e, brow)
  }
  const beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.4) })
  const beaconGeo = new THREE.SphereGeometry(1.1, 16, 10)
  const bm = new THREE.Mesh(beaconGeo, beacon)
  bm.position.set(0, SIZE + 0.6, 0)
  bm.scale.set(1, 0.7, 1)
  body.add(bm)
  const bb = new Batch()
  for (let k = 0; k < 6; k++) bb.add(BOX(), trs(0, 0, 0, 0, (k / 6) * Math.PI, 0, 0.18, 0.18, 4.2), 0x8c86a8)
  bb.add(CYL(12), trs(0, 0, 0, 0, 0, 0, 0.8, 0.5, 0.8), 0x9b8cff)
  const brushGeo = bb.build()
  const brushes: THREE.Object3D[] = []
  for (const sx of [-1, 1]) {
    const br = new THREE.Mesh(brushGeo, shellMat)
    br.position.set(sx * (R - 1.2), 0.4, 3.4)
    body.add(br)
    brushes.push(br)
  }
  return { body, eyes, beacon, brushes, owned: [shellGeo, shellMat, eyes, eyeGeo, browGeo, beacon, beaconGeo, brushGeo] }
}

export async function buildVacuum(): Promise<VacuumView> {
  const group = new THREE.Group()
  const proc = procedural()
  const owned = [...proc.owned]
  const mesh = await tryLoadMesh('./models/vacuum.glb')
  if (mesh !== null) {
    // Tripo: ~1 m, front towards +z. Stand it on the floor at boss size.
    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    const k = SIZE / Math.max(size.x, size.y, size.z, 1e-3)
    mesh.scale.multiplyScalar(k)
    const b2 = new THREE.Box3().setFromObject(mesh)
    mesh.position.y -= b2.min.y
    mesh.position.x -= (b2.min.x + b2.max.x) / 2
    mesh.position.z -= (b2.min.z + b2.max.z) / 2
    mesh.castShadow = true
    const holder = new THREE.Group()
    holder.add(mesh)
    // Keep the glowing beacon and brushes from the procedural one; drop its shell.
    proc.body.children.filter((c) => c instanceof THREE.Mesh && c.material !== proc.beacon && !proc.brushes.includes(c)).forEach((c) => c.removeFromParent())
    proc.body.children.forEach((c) => {
      if (c instanceof THREE.Mesh && c.material === proc.beacon) c.position.y = b2.max.y - b2.min.y + 0.3
    })
    proc.body.add(holder)
  }
  group.add(proc.body)
  // Dust being sucked in.
  const dustGeo = new THREE.BufferGeometry()
  const arr = new Float32Array(DUST * 3)
  dustGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  const seeds = Array.from({ length: DUST }, () => [Math.random(), (Math.random() - 0.5) * 2, Math.random()])
  const dustTex = dotTexture()
  const dustMat = new THREE.PointsMaterial({ map: dustTex, size: 0.6, color: 0xd8ccbb, transparent: true, depthWrite: false, opacity: 0.85 })
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  proc.body.add(dust)
  owned.push(dustGeo, dustTex, dustMat)
  const f = new THREE.Vector3()
  return {
    group,
    update(t, dt, s, danger, track) {
      const fr = track.frameAt(Math.max(0, s))
      const p = track.toWorld(Math.max(0, s), 0, 0)
      group.position.set(p.x, p.y - 0.6 - (s < 0 ? -s * 0.02 : 0), p.z)
      f.set(fr.t.x, 0, fr.t.z).normalize()
      group.rotation.y = Math.atan2(f.x, f.z)
      proc.body.position.y = Math.abs(Math.sin(t * 7)) * 0.25
      proc.body.rotation.z = Math.sin(t * 3.1) * 0.03
      const heat = 0.6 + danger * 1.6 + Math.sin(t * 12) * 0.2 * danger
      proc.eyes.color.setRGB(0.3 * heat + danger * 1.5, 2.6 * heat * (1 - 0.5 * danger), 3 * heat * (1 - 0.6 * danger))
      const blink = Math.sin(t * (4 + danger * 8)) > 0 ? 3.4 : 0.6
      proc.beacon.color.setRGB(blink, 0.25, 0.25)
      for (const br of proc.brushes) br.rotation.y += dt * 14
      for (let i = 0; i < DUST; i++) {
        const sd = seeds[i]
        const u = (sd[0] + t * 0.9) % 1
        arr[i * 3] = sd[1] * 6 * (1 - u)
        arr[i * 3 + 1] = 0.6 + sd[2] * 3 * (1 - u)
        arr[i * 3 + 2] = 4 + 11 * (1 - u)
      }
      dustGeo.getAttribute('position').needsUpdate = true
    },
    dispose() {
      for (const o of owned) o.dispose()
      if (mesh !== null) {
        mesh.geometry.dispose()
        const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of ms) m.dispose()
      }
    },
  }
}

export const VACUUM_SIZE = SIZE
