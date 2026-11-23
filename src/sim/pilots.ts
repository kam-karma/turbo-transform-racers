/**
 * Kupa Pilotları: the game's own racing crew. Their ghosts ship with the game and they are
 * always shown as themselves, never passed off as real players (spec §12.5).
 */
import type { BotSkill } from './bot'

export interface Pilot {
  readonly id: string
  readonly name: string
  /** Short badge shown next to the name. */
  readonly badge: string
  readonly color: number
  readonly skill: BotSkill
}

const skill = (level: number): BotSkill => {
  // level 1 = best … 0 = beginner
  const l = Math.max(0, Math.min(1, level))
  return {
    perfectChance: 0.05 + 0.8 * l,
    earlyRange: [0.35 + 0.2 * l, 2.2 - 1.2 * l],
    lateChance: 0.5 * (1 - l),
    lineNoise: 0.3 + 4 * (1 - l),
    throttleLift: 0.04 + 0.5 * (1 - l),
    coinPull: 0.2 + 0.6 * l,
    power: 0.84 + 0.16 * l,
  }
}

const crew: readonly [string, string, string, number][] = [
  ['volt', 'Kaptan Volt', '⚡', 0xffd400],
  ['zipzip', 'Pilot Zıpzıp', '🐰', 0xff6fb5],
  ['bulut', 'Bulut Avcısı', '☁️', 0x7fd6ff],
  ['firtina', 'Minik Fırtına', '🌪️', 0x8b7bff],
  ['lav', 'Lav Canavarı', '🌋', 0xff5a2a],
  ['buz', 'Buz Kraliçesi', '❄️', 0xbfefff],
  ['tilki', 'Neon Tilki', '🦊', 0xff9a1f],
  ['lolipop', 'Lolipop Lale', '🍭', 0xff4fd8],
  ['dalga', 'Dalga Dede', '🌊', 0x1fb6ff],
  ['kedi', 'Kanatlı Kedi', '🐱', 0xffe08a],
  ['pervane', 'Pervane Pıtırcık', '🌀', 0x4fffc1],
  ['gaga', 'Gökkuşağı Gaga', '🦜', 0x5bff5b],
  ['cikolata', 'Çikolata Çelik', '🍫', 0xb06a3b],
  ['ruzgar', 'Rüzgâr Gülü', '🌸', 0xffb0d0],
  ['tosbaga', 'Turbo Tosbağa', '🐢', 0x6fcf4f],
]

export const PILOTS: readonly Pilot[] = crew.map(([id, name, badge, color], i) => ({
  id, name, badge, color, skill: skill(1 - i / (crew.length - 1)),
}))

export const pilotById = (id: string): Pilot | undefined => PILOTS.find((p) => p.id === id)
