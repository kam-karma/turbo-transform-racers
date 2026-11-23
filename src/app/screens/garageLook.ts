/**
 * Garage "Görünüm" tab: category chips, the mod of the day, item tiles with a live preview on
 * the turntable car, buy with gold or unlock with 1-3 videos (progress saved), equip.
 */
import { MOD_CATEGORIES, MOD_CATEGORY_NAMES, carById, modById, type ModCategory, type ModDef } from '../../meta/catalog'
import { claimDailyMod, dailyModOffer, dayKey } from '../../meta/daily'
import { buyMod, equipMod, equippedMods, watchModVideo } from '../../meta/shop'
import { formatGold } from '../../ui/format'
import { icon } from '../../ui/icon'
import { lookOf } from '../carLook'
import { btn, el, priceTag } from '../dom'
import type { Ctx } from '../screen'
import { modItems, type ModItemVM } from '../viewModels'

const CAT_ICON: Readonly<Record<ModCategory, string>> = { paint: 'paint', wheels: 'wheel', spoiler: 'spoiler', neon: 'neon', decal: 'star', trail: 'trail', horn: 'horn' }

const hex = (n: number | string | undefined, fb = '#ffffff'): string => (typeof n === 'number' && n > 0 ? `#${n.toString(16).padStart(6, '0')}` : fb)

/** The coloured preview inside a tile. */
export function swatch(mod: ModDef, carHue: number): HTMLElement {
  const s = el('div', `sw sw-${mod.category}`)
  const v = mod.value
  if (mod.category === 'paint') {
    s.style.background = v.finish === 'rainbow'
      ? 'conic-gradient(#ff5f6d, #ffc371, #f9f871, #6dff8f, #4fc3ff, #a46bff, #ff5f6d)'
      : v.finish === 'factory' ? `hsl(${carHue} 90% 55%)` : `radial-gradient(circle at 35% 30%, #fff8, transparent 45%), ${hex(v.color)}`
    if (v.finish === 'metal' || v.finish === 'chrome' || v.finish === 'pearl') s.classList.add('shiny')
    return s
  }
  const tint = hex(mod.category === 'wheels' ? v.rim : v.color, '#ffffff')
  s.style.setProperty('--sw', tint)
  s.append(icon(CAT_ICON[mod.category]))
  return s
}

