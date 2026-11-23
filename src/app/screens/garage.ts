/**
 * Garage: the car on the turntable (drag to spin), name plate + stat bars, and a panel with
 * tabs Arabalar (12 cars: preview, buy, select, locked prize cars + one-race trial video),
 * Performans (engine / nitro / handling, 5 levels, gold only) and Görünüm (garageLook.ts).
 */
import { carById, effectiveStats, type CarStats } from '../../meta/catalog'
import { canTryCar, dayKey } from '../../meta/daily'
import { buyCar, buyPerf, equipMod, selectCar } from '../../meta/shop'
import { formatGold } from '../../ui/format'
import { icon } from '../../ui/icon'
import { btn, el, pill, priceTag, setPill } from '../dom'
import type { Ctx, Screen } from '../screen'
import { carCards, perfRows, playButton, statFill } from '../viewModels'
import { lookTab } from './garageLook'

type Tab = 'cars' | 'perf' | 'look'
const TABS: readonly [Tab, string, string][] = [['cars', 'Arabalar', 'garage'], ['perf', 'Performans', 'upgrade-engine'], ['look', 'Görünüm', 'paint']]
const PERF_ICON = { engine: 'upgrade-engine', nitro: 'upgrade-nitro', handling: 'upgrade-handling' } as const
const STAT_ROWS: readonly [keyof CarStats, string][] = [['speed', 'Hız'], ['accel', 'İvme'], ['handling', 'Yol Tutuş']]

/** The hero car icon re-tinted to a car's hue (the icon is yellow, hue ≈ 48°). */
/** Cars with their own artwork (public/ui/cars/<id>.png, from tools/icons/car_thumbs.py). */
const CAR_THUMBS: ReadonlySet<string> = new Set(['kivilcim', 'kumbocegi', 'pitircik', 'roket', 'tosbik', 'nane', 'firtina', 'cakal', 'buzul', 'simsek', 'magma'])

export function carIcon(hue: number, carId = ''): HTMLElement {
  if (CAR_THUMBS.has(carId)) {
    const img = document.createElement('img')
    img.className = 'car-ic car-thumb'
    img.src = `./ui/cars/${carId}.png`
    img.alt = ''
    img.draggable = false
    return img
  }
  const i = icon('form-car', 'car-ic')
  i.style.filter = `hue-rotate(${Math.round(hue - 48)}deg) saturate(1.1)`
  return i
}

