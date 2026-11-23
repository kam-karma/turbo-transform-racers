/**
 * The Kurgu mode panel for the race HUD (hud.setModePanel): four chunky toy-box slots — Ön,
 * Yan, Arka, Teker — showing the part clicked into each (its icon, or a styled badge until
 * the icon exists), a chip announcing the next gate and whether the car is ready for it, and
 * the combo badge when two parts make one.
 */
import type { GateKind } from '../sim/kurguTrack'
import { comboDef, PART_DEFS, SLOTS, type ComboId, type PartId, type Slot } from '../sim/parts'
import type { SlotView } from '../sim/kurguGhost'

const SLOT_NAME: Readonly<Record<Slot, string>> = { front: 'Ön', side: 'Yan', back: 'Arka', wheels: 'Teker' }
const ICON: Partial<Record<PartId, string>> = { wing: 'part-wing', rocket: 'part-rocket', drill: 'part-drill', magnet: 'part-magnet', bigwheel: 'part-bigwheel', float: 'part-float', treads: 'part-treads', bumper: 'part-bumper', propeller: 'part-propeller' }
const GATE_WORD: Readonly<Record<GateKind, string>> = { gap: 'Boşluk', water: 'Su', climb: 'Duvar tırmanışı', wall: 'Oyuncak duvar' }

const CSS = `
.kp{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:"Baloo 2","Fredoka",system-ui,sans-serif;pointer-events:none;user-select:none}
.kp-slots{display:flex;gap:8px;padding:8px 10px;border-radius:22px;background:linear-gradient(180deg,#fff8ec,#ffe9c7);border:4px solid #fff;box-shadow:0 6px 0 #d9a35a,0 10px 22px rgba(80,40,0,.35)}
.kp-slot{width:64px;height:74px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;background:#f3e2c4;box-shadow:inset 0 3px 0 rgba(0,0,0,.08);position:relative;transition:transform .18s}
.kp-slot b{font-size:12px;font-weight:800;color:#9a6a3a;letter-spacing:.5px;margin-top:3px}
.kp-ic{width:48px;height:48px;margin-top:1px;display:flex;align-items:center;justify-content:center;border-radius:14px}
.kp-ic img{width:48px;height:48px;object-fit:contain;filter:drop-shadow(0 2px 1px rgba(0,0,0,.25))}
.kp-empty{border:3px dashed #d8b98a;width:38px;height:38px;border-radius:12px;opacity:.8}
.kp-badge{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:22px;border:3px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.2)}
.kp-slot.full{background:#fff}
.kp-slot.shiny{background:linear-gradient(160deg,#fff6c0,#ffd34d);box-shadow:0 0 14px #ffd34d}
.kp-slot.kp-popped{animation:kp-pop .38s cubic-bezier(.3,1.8,.5,1)}
@keyframes kp-pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
.kp-slot.kp-lost{animation:kp-lost .5s ease}
@keyframes kp-lost{0%,100%{transform:none}25%{transform:translateX(-5px) rotate(-6deg)}75%{transform:translateX(5px) rotate(6deg)}}
.kp-gate{display:flex;align-items:center;gap:8px;padding:5px 14px 5px 6px;border-radius:999px;background:#fff;border:3px solid #fff;box-shadow:0 4px 0 rgba(0,0,0,.18);font-weight:800;font-size:15px;color:#4a3462;opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s}
.kp-gate.on{opacity:1;transform:none}
.kp-gate .kp-ic{width:34px;height:34px}
.kp-gate .kp-ic img{width:34px;height:34px}
.kp-gate .kp-badge{width:30px;height:30px;font-size:16px}
.kp-gate.ok{background:#e4ffd6;color:#2c7a1c}
.kp-gate.need{background:#fff1d6;color:#a2560a}
.kp-gate i{font-style:normal;font-size:13px;font-weight:700;opacity:.8}
.kp-combo{position:absolute;top:-34px;padding:4px 14px;border-radius:999px;background:linear-gradient(90deg,#ff7eb6,#ffcf3a);color:#fff;font-weight:900;font-size:16px;border:3px solid #fff;box-shadow:0 4px 0 rgba(0,0,0,.2);opacity:0;transition:opacity .3s}
.kp-combo.on{opacity:1}
@media (max-width:700px){.kp-slot{width:52px;height:62px}.kp-ic,.kp-ic img{width:38px;height:38px}.kp-gate{font-size:13px}}
`