export function lookTab(ctx: Ctx, content: HTMLElement, bar: HTMLElement, gift?: string): void {
  let cat: ModCategory = gift !== undefined ? modById(gift)?.category ?? 'paint' : 'paint'
  let selected: string | null = gift ?? null

  const preview = async (mod: ModDef | null): Promise<void> => {
    const save = ctx.save()
    const car = carById(save.car)
    const handle = await ctx.showCar()
    if (car === undefined || handle === null) return
    const mods = { ...equippedMods(save, car.id), ...(mod === null ? {} : { [mod.category]: mod }) }
    handle.set(lookOf(car, mods, true))
  }

  const render = (): void => {
    const save = ctx.save()
    const car = carById(save.car)!
    const chips = el('div', 'cat-chips')
    for (const c of MOD_CATEGORIES) {
      const b = el('button', `cat-chip${c === cat ? ' on' : ''}`)
      b.type = 'button'
      b.title = MOD_CATEGORY_NAMES[c]
      b.append(icon(CAT_ICON[c]), el('span', '', MOD_CATEGORY_NAMES[c]))
      b.addEventListener('click', () => {
        ctx.sound('click')
        cat = c
        selected = null
        void preview(null)
        render()
      })
      chips.append(b)
    }
    const items = modItems(save, car.id, cat)
    const sel = items.find((i) => i.mod.id === selected) ?? items.find((i) => i.equipped) ?? items[0]
    const grid = el('div', 'mod-grid')
    items.forEach((it, i) => grid.append(tile(it, i, it === sel, car.hue)))
    const parts: HTMLElement[] = [chips]
    const daily = dailyBanner()
    if (daily !== null) parts.push(daily)
    parts.push(grid)
    content.replaceChildren(...parts)
    bar.replaceChildren(...actions(sel))
  }

  const tile = (it: ModItemVM, i: number, isSel: boolean, hue: number): HTMLElement => {
    const t = el('button', `mod-tile k-pop${isSel ? ' sel' : ''}${it.equipped ? ' on' : ''}${it.owned ? ' owned' : ''}`)
    t.type = 'button'
    t.style.setProperty('--d', `${i * 0.02}s`)
    t.append(swatch(it.mod, hue), el('div', 'mt-name', it.mod.name))
    if (it.equipped) t.append(el('div', 'mt-tag on', 'TAKILI'))
    else if (it.owned) t.append(el('div', 'mt-tag', 'SENİN'))
    else {
      const foot = el('div', 'mt-foot')
      foot.append(priceTag(it.mod.price, it.canAfford))
      if (it.mod.videos > 0) {
        const v = el('span', 'mt-vid')
        v.append(icon('video'), el('span', '', `${it.videos}/${it.mod.videos}`))
        foot.append(v)
      }
      t.append(foot)
    }
    t.addEventListener('click', () => {
      ctx.sound('click')
      selected = it.mod.id
      if (it.mod.category === 'horn') ctx.deps.horn?.(String(it.mod.value.sound), Number(it.mod.value.pitch ?? 1))
      void preview(it.mod).then(() => ctx.showroom.pose())
      render()
    })
    return t
  }

  const equip = (mod: ModDef): void => {
    const r = equipMod(ctx.save(), ctx.save().car, mod.id)
    if (!r.ok) return
    ctx.update(() => r.save)
    ctx.sound('buy')
    ctx.showroom.pose()
    render()
  }

  const actions = (it: ModItemVM): HTMLElement[] => {
    const mod = it.mod
    if (it.equipped) return [el('div', 'g-note', `${mod.name} takılı`)]
    if (it.owned) return [btn('Tak', () => equip(mod), { icon: 'play' })]
    const buy = btn('Satın al', () => {
      const r = buyMod(ctx.save(), ctx.save().car, mod.id)
      if (!r.ok) {
        ctx.sound('error')
        ctx.toast(`${formatGold(mod.price - ctx.save().gold)} altın eksik`, 'coin')
        return
      }
      ctx.update(() => r.save)
      ctx.toast(`${mod.name} açıldı!`, CAT_ICON[mod.category])
      equip(mod)
    }, { className: it.canAfford ? '' : 'off' })
    buy.append(priceTag(mod.price, true))
    const out: HTMLElement[] = [buy]
    if (mod.videos > 0 && ctx.deps.ads.canReward()) {
      out.push(btn('Video izle', async () => {
        if (!(await ctx.rewarded('mod'))) {
          ctx.toast('Video tamamlanmadı', 'video')
          return
        }
        const r = watchModVideo(ctx.save(), ctx.save().car, mod.id)
        if (!r.ok) return
        ctx.update(() => r.save)
        if (r.unlocked) {
          ctx.sound('unlock')
          ctx.toast(`${mod.name} açıldı!`, CAT_ICON[mod.category])
          equip(mod)
        } else {
          ctx.sound('reward')
          ctx.toast(`${r.progress}/${mod.videos} video`, 'video')
          render()
        }
      }, { color: 'video', sub: `${it.videos}/${mod.videos}` }))
    }
    return out
  }

  const dailyBanner = (): HTMLElement | null => {
    const day = dayKey(new Date(ctx.now()))
    const id = dailyModOffer(ctx.save(), day)
    const mod = id === null ? undefined : modById(id)
    if (mod === undefined || !ctx.deps.ads.canReward()) return null
    const b = el('div', 'daily-mod k-rise')
    const txt = el('div', 'dm-txt')
    txt.append(el('b', '', 'Günün modifiyesi'), el('span', '', `${mod.name} · ${MOD_CATEGORY_NAMES[mod.category]}`))
    b.append(swatch(mod, carById(ctx.save().car)?.hue ?? 48), txt, btn('Bedava', async () => {
      if (!(await ctx.rewarded('daily-mod'))) return
      const r = claimDailyMod(ctx.save(), day)
      if (!r.ok) return
      ctx.update(() => r.save)
      ctx.sound('unlock')
      ctx.toast(`${mod.name} hediye!`, 'gift')
      cat = mod.category
      selected = mod.id
      equip(mod)
    }, { color: 'video', size: 'sm' }))
    return b
  }

  if (selected !== null) void preview(null)
  render()
}
