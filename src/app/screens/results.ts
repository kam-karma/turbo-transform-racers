/**
 * Results: title, podium of the top 3 (stylized 2D, the player highlighted), the rest of the
 * field, stars appearing one by one with their labels, the reward breakdown counting up,
 * "Ödülü x2 yap" (video, purple — never green), unlock notes, the "az kaldı" goal bar and
 * Tekrar / Harita / Garaj / Sonraki yarış.
 */
import { PART_DEFS, PART_IDS } from '../../kurgu/sim/parts'
import { raceById } from '../../meta/cups'
import { applyDoubleReward, type RewardBreakdown } from '../../meta/rewards'
import { playButton } from '../viewModels'
import type { RaceOutcome, ResultRow } from '../../modes/types'
import { formatGold, formatTime } from '../../ui/format'
import { icon } from '../../ui/icon'
import { btn, countUp, el, wait } from '../dom'
import type { Ctx, Screen } from '../screen'
import { resultTitle, rowInitial } from './resultsText'

export interface ResultsData {
  readonly raceId: string
  readonly outcome: RaceOutcome
  readonly breakdown: RewardBreakdown
  readonly goldBefore: number
  readonly firstRun: boolean
}

export interface ResultsHandlers {
  retry(): void
  next(raceId: string): void
  map(): void
  garage(gift?: string): void
}

const LINE_ICON: Readonly<Record<string, string>> = { place: 'trophy', coins: 'coin', stars: 'star', boss: 'boss', gift: 'gift' }
const PODIUM_ORDER = [1, 0, 2] as const

function podium(rows: readonly ResultRow[]): HTMLElement {
  const box = el('div', 'podium')
  for (const i of PODIUM_ORDER) {
    const r = rows[i]
    if (r === undefined) continue
    const col = el('div', `pod pod-${i + 1}${r.you ? ' you' : ''} k-rise`)
    col.style.setProperty('--d', `${0.25 + (2 - i) * 0.15}s`)
    const av = el('div', 'pod-av')
    av.append(el('span', 'k-out-thin', rowInitial(r.name)))
    if (r.you) av.append(el('div', 'pod-you', 'SEN'))
    const block = el('div', 'pod-block')
    block.append(icon(['trophy-gold', 'trophy-silver', 'trophy-bronze'][i]), el('div', 'pod-n k-out', String(i + 1)))
    col.append(av, el('div', 'pod-name', r.name), el('div', 'pod-time', r.time === null ? '—' : formatTime(r.time)), block)
    box.append(col)
  }
  return box
}

function restList(rows: readonly ResultRow[]): HTMLElement {
  const list = el('div', 'res-rest')
  rows.slice(3).forEach((r, k) => {
    const row = el('div', `res-row${r.you ? ' you' : ''} k-rise`)
    row.style.setProperty('--d', `${0.7 + k * 0.06}s`)
    row.append(el('span', 'rr-n', `${k + 4}.`), el('span', 'rr-name', r.you ? `${r.name} (sen)` : r.name), el('span', 'rr-t', r.time === null ? '—' : formatTime(r.time)))
    list.append(row)
  })
  return list
}

/**
 * Kurgu: keep the rare part found this race (rewarded video, spec §9.2). The next Dev Ev race
 * starts with it already fitted.
 */
function rareOffer(ctx: Ctx, extra: Readonly<Record<string, number>> | undefined): HTMLElement | null {
  const i = extra?.rarePart
  if (i === undefined || i < 0 || !ctx.deps.ads.canReward()) return null
  const id = PART_IDS[i]
  if (id === undefined) return null
  const part = PART_DEFS[id]
  const shiny = extra?.rareShiny === 1
  const b = btn('Nadir parçayı garaja götür', async () => {
    const ok = await ctx.rewarded('rare-part')
    if (!ok) {
      ctx.toast('Video tamamlanmadı', 'video')
      return
    }
    ctx.update((s) => ({ ...s, kurguKeep: [id] }))
    b.remove()
    ctx.sound('reward')
    ctx.toast(`Sonraki Dev Ev yarışına ${part.name} ile başlarsın!`, ICON_OF[id] ?? 'gift')
  }, { color: 'video', sub: `${shiny ? 'Altın ' : ''}${part.name}`, className: 'k-pop' })
  return b
}

const ICON_OF: Readonly<Record<string, string>> = {
  wing: 'part-wing', rocket: 'part-rocket', drill: 'part-drill', magnet: 'part-magnet', bigwheel: 'part-bigwheel',
  float: 'part-float', treads: 'part-treads', bumper: 'part-bumper', propeller: 'part-propeller',
}

