/** Modal cards: settings, pause, daily chest, daily tasks. */
import { modById } from '../meta/catalog'
import { chestState, claimTask, dayKey, ensureDaily, openChest, taskLabel } from '../meta/daily'
import { DAILY_TASK_GOLD } from '../meta/economy'
import { formatCountdown } from '../ui/format'
import { icon, setIcon } from '../ui/icon'
import type { Settings } from '../ui/settings'
import { btn, countUp, el, wait } from './dom'
import type { Ctx } from './screen'

function header(title: string, iconName: string, close?: () => void): HTMLElement {
  const h = el('div', 'modal-head')
  const r = el('div', 'kribbon')
  r.append(icon(iconName), el('span', 'lbl', title))
  h.append(r)
  if (close !== undefined) {
    const x = btn('', close, { color: 'red', round: true, className: 'modal-x', title: 'Kapat' })
    const mark = el('span', 'xmark')
    mark.innerHTML = '<svg viewBox="0 0 32 32"><path d="M8 8 24 24M24 8 8 24" stroke="#2b1460" stroke-width="11" stroke-linecap="round"/><path d="M8 8 24 24M24 8 8 24" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'
    x.append(mark)
    h.append(x)
  }
  return h
}

// --- settings -------------------------------------------------------------------------

interface ToggleRow {
  readonly label: string
  readonly icon: (s: Settings) => string
  readonly on: (s: Settings) => boolean
  readonly text: readonly [string, string]
  readonly flip: (s: Settings) => Settings
}

const ROWS: readonly ToggleRow[] = [
  { label: 'Ses', icon: (s) => (s.sound ? 'sound-on' : 'sound-off'), on: (s) => s.sound, text: ['Açık', 'Kapalı'], flip: (s) => ({ ...s, sound: !s.sound }) },
  { label: 'Otomatik gaz', icon: () => 'gas-auto', on: (s) => s.autoGas, text: ['Açık', 'Kapalı'], flip: (s) => ({ ...s, autoGas: !s.autoGas }) },
  { label: 'Form ipuçları', icon: () => 'form-boat', on: (s) => s.formHints, text: ['Açık', 'Kapalı'], flip: (s) => ({ ...s, formHints: !s.formHints }) },
  { label: 'Grafik', icon: () => 'speed', on: (s) => s.quality === 'high', text: ['Yüksek', 'Düşük'], flip: (s) => ({ ...s, quality: s.quality === 'high' ? 'low' : 'high' }) },
]

export function openSettingsModal(ctx: Ctx, apply: (s: Settings) => void): void {
  const box = el('div', 'settings')
  let close = (): void => undefined
  const list = el('div', 'set-list')
  const render = (): void => {
    const s = ctx.settings()
    list.replaceChildren(
      ...ROWS.map((r, i) => {
        const row = el('div', 'set-row k-rise')
        row.style.setProperty('--d', `${i * 0.05}s`)
        const on = r.on(s)
        const sw = el('button', `switch${on ? ' on' : ''}`)
        sw.type = 'button'
        sw.append(el('i'), el('span', '', on ? r.text[0] : r.text[1]))
        sw.addEventListener('click', () => {
          ctx.sound('click')
          apply(r.flip(ctx.settings()))
          render()
        })
        const ic = icon(r.icon(s))
        row.append(ic, el('span', 'set-label', r.label), sw)
        return row
      }),
    )
  }
  render()
  box.append(header('Ayarlar', 'gear', () => close()), list, el('div', 'set-note', 'Grafik değişikliği oyunu kısa bir an yeniden yükleyebilir.'))
  const ok = btn('Tamam', () => close(), { color: 'blue' })
  box.append(el('div', 'modal-actions'))
  box.lastElementChild!.append(ok)
  close = ctx.modal(box)
}

// --- pause ----------------------------------------------------------------------------

export interface PauseHandlers {
  resume(): void
  restart(): void
  quit(): void
  closed(): void
}

export function openPauseModal(ctx: Ctx, h: PauseHandlers): () => void {
  const box = el('div', 'pause')
  let close = (): void => undefined
  const then = (fn: () => void) => (): void => {
    ctx.sound('click')
    close()
    fn()
  }
  const big = btn('Devam', then(h.resume), { size: 'xl', icon: 'play' })
  const row = el('div', 'pause-row')
  row.append(
    btn('Yeniden', then(h.restart), { color: 'blue', icon: 'flag' }),
    btn('Ayarlar', () => ctx.openSettings(), { color: 'white', icon: 'gear' }),
    btn('Harita', then(h.quit), { color: 'white', icon: 'map' }),
  )
  box.append(header('Duraklatıldı', 'pause'), big, row, el('div', 'set-note', ctx.touch ? '' : 'Esc ya da P ile devam et'))
  close = ctx.modal(box, { onClose: h.closed })
  return close
}

// --- daily chest -----------------------------------------------------------------------

