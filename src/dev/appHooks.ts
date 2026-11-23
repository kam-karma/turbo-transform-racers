/**
 * Dev-only browser test hooks (window.__app). The Browser pane may be hidden, which stops
 * requestAnimationFrame, so tests advance the app by hand (`tick`) and save frames straight
 * to disk through the local asset relay (`snap` → assets/snaps/<name>.jpg).
 */
import type * as THREE from 'three'
import type { App } from '../app/app'
import { currentRace } from '../modes/registry'
import type { ModeDev } from '../modes/types'
import { botInput, newBotMemory, rng } from '../sim/bot'
import { PILOTS } from '../sim/pilots'
import type { DevInput } from './devInput'

const RELAY = 'http://127.0.0.1:5199/?name='

export interface AppHookDeps {
  readonly app: App
  readonly renderer: THREE.WebGLRenderer
  readonly input: DevInput
  readonly fps: () => number
  readonly racing: () => boolean
}

const devOf = (): ModeDev | null => ((currentRace() as { dev?: ModeDev } | null)?.dev ?? null)

export function installDevHooks(d: AppHookDeps): void {
  const hooks = {
    ...d,
    get race() {
      return currentRace()
    },
    get state() {
      return devOf()?.state ?? null
    },
    /** Runs the app for `seconds` in 1/60 s frames. */
    tick(seconds: number): number | null {
      const n = Math.round(seconds * 60)
      for (let i = 0; i < n; i++) d.app.tick(1 / 60)
      return devOf()?.state?.s ?? null
    },
    teleport(s: number): void {
      devOf()?.teleport(s)
    },
    /** Lets a Kupa Pilotu's bot drive the player car in Dönüşüm races (0 = the best pilot). */
    autopilot(on: boolean, pilot = 0): void {
      if (!on) {
        d.input.autopilot = null
        return
      }
      const rand = rng(99)
      const mem = newBotMemory()
      const skill = PILOTS[pilot]?.skill ?? PILOTS[0].skill
      d.input.autopilot = (dt) => {
        const dev = devOf()
        return dev === null || dev.state === undefined ? { throttle: 1, brake: 0, steer: 0, form: null } : botInput(dev.state, dev.track, skill, rand, mem, dt)
      }
    },
    /** Saves the current canvas as name.jpg through the local relay. */
    async snap(name: string): Promise<string> {
      d.app.tick(0)
      const blob = await new Promise<Blob | null>((res) => d.renderer.domElement.toBlob(res, 'image/jpeg', 0.85))
      if (blob === null) return 'no blob'
      const r = await fetch(RELAY + encodeURIComponent(name + '.jpg'), { method: 'POST', body: blob })
      return r.text()
    },
  }
  ;(window as unknown as { __app?: unknown }).__app = hooks
}
