/**
 * How each Kurgu event feels: the HUD pop (Turkish), screen flash, effect burst, sound,
 * camera shake and slow motion, and what changes in the world (coins fly, walls burst,
 * obstacles tumble, pickup bubbles pop). Pure routing; the race owns the state.
 */
import type * as THREE from 'three'
import type { RaceAudio } from '../game/audio'
import type { ChaseCamera } from '../game/chaseCamera'
import type { Fx } from '../game/fx'
import type { TimeScale } from '../game/timeScale'
import type { RacerEvent } from '../sim/racer'
import type { RaceHud } from '../ui/raceHud'
import type { KurguEvent } from './sim/kurguRacer'
import type { KurguTrack } from './sim/kurguTrack'
import { comboDef, PART_DEFS } from './sim/parts'
import type { PartPanel } from './view/panel'
import type { DevEvWorld } from './world'

export interface FeedbackDeps {
  readonly hud: RaceHud
  readonly audio: RaceAudio
  readonly fx: Fx
  readonly cam: ChaseCamera
  readonly time: TimeScale
  readonly world: DevEvWorld
  readonly panel: PartPanel
  readonly kt: KurguTrack
}

const GATE_POP: Readonly<Record<string, string>> = { gap: 'SÜZÜL!', water: 'YÜZ!', climb: 'TIRMAN!' }

const fxEv = (kind: RacerEvent['kind'], value = 0): RacerEvent => ({ kind, value })

/** Routes one event; `at` is the car's position, `fwd` its forward. */
export function feedback(d: FeedbackDeps, e: KurguEvent, at: THREE.Vector3, fwd: THREE.Vector3): void {
  const { hud, audio, fx, cam, time, world } = d
  switch (e.kind) {
    case 'coin':
      world.items.collectCoin(e.value ?? -1, e.magnet === true ? at : null)
      fx.onEvent(fxEv('coin'), at)
      audio.onEvent(fxEv('coin'))
      return
    case 'pickup': {
      const def = PART_DEFS[e.part ?? 'wing']
      hud.pop(e.shiny === true ? `ALTIN ${def.name.toLocaleUpperCase('tr')}!` : `${def.name}!`, e.shiny === true ? 'gold' : 'soft')
      fx.onEvent(fxEv('transform'), at)
      audio.onEvent(fxEv('transform'))
      cam.shake(0.18)
      return
    }
    case 'combo': {
      const c = comboDef(e.combo ?? 'flight')
      hud.pop(`KOMBO! ${c.name}`, 'combo')
      hud.flash('#ff7eb6')
      d.panel.combo(c.id)
      fx.onEvent(fxEv('perfect', 3), at)
      audio.onEvent(fxEv('perfect', 3))
      time.trigger()
      return
    }
    case 'knock':
      hud.pop(`${PART_DEFS[e.part ?? 'wing'].name} düştü!`, 'bad')
      return
    case 'hit':
      world.items.hitObstacle(e.obstacle ?? -1, fwd)
      cam.shake(0.6)
      fx.onEvent(fxEv('wall', e.value ?? 30), at)
      audio.onEvent(fxEv('wall', e.value ?? 30))
      hud.flash('#ff5a5a')
      return
    case 'smash':
    case 'bump':
      world.items.hitObstacle(e.obstacle ?? -1, fwd)
      cam.shake(0.3)
      fx.onEvent(fxEv('wall', 20), at)
      audio.onEvent(fxEv('wall', 20))
      hud.pop(e.kind === 'smash' ? 'EZDİN!' : 'ÇAT!', 'soft')
      return
    case 'wallBreak':
      world.items.breakWall(e.gate ?? -1, fwd)
      cam.shake(0.7)
      fx.onEvent(fxEv('land', 12), at)
      audio.onEvent(fxEv('wall', 45))
      hud.pop('DELDİN!', 'perfect')
      time.trigger(0.6, 0.3)
      return
    case 'gate': {
      const g = d.kt.def.gates[e.gate ?? 0]
      if (g !== undefined && GATE_POP[g.kind] !== undefined) hud.pop(GATE_POP[g.kind], 'perfect')
      return
    }
    case 'detour':
      hud.pop('Uzun yol…', 'soft')
      return
    case 'rocket':
      hud.pop('ROKET!', 'perfect')
      fx.onEvent(fxEv('boost'), at)
      audio.onEvent(fxEv('boost'))
      cam.shake(0.35)
      return
    case 'flight':
      hud.pop('UÇUŞ!', 'combo')
      hud.flash('#4fc3ff')
      fx.onEvent(fxEv('perfect', 3), at)
      audio.onEvent(fxEv('boost'))
      time.trigger()
      return
    case 'hidden':
      hud.pop('GİZLİ PARÇA!', 'gold')
      hud.flash('#ffd34d')
      world.pickups.takeHidden()
      fx.onEvent(fxEv('perfect', 2), at)
      audio.onEvent(fxEv('perfect', 2))
      return
    case 'boost':
      hud.pop('HIZ!', 'soft')
      fx.onEvent(fxEv('boost'), at)
      audio.onEvent(fxEv('boost'))
      return
    case 'jump':
      fx.onEvent(fxEv('jump', e.value ?? 0), at)
      audio.onEvent(fxEv('jump', e.value ?? 0))
      if ((e.value ?? 0) > 25) time.trigger()
      return
    case 'land':
      fx.onEvent(fxEv('land', e.value ?? 0), at)
      audio.onEvent(fxEv('land', e.value ?? 0))
      cam.shake(Math.min(0.8, (e.value ?? 0) * 0.08))
      return
    case 'wall':
      fx.onEvent(fxEv('wall', e.value ?? 0), at)
      audio.onEvent(fxEv('wall', e.value ?? 0))
      cam.shake(Math.min(0.6, (e.value ?? 0) * 0.02))
      return
    case 'splash':
      fx.onEvent(fxEv('splash', e.value ?? 0), at)
      audio.onEvent(fxEv('splash', e.value ?? 0))
      return
    case 'finish':
      fx.onEvent(fxEv('finish'), at)
      audio.onEvent(fxEv('finish'))
      return
    default:
      return
  }
}
