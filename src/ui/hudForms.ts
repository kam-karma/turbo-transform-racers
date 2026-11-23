/** Ready-made HUD panels modes can use: the four form buttons (Dönüşüm) and a generic meter. */
import { FORMS, type FormId } from '../sim/forms'
import { icon } from './icon'
import { el } from './hudDom'
import { clamp01 } from './format'
import type { FormButtons, HudMeter } from './raceHud'

export const FORM_STYLE: Readonly<Record<FormId, { readonly icon: string; readonly color: string; readonly dark: string; readonly name: string; readonly key: string }>> = {
  car: { icon: 'form-car', color: '#ffd23f', dark: '#e08a00', name: 'Araba', key: '1' },
  boat: { icon: 'form-boat', color: '#2ec5ff', dark: '#1260d0', name: 'Tekne', key: '2' },
  glider: { icon: 'form-glider', color: '#ff6bd6', dark: '#c21c8e', name: 'Planör', key: '3' },
  climber: { icon: 'form-climber', color: '#7dff5a', dark: '#2f9a1f', name: 'Tırmanıcı', key: '4' },
}

/** Button centres on a quarter arc from the bottom-right corner (thumb reach), in px. */
export function formArc(i: number, n: number, rx = 250, ry = 215): { right: number; bottom: number } {
  const a = (Math.PI / 2) * (n <= 1 ? 0 : i / (n - 1))
  return { right: Math.round(62 + Math.cos(a) * (rx - 62)), bottom: Math.round(62 + Math.sin(a) * (ry - 62)) }
}

export function createFormButtons(onForm: (f: FormId) => void): FormButtons {
  const root = el('div', 'fbtns')
  const buttons = new Map<FormId, HTMLElement>()
  FORMS.forEach((f, i) => {
    const st = FORM_STYLE[f]
    const b = el('div', 'fbtn')
    b.style.setProperty('--c', st.color)
    b.style.setProperty('--cd', st.dark)
    const pos = formArc(i, FORMS.length)
    b.style.right = `${pos.right - 46}px`
    b.style.bottom = `${pos.bottom - 46}px`
    b.style.margin = '0'
    b.title = `${st.name} (${st.key})`
    b.setAttribute('role', 'button')
    b.setAttribute('aria-label', st.name)
    b.append(icon(st.icon), el('div', 'key', st.key))
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      b.classList.add('press')
      onForm(f)
    })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => b.classList.remove('press'))
    buttons.set(f, b)
    root.append(b)
  })
  let active: FormId | null = null
  let hinted: FormId | null = null
  return {
    el: root,
    setActive(f) {
      if (f === active) return
      active = f
      for (const [id, b] of buttons) b.classList.toggle('active', id === f)
    },
    hint(f) {
      if (f === hinted) return
      hinted = f
      for (const [id, b] of buttons) b.classList.toggle('hint', id === f)
    },
  }
}

export function createMeter(label: string, color: string, iconName?: string): HudMeter {
  const root = el('div', 'chip meter')
  root.style.setProperty('--mc', color)
  const fill = el('div', 'mfill')
  const bar = el('div', 'mbar')
  bar.append(fill)
  if (iconName !== undefined) root.append(icon(iconName))
  root.append(el('span', '', label), bar)
  let last = -1
  return {
    el: root,
    set(v01) {
      const v = Math.round(clamp01(v01) * 1000) / 10
      if (v === last) return
      last = v
      fill.style.width = `${v}%`
      root.classList.toggle('full', v >= 100)
    },
  }
}
