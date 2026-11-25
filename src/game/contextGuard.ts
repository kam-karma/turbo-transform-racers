/**
 * WebGL context loss: a GPU that cannot keep up (driver reset, out of memory) drops the
 * canvas, the page background shows through, the browser restores it and the same heavy
 * frame drops it again. The first loss on High steps down to Low and reloads once; later
 * losses are left to three.js' own restore.
 */
import type { Quality } from '../ui/settings'

export type LossAction = 'drop-to-low' | 'wait'

const FLAG = 'ttr-context-drop'

export function lossAction(quality: Quality, alreadyDropped: boolean): LossAction {
  return quality === 'high' && !alreadyDropped ? 'drop-to-low' : 'wait'
}

function dropped(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

function markDropped(): void {
  try {
    sessionStorage.setItem(FLAG, '1')
  } catch {
    // Storage blocked: the reload still happens once per loss.
  }
}

/** Watches the game canvas; `toLow` saves Low quality before the page reloads. */
export function guardContext(canvas: HTMLCanvasElement, quality: () => Quality, toLow: () => void): void {
  canvas.addEventListener('webglcontextlost', () => {
    console.warn('WebGL context lost')
    if (lossAction(quality(), dropped()) !== 'drop-to-low') return
    markDropped()
    toLow()
    window.setTimeout(() => window.location.reload(), 50)
  })
}
