/** Pure formatters shared by the HUD and the menus (unit tested). Player-facing text is Turkish. */

/** 83.456 → "1:23.4" */
export function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const tenths = Math.floor(s * 10 + 1e-6)
  const m = Math.floor(tenths / 600)
  const rest = (tenths - m * 600) / 10
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`
}

/** 12500 → "12.500" (Turkish thousands separator). */
export function formatGold(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0)
  const sign = v < 0 ? '-' : ''
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Milliseconds → "3 sa 12 dk" / "12 dk 05 sn" / "45 sn"; 0 or less → "". */
export function formatCountdown(ms: number): string {
  if (!(ms > 0)) return ''
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} sa ${m} dk`
  if (m > 0) return `${m} dk ${String(s).padStart(2, '0')} sn`
  return `${s} sn`
}

/** 1 → "1.", used for places ("1. oldun!"). */
export const ordinal = (n: number): string => `${Math.max(1, Math.round(n))}.`

/** Speedometer fill 0..1 (soft cap so turbo still moves the needle). */
export function speedFraction(kmh: number, max = 200): number {
  const v = Math.max(0, Number.isFinite(kmh) ? kmh : 0)
  return Math.min(1, v / max)
}

export type PopPart = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'icon'; readonly name: string }

/**
 * Pop texts may embed icons as `{name}` tokens: "{form-boat} Yanlış form!" → icon + text.
 * Anything that is not a well-formed token stays text.
 */
export function parsePopText(text: string): PopPart[] {
  const parts: PopPart[] = []
  const re = /\{([a-z0-9-]+)\}/g
  let last = 0
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) })
    parts.push({ kind: 'icon', name: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts.map((p): PopPart => (p.kind === 'text' ? { kind: 'text', text: p.text.trim() } : p)).filter((p) => p.kind === 'icon' || p.text !== '')
}

/** Clamp to 0..1; NaN → 0. */
export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)
