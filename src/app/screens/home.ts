/**
 * Home page: 3D showroom behind, logo, gold/stars, settings, daily chest + tasks, three world
 * cards (lock state, stars, cup tiers), garage and the big YARIŞ button (next unfinished race).
 */
import { carById } from '../../meta/catalog'
import { chestState } from '../../meta/daily'
import { nextGoal, totalStars } from '../../meta/progress'
import { formatCountdown } from '../../ui/format'
import { icon, imageOr } from '../../ui/icon'
import { btn, el, logo, pill, setPill } from '../dom'
import { taskList } from '../modals'
import type { Ctx, Screen } from '../screen'
import { worldTheme } from '../theme'
import { playButton, worldCards, type WorldCardVM } from '../viewModels'

const TIER_TROPHY = ['trophy-bronze', 'trophy-silver', 'trophy-gold'] as const

function worldCard(ctx: Ctx, vm: WorldCardVM, i: number): HTMLElement {
  const theme = worldTheme(vm.world)
  const card = el('button', `wcard k-rise${vm.unlocked ? '' : ' locked'}${vm.current ? ' current' : ''}`)
  card.type = 'button'
  card.style.setProperty('--d', `${0.15 + i * 0.08}s`)
  card.style.setProperty('--wc', theme.accent)
  const fb = el('div', 'wcard-fb')
  fb.style.background = `linear-gradient(160deg, ${theme.sky.join(', ')})`
  const art = imageOr(`./ui/worlds/${vm.world}.jpg`, fb, 'wcard-art')
  const shade = el('div', 'wcard-shade')
  const name = el('div', 'wcard-name')
  name.append(el('span', 'k-out-thin', vm.name), el('small', '', vm.cupName))
  const stars = el('div', 'wcard-stars')
  stars.append(icon('star'), el('span', '', `${vm.stars}/${vm.maxStars}`))
  const tiers = el('div', 'wcard-tiers')
  vm.tiers.forEach((t, k) => {
    const tr = el('div', `tier${t.bossBeaten ? ' won' : ''}${t.unlocked ? '' : ' shut'}`)
    tr.title = `${t.name}${t.bossBeaten ? ' kazanıldı' : ''}`
    tr.append(icon(TIER_TROPHY[k]))
    tiers.append(tr)
  })
  card.append(art, shade, stars, name, tiers)
  if (vm.current) card.append(el('div', 'wcard-next', 'SIRADAKİ'))
  if (!vm.unlocked) {
    const lock = el('div', 'wcard-lock')
    lock.append(icon('lock'), el('span', '', vm.lockReason ?? 'Kilitli'))
    card.append(lock)
  }
  card.addEventListener('pointerdown', (e) => e.stopPropagation())
  card.addEventListener('click', () => {
    if (!vm.unlocked) {
      ctx.sound('error')
      card.classList.remove('nope')
      void card.offsetWidth
      card.classList.add('nope')
      ctx.toast(vm.lockReason ?? 'Kilitli', 'lock')
      return
    }
    ctx.sound('click')
    ctx.go({ name: 'cupMap', world: vm.world })
  })
  return card
}

export function homeScreen(ctx: Ctx): Screen {
  const root = el('div', 'scr-home')
  const save = ctx.save()

  const top = el('div', 'topbar')
  const left = el('div', 'tb-left')
  left.append(logo('logo home-logo k-drop'))
  const right = el('div', 'tb-right k-drop')
  const gold = pill('coin', save.gold)
  const stars = pill('star', totalStars(save))
  right.append(stars, gold, btn('', () => ctx.openSettings(), { color: 'white', round: true, icon: 'gear', title: 'Ayarlar' }))
  top.append(left, right)

  // daily column
  const side = el('div', 'home-side')
  const chestBtn = el('button', 'chest-btn k-rise')
  chestBtn.type = 'button'
  const chestIcon = icon('chest')
  const chestTxt = el('div', 'chest-txt')
  chestBtn.append(chestIcon, chestTxt)
  chestBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
  chestBtn.addEventListener('click', () => {
    ctx.sound('click')
    ctx.openChest()
  })
  const tasksPanel = el('div', 'kpanel tasks-panel k-rise')
  tasksPanel.style.setProperty('--d', '.08s')
  const tasksHead = el('div', 'tp-head')
  tasksHead.append(icon('flag'), el('span', '', 'Günlük Görevler'))
  const tasksBody = el('div')
  const renderTasks = (): void => tasksBody.replaceChildren(taskList(ctx, renderTasks))
  renderTasks()
  tasksPanel.append(tasksHead, tasksBody)
  const tasksBtn = btn('Görevler', () => ctx.openTasks(), { color: 'white', icon: 'flag', size: 'sm', className: 'tasks-btn' })
  side.append(chestBtn, tasksPanel, tasksBtn)

  // play column
  const play = el('div', 'home-play')
  const goal = nextGoal(save)
  const goalBox = el('div', 'goal-chip k-rise')
  goalBox.style.setProperty('--d', '.2s')
  const gBar = el('div', 'kbar')
  const gFill = el('i')
  gBar.append(gFill)
  goalBox.append(icon(goal.kind === 'car' ? 'garage' : goal.kind === 'boss' ? 'boss' : 'lock'), el('div', 'goal-txt', goal.label), gBar)
  window.setTimeout(() => (gFill.style.width = `${Math.round(goal.progress * 100)}%`), 300)
  const pb = playButton(save)
  const garage = btn('Garaj', () => {
    ctx.sound('click')
    ctx.go({ name: 'garage' })
  }, { color: 'blue', icon: 'garage', className: 'k-rise garage-btn' })
  garage.style.setProperty('--d', '.25s')
  const go = btn('Yarış', () => {
    if (pb.race === null) return
    ctx.sound('whoosh')
    ctx.go({ name: 'race', raceId: pb.race.id })
  }, { size: 'xl', icon: 'play', sub: pb.subtitle, className: 'k-rise race-btn k-shine' })
  go.style.setProperty('--d', '.3s')
  play.append(goalBox, garage, go)

  const worlds = el('div', 'home-worlds')
  worldCards(save).forEach((vm, i) => worlds.append(worldCard(ctx, vm, i)))

  const carName = el('div', 'home-car k-pop')
  carName.style.setProperty('--d', '.35s')
  carName.textContent = carById(save.car)?.name ?? ''

  root.append(top, side, carName, worlds, play)

  const tickChest = (): void => {
    const st = chestState(ctx.save(), ctx.now())
    chestBtn.classList.toggle('ready', st.ready)
    chestTxt.replaceChildren(el('b', '', st.ready ? 'Sandık hazır!' : 'Günlük sandık'), el('span', '', st.ready ? 'Açmak için dokun' : formatCountdown(st.msLeft)))
  }
  tickChest()
  const timer = window.setInterval(tickChest, 1000)
  const unsub = ctx.deps.save.subscribe((s) => {
    setPill(gold, s.gold)
    setPill(stars, totalStars(s))
    tickChest()
    renderTasks()
  })
  void ctx.showCar()

  return {
    el: root,
    showroom: 'home',
    dispose() {
      window.clearInterval(timer)
      unsub()
    },
  }
}
