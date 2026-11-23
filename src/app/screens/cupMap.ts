/**
 * Cup map for one world: tier tabs (Bronz / Gümüş / Altın), a winding road of 5 race nodes and
 * the boss node, stars and best times, locks, and a details card with the YARIŞ button.
 */
import { TIER_NAMES, VARIANT_NAMES, type CupTier, type WorldId } from '../../meta/cups'
import { formatTime } from '../../ui/format'
import { icon } from '../../ui/icon'
import { btn, el, pill, starRow } from '../dom'
import type { Ctx, Screen } from '../screen'
import { worldTheme } from '../theme'
import { cupMap, defaultTier, type CupMapVM, type RaceNodeVM } from '../viewModels'

const TIER_ICON: Readonly<Record<CupTier, string>> = { bronz: 'trophy-bronze', gumus: 'trophy-silver', altin: 'trophy-gold' }

/** Node centres in % of the map area: a gentle S-road from left to right. */
export function nodePoints(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const u = n <= 1 ? 0 : i / (n - 1)
    return { x: 9 + u * 80, y: 52 + Math.sin(u * Math.PI * 2.1 + 0.4) * 24 }
  })
}

function roadPath(pts: readonly { x: number; y: number }[]): string {
  const P = pts.map((p) => ({ x: p.x * 10, y: p.y * 5 }))
  let d = `M ${P[0].x} ${P[0].y}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[Math.min(P.length - 1, i + 2)]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x} ${p2.y}`
  }
  return d
}

