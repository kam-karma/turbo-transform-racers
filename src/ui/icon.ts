/**
 * <Icon name>: the custom PNG from public/ui/icons/<name>.png when it exists, otherwise a vector
 * stand-in drawn in the same style (iconGlyphs.ts). Each PNG is probed once; elements created
 * before the probe finishes swap to the PNG when it loads. Never an emoji.
 */
import { GLYPHS, iconDefsMarkup, letterBadge } from './iconGlyphs'

export type IconName = string

const ICON_BASE = './ui/icons/'
const state = new Map<IconName, 'ok' | 'missing' | Promise<boolean>>()
let defsDone = false

function ensureDefs(): void {
  if (defsDone || typeof document === 'undefined') return
  defsDone = true
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  holder.setAttribute('width', '0')
  holder.setAttribute('height', '0')
  holder.setAttribute('aria-hidden', 'true')
  holder.style.position = 'absolute'
  holder.innerHTML = `<defs>${iconDefsMarkup()}</defs>`
  document.body.prepend(holder)
}

/** Stable hue per name, for the lettered fallback badge. */
export function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function iconUrl(name: IconName): string {
  return `${ICON_BASE}${name}.png`
}

function probe(name: IconName): Promise<boolean> {
  const known = state.get(name)
  if (known === 'ok') return Promise.resolve(true)
  if (known === 'missing') return Promise.resolve(false)
  if (known !== undefined) return known
  const p = new Promise<boolean>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ok = img.naturalWidth > 0
      state.set(name, ok ? 'ok' : 'missing')
      resolve(ok)
    }
    img.onerror = () => {
      state.set(name, 'missing')
      resolve(false)
    }
    img.src = iconUrl(name)
  })
  state.set(name, p)
  return p
}

function vector(name: IconName): SVGSVGElement {
  ensureDefs()
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 64 64')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = GLYPHS[name] ?? letterBadge(name, nameHue(name))
  return svg
}

function png(name: IconName): HTMLImageElement {
  const img = document.createElement('img')
  img.src = iconUrl(name)
  img.alt = ''
  img.draggable = false
  return img
}

/** An inline icon; size it with CSS (`.ic` is 1em square by default). */
export function icon(name: IconName, className = ''): HTMLElement {
  const span = document.createElement('span')
  span.className = className === '' ? 'ic' : `ic ${className}`
  span.dataset.icon = name
  setIcon(span, name)
  return span
}

/** Re-points an existing icon element at another name (e.g. sound on/off). */
export function setIcon(span: HTMLElement, name: IconName): void {
  span.dataset.icon = name
  if (state.get(name) === 'ok') {
    span.replaceChildren(png(name))
    return
  }
  span.replaceChildren(vector(name))
  if (state.get(name) === 'missing') return
  void probe(name).then((ok) => {
    if (ok && span.dataset.icon === name) span.replaceChildren(png(name))
  })
}

/** Warm the cache so the first screen does not swap icons in visibly. */
export function preloadIcons(names: readonly IconName[]): Promise<void> {
  return Promise.all(names.map(probe)).then(() => undefined)
}

/**
 * An image with a styled fallback: `fallback` is shown until (and unless) `url` loads.
 * Used for the logo and the world cards.
 */
export function imageOr(url: string, fallback: HTMLElement, className: string): HTMLElement {
  const box = document.createElement('div')
  box.className = className
  box.append(fallback)
  const img = new Image()
  img.alt = ''
  img.draggable = false
  img.onload = () => {
    if (img.naturalWidth > 0) {
      box.classList.add('has-img')
      box.replaceChildren(img)
    }
  }
  img.src = url
  return box
}
