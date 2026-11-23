/** Boot loading screen: logo, candy progress bar with the hero car riding it, tips. */
import { icon } from '../../ui/icon'
import { el, logo } from '../dom'
import type { Screen } from '../screen'

const TIPS = [
  'Zemin değişmeden hemen önce doğru forma geç: TURBO!',
  'Suya yaklaşırken tekneye, uçuruma gelirken planöre dönüş.',
  'Her pistte 3 yıldız var. Hepsini toplayabilir misin?',
  'Garajda arabanı boya, spoiler ve neon ile süsle.',
  'Günlük sandığı açmayı unutma!',
]

export function loadingScreen(): Screen & { set(f: number): void } {
  const root = el('div', 'scr-loading')
  const bg = el('div', 'load-bg')
  for (let i = 0; i < 7; i++) {
    const b = el('i')
    b.style.setProperty('--i', String(i))
    bg.append(b)
  }
  const bar = el('div', 'load-bar')
  const fill = el('div', 'load-fill')
  const rider = el('div', 'load-rider')
  rider.append(icon('form-car'))
  bar.append(fill, rider)
  const pct = el('div', 'load-pct', '%0')
  const tip = el('div', 'load-tip', TIPS[Math.floor(Math.random() * TIPS.length)])
  const center = el('div', 'load-center')
  center.append(logo('logo load-logo'), bar, pct, tip)
  root.append(bg, center)
  let shown = 0
  return {
    el: root,
    showroom: null,
    set(f) {
      const v = Math.max(shown, Math.min(1, f))
      shown = v
      fill.style.width = `${(v * 100).toFixed(1)}%`
      rider.style.left = `${(v * 100).toFixed(1)}%`
      pct.textContent = v >= 1 ? 'Hazır!' : `%${Math.round(v * 100)}`
    },
  }
}
