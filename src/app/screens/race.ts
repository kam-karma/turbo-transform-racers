/** Race-side screens: the build loading card, the intro card over the live scene, the in-race overlay. */
import { WORLD_INFO, VARIANT_NAMES, type CupDef, type CupMode, type RaceDef } from '../../meta/cups'
import { formatTime } from '../../ui/format'
import { icon } from '../../ui/icon'
import { btn, el, logo, starRow } from '../dom'
import type { Ctx, Screen } from '../screen'
import { worldTheme } from '../theme'

export function raceLoadingScreen(ctx: Ctx, race: RaceDef, cup: CupDef): Screen {
  const theme = worldTheme(cup.world)
  const root = el('div', `scr-raceload world-${cup.world}`)
  const bg = el('div', 'map-bg')
  bg.style.backgroundImage = `url(./ui/worlds/${cup.world}.jpg), linear-gradient(160deg, ${theme.sky.join(', ')})`
  const card = el('div', 'rl-card k-pop')
  const spin = el('div', 'rl-spin')
  spin.append(icon('wheel'))
  card.append(icon(theme.cupIcon, 'rl-cup'), el('div', 'rl-cupname k-out-thin', cup.name), el('div', 'rl-race k-out', race.boss ? WORLD_INFO[cup.world].bossName : race.name), spin, el('div', 'rl-txt k-out-thin', 'Pist hazırlanıyor…'))
  root.append(bg, el('div', 'map-veil'), card)
  void ctx
  return { el: root, showroom: null }
}

export interface IntroHandlers {
  start(rocket: boolean): void
  back(): void
  /** The race's own star goals (mode.goals); generic ones when the mode gives none. */
  readonly goals?: readonly string[]
}

const STAR_GOALS = ['Birinci bitir', 'Gizli hedefi bul', 'Pist görevini yap'] as const

function keyCap(k: string): HTMLElement {
  return el('b', 'kcap', k)
}

/** The mode's own control: forms (Dönüşüm), parts picked up on the road (Kurgu), Şok (Kaos). */
const MODE_TOUCH: Readonly<Record<CupMode, [Parameters<typeof icon>[0], string]>> = {
  transform: ['form-boat', 'Sağdaki tuşlar: dönüş!'],
  build: ['part-wing', 'Parçaları yolda topla!'],
  chaos: ['shock', 'Sağdaki tuş: ŞOK!'],
}

function controlsHint(touch: boolean, mode: CupMode = 'transform'): HTMLElement {
  const box = el('div', 'ctl-hint')
  if (touch) {
    const l = el('div', 'ctl-side left')
    l.append(el('div', 'ctl-hand'), el('span', '', 'Sola bas: gaz'), el('small', '', 'parmağını kaydır: direksiyon'))
    const r = el('div', 'ctl-side right')
    const [ic, text] = MODE_TOUCH[mode]
    r.append(icon(ic), el('span', '', text))
    box.append(l, r)
    return box
  }
  const last: [HTMLElement[], string] =
    mode === 'chaos' ? [[keyCap('BOŞLUK')], 'şok dalgası']
      : mode === 'build' ? [[icon('part-wing')], 'parçaları yolda topla']
        : [[keyCap('1'), keyCap('2'), keyCap('3'), keyCap('4')], 'dönüşüm']
  const rows: [HTMLElement[], string][] = [
    [[keyCap('W')], 'gaz'],
    [[keyCap('A'), keyCap('D')], 'direksiyon'],
    [[keyCap('S')], 'fren'],
    last,
  ]
  for (const [caps, label] of rows) {
    const r = el('div', 'ctl-row')
    r.append(...caps, el('span', '', label))
    box.append(r)
  }
  return box
}