export function cupMapScreen(ctx: Ctx, world: WorldId, tierIn?: CupTier): Screen {
  const theme = worldTheme(world)
  const root = el('div', `scr-map world-${world}`)
  root.style.setProperty('--wc', theme.accent)
  root.style.setProperty('--path', theme.path)
  const bg = el('div', 'map-bg')
  bg.style.backgroundImage = `url(./ui/worlds/${world}.jpg), linear-gradient(160deg, ${theme.sky.join(', ')})`
  root.append(bg, el('div', 'map-veil'))

  let tier: CupTier = tierIn ?? defaultTier(ctx.save(), world)
  let selected: string | null = null
  const top = el('div', 'topbar')
  const body = el('div', 'map-body')
  root.append(top, body)

  const render = (): void => {
    const vm = cupMap(ctx.save(), world, tier)
    renderTop(vm)
    renderBody(vm)
  }

  const renderTop = (vm: CupMapVM): void => {
    const left = el('div', 'tb-left')
    left.append(btn('', () => back(), { color: 'white', round: true, icon: 'back', title: 'Geri' }))
    const title = el('div', 'map-title k-drop')
    const ttl = el('div', 'kribbon')
    ttl.append(icon(theme.cupIcon), el('span', 'lbl', vm.worldName))
    title.append(ttl, el('div', 'map-sub k-out-thin', vm.cupName))
    left.append(title)
    const right = el('div', 'tb-right')
    right.append(pill('star', `${vm.stars}/${vm.maxStars}`), pill('coin', ctx.save().gold))
    top.replaceChildren(left, right)
  }

  const renderBody = (vm: CupMapVM): void => {
    const tabs = el('div', 'tier-tabs k-rise')
    for (const t of vm.tabs) {
      const b = el('button', `tier-tab${t.tier === tier ? ' on' : ''}${t.unlocked ? '' : ' shut'}`)
      b.type = 'button'
      b.append(icon(t.unlocked ? TIER_ICON[t.tier] : 'lock'), el('span', '', TIER_NAMES[t.tier]))
      if (t.unlocked) b.append(el('small', '', `${t.stars}/${t.maxStars}`))
      b.addEventListener('click', () => {
        ctx.sound('click')
        if (!t.unlocked) ctx.toast(t.lockReason ?? 'Kilitli', 'lock')
        tier = t.tier
        selected = null
        render()
      })
      tabs.append(b)
    }
    const map = el('div', 'map-area')
    const pts = nodePoints(vm.nodes.length)
    map.innerHTML = `<svg class="road" viewBox="0 0 1000 500" preserveAspectRatio="none"><path class="road-edge" d="${roadPath(pts)}"/><path class="road-fill" d="${roadPath(pts)}"/><path class="road-dash" d="${roadPath(pts)}"/></svg>`
    const current = vm.nodes.find((n) => n.current) ?? vm.nodes.find((n) => n.unlocked && !n.finished) ?? vm.nodes[0]
    const sel = vm.nodes.find((n) => n.race.id === selected) ?? current
    vm.nodes.forEach((n, i) => map.append(node(n, pts[i], i, n === sel)))
    const card = vm.unlocked ? detail(vm, sel) : lockedCard(vm)
    body.replaceChildren(tabs, map, card)
  }

  const node = (n: RaceNodeVM, p: { x: number; y: number }, i: number, isSel: boolean): HTMLElement => {
    const boss = n.race.boss
    const b = el('button', `node k-pop${boss ? ' boss' : ''}${n.unlocked ? '' : ' shut'}${n.finished ? ' won' : ''}${n.current ? ' current' : ''}${isSel ? ' sel' : ''}`)
    b.type = 'button'
    b.style.left = `${p.x}%`
    b.style.top = `${p.y}%`
    b.style.setProperty('--d', `${0.1 + i * 0.07}s`)
    const disc = el('div', 'node-disc')
    if (boss) disc.append(icon('boss'))
    else if (!n.unlocked) disc.append(icon('lock'))
    else disc.append(el('span', 'k-out', n.label))
    b.append(disc)
    if (boss && !n.unlocked) b.append(icon('lock', 'node-lock'))
    if (n.unlocked && !boss) b.append(starRow(n.stars, 'node-stars'))
    if (n.bestTime !== null && !boss) b.append(el('div', 'node-time', formatTime(n.bestTime)))
    if (boss) b.append(el('div', 'node-tag', 'BOSS'))
    if (n.current) {
      const me = el('div', 'node-me')
      me.append(icon('form-car'))
      b.append(me)
    }
    b.addEventListener('click', () => {
      ctx.sound('click')
      selected = n.race.id
      render()
    })
    b.addEventListener('dblclick', () => playNode(n))
    return b
  }

  const playNode = (n: RaceNodeVM): void => {
    if (!n.unlocked) {
      ctx.sound('error')
      ctx.toast(n.race.boss ? "Boss'a ulaşmak için 5 yarışı bitir" : 'Önce önceki yarışı bitir', 'lock')
      return
    }
    ctx.sound('whoosh')
    ctx.go({ name: 'race', raceId: n.race.id })
  }

  const detail = (vm: CupMapVM, n: RaceNodeVM): HTMLElement => {
    const card = el('div', 'kpanel map-card k-rise')
    card.style.setProperty('--d', '.2s')
    const head = el('div', 'mc-head')
    head.append(icon(n.race.boss ? 'boss' : 'flag'), el('div', 'mc-name', n.race.boss ? vm.bossName : n.race.name.replace(/ \(.*\)$/, '')))
    const facts = el('div', 'mc-facts')
    const variant = VARIANT_NAMES[n.race.variant]
    facts.append(el('span', 'chip-s', n.race.boss ? 'Boss Yarışı' : `Yarış ${n.race.index + 1}/5`))
    if (variant !== '') facts.append(el('span', 'chip-s alt', variant))
    const best = el('span', 'chip-s')
    best.append(icon('timer'), el('span', '', n.bestTime === null ? '—' : formatTime(n.bestTime)))
    facts.append(best)
    const actions = el('div', 'mc-actions')
    if (n.unlocked) actions.append(btn(n.finished ? 'Tekrar' : 'Yarış', () => playNode(n), { icon: 'play', size: 'md', className: 'k-shine' }))
    else actions.append(el('div', 'mc-locked', n.race.boss ? "Boss'a ulaşmak için 5 yarışı bitir" : 'Önce önceki yarışı bitir'))
    card.append(head, facts)
    if (!n.race.boss) card.append(starRow(n.stars, 'mc-stars'))
    card.append(actions)
    return card
  }

  const lockedCard = (vm: CupMapVM): HTMLElement => {
    const card = el('div', 'kpanel map-card locked k-rise')
    const head = el('div', 'mc-head')
    head.append(icon('lock'), el('div', 'mc-name', `${TIER_NAMES[vm.tier]} kilitli`))
    card.append(head, el('div', 'mc-locked', vm.lockReason ?? ''))
    return card
  }

  const back = (): boolean => {
    ctx.sound('back')
    ctx.go({ name: 'home' })
    return true
  }

  render()
  const unsub = ctx.deps.save.subscribe(() => render())
  return { el: root, showroom: null, back, dispose: unsub }
}
