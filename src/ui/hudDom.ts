/** Tiny DOM helpers for the HUD and menus. */
export { formatTime } from './format'

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className !== '') e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

/** Restart a CSS animation class on an element. */
export function replay(e: HTMLElement, cls: string): void {
  e.classList.remove(cls)
  void e.offsetWidth
  e.classList.add(cls)
}

/** Keep pointer events from reaching the touch-driving layer under the UI. */
export function guardPointer(e: HTMLElement): void {
  e.addEventListener('pointerdown', (ev) => ev.stopPropagation())
}
