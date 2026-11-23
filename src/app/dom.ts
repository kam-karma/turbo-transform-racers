/** DOM builders for the menus: buttons, pills, star rows, the logo. */
import { el } from '../ui/hudDom'
import { icon, imageOr } from '../ui/icon'
import { formatGold } from '../ui/format'

export { el }

export type BtnColor = 'yellow' | 'blue' | 'pink' | 'red' | 'white' | 'dark' | 'video'

export interface BtnOpts {
  readonly color?: BtnColor
  readonly icon?: string
  readonly size?: 'sm' | 'md' | 'xl'
  readonly sub?: string
  readonly round?: boolean
  readonly className?: string
  readonly title?: string
}

/** A chunky candy button. Video buttons get the clapper badge (never green, spec §13). */
export function btn(label: string, onClick: () => void, o: BtnOpts = {}): HTMLButtonElement {
  const b = el('button', ['kbtn', o.color !== undefined && o.color !== 'yellow' ? `kbtn-${o.color}` : '', o.size === 'xl' ? 'kbtn-xl' : o.size === 'sm' ? 'kbtn-sm' : '', o.round === true ? 'kround' : '', o.className ?? ''].filter(Boolean).join(' '))
  b.type = 'button'
  if (o.icon !== undefined) b.append(icon(o.icon))
  if (label !== '') {
    const l = el('span', 'lbl', label)
    if (o.sub !== undefined) l.append(el('small', '', o.sub))
    b.append(l)
  }
  if (o.color === 'video') {
    const badge = el('span', 'vid-badge')
    badge.append(icon('video'))
    b.append(badge)
  }
  if (o.title !== undefined) b.title = o.title
  if (label === '' && o.title !== undefined) b.setAttribute('aria-label', o.title)
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    if (b.disabled) return
    onClick()
  })
  b.addEventListener('pointerdown', (e) => e.stopPropagation())
  return b
}

/** Gold / star counter capsule with an overflowing icon. */
export function pill(iconName: string, value: number | string, className = ''): HTMLElement {
  const p = el('div', `kpill ${className}`.trim())
  p.append(icon(iconName), el('span', 'num', typeof value === 'number' ? formatGold(value) : value))
  return p
}

export function setPill(p: HTMLElement, value: number): void {
  const n = p.querySelector('.num')
  if (n !== null) n.textContent = formatGold(value)
}

/** Three stars (earned = gold). */
export function starRow(stars: readonly boolean[], className = 'stars'): HTMLElement {
  const row = el('div', className)
  for (const s of stars) row.append(icon(s ? 'star' : 'star-empty'))
  return row
}

/** Gold price tag: coin + amount. */
export function priceTag(price: number, canAfford = true): HTMLElement {
  const t = el('span', `price${canAfford ? '' : ' short'}`)
  t.append(icon('coin'), el('span', '', formatGold(price)))
  return t
}

/** Logo PNG with a styled text fallback. */
export function logo(className = 'logo'): HTMLElement {
  const fb = el('div', 'logo-text')
  fb.append(el('span', 'l1', 'TURBO'), el('span', 'l2', 'TRANSFORM'), el('span', 'l3', 'RACERS'))
  return imageOr('./ui/logo.png', fb, className)
}

/** Animated count-up of a number into `target` (results, chest). */
export function countUp(target: HTMLElement, from: number, to: number, ms: number, tick?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    let lastShown = from
    const step = (): void => {
      const u = Math.min(1, (performance.now() - t0) / Math.max(1, ms))
      const v = Math.round(from + (to - from) * (1 - (1 - u) ** 3))
      if (v !== lastShown) {
        lastShown = v
        target.textContent = formatGold(v)
        tick?.()
      }
      if (u < 1) window.setTimeout(step, 30)
      else resolve()
    }
    step()
  })
}

export const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))
