/**
 * Ghosts: a race recorded at 10 Hz in track space, a compact text encoding for storing and
 * shipping them, and interpolated playback.
 */
import { FORMS, type FormId } from './forms'
import type { RacerState } from './racer'

export interface GhostSample {
  readonly t: number
  readonly s: number
  readonly d: number
  readonly y: number
  readonly yaw: number
  readonly form: FormId
  /** Effect bits: 1 turbo, 2 combo flame, 4 boost pad, 8 airborne. */
  readonly fx: number
}

export interface GhostMeta {
  readonly id: string
  readonly pilot: string
  readonly car: string
  readonly color: number
  /** Finish time in seconds. */
  readonly time: number
}

export interface Ghost extends GhostMeta {
  readonly hz: number
  readonly samples: readonly GhostSample[]
}

export const GHOST_HZ = 10

export const FX_TURBO = 1
export const FX_FLAME = 2
export const FX_BOOST = 4
export const FX_AIR = 8

export function fxOf(st: RacerState): number {
  return (st.turbo > 0 ? FX_TURBO : 0) | (st.combo >= 3 ? FX_FLAME : 0) | (st.boost > 0 ? FX_BOOST : 0) | (st.airborne ? FX_AIR : 0)
}

export class GhostRecorder {
  private readonly samples: GhostSample[] = []

  constructor(private readonly hz = GHOST_HZ) {}

  /** Call every frame; keeps one sample per 1/hz of race time. */
  push(st: RacerState): void {
    const i = this.samples.length
    if (st.time + 1e-6 < i / this.hz) return
    this.samples.push({ t: i / this.hz, s: st.s, d: st.d, y: st.y, yaw: st.yaw, form: st.form, fx: fxOf(st) })
  }

  get count(): number {
    return this.samples.length
  }

  finish(meta: GhostMeta, last?: RacerState): Ghost {
    const samples = [...this.samples]
    if (last !== undefined) samples.push({ t: samples.length / this.hz, s: last.s, d: last.d, y: last.y, yaw: last.yaw, form: last.form, fx: fxOf(last) })
    return { ...meta, hz: this.hz, samples }
  }
}

// --- encoding: JSON header + base64 of packed little-endian columns --------------------

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)))

export function encodeGhost(g: Ghost): string {
  const n = g.samples.length
  const buf = new ArrayBuffer(n * 4 + n * 6 + n * 2)
  const view = new DataView(buf)
  let o = 0
  for (const x of g.samples) { view.setInt32(o, Math.round(x.s * 50), true); o += 4 }
  for (const x of g.samples) { view.setInt16(o, clampInt(x.d * 100, -32768, 32767), true); o += 2 }
  for (const x of g.samples) { view.setInt16(o, clampInt(x.y * 50, -32768, 32767), true); o += 2 }
  for (const x of g.samples) { view.setInt16(o, clampInt(x.yaw * 10000, -32768, 32767), true); o += 2 }
  for (const x of g.samples) { view.setUint8(o, Math.max(0, FORMS.indexOf(x.form))); o += 1 }
  for (const x of g.samples) { view.setUint8(o, x.fx & 0xff); o += 1 }
  const { samples: _samples, ...meta } = g
  return JSON.stringify({ ...meta, n, data: toBase64(new Uint8Array(buf)) })
}

export function decodeGhost(text: string): Ghost {
  const o = JSON.parse(text) as Record<string, unknown>
  const n = o.n
  if (typeof o.data !== 'string' || typeof n !== 'number' || typeof o.hz !== 'number' || typeof o.time !== 'number') {
    throw new Error('Bozuk hayalet verisi')
  }
  const bytes = fromBase64(o.data)
  if (bytes.length !== n * 12) throw new Error('Bozuk hayalet verisi (uzunluk)')
  const view = new DataView(bytes.buffer)
  const hz = o.hz
  const samples: GhostSample[] = []
  for (let i = 0; i < n; i++) {
    samples.push({
      t: i / hz,
      s: view.getInt32(i * 4, true) / 50,
      d: view.getInt16(n * 4 + i * 2, true) / 100,
      y: view.getInt16(n * 6 + i * 2, true) / 50,
      yaw: view.getInt16(n * 8 + i * 2, true) / 10000,
      form: FORMS[view.getUint8(n * 10 + i)] ?? 'car',
      fx: view.getUint8(n * 11 + i),
    })
  }
  return {
    id: String(o.id ?? ''), pilot: String(o.pilot ?? ''), car: String(o.car ?? ''), color: Number(o.color ?? 0xffffff),
    time: o.time, hz, samples,
  }
}

/** Ghost pose at race time t (linear in between samples, form from the earlier sample). */
export function sampleGhost(g: Ghost, t: number): GhostSample {
  const last = g.samples.length - 1
  const f = Math.max(0, Math.min(last, t * g.hz))
  const i = Math.min(last, Math.floor(f))
  const j = Math.min(last, i + 1)
  const k = f - i
  const a = g.samples[i]
  const b = g.samples[j]
  return {
    t,
    s: a.s + (b.s - a.s) * k,
    d: a.d + (b.d - a.d) * k,
    y: a.y + (b.y - a.y) * k,
    yaw: a.yaw + (b.yaw - a.yaw) * k,
    form: a.form,
    fx: a.fx,
  }
}
