/**
 * The Kaos mode panel handed to hud.setModePanel: the Şok meter with a big round neon Şok
 * button (tap on phones, Space on keyboards), the live destruction score, and in the boss
 * race the dragon's health bar. Neon-glass styling; the icon is ./ui/icons/shock.png with a
 * drawn SVG bolt as fallback (never an emoji).
 */
import type { HudMeter, RaceHud } from '../ui/raceHud'

const CSS = `
.kaos-panel { position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom)); display: flex; align-items: flex-end; gap: 14px; pointer-events: none; font-family: "Baloo 2", "Nunito", system-ui, sans-serif; }
.kaos-col { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.kaos-score { pointer-events: none; padding: 6px 14px; border-radius: 14px; background: rgba(12, 8, 34, 0.72); border: 2px solid #ff3df2; box-shadow: 0 0 14px rgba(255, 61, 242, 0.55), inset 0 0 10px rgba(255, 61, 242, 0.25); color: #fff; font-weight: 900; font-size: 20px; letter-spacing: 0.5px; text-shadow: 0 0 8px #ff3df2; }
.kaos-score b { color: #ffe03a; text-shadow: 0 0 10px #ffb02e; font-size: 24px; margin-left: 6px; }
.kaos-btn { pointer-events: auto; position: relative; width: 96px; height: 96px; border-radius: 50%; border: 3px solid #22e6ff; background: radial-gradient(circle at 50% 40%, rgba(34, 230, 255, 0.35), rgba(12, 8, 34, 0.9) 70%); box-shadow: 0 0 18px rgba(34, 230, 255, 0.6), inset 0 0 16px rgba(34, 230, 255, 0.4); display: grid; place-items: center; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; transition: transform 0.12s, filter 0.2s; filter: grayscale(0.85) brightness(0.65); }
.kaos-btn img, .kaos-btn svg { width: 58px; height: 58px; filter: drop-shadow(0 0 6px #22e6ff); }
.kaos-btn .key { position: absolute; bottom: -10px; padding: 1px 8px; border-radius: 8px; background: #0c0822; border: 2px solid #22e6ff; color: #bff8ff; font-size: 12px; font-weight: 900; letter-spacing: 1px; }
.kaos-btn.ready { filter: none; animation: kaos-pulse 0.7s ease-in-out infinite alternate; }
.kaos-btn:active { transform: scale(0.92); }
@keyframes kaos-pulse { from { box-shadow: 0 0 16px rgba(34,230,255,0.7), inset 0 0 14px rgba(34,230,255,0.5); transform: scale(1); } to { box-shadow: 0 0 36px rgba(34,230,255,1), 0 0 70px rgba(255,61,242,0.6), inset 0 0 22px rgba(255,255,255,0.6); transform: scale(1.07); } }
body.touch .kaos-btn .key { display: none; }
`

const BOLT = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="kb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffd23f"/></linearGradient></defs><circle cx="32" cy="32" r="27" fill="none" stroke="#22e6ff" stroke-width="3" opacity="0.8"/><path d="M36 6 L16 36 H30 L26 58 L48 26 H34 Z" fill="url(#kb)" stroke="#ff9a1f" stroke-width="2.5" stroke-linejoin="round"/></svg>`

export interface KaosPanel {
  readonly el: HTMLElement
  setShock(v01: number): void
  setScore(n: number): void
  setBoss(v01: number): void
  dispose(): void
}

let styled = false

export function createKaosPanel(hud: RaceHud, boss: boolean, onShock: () => void): KaosPanel {
  if (!styled && typeof document !== 'undefined') {
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    styled = true
  }
  const el = document.createElement('div')
  el.className = 'kaos-panel'
  const col = document.createElement('div')
  col.className = 'kaos-col'
  let bossMeter: HudMeter | null = null
  if (boss) {
    bossMeter = hud.meter('EJDERHA', '#b6ff2e')
    col.appendChild(bossMeter.el)
  }
  const score = document.createElement('div')
  score.className = 'kaos-score'
  score.innerHTML = 'YIKIM<b>0</b>'
  const shock = hud.meter('ŞOK', '#22e6ff')
  col.append(score, shock.el)
  const btn = document.createElement('button')
  btn.className = 'kaos-btn'
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Şok dalgası')
  const img = new Image()
  img.alt = ''
  img.src = './ui/icons/shock.png'
  img.onerror = () => {
    img.remove()
    btn.insertAdjacentHTML('afterbegin', BOLT)
  }
  btn.appendChild(img)
  const key = document.createElement('span')
  key.className = 'key'
  key.textContent = 'BOŞLUK'
  btn.appendChild(key)
  const press = (e: Event): void => {
    e.preventDefault()
    e.stopPropagation()
    onShock()
  }
  btn.addEventListener('pointerdown', press)
  el.append(col, btn)
  const scoreB = score.querySelector('b') as HTMLElement
  let last = -1
  return {
    el,
    setShock(v) {
      shock.set(v)
      btn.classList.toggle('ready', v >= 1)
    },
    setScore(n) {
      if (n === last) return
      last = n
      scoreB.textContent = String(n)
    },
    setBoss(v) {
      bossMeter?.set(v)
    },
    dispose() {
      btn.removeEventListener('pointerdown', press)
      el.remove()
    },
  }
}
