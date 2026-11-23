/**
 * The app shell: loading → home → cup map → race (intro card, HUD, pause) → results → back,
 * plus garage, settings, daily chest and daily tasks. Screens are plain DOM over the canvas;
 * menus render the 3D showroom, races render the mode's scene.
 *
 * Wiring (main.ts):
 *   const app = new App({ root, renderer, camera, render, save, ads, input, touch, settings,
 *                         createRace, loadCar, preload, onSettings, sound, horn, music })
 *   app.start()
 */
import '../ui/ui.css'
import './app.css'
import './home.css'
import './map.css'
import './race.css'
import './results.css'
import './garage.css'
import { STARTER_CAR, carById, type CarDef, type ModDef } from '../meta/catalog'
import { cupById, type WorldId } from '../meta/cups'
import type { SaveData } from '../meta/save'
import { dayKey, ensureDaily } from '../meta/daily'
import { equippedMods } from '../meta/shop'
import { createRaceHud, type RaceHudExt } from '../ui/hudRace'
import { el } from '../ui/hudDom'
import { icon, preloadIcons } from '../ui/icon'
import { saveSettings, type Settings } from '../ui/settings'
import type { AppDeps, RewardReason, UiSound } from './appTypes'
import { applyCarLook, lookOf, type CarLook, type CarLookHandle } from './carLook'
import { openChestModal, openSettingsModal, openTasksModal } from './modals'
import { RaceFlow } from './raceFlow'
import type { Ctx, Route, Screen } from './screen'
import { cupMapScreen } from './screens/cupMap'
import { garageScreen } from './screens/garage'
import { homeScreen } from './screens/home'
import { loadingScreen } from './screens/loading'
import { Showroom } from './showroom'
import { playButton } from './viewModels'

const ICONS = ['coin', 'star', 'star-empty', 'gear', 'pause', 'play', 'garage', 'lock', 'video', 'chest', 'boss', 'flag', 'home', 'back', 'trophy', 'trophy-gold', 'trophy-silver', 'trophy-bronze', 'gift', 'timer', 'map', 'form-car', 'form-boat', 'form-glider', 'form-climber', 'cup-donusum', 'cup-kurgu', 'cup-kaos']

export class App {
  readonly hud: RaceHudExt
  readonly showroom: Showroom
  private readonly d: AppDeps
  private readonly layer = el('div', 'app-screens')
  private readonly modalLayer = el('div', 'app-modals')
  private readonly toastLayer = el('div', 'app-toasts')
  private readonly rotate = el('div', 'app-rotate k-hidden')
  private screen: Screen | null = null
  private settingsNow: Settings
  private readonly race: RaceFlow
  private carHandle: CarLookHandle | null = null
  private carShown = ''
  private carToken = 0
  private last = 0
  private t = 0
  private started = false
  readonly ctx: Ctx

