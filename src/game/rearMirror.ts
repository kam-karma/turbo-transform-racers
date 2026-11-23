/**
 * A rear-view mirror drawn over the race frame (boss chases): the scene rendered again from a
 * mode's rear camera into a rounded window at the top centre, with a chrome frame in the DOM.
 */
import * as THREE from 'three'
import type { RearView } from '../modes/types'

const W = 0.3
const ASPECT = 2.6
const TOP = 0.115
const BORDER = 5
const saved = new THREE.Vector4()

export class RearMirror {
  private readonly frame: HTMLDivElement
  private shown = false

  constructor(private readonly renderer: THREE.WebGLRenderer, ui: HTMLElement) {
    this.frame = document.createElement('div')
    this.frame.className = 'rear-mirror'
    Object.assign(this.frame.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', display: 'none',
      border: '5px solid #fff', borderRadius: '9px', boxShadow: '0 0 0 3px #3b1f7a, 0 8px 18px rgba(20,10,60,.45), inset 0 0 18px rgba(79,195,255,.55)',
      zIndex: '3', boxSizing: 'content-box', overflow: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>)
    ui.append(this.frame)
  }

  hide(): void {
    if (!this.shown) return
    this.shown = false
    this.frame.style.display = 'none'
  }

  draw(scene: THREE.Scene, rear: RearView | null): void {
    if (rear === null || rear.amount < 0.02) {
      this.hide()
      return
    }
    const r = this.renderer
    const cw = r.domElement.clientWidth
    const ch = r.domElement.clientHeight
    const w = Math.round(Math.max(180, cw * W) * (0.6 + 0.4 * rear.amount))
    const h = Math.round(w / ASPECT)
    const x = Math.round((cw - w) / 2)
    const top = Math.round(ch * TOP)
    rear.camera.aspect = w / h
    rear.camera.updateProjectionMatrix()
    const y = ch - top - h
    r.getViewport(saved)
    const autoShadows = r.shadowMap.autoUpdate
    // The main view's shadow map stays as it is: the mirror only reuses it.
    r.shadowMap.autoUpdate = false
    r.setScissorTest(true)
    r.setScissor(x, y, w, h)
    r.setViewport(x, y, w, h)
    r.render(scene, rear.camera)
    r.setScissorTest(false)
    r.setViewport(saved)
    r.shadowMap.autoUpdate = autoShadows
    this.shown = true
    // content-box: the frame's border sits around the image, not over it.
    Object.assign(this.frame.style, { display: 'block', top: `${top - BORDER}px`, width: `${w}px`, height: `${h}px`, opacity: String(Math.min(1, rear.amount * 1.4)) })
  }
}