export function raceIntroScreen(ctx: Ctx, race: RaceDef, cup: CupDef, firstRun: boolean, h: IntroHandlers): Screen {
  const root = el('div', `scr-intro${firstRun ? ' first' : ''}`)
  let started = false
  const go = (rocket: boolean): void => {
    if (started) return
    started = true
    window.removeEventListener('keydown', onKey)
    ctx.sound('whoosh')
    h.start(rocket)
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.code === 'Escape') return
    if (firstRun || e.code === 'Enter' || e.code === 'Space') go(false)
  }
  window.addEventListener('keydown', onKey)

  if (firstRun) {
    const tap = el('div', 'first-tap')
    tap.append(el('div', 'k-out big', ctx.touch ? 'Başlamak için dokun' : 'Başlamak için bir tuşa bas'), controlsHint(ctx.touch))
    root.append(logo('logo first-logo k-drop'), tap)
    root.addEventListener('pointerdown', () => go(false))
    return { el: root, showroom: null, dispose: () => window.removeEventListener('keydown', onKey) }
  }

  const theme = worldTheme(cup.world)
  const card = el('div', 'kpanel intro-card k-rise')
  const head = el('div', 'ic-head')
  head.append(icon(race.boss ? 'boss' : theme.cupIcon), el('div', 'ic-cup', cup.name))
  const name = el('div', 'ic-name', race.boss ? WORLD_INFO[cup.world].bossName : race.name.replace(/ \(.*\)$/, ''))
  const facts = el('div', 'mc-facts')
  facts.append(el('span', 'chip-s', race.boss ? 'Boss Yarışı' : `Yarış ${race.index + 1}/5`))
  const v = VARIANT_NAMES[race.variant]
  if (v !== '') facts.append(el('span', 'chip-s alt', v))
  const best = ctx.save().bestTimes[race.id]
  const bt = el('span', 'chip-s')
  bt.append(icon('timer'), el('span', '', best === undefined ? '—' : formatTime(best)))
  facts.append(bt)
  const goals = el('div', 'ic-goals')
  const got = ctx.save().stars[race.id] ?? [false, false, false]
  if (race.boss) goals.append(el('div', 'ic-goal', `${WORLD_INFO[cup.world].bossName} seni yakalamadan bitişe ulaş!`))
  ;(h.goals ?? (race.boss ? null : STAR_GOALS))?.forEach((g, i) => {
    const row = el('div', `ic-goal${got[i] ? ' got' : ''}`)
    row.append(starRow([got[i]], 'ic-star'), el('span', '', g))
    goals.append(row)
  })
  const actions = el('div', 'ic-actions')
  let rocket = false
  const rocketBtn = btn('Roketle başla', async () => {
    if (rocket) return
    const ok = await ctx.rewarded('rocket-start')
    if (!ok) return
    rocket = true
    rocketBtn.classList.add('off')
    rocketBtn.disabled = true
    ctx.toast('Roket hazır: ilk 3 saniye turbo!', 'part-rocket')
  }, { color: 'video', icon: 'part-rocket', size: 'sm' })
  actions.append(btn('Başla', () => go(rocket), { size: 'xl', icon: 'play', className: 'k-shine' }), rocketBtn)
  card.append(head, name, facts, goals, actions)
  const backBtn = btn('', () => h.back(), { color: 'white', round: true, icon: 'back', className: 'intro-back', title: 'Geri' })
  root.append(backBtn, card, controlsHint(ctx.touch, cup.mode))
  return {
    el: root,
    showroom: null,
    back: () => {
      h.back()
      return true
    },
    dispose: () => window.removeEventListener('keydown', onKey),
  }
}

/** Pause button, touch brake and the first-race driving hint over the HUD. */
export function raceOverlayScreen(ctx: Ctx, firstRun: boolean, pause: () => void): Screen {
  const root = el('div', 'scr-raceui')
  const p = el('button', 'icon-btn pause-btn')
  p.type = 'button'
  p.setAttribute('aria-label', 'Duraklat')
  p.append(icon('pause'))
  p.addEventListener('pointerdown', (e) => e.stopPropagation())
  p.addEventListener('click', () => {
    ctx.sound('click')
    pause()
  })
  root.append(p)
  if (ctx.touch) {
    const brake = el('div', 'brake-btn')
    brake.setAttribute('data-ui-hit', '')
    brake.append(el('span', '', 'FREN'))
    const input = ctx.deps.input
    brake.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      brake.classList.add('press')
      input.setTouchBrake(true)
    })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) brake.addEventListener(ev, () => {
      brake.classList.remove('press')
      input.setTouchBrake(false)
    })
    root.append(brake)
  }
  if (firstRun) {
    const hint = controlsHint(ctx.touch)
    hint.classList.add('fading')
    root.append(hint)
  }
  return { el: root, showroom: null }
}
