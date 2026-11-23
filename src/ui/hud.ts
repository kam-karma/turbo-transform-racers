/**
 * @deprecated Legacy A0 HUD API kept so the A0 main.ts / game/session.ts keep running until the
 * integrator switches to the App shell (src/app/app.ts) and RaceHud (src/ui/raceHud.ts).
 * Implemented on top of the new themed RaceHud; menus use the shared candy components.
 * No emoji anywhere: icons come from public/ui/icons via icon().
 */
import './ui.css'
import { FORMS, type FormId } from '../sim/forms'
import { FORM_STYLE } from './hudForms'
import { createRaceHud, type RaceHudExt } from './hudRace'
import type { FormButtons } from './raceHud'
import type { Settings } from './settings'
import { el, formatTime } from './hudDom'
import { icon } from './icon'

/** `icon` is a pop-text token: `${FORM_UI.boat.icon} Yanlış form!` renders the boat icon. */
export const FORM_UI: Readonly<Record<FormId, { icon: string; color: string; name: string; key: string }>> = Object.fromEntries(
  FORMS.map((f) => [f, { icon: `{${FORM_STYLE[f].icon}}`, color: FORM_STYLE[f].color, name: FORM_STYLE[f].name, key: FORM_STYLE[f].key }]),
) as Record<FormId, { icon: string; color: string; name: string; key: string }>

export interface HudRacer { readonly id: string; readonly progress: number; readonly color: string; readonly you: boolean }
export interface HudView { readonly place: number; readonly of: number; readonly time: number; readonly kmh: number; readonly coins: number; readonly racers: readonly HudRacer[]; readonly form: FormId }
export interface ResultRow { readonly name: string; readonly badge: string; readonly time: number | null; readonly you: boolean; readonly pilot: boolean }
export interface ResultView { readonly place: number; readonly rows: readonly ResultRow[]; readonly time: number; readonly perfects: number; readonly bestCombo: number; readonly coins: number; readonly newBest: boolean }

function button(label: string, iconName: string, onClick: () => void, color = ''): HTMLButtonElement {
  const b = el('button', `kbtn ${color}`.trim())
  b.type = 'button'
  b.append(icon(iconName), el('span', 'lbl', label))
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  b.addEventListener('pointerdown', (e) => e.stopPropagation())
  return b
}

export class Hud {
  private readonly root: HTMLElement
  private readonly race: RaceHudExt
  private readonly forms: FormButtons
  private readonly overlay = el('div', 'legacy-overlay k-hidden')
  private readonly pauseEl = el('div', 'legacy-overlay k-hidden')
  private readonly extras: HTMLElement[] = []
  private formHandler: (f: FormId) => void = () => undefined
  private brakeHandler: (on: boolean) => void = () => undefined
  private shown = false

