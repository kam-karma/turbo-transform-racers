/**
 * The in-race HUD (RaceHud implementation): place, time, coins, progress with rival dots,
 * speed arc, combo, countdown, pops, flash, mode panel slot and meters. Skinned per world via
 * `data-world` (hud.css). DOM writes are skipped when a value did not change.
 */
import './ui.css'
import './hud.css'
import type { FormId } from '../sim/forms'
import { clamp01, formatTime, parsePopText, speedFraction } from './format'
import { createFormButtons, createMeter } from './hudForms'
import { el, replay } from './hudDom'
import { icon } from './icon'
import type { FormButtons, HudMeter, HudWorld, RaceHud, RaceHudView } from './raceHud'

const ARC_START = (200 * Math.PI) / 180
const ARC_END = (-20 * Math.PI) / 180

function arcPath(cx: number, cy: number, r: number): string {
  const p = (a: number): string => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy - Math.sin(a) * r).toFixed(1)}`
  return `M ${p(ARC_START)} A ${r} ${r} 0 1 1 ${p(ARC_END)}`
}

const COUNT_COLORS = ['#7dff5a', '#ffd23f', '#ff9a2e', '#ff4b5c']

/** Extra hooks beyond the contract, used by the app shell. */
export interface RaceHudExt extends RaceHud {
  readonly root: HTMLElement
  /** Combo counter (also accepted through update({combo})). */
  combo(n: number): void
  /** Player marker colour on the progress bar. */
  setPlayerColor(color: string): void
  /** The skin last passed to show(). */
  readonly world: HudWorld
}

export function createRaceHud(parent: HTMLElement): RaceHudExt {
  const root = el('div', 'rhud k-hidden')
  root.dataset.world = 'adalar'

  const place = el('div', 'place')
  const placeN = el('span', 'n', '1')
  const placeOf = el('span', 'of', '/6')
  place.append(placeN, placeOf)

  const stats = el('div', 'stats')
  const timeChip = el('div', 'chip time')
  const timeTxt = el('span', '', '0:00.0')
  timeChip.append(icon('timer'), timeTxt)
  const coinChip = el('div', 'chip coins')
  const coinTxt = el('span', '', '0')
  coinChip.append(icon('coin'), coinTxt)
  stats.append(timeChip, coinChip)

  const prog = el('div', 'prog')
  const bar = el('div', 'bar')
  const fill = el('div', 'fill')
  bar.append(fill)
  const you = el('div', 'dot you')
  prog.append(bar, icon('flag', 'flag'), you)
  const lap = el('div', 'chip lap k-hidden')

  const meters = el('div', 'meters')

  const speedo = el('div', 'speedo')
  speedo.innerHTML =
    `<svg viewBox="0 0 210 150"><defs><linearGradient id="rhud-speed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#39f2ff"/><stop offset=".55" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff4b5c"/></linearGradient></defs>` +
    `<path class="arc-bg" d="${arcPath(105, 92, 82)}"/><path class="arc-rim" d="${arcPath(105, 92, 82)}"/>` +
    `<path class="arc" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" d="${arcPath(105, 92, 82)}"/></svg>`
  const speedVal = el('div', 'val', '0')
  speedo.append(speedVal, el('div', 'unit', 'KM/S'))
  const arc = speedo.querySelector('.arc') as SVGPathElement

  const comboEl = el('div', 'cmeter')
  const comboX = el('div', 'x', '×2')
  comboEl.append(comboX, el('div', 't', 'KOMBO'))

  const mode = el('div', 'mode')
  const count = el('div', 'count')
  const flashEl = el('div', 'flash')
  root.append(flashEl, prog, lap, place, stats, meters, speedo, comboEl, mode, count)
  parent.append(root)

  const dots = new Map<string, HTMLElement>()
  const last = { place: -1, of: -1, time: '', coins: -1, kmh: -1, fill: -1, lap: '', combo: -1 }
  let world: HudWorld = 'adalar'
  let activePops = 0

  const reset = (): void => {
    for (const d of dots.values()) d.remove()
    dots.clear()
    meters.replaceChildren()
    mode.replaceChildren()
    count.replaceChildren()
    count.className = 'count'
    for (const k of Object.keys(last) as (keyof typeof last)[]) (last as Record<string, number | string>)[k] = typeof last[k] === 'number' ? -1 : ''
    lap.classList.add('k-hidden')
    comboEl.classList.remove('on', 'fire')
  }

  const setCombo = (n: number): void => {
    if (n === last.combo) return
    last.combo = n
    comboEl.classList.toggle('on', n >= 2)
    comboEl.classList.toggle('fire', n >= 3)
    if (n >= 2) {
      comboX.textContent = `×${n}`
      replay(comboX, 'k-bump')
    }
  }

  const hud: RaceHudExt = {
    root,
    get world() {
      return world
    },
    show(w) {
      world = w
      root.dataset.world = w
      reset()
      root.classList.remove('k-hidden')
    },
    hide() {
      root.classList.add('k-hidden')
      reset()
    },
    countdown(n) {
      const go = n <= 0
      count.replaceChildren()
      count.style.setProperty('--cc', COUNT_COLORS[Math.max(0, Math.min(3, n))])
      if (!go) count.append(el('div', 'ring'))
      count.append(el('div', 'num', go ? 'GİT!' : String(n)), el('div', 'burst'))
      count.className = `count${go ? ' go' : ''}`
      replay(count, 'show')
    },
    update(v: RaceHudView) {
      if (v.place !== last.place || v.of !== last.of) {
        const bumped = last.place !== -1 && v.place < last.place
        last.place = v.place
        last.of = v.of
        placeN.textContent = String(v.place)
        placeOf.textContent = `/${v.of}`
        place.className = `place p${Math.min(4, v.place)}`
        if (bumped) replay(place, 'bump')
      }
      const t = formatTime(v.time)
      if (t !== last.time) timeTxt.textContent = last.time = t
      if (v.coins !== last.coins) {
        const more = last.coins !== -1 && v.coins > last.coins
        last.coins = v.coins
        coinTxt.textContent = String(v.coins)
        if (more) replay(coinChip, 'bump')
      }
      const kmh = Math.round(v.kmh)
      if (kmh !== last.kmh) {
        last.kmh = kmh
        speedVal.textContent = String(kmh)
        arc.setAttribute('stroke-dashoffset', (100 - speedFraction(kmh) * 100).toFixed(1))
        speedo.classList.toggle('boost', kmh > 160)
      }
      const p = Math.round(clamp01(v.progress) * 1000) / 10
      if (p !== last.fill) {
        last.fill = p
        fill.style.width = `${p}%`
        you.style.left = `calc((100% - 22px) * ${p / 100})`
      }
      for (const r of v.rivals) {
        let d = dots.get(r.id)
        if (d === undefined) {
          d = el('div', 'dot')
          d.style.background = r.color
          prog.insertBefore(d, you)
          dots.set(r.id, d)
        }
        d.style.left = `calc((100% - 22px) * ${clamp01(r.progress).toFixed(4)})`
      }
      const lapTxt = v.lap === undefined ? '' : `TUR ${v.lap.n}/${v.lap.of}`
      if (lapTxt !== last.lap) {
        last.lap = lapTxt
        lap.textContent = lapTxt
        lap.classList.toggle('k-hidden', lapTxt === '')
      }
      if (v.combo !== undefined) setCombo(v.combo)
    },
    pop(text, kind) {
      const p = el('div', `pop ${kind}`)
      for (const part of parsePopText(text)) p.append(part.kind === 'icon' ? icon(part.name) : el('span', '', part.text))
      p.style.setProperty('--y', `${27 + Math.min(3, activePops) * 11}%`)
      activePops++
      root.append(p)
      window.setTimeout(() => {
        p.remove()
        activePops = Math.max(0, activePops - 1)
      }, 1000)
    },
    flash(color) {
      flashEl.style.setProperty('--flash', color)
      replay(flashEl, 'on')
    },
    setModePanel(panel) {
      mode.replaceChildren()
      if (panel !== null) mode.append(panel)
    },
    formButtons(onForm: (f: FormId) => void): FormButtons {
      return createFormButtons(onForm)
    },
    meter(label, color): HudMeter {
      const m = createMeter(label, color)
      meters.append(m.el)
      return m
    },
    combo: setCombo,
    setPlayerColor(color) {
      you.style.background = `radial-gradient(circle at 35% 30%, #fff, ${color} 60%)`
    },
  }
  return hud
}
