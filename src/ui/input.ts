/**
 * Keyboard and touch into one RaceInput. Keys are eased into analogue values (a tap is a small
 * correction); forms are one-shot presses delivered once. Driving input is only read while
 * `enabled` (the app turns it off in menus); key handlers (`onKey`) always fire.
 * Touches that start on a UI control (buttons, panels: anything with pointer events in #ui)
 * never drive the car.
 */
import type { FormId } from '../sim/forms'
import type { RaceInput } from '../sim/racer'
import type { Settings } from './settings'
import { TouchTracker } from './touchMath'

const FORM_KEYS: Readonly<Record<string, FormId>> = { Digit1: 'car', Digit2: 'boat', Digit3: 'glider', Digit4: 'climber', Numpad1: 'car', Numpad2: 'boat', Numpad3: 'glider', Numpad4: 'climber' }
const GAS = ['KeyW', 'ArrowUp']
const BRAKE = ['KeyS', 'ArrowDown']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']

const STEER_UP = 4
const STEER_DOWN = 8

const IDLE: RaceInput = { throttle: 0, brake: 0, steer: 0, form: null }

/** A pointer that lands on a UI control belongs to the UI, not to the driving area. */
function onUiControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (el === null || typeof el.closest !== 'function') return false
  return el.closest('button, .kbtn, .fbtn, .kpanel, [data-ui-hit]') !== null
}

export class Input {
  /** Driving input on/off (menus: off). */
  enabled = true
  private readonly keys = new Set<string>()
  private readonly touch = new TouchTracker()
  private keySteer = 0
  private pendingForm: FormId | null = null
  private touchBrake = false
  private anyHandlers: (() => void)[] = []
  private keyHandlers = new Map<string, Set<() => void>>()

  constructor(private readonly settings: () => Settings) {
    window.addEventListener('keydown', (e) => {
      if (this.enabled && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      this.keys.add(e.code)
      const f = FORM_KEYS[e.code]
      if (f !== undefined && !e.repeat && this.enabled) this.pendingForm = f
      if (!e.repeat) for (const fn of this.keyHandlers.get(e.code) ?? []) fn()
      this.fireAny()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.clear())
    window.addEventListener('pointerdown', (e) => {
      this.fireAny()
      if (e.pointerType === 'mouse' || !this.enabled || onUiControl(e.target)) return
      this.touch.down(e.pointerId, e.clientX, window.innerWidth)
    })
    window.addEventListener('pointermove', (e) => this.touch.move(e.pointerId, e.clientX))
    for (const ev of ['pointerup', 'pointercancel'] as const) window.addEventListener(ev, (e) => this.touch.up(e.pointerId))
  }

  /** Forget held keys and fingers (pause, menus, focus loss). */
  clear(): void {
    this.keys.clear()
    this.touch.clear()
    this.touchBrake = false
    this.pendingForm = null
    this.keySteer = 0
  }

  /** A form button was pressed (on-screen). */
  pressForm(f: FormId): void {
    this.pendingForm = f
  }

  setTouchBrake(on: boolean): void {
    this.touchBrake = on
  }

  /** Adds a key handler; returns a remover. */
  onKey(code: string, fn: () => void): () => void {
    let set = this.keyHandlers.get(code)
    if (set === undefined) {
      set = new Set()
      this.keyHandlers.set(code, set)
    }
    set.add(fn)
    return () => {
      set.delete(fn)
    }
  }

  onAny(fn: () => void): void {
    this.anyHandlers.push(fn)
  }

  /** True while a key is held (modes: e.g. Space for Şok). */
  held(code: string): boolean {
    return this.keys.has(code)
  }

  private fireAny(): void {
    for (const fn of this.anyHandlers) fn()
  }

  private heldAny(codes: readonly string[]): boolean {
    return codes.some((c) => this.keys.has(c))
  }

  /** Current controls; the pending form press is consumed. */
  read(dt: number): RaceInput {
    if (!this.enabled) return IDLE
    const t = this.touch.state()
    const want = (this.heldAny(LEFT) ? 1 : 0) - (this.heldAny(RIGHT) ? 1 : 0)
    const rate = want === 0 || Math.sign(want) !== Math.sign(this.keySteer) ? STEER_DOWN : STEER_UP
    this.keySteer += Math.max(-rate * dt, Math.min(rate * dt, want - this.keySteer))
    const brake = this.heldAny(BRAKE) || this.touchBrake ? 1 : 0
    const gas = this.settings().autoGas || this.heldAny(GAS) || t.gas ? 1 : 0
    const form = this.pendingForm
    this.pendingForm = null
    return {
      throttle: brake > 0 ? 0 : gas,
      brake,
      steer: Math.abs(t.steer) > Math.abs(this.keySteer) ? t.steer : this.keySteer,
      form,
    }
  }
}