  constructor(root: HTMLElement) {
    this.root = root
    this.race = createRaceHud(root)
    this.forms = this.race.formButtons((f) => this.formHandler(f))
    const brake = el('div', 'brake-btn legacy-brake')
    brake.append(el('span', '', 'FREN'))
    brake.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this.brakeHandler(true)
    })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) brake.addEventListener(ev, () => this.brakeHandler(false))
    this.extras.push(brake)
    const rotate = el('div', 'app-rotate legacy-rotate')
    const phone = el('div', 'phone')
    phone.append(el('i'))
    rotate.append(phone, el('div', 'k-out', 'Telefonunu yan çevir!'))
    root.append(brake, this.overlay, this.pauseEl, rotate)
    this.showRace(false)
  }

  onForm(fn: (f: FormId) => void): void {
    this.formHandler = fn
  }

  onBrake(fn: (on: boolean) => void): void {
    this.brakeHandler = fn
  }

  pauseControls(toggle: () => void): void {
    const btn = el('button', 'icon-btn pause-btn legacy-pause')
    btn.append(icon('pause'))
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggle()
    })
    btn.addEventListener('pointerdown', (e) => e.stopPropagation())
    const card = el('div', 'kpanel legacy-card')
    card.append(el('div', 'legacy-title', 'Duraklatıldı'), button('Devam', 'play', toggle), el('div', 'legacy-sub', 'Esc ya da P ile devam'))
    this.pauseEl.append(card)
    this.root.append(btn)
    this.extras.push(btn)
    this.showRace(this.shown)
  }

  showPause(on: boolean): void {
    this.pauseEl.classList.toggle('k-hidden', !on)
  }

  hideOverlay(): void {
    this.overlay.classList.add('k-hidden')
  }

  showRace(on: boolean): void {
    this.shown = on
    if (on) {
      this.race.show('adalar')
      this.race.setModePanel(this.forms.el)
    } else this.race.hide()
    for (const e of this.extras) e.classList.toggle('k-hidden', !on)
  }

  private card(...children: HTMLElement[]): void {
    const c = el('div', 'kpanel legacy-card k-pop')
    c.append(...children)
    this.overlay.replaceChildren(c)
    this.overlay.classList.remove('k-hidden')
  }

  loading(fraction: number): void {
    this.card(el('div', 'legacy-logo', 'TURBO TRANSFORM RACERS'), el('div', 'legacy-sub', `Yükleniyor… %${Math.round(fraction * 100)}`))
  }

  showStart(trackName: string, _touch: boolean, onStart: () => void): void {
    const start = (): void => {
      window.removeEventListener('keydown', key)
      this.overlay.classList.add('k-hidden')
      onStart()
    }
    const key = (e: KeyboardEvent): void => {
      if (!e.repeat && e.code !== 'Escape') start()
    }
    window.addEventListener('keydown', key)
    this.card(el('div', 'legacy-logo', 'TURBO TRANSFORM RACERS'), el('div', 'legacy-sub', `Uçan Adalar · ${trackName}`), button('Yarış', 'play', start))
  }

  countdown(n: number): void {
    this.race.countdown(n)
  }

  pop(text: string, kind: 'perfect' | 'combo' | 'bad' | 'soft'): void {
    this.race.pop(text, kind)
  }

  flash(color: string): void {
    this.race.flash(color)
  }

  hintForm(f: FormId | null): void {
    this.forms.hint(f)
  }

  update(v: HudView): void {
    const you = v.racers.find((r) => r.you)
    this.race.update({ place: v.place, of: v.of, time: v.time, kmh: v.kmh, coins: v.coins, progress: you?.progress ?? 0, rivals: v.racers.filter((r) => !r.you) })
    this.forms.setActive(v.form)
  }

  resetDots(): void {
    this.race.show('adalar')
    this.race.setModePanel(this.forms.el)
  }

  showResults(r: ResultView, onRestart: () => void): void {
    const list = el('div', 'legacy-rows')
    r.rows.forEach((row, i) => {
      list.append(el('div', `legacy-row${row.you ? ' you' : ''}`, `${i + 1}. ${row.name}  ${row.time === null ? '—' : formatTime(row.time)}`))
    })
    this.card(el('div', 'legacy-title', r.place === 1 ? 'BİRİNCİ OLDUN!' : `${r.place}. oldun!`), list, button('Tekrar', 'flag', () => {
      this.overlay.classList.add('k-hidden')
      onRestart()
    }))
  }

  settingsMenu(get: () => Settings, change: (s: Settings) => void, opened: (open: boolean) => void = () => undefined): void {
    const panel = el('div', 'legacy-overlay k-hidden')
    const gear = el('button', 'icon-btn legacy-gear')
    gear.append(icon('gear'))
    const render = (): void => {
      const s = get()
      const row = (label: string, on: boolean, flip: () => Settings): HTMLElement =>
        button(`${label}: ${on ? 'Açık' : 'Kapalı'}`, on ? 'play' : 'pause', () => {
          change(flip())
          render()
        }, 'kbtn-white')
      const c = el('div', 'kpanel legacy-card')
      c.append(
        row('Otomatik gaz', s.autoGas, () => ({ ...get(), autoGas: !get().autoGas })),
        row('Form ipuçları', s.formHints, () => ({ ...get(), formHints: !get().formHints })),
        row('Ses', s.sound, () => ({ ...get(), sound: !get().sound })),
        row('Yüksek grafik', s.quality === 'high', () => ({ ...get(), quality: get().quality === 'high' ? 'low' : 'high' })),
        button('Tamam', 'play', () => {
          panel.classList.add('k-hidden')
          opened(false)
        }, 'kbtn-blue'),
      )
      panel.replaceChildren(c)
    }
    gear.addEventListener('click', (e) => {
      e.stopPropagation()
      render()
      panel.classList.remove('k-hidden')
      opened(true)
    })
    gear.addEventListener('pointerdown', (e) => e.stopPropagation())
    panel.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.root.append(gear, panel)
  }
}