export function openChestModal(ctx: Ctx): void {
  const box = el('div', 'chestbox')
  let close = (): void => undefined
  const chest = icon('chest', 'chest-big')
  const glow = el('div', 'chest-rays')
  const stage = el('div', 'chest-stage')
  stage.append(glow, chest)
  const info = el('div', 'chest-info')
  const actions = el('div', 'modal-actions')
  let timer = 0
  const reveal = async (video: boolean): Promise<void> => {
    if (video && !(await ctx.rewarded('chest'))) {
      ctx.toast('Video tamamlanmadı', 'video')
      return
    }
    const r = openChest(ctx.save(), ctx.now(), Math.random, { video })
    if (!r.ok) return
    window.clearInterval(timer)
    ctx.update(() => r.save)
    actions.replaceChildren()
    stage.classList.add('opening')
    ctx.sound('whoosh')
    await wait(700)
    stage.classList.add('open')
    ctx.sound('reward')
    const amount = el('span', 'num', '0')
    const line = el('div', 'chest-gold k-pop')
    line.append(icon('coin'), el('span', 'plus', '+'), amount)
    info.replaceChildren(line)
    await countUp(amount, 0, r.gold, 900, () => ctx.sound('tick'))
    if (r.mod !== undefined) {
      const m = modById(r.mod)
      const gift = el('div', 'chest-mod k-pop')
      gift.append(icon('gift'), el('span', '', `Bonus: ${m?.name ?? 'Modifiye'}`))
      info.append(gift)
    }
    actions.append(btn('Harika!', () => close(), { size: 'md' }))
  }
  const render = (): void => {
    const st = chestState(ctx.save(), ctx.now())
    if (st.ready) {
      info.replaceChildren(el('div', 'chest-title', 'Günlük sandığın hazır!'), el('div', 'set-note', 'İçinden altın ve bazen modifiye çıkar.'))
      actions.replaceChildren(btn('Aç!', () => void reveal(false), { size: 'xl', icon: 'chest' }))
      stage.classList.add('ready')
      window.clearInterval(timer)
      return
    }
    info.replaceChildren(el('div', 'chest-title', 'Yeni sandık'), el('div', 'chest-timer', formatCountdown(st.msLeft)))
    if (actions.childElementCount === 0) {
      actions.append(
        btn('Hemen aç', () => void reveal(true), { color: 'video', sub: '1 video' }),
        btn('Tamam', () => close(), { color: 'blue' }),
      )
    }
  }
  render()
  timer = window.setInterval(render, 1000)
  box.append(header('Günlük Sandık', 'chest', () => close()), stage, info, actions)
  close = ctx.modal(box, { onClose: () => window.clearInterval(timer) })
}

// --- daily tasks -----------------------------------------------------------------------

/** Task rows (also used by the home page panel). `onChange` after a claim. */
export function taskList(ctx: Ctx, onChange: () => void): HTMLElement {
  const save = ensureDaily(ctx.save(), dayKey(new Date(ctx.now())))
  const list = el('div', 'tasks')
  save.daily.tasks.forEach((t, i) => {
    const row = el('div', `task${t.done ? ' done' : ''}${t.claimed ? ' claimed' : ''} k-rise`)
    row.style.setProperty('--d', `${i * 0.06}s`)
    const bar = el('div', 'kbar')
    const fill = el('i')
    fill.style.width = `${Math.round(Math.min(1, t.progress / Math.max(1, t.goal)) * 100)}%`
    bar.append(fill)
    const text = el('div', 'task-text')
    text.append(el('div', 'task-label', taskLabel(t.id)), bar, el('div', 'task-count', `${Math.min(t.progress, t.goal)}/${t.goal}`))
    const right = el('div', 'task-right')
    if (t.claimed) {
      const ok = el('div', 'task-ok')
      ok.append(icon('star'))
      right.append(ok)
    } else if (t.done) {
      right.append(btn(`+${DAILY_TASK_GOLD}`, () => {
        ctx.update((s) => claimTask(s, t.id))
        ctx.sound('reward')
        ctx.toast(`+${DAILY_TASK_GOLD} altın`, 'coin')
        onChange()
      }, { size: 'sm', icon: 'coin', className: 'task-claim' }))
    } else {
      const reward = el('div', 'task-reward')
      reward.append(icon('coin'), el('span', '', String(DAILY_TASK_GOLD)))
      right.append(reward)
    }
    row.append(text, right)
    list.append(row)
  })
  return list
}

export function openTasksModal(ctx: Ctx): void {
  const box = el('div', 'tasksbox')
  let close = (): void => undefined
  const holder = el('div')
  const render = (): void => {
    holder.replaceChildren(taskList(ctx, render))
  }
  render()
  box.append(header('Günlük Görevler', 'flag', () => close()), holder, el('div', 'set-note', 'Görevler her gün yenilenir.'))
  close = ctx.modal(box)
}

/** Swap a sound icon in place (settings row). */
export const soundIcon = (span: HTMLElement, on: boolean): void => setIcon(span, on ? 'sound-on' : 'sound-off')