  constructor(deps: AppDeps) {
    this.d = deps
    this.settingsNow = deps.settings
    document.body.classList.toggle('touch', deps.touch)
    const hudRoot = el('div', 'app-hud')
    deps.root.append(hudRoot, this.layer, this.modalLayer, this.toastLayer, this.rotate)
    this.hud = createRaceHud(hudRoot)
    this.showroom = new Showroom(deps.renderer)
    this.buildRotate()
    const app = this
    this.ctx = {
      deps,
      touch: deps.touch,
      save: () => deps.save.get(),
      update: (fn) => deps.save.update(fn),
      go: (r) => this.go(r),
      toast: (text, name) => this.toast(text, name),
      modal: (content, opts) => this.modal(content, opts),
      sound: (cue) => this.sound(cue),
      get showroom() {
        return app.showroom
      },
      showCar: (id) => this.showCar(id),
      settings: () => this.settingsNow,
      openSettings: () => openSettingsModal(this.ctx, (s) => this.applySettings(s)),
      openChest: () => openChestModal(this.ctx),
      openTasks: () => openTasksModal(this.ctx),
      now: () => (deps.now ?? Date.now)(),
      rewarded: (reason) => this.rewarded(reason),
    }
    this.race = new RaceFlow(this.ctx, this.hud, (s) => this.setScreen(s))
    deps.input.onKey('Escape', () => this.escape())
    deps.input.onKey('KeyP', () => this.race.togglePause())
    document.addEventListener('visibilitychange', () => this.race.autoPause(this.forcedPause()))
    window.matchMedia('(orientation: portrait)').addEventListener('change', () => this.refreshRotate())
    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  /** Loading screen, then the first race (new players, spec §6) or the home page. Starts the loop. */
  start(): void {
    if (this.started) return
    this.started = true
    const loading = loadingScreen()
    this.setScreen(loading)
    this.refreshRotate()
    this.d.renderer.setAnimationLoop((now: number) => {
      const dt = this.last === 0 ? 0 : Math.min(0.1, (now - this.last) / 1000)
      this.last = now
      this.tick(dt)
    })
    const steps: Promise<unknown>[] = [
      preloadIcons(ICONS).then(() => loading.set(0.15)),
      document.fonts?.load('900 20px Kupa').catch(() => undefined) ?? Promise.resolve(),
    ]
    if (this.d.preload !== undefined) steps.push(this.d.preload((f) => loading.set(0.15 + f * 0.8)))
    Promise.all(steps)
      .catch((error: unknown) => console.error('Preload failed, starting anyway:', error))
      .then(async () => {
        loading.set(1)
        this.ctx.update((s) => ensureDaily(s, dayKey(new Date(this.ctx.now()))))
        await this.showCar()
        const save = this.d.save.get()
        const first = save.firstRun ? playButton(save).race : null
        this.go(first === null ? { name: 'home' } : { name: 'race', raceId: first.id })
      })
      .catch((error: unknown) => console.error('Start failed:', error))
  }

  /** One frame: menus render the showroom, races the mode scene. Exposed for dev hooks. */
  tick(dt: number): void {
    this.t += dt
    if (this.race.active) {
      this.race.frame(dt)
      return
    }
    this.screen?.frame?.(dt)
    if (this.screen !== null && this.screen.showroom !== null) {
      this.showroom.setView(this.screen.showroom)
      this.showroom.frame(dt)
      this.carHandle?.update(this.t)
      this.d.renderer.render(this.showroom.scene, this.showroom.camera)
    }
  }

  go(route: Route): void {
    this.closeModals()
    if (route.name !== 'race' && this.race.active) this.race.dispose()
    switch (route.name) {
      case 'home':
        this.d.music?.('menu')
        this.setScreen(homeScreen(this.ctx))
        break
      case 'cupMap':
        this.d.music?.('menu')
        this.setScreen(cupMapScreen(this.ctx, route.world, route.tier))
        break
      case 'garage':
        this.d.music?.('menu')
        this.setScreen(garageScreen(this.ctx, route.tab ?? 'cars', route.gift))
        break
      case 'race':
        void this.race.play(route.raceId, route.trialCar)
        break
    }
  }

  private setScreen(next: Screen): void {
    const prev = this.screen
    this.screen = next
    next.el.classList.add('screen', 'enter')
    this.layer.append(next.el)
    window.setTimeout(() => next.el.classList.remove('enter'), 450)
    if (prev !== null && prev !== next) {
      prev.dispose?.()
      prev.el.classList.add('leave')
      prev.el.style.pointerEvents = 'none'
      window.setTimeout(() => prev.el.remove(), 260)
    }
    if (next.showroom !== null) {
      this.showroom.setView(next.showroom)
      const save = this.d.save.get()
      const world = this.race.lastWorld ?? playButtonWorld(save)
      this.showroom.setWorld(world)
    }
  }

  private escape(): void {
    if (this.modalLayer.childElementCount > 0) {
      ;(this.modalLayer.lastElementChild as HTMLElement & { close?: () => void }).close?.()
      return
    }
    if (this.race.active) {
      this.race.togglePause()
      return
    }
    if (this.screen?.back?.() === true) return
  }

  private async showCar(carId?: string): Promise<CarLookHandle | null> {
    const save = this.d.save.get()
    const id = carId ?? save.car
    const car = carById(id)
    if (car === undefined) return null
    if (id === this.carShown && this.carHandle !== null) {
      this.carHandle.set(lookOf(car, equippedMods(save, id), true))
      return this.carHandle
    }
    const token = ++this.carToken
    let model = await this.d.loadCar(car).catch(() => null)
    const hero = carById(STARTER_CAR)
    let stand: CarDef | null = null
    if (model === null && hero !== undefined && car.id !== hero.id) {
      // Model not delivered yet: the hero model painted in this car's colour.
      model = await this.d.loadCar(hero).catch(() => null)
      stand = car
    }
    if (token !== this.carToken) return this.carHandle
    this.carHandle?.dispose()
    this.carHandle = null
    if (model !== null) {
      const inner = applyCarLook(model, standIn(lookOf(car, equippedMods(save, id), true), stand, hero))
      this.carHandle = { set: (look) => inner.set(standIn(look, stand, hero)), update: (t) => inner.update(t), dispose: () => inner.dispose() }
    }
    this.showroom.setCar(model)
    this.carShown = id
    return this.carHandle
  }

  private toast(text: string, name?: string): void {
    const t = el('div', 'toast')
    if (name !== undefined) t.append(icon(name))
    t.append(el('span', '', text))
    this.toastLayer.append(t)
    window.setTimeout(() => t.classList.add('out'), 2600)
    window.setTimeout(() => t.remove(), 3000)
  }

  private modal(content: HTMLElement, opts: { onClose?: () => void; dismissable?: boolean } = {}): () => void {
    const wrap = el('div', 'modal') as HTMLElement & { close?: () => void }
    const card = el('div', 'modal-card')
    card.append(content)
    wrap.append(card)
    let closed = false
    const close = (): void => {
      if (closed) return
      closed = true
      wrap.classList.add('out')
      window.setTimeout(() => wrap.remove(), 220)
      opts.onClose?.()
      if (this.modalLayer.childElementCount <= 1) this.race.autoPause(this.forcedPause())
    }
    wrap.close = close
    if (opts.dismissable !== false) {
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) close()
      })
    }
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation())
    this.modalLayer.append(wrap)
    this.race.autoPause(true)
    return close
  }

  private closeModals(): void {
    for (const m of [...this.modalLayer.children]) (m as HTMLElement & { close?: () => void }).close?.()
  }

  private sound(cue: UiSound): void {
    try {
      this.d.sound?.(cue)
    } catch (error) {
      console.error('UI sound failed:', error)
    }
  }

  private async rewarded(reason: RewardReason): Promise<boolean> {
    try {
      return await this.d.ads.rewarded(reason)
    } catch (error) {
      console.error('Rewarded video failed:', error)
      return false
    }
  }

  /** Settings changed by the menu or by the game itself (automatic quality drop). */
  applySettings(s: Settings): void {
    const prev = this.settingsNow
    this.settingsNow = s
    saveSettings(s)
    this.d.onSettings?.(s, prev)
  }

  private forcedPause(): boolean {
    return document.hidden || this.modalLayer.childElementCount > 0 || (this.d.touch && window.matchMedia('(orientation: portrait)').matches)
  }

  private buildRotate(): void {
    const phone = el('div', 'phone')
    phone.append(el('i'))
    this.rotate.append(phone, el('div', 'k-out', 'Telefonunu yan çevir!'), el('div', 'sub', 'Yarış yatay ekranda çok daha güzel.'))
  }

  private refreshRotate(): void {
    const portrait = this.d.touch && window.matchMedia('(orientation: portrait)').matches
    this.rotate.classList.toggle('k-hidden', !portrait)
    this.race.autoPause(this.forcedPause())
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.showroom.resize(w, h)
    this.d.camera.aspect = w / Math.max(1, h)
    this.d.camera.updateProjectionMatrix()
    document.documentElement.style.setProperty('--ui-scale', String(Math.max(0.62, Math.min(1.15, Math.min(w / 1280, h / 720)))))
  }
}

function playButtonWorld(save: SaveData): WorldId {
  const r = playButton(save).race
  return (r === null ? undefined : cupById(r.cup)?.world) ?? 'adalar'
}

/** A stand-in look: the hero model wearing `car`'s colour (unless a paint is chosen). */
function standIn(look: CarLook, stand: CarDef | null, hero: CarDef | undefined): CarLook {
  if (stand === null || hero === undefined) return look
  const paint = look.mods.paint
  const factory = paint === undefined || paint.value.finish === 'factory'
  const tint: ModDef = { id: 'paint-standin', category: 'paint', name: '', price: 0, videos: 0, accountWide: false, value: { finish: 'gloss', hue: stand.hue, color: 0xffffff, sat: 1.05, light: 1 } }
  return { ...look, car: hero, mods: { ...look.mods, paint: factory ? tint : paint } }
}

export type { AppDeps, RaceKit } from './appTypes'