export function resultsScreen(ctx: Ctx, data: ResultsData, h: ResultsHandlers): Screen {
  const { outcome, firstRun } = data
  let breakdown = data.breakdown
  const race = raceById(data.raceId)
  const root = el('div', `scr-results${outcome.place === 1 || outcome.bossBeaten === true ? ' win' : ''}`)
  const veil = el('div', 'res-veil')
  if (outcome.place === 1 || outcome.bossBeaten === true) {
    const conf = el('div', 'confetti')
    for (let i = 0; i < 36; i++) {
      const c = el('i')
      c.style.setProperty('--x', `${(i * 37) % 100}%`)
      c.style.setProperty('--d', `${(i % 9) * 0.18}s`)
      c.style.setProperty('--h', String((i * 53) % 360))
      conf.append(c)
    }
    root.append(conf)
  }
  const title = el('div', 'res-title k-pop')
  const t = resultTitle(outcome, race?.boss === true)
  title.append(icon(t.icon), el('span', 'k-out', t.text))

  const left = el('div', 'res-left')

  const panel = el('div', 'kpanel res-panel k-rise')
  panel.style.setProperty('--d', '.2s')
  const stars = el('div', 'res-stars')
  const starEls = outcome.stars.map((got, i) => {
    const s = el('div', `res-star${got ? ' got' : ''}${breakdown.newStars[i] ? ' new' : ''}`)
    s.append(icon('star-empty', 'se'), icon('star', 'sf'), el('div', 'res-star-l', outcome.starLabels[i] ?? ''))
    if (breakdown.newStars[i]) s.append(el('div', 'res-new', 'YENİ!'))
    stars.append(s)
    return s
  })
  const lines = el('div', 'res-lines')
  const total = el('div', 'res-total')
  const totalNum = el('span', 'num', formatGold(0))
  total.append(el('span', 'rt-l', 'Toplam'), icon('coin'), totalNum)
  const notes = el('div', 'res-notes')
  const goal = el('div', 'goal-chip res-goal')
  const gBar = el('div', 'kbar')
  const gFill = el('i')
  gBar.append(gFill)
  goal.append(icon(breakdown.goal.kind === 'car' ? 'garage' : breakdown.goal.kind === 'boss' ? 'boss' : 'lock'), el('div', 'goal-txt', `Az kaldı! ${breakdown.goal.label}`), gBar)
  const offer = el('div', 'res-offer')
  panel.append(stars, lines, total, offer, notes)
  left.append(podium(outcome.rows), restList(outcome.rows), goal)

  const actions = el('div', 'res-actions')
  const gift = breakdown.unlocked.find((u) => u.kind === 'mod')?.id
  if (firstRun) {
    actions.append(btn('Devam', () => h.garage(gift), { size: 'xl', icon: 'play' }))
  } else {
    const next = breakdown.unlocked.find((u) => u.kind === 'race')?.id ?? playButton(ctx.save()).race?.id ?? data.raceId
    actions.append(
      btn('Tekrar', () => h.retry(), { color: 'white', icon: 'flag' }),
      btn('Harita', () => h.map(), { color: 'white', icon: 'map' }),
      btn('Garaj', () => h.garage(), { color: 'blue', icon: 'garage' }),
      btn('Sonraki', () => h.next(next), { size: 'xl', icon: 'play', className: 'k-shine', sub: raceById(next)?.name ?? '' }),
    )
  }
  root.append(veil, title, left, panel, actions)

  let alive = true
  const run = async (): Promise<void> => {
    await wait(500)
    for (let i = 0; i < starEls.length && alive; i++) {
      starEls[i].classList.add('show')
      if (outcome.stars[i]) ctx.sound('star')
      await wait(380)
    }
    let shown = 0
    for (const line of breakdown.lines) {
      if (!alive) return
      const row = el('div', `res-line k-rise kind-${line.kind}`)
      const amt = el('span', 'num', '0')
      row.append(icon(LINE_ICON[line.kind] ?? 'coin'), el('span', 'rl-l', line.label), el('span', 'rl-plus', line.gold > 0 ? '+' : ''), amt)
      lines.append(row)
      if (line.gold > 0) {
        await countUp(amt, 0, line.gold, 450, () => ctx.sound('tick'))
        shown += line.gold
        totalNum.textContent = formatGold(shown)
      } else amt.textContent = ''
      await wait(120)
    }
    if (!alive) return
    ctx.sound('coin')
    totalNum.textContent = formatGold(breakdown.gold)
    total.classList.add('k-bump')
    for (const u of breakdown.unlocked.filter((x) => x.kind !== 'race')) {
      const n = el('div', 'res-note k-pop')
      n.append(icon(u.kind === 'car' ? 'garage' : u.kind === 'cup' ? 'trophy' : 'gift'), el('span', '', u.label))
      notes.append(n)
      ctx.sound('unlock')
    }
    gFill.style.width = `${Math.round(breakdown.goal.progress * 100)}%`
    if (breakdown.doubleable > 0 && !breakdown.doubled && ctx.deps.ads.canReward()) {
      const x2 = btn(`Ödülü x2 yap`, async () => {
        const ok = await ctx.rewarded('x2')
        if (!ok) {
          ctx.toast('Video tamamlanmadı', 'video')
          return
        }
        const before = breakdown.gold
        const r = applyDoubleReward(ctx.save(), breakdown)
        ctx.update(() => r.save)
        breakdown = r.breakdown
        x2.remove()
        ctx.sound('reward')
        await countUp(totalNum, before, before + breakdown.doubleable, 700, () => ctx.sound('tick'))
        ctx.toast(`+${formatGold(breakdown.doubleable)} altın`, 'coin')
      }, { color: 'video', sub: `+${formatGold(breakdown.doubleable)} altın`, className: 'k-pop' })
      offer.append(x2)
    }
    const rare = rareOffer(ctx, outcome.extra)
    if (rare !== null) offer.append(rare)
  }
  void run()

  return {
    el: root,
    showroom: null,
    back: () => {
      h.map()
      return true
    },
    dispose: () => {
      alive = false
    },
  }
}