function ensureCss(): void {
  if (document.getElementById('kurgu-panel-css') !== null) return
  const st = document.createElement('style')
  st.id = 'kurgu-panel-css'
  st.textContent = CSS
  document.head.appendChild(st)
}

/** The part's icon, or a coloured rounded badge with its first letter until icons exist. */
export function partIcon(id: PartId): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'kp-ic'
  const badge = (): HTMLElement => {
    const b = document.createElement('div')
    b.className = 'kp-badge'
    b.style.background = PART_DEFS[id].color
    b.textContent = PART_DEFS[id].name[0]
    return b
  }
  const icon = ICON[id]
  if (icon === undefined) {
    wrap.appendChild(badge())
    return wrap
  }
  const img = document.createElement('img')
  img.alt = PART_DEFS[id].name
  img.onerror = () => {
    img.remove()
    wrap.appendChild(badge())
  }
  img.src = `./ui/icons/${icon}.png`
  wrap.appendChild(img)
  return wrap
}

export interface PartPanel {
  readonly el: HTMLElement
  setSlots(slots: SlotView, popped: Slot | null, lost: Slot | null): void
  setGate(kind: GateKind | null, need: PartId | null, ready: boolean): void
  combo(id: ComboId | null): void
}

export function createPartPanel(): PartPanel {
  ensureCss()
  const el = document.createElement('div')
  el.className = 'kp'
  const combo = document.createElement('div')
  combo.className = 'kp-combo'
  const gate = document.createElement('div')
  gate.className = 'kp-gate'
  const row = document.createElement('div')
  row.className = 'kp-slots'
  const tiles = new Map<Slot, HTMLElement>()
  const shown = new Map<Slot, string>()
  for (const s of SLOTS) {
    const t = document.createElement('div')
    t.className = 'kp-slot'
    row.appendChild(t)
    tiles.set(s, t)
  }
  el.append(combo, gate, row)
  let comboT = 0
  let gateKey = ''

  const paint = (s: Slot, slots: SlotView): void => {
    const t = tiles.get(s) as HTMLElement
    const a = slots[s]
    const key = a === null ? '' : `${a.id}${a.shiny ? '*' : ''}`
    if (shown.get(s) === key) return
    shown.set(s, key)
    t.replaceChildren()
    t.classList.toggle('full', a !== null)
    t.classList.toggle('shiny', a?.shiny === true)
    if (a === null) {
      const e = document.createElement('div')
      e.className = 'kp-empty'
      t.append(Object.assign(document.createElement('div'), { className: 'kp-ic' }))
      ;(t.firstChild as HTMLElement).appendChild(e)
    } else t.appendChild(partIcon(a.id))
    const label = document.createElement('b')
    label.textContent = SLOT_NAME[s]
    t.appendChild(label)
  }
  for (const s of SLOTS) paint(s, { front: null, side: null, back: null, wheels: null })

  const flash = (s: Slot, cls: string): void => {
    const t = tiles.get(s) as HTMLElement
    t.classList.remove(cls)
    void t.offsetWidth
    t.classList.add(cls)
  }

  return {
    el,
    setSlots(slots, popped, lost) {
      for (const s of SLOTS) paint(s, slots)
      if (popped !== null) flash(popped, 'kp-popped')
      if (lost !== null) flash(lost, 'kp-lost')
    },
    setGate(kind, need, ready) {
      const key = kind === null ? '' : `${kind}${need}${ready}`
      if (key === gateKey) return
      gateKey = key
      gate.classList.toggle('on', kind !== null)
      if (kind === null || need === null) return
      gate.className = `kp-gate on ${ready ? 'ok' : 'need'}`
      const text = document.createElement('span')
      text.innerHTML = `${ready ? 'Hazırsın!' : `${PART_DEFS[need].name} lazım`} <i>· ileride ${GATE_WORD[kind].toLowerCase()}</i>`
      gate.replaceChildren(partIcon(need), text)
    },
    combo(id) {
      if (id === null) {
        combo.classList.remove('on')
        return
      }
      combo.textContent = `KOMBO: ${comboDef(id).name}`
      combo.classList.add('on')
      window.clearTimeout(comboT)
      comboT = window.setTimeout(() => combo.classList.remove('on'), 2600)
    },
  }
}
