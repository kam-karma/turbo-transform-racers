import { describe, expect, it, vi } from 'vitest'
import { createAdFlow } from './adFlow'
import type { AdsPlatform } from './ads'

function fakeAds(overrides: Partial<AdsPlatform> = {}): AdsPlatform & { readonly log: string[] } {
  const log: string[] = []
  return {
    log,
    init: () => Promise.resolve(),
    loadingFinished: () => undefined,
    gameplayStart: () => void log.push('start'),
    gameplayStop: () => void log.push('stop'),
    canReward: () => true,
    rewardedBreak: () => {
      log.push('rewarded')
      return Promise.resolve(true)
    },
    commercialBreak: () => {
      log.push('commercial')
      return Promise.resolve()
    },
    ...overrides,
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Poki's rule: gameplayStart and gameplayStop must alternate, starting with a start. */
function alternates(log: readonly string[]): boolean {
  const marks = log.filter((entry) => entry === 'start' || entry === 'stop')
  return marks.every((entry, index) => entry === (index % 2 === 0 ? 'start' : 'stop'))
}

describe('ad flow', () => {
  it('reports gameplay start and stop once each, never twice in a row', () => {
    const ads = fakeAds()
    const flow = createAdFlow(ads)
    flow.gameplayStop()
    flow.gameplayStart()
    flow.gameplayStart()
    flow.gameplayStop()
    flow.gameplayStop()
    expect(ads.log).toEqual(['start', 'stop'])
  })

  it('stops gameplay around a commercial break and restarts it afterwards', async () => {
    const ads = fakeAds()
    const flow = createAdFlow(ads)
    flow.gameplayStart()
    const done = flow.commercialBreak()
    expect(flow.isAdRunning()).toBe(true)
    await done
    expect(flow.isAdRunning()).toBe(false)
    expect(ads.log).toEqual(['start', 'stop', 'commercial', 'start'])
  })

  it('does not restart gameplay after a break taken from a menu', async () => {
    const ads = fakeAds()
    const flow = createAdFlow(ads)
    await flow.commercialBreak()
    expect(ads.log).toEqual(['commercial'])
  })

  it('pauses around a rewarded video and grants it only when watched', async () => {
    const ads = fakeAds()
    const flow = createAdFlow(ads)
    flow.gameplayStart()
    expect(await flow.rewarded('continue')).toBe(true)
    expect(ads.log).toEqual(['start', 'stop', 'rewarded', 'start'])
    const skipped = createAdFlow(fakeAds({ rewardedBreak: () => Promise.resolve(false) }))
    expect(await skipped.rewarded('x2')).toBe(false)
  })

  it('passes the reason to the platform', async () => {
    const reasons: string[] = []
    const flow = createAdFlow(fakeAds({ rewardedBreak: (r) => (reasons.push(r ?? ''), Promise.resolve(true)) }))
    await flow.rewarded('chest')
    expect(reasons).toEqual(['chest'])
  })

  it('offers nothing when the platform cannot reward', async () => {
    const ads = fakeAds({ canReward: () => false })
    const flow = createAdFlow(ads)
    expect(flow.canReward()).toBe(false)
    expect(await flow.rewarded('x2')).toBe(false)
    expect(ads.log).toEqual([])
  })

  it('ignores every other ad request while one is on screen', async () => {
    let finish: (watched: boolean) => void = () => undefined
    const ads = fakeAds({
      rewardedBreak: () => {
        ads.log.push('rewarded')
        return new Promise<boolean>((resolve) => {
          finish = resolve
        })
      },
    })
    const flow = createAdFlow(ads)
    flow.gameplayStart()
    const first = flow.rewarded('mod')
    expect(await flow.rewarded('mod')).toBe(false)
    await flow.commercialBreak()
    flow.gameplayStart()
    flow.gameplayStop()
    flow.gameplayStart()
    await settle()
    expect(ads.log).toEqual(['start', 'stop', 'rewarded'])
    finish(true)
    expect(await first).toBe(true)
    // The game asked to be playing when the ad ended, so play goes on.
    expect(ads.log).toEqual(['start', 'stop', 'rewarded', 'start'])
  })

  it('stays stopped after an ad if the game stopped meanwhile', async () => {
    let finish: () => void = () => undefined
    const ads = fakeAds({
      commercialBreak: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    })
    const flow = createAdFlow(ads)
    flow.gameplayStart()
    const done = flow.commercialBreak()
    flow.gameplayStop()
    finish()
    await done
    expect(ads.log).toEqual(['start', 'stop'])
  })

  it('tells listeners when an ad starts and ends, so audio can be muted', async () => {
    const flow = createAdFlow(fakeAds())
    const seen: boolean[] = []
    const stop = flow.onAdChange((running) => seen.push(running))
    await flow.rewarded('x2')
    stop()
    await flow.commercialBreak()
    expect(seen).toEqual([true, false])
  })

  it('lets the game go on when the ad call throws', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ads = fakeAds({
      rewardedBreak: () => {
        throw new Error('sdk broke')
      },
      commercialBreak: () => Promise.reject(new Error('sdk broke')),
    })
    const flow = createAdFlow(ads)
    flow.gameplayStart()
    expect(await flow.rewarded('x2')).toBe(false)
    await expect(flow.commercialBreak()).resolves.toBeUndefined()
    expect(flow.isAdRunning()).toBe(false)
    expect(alternates(ads.log)).toBe(true)
    expect(ads.log.at(-1)).toBe('start')
    errors.mockRestore()
  })

  it('keeps start and stop alternating through a long, messy session', async () => {
    const ads = fakeAds()
    const flow = createAdFlow(ads)
    const moves = [
      () => flow.gameplayStop(),
      () => void flow.commercialBreak(),
      () => flow.gameplayStart(),
      () => void flow.rewarded('x2'),
      () => flow.gameplayStop(),
      () => flow.gameplayStart(),
      () => flow.gameplayStart(),
      () => void flow.rewarded('mod'),
    ]
    for (let round = 0; round < 6; round += 1) {
      for (const [index, move] of moves.entries()) {
        move()
        if ((index + round) % 3 === 0) await settle()
      }
    }
    await settle()
    expect(alternates(ads.log)).toBe(true)
    expect(ads.log.filter((entry) => entry === 'start').length).toBeGreaterThan(2)
  })
})
