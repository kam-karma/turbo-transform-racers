import { describe, expect, it } from 'vitest'
import {
  BOSS_FIRST_REWARD,
  BOSS_REPEAT_REWARD,
  CHEST_COOLDOWN_MS,
  DAILY_TASK_GOLD,
  FORM_PRICES,
  PLACE_GOLD,
  STAR_GOLD,
  perfPrice,
  placeGold,
  raceReward,
} from './economy'

describe('economy', () => {
  it('pays by finishing place per spec §11.1', () => {
    expect(PLACE_GOLD).toEqual([150, 120, 100, 80, 65, 50])
    expect(raceReward(1, 0, 0)).toBe(150)
    expect(raceReward(3, 0, 0)).toBe(100)
    expect(raceReward(6, 0, 0)).toBe(50)
    expect(raceReward(9, 0, 0)).toBe(50)
    expect(placeGold(0)).toBe(150)
  })

  it('adds collected coins and 40 gold per new star', () => {
    expect(STAR_GOLD).toBe(40)
    expect(raceReward(2, 35, 2)).toBe(120 + 35 + 80)
  })

  it('ignores nonsense inputs instead of paying them', () => {
    expect(raceReward(1, -20, -1)).toBe(150)
    expect(raceReward(Number.NaN, Number.NaN, Number.NaN)).toBe(50)
    expect(raceReward(1, 12.9, 0)).toBe(162)
  })

  it('has the boss, daily and chest numbers', () => {
    expect(BOSS_FIRST_REWARD).toBe(500)
    expect(BOSS_REPEAT_REWARD).toBe(150)
    expect(DAILY_TASK_GOLD).toBe(100)
    expect(CHEST_COOLDOWN_MS).toBe(4 * 3600 * 1000)
    expect(FORM_PRICES).toEqual([150, 300, 600, 1200, 2000])
  })

  it('prices the next performance level, or null at max', () => {
    expect(perfPrice(0)).toBe(200)
    expect(perfPrice(4)).toBe(2500)
    expect(perfPrice(5)).toBeNull()
  })
})