export function garageScreen(ctx: Ctx, tabIn: Tab, gift?: string): Screen {
  const root = el('div', 'scr-garage')
  let tab: Tab = tabIn
  let viewCar = ctx.save().car

  const top = el('div', 'topbar')
  const left = el('div', 'tb-left')
  const title = el('div', 'kribbon k-drop')
  title.append(icon('garage'), el('span', 'lbl', 'Garaj'))
  left.append(btn('', () => back(), { color: 'white', round: true, icon: 'back', title: 'Geri' }), title)
  const gold = pill('coin', ctx.save().gold)
  const right = el('div', 'tb-right')
  right.append(gold)
  top.append(left, right)

  const plate = el('div', 'car-plate k-rise')
  const panel = el('div', 'kpanel garage-panel k-rise')
  panel.style.setProperty('--d', '.1s')
  const tabsEl = el('div', 'g-tabs')
  const content = el('div', 'g-content')
  const bar = el('div', 'g-bar')
  panel.append(tabsEl, content, bar)
  const spin = el('div', 'spin-zone')
  spin.setAttribute('data-ui-hit', '')
  root.append(spin, top, plate, panel)

  // drag to spin the turntable
  let dragX: number | null = null
  spin.addEventListener('pointerdown', (e) => {
    dragX = e.clientX
    spin.setPointerCapture(e.pointerId)
  })
  spin.addEventListener('pointermove', (e) => {
    if (dragX === null) return
    ctx.showroom.drag(e.clientX - dragX)
    dragX = e.clientX
  })
  spin.addEventListener('pointerup', () => (dragX = null))

  const renderPlate = (stats: CarStats, preview?: CarStats): void => {
    const car = carById(viewCar)!
    const bars = el('div', 'stat-bars')
    for (const [k, label] of STAT_ROWS) {
      const row = el('div', 'stat')
      const b = el('div', 'stat-bar')
      const f = el('i')
      f.style.width = `${statFill(stats[k]) * 100}%`
      if (preview !== undefined && preview[k] > stats[k]) {
        const g = el('b')
        g.style.width = `${statFill(preview[k]) * 100}%`
        b.append(g)
      }
      b.append(f)
      row.append(el('span', 'stat-l', label), b, el('span', 'stat-v', stats[k].toFixed(1).replace('.0', '')))
      bars.append(row)
    }
    plate.replaceChildren(el('div', 'cp-name k-out', car.name), el('div', 'cp-char', car.character), bars)
  }

  const show = async (carId: string): Promise<void> => {
    viewCar = carId
    await ctx.showCar(carId)
    ctx.showroom.pose()
  }

  const renderTabs = (): void => {
    tabsEl.replaceChildren(...TABS.map(([id, label, ic]) => {
      const b = el('button', `g-tab${id === tab ? ' on' : ''}`)
      b.type = 'button'
      b.append(icon(ic), el('span', '', label))
      b.addEventListener('click', () => {
        if (id === tab) return
        ctx.sound('click')
        tab = id
        if (id !== 'cars') viewCar = ctx.save().car
        void ctx.showCar(viewCar)
        render()
      })
      return b
    }))
  }

  const carsTab = (): void => {
    const grid = el('div', 'car-grid')
    const cards = carCards(ctx.save())
    cards.forEach((c, i) => {
      const card = el('button', `car-card k-pop${c.car.id === viewCar ? ' sel' : ''}${c.owned ? ' owned' : ''}${c.lockText !== null ? ' prize' : ''}`)
      card.type = 'button'
      card.style.setProperty('--d', `${i * 0.025}s`)
      card.style.setProperty('--hue', String(c.car.hue))
      const badge = c.selected ? el('div', 'cc-badge on', 'SÜRÜYORSUN') : c.owned ? null : c.lockText !== null ? el('div', 'cc-badge lock') : null
      if (badge !== null && c.lockText !== null && !c.owned) badge.append(icon('lock'))
      card.append(carIcon(c.car.hue, c.car.id), el('div', 'cc-name', c.car.name))
      if (!c.owned && c.lockText === null) card.append(priceTag(c.car.price, c.canAfford))
      if (badge !== null) card.append(badge)
      card.addEventListener('click', () => {
        ctx.sound('click')
        void show(c.car.id).then(render)
        render()
      })
      grid.append(card)
    })
    content.replaceChildren(grid)
    const sel = cards.find((c) => c.car.id === viewCar)!
    renderPlate(sel.stats)
    const actions: HTMLElement[] = []
    if (sel.selected) actions.push(el('div', 'g-note', 'Bu arabayla yarışıyorsun'))
    else if (sel.owned) actions.push(btn('Seç', () => {
      ctx.update((s) => selectCar(s, sel.car.id).save)
      ctx.sound('buy')
      ctx.toast(`${sel.car.name} seçildi!`, 'garage')
      render()
    }, { icon: 'play' }))
    else if (sel.lockText !== null) {
      const note = el('div', 'g-note lock')
      note.append(icon('lock'), el('span', '', sel.lockText))
      actions.push(note)
      if (canTryCar(ctx.save(), dayKey(new Date(ctx.now()))) && ctx.deps.ads.canReward()) actions.push(trialBtn(sel.car.id))
    } else {
      const buy = btn('Satın al', () => {
        const r = buyCar(ctx.save(), sel.car.id)
        if (!r.ok) {
          ctx.sound('error')
          ctx.toast(`${formatGold(sel.car.price - ctx.save().gold)} altın eksik`, 'coin')
          return
        }
        ctx.update(() => selectCar(r.save, sel.car.id).save)
        ctx.sound('unlock')
        ctx.showroom.pose()
        ctx.toast(`${sel.car.name} artık senin!`, 'garage')
        render()
      }, { className: sel.canAfford ? '' : 'off' })
      buy.append(priceTag(sel.car.price, true))
      actions.push(buy)
      if (canTryCar(ctx.save(), dayKey(new Date(ctx.now()))) && ctx.deps.ads.canReward()) actions.push(trialBtn(sel.car.id))
    }
    bar.replaceChildren(...actions)
  }

  const trialBtn = (carId: string): HTMLElement =>
    btn('Tek yarış dene', async () => {
      if (!(await ctx.rewarded('car-trial'))) return
      const race = playButton(ctx.save()).race
      if (race !== null) ctx.go({ name: 'race', raceId: race.id, trialCar: carId })
    }, { color: 'video', size: 'sm' })

  const perfTab = (): void => {
    const save = ctx.save()
    const car = carById(save.car)!
    const rows = perfRows(save, car.id)
    const list = el('div', 'perf-list')
    rows.forEach((r, i) => {
      const row = el('div', 'perf-row k-rise')
      row.style.setProperty('--d', `${i * 0.06}s`)
      const pips = el('div', 'pips')
      for (let k = 0; k < r.max; k++) pips.append(el('i', k < r.level ? 'on' : ''))
      const info = el('div', 'perf-info')
      info.append(el('div', 'perf-name', r.name), pips)
      const action = r.price === null
        ? el('div', 'perf-max', 'MAKS')
        : btn('', () => {
          const res = buyPerf(ctx.save(), car.id, r.perf)
          if (!res.ok) {
            ctx.sound('error')
            ctx.toast(`${formatGold((r.price ?? 0) - ctx.save().gold)} altın eksik`, 'coin')
            return
          }
          ctx.update(() => res.save)
          ctx.sound('buy')
          ctx.showroom.pose()
          ctx.toast(`${r.name} seviye ${r.level + 1}!`, PERF_ICON[r.perf])
          render()
        }, { size: 'sm', color: 'blue', className: r.canAfford ? '' : 'off' })
      if (r.price !== null) action.append(priceTag(r.price, true))
      row.append(icon(PERF_ICON[r.perf], 'perf-ic'), info, action)
      list.append(row)
    })
    content.replaceChildren(list, el('div', 'g-note small', 'Performans yalnızca altınla yükselir. Yarışlarda altın kazan!'))
    bar.replaceChildren()
    const base = effectiveStats(car, save.perf[car.id] ?? {})
    const next = effectiveStats(car, Object.fromEntries(rows.map((r) => [r.perf, Math.min(r.max, r.level + 1)])))
    renderPlate(base, next)
  }

  const render = (): void => {
    renderTabs()
    setPill(gold, ctx.save().gold)
    if (tab === 'cars') carsTab()
    else if (tab === 'perf') perfTab()
    else {
      viewCar = ctx.save().car
      lookTab(ctx, content, bar, gift)
      const car = carById(viewCar)!
      renderPlate(effectiveStats(car, ctx.save().perf[car.id] ?? {}))
    }
  }

  const back = (): boolean => {
    ctx.sound('back')
    ctx.go(gift !== undefined ? { name: 'cupMap', world: 'adalar' } : { name: 'home' })
    return true
  }

  if (gift !== undefined) {
    ctx.update((s) => equipMod(s, s.car, gift).save)
    window.setTimeout(() => ctx.toast('Hediye spoiler arabana takıldı!', 'gift'), 500)
  }
  void show(viewCar)
  render()
  const unsub = ctx.deps.save.subscribe((s) => setPill(gold, s.gold))
  return { el: root, showroom: 'garage', back, dispose: unsub }
}
