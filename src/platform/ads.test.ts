import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAds, createLocalAds } from './ads'
import { createPokiAds, type PokiSdk } from './poki'

function fakeSdk(over: Partial<PokiSdk> = {}): PokiSdk & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    init: () => (calls.push('init'), Promise.resolve()),
    gameLoadingFinished: () => void calls.push('loaded'),
    gameplayStart: () => void calls.push('start'),
    gameplayStop: () => void calls.push('stop'),
    rewardedBreak: () => (calls.push('rewarded'), Promise.resolve(true)),
    commercialBreak: () => (calls.push('commercial'), Promise.resolve()),
    ...over,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('local stand-in', () => {
  it('in development grants a reward after one second and logs it', async () => {
    vi.useFakeTimers()
    const log: string[] = []
    const ads = createLocalAds({ grantRewards: true, delayMs: 1000, log: (m) => log.push(m) })
    expect(ads.canReward()).toBe(true)
    let result: boolean | null = null
    void ads.rewardedBreak('x2').then((r) => (result = r))
    await vi.advanceTimersByTimeAsync(999)
    expect(result).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(result).toBe(true)
    expect(log.some((m) => m.includes('x2'))).toBe(true)
  })

  it('in a release build without the SDK gives no free rewards', async () => {
    const ads = createLocalAds({ grantRewards: false, delayMs: 0, log: () => undefined })
    expect(ads.canReward()).toBe(false)
    expect(await ads.rewardedBreak('x2')).toBe(false)
    await expect(ads.commercialBreak()).resolves.toBeUndefined()
  })
})

describe('createAds', () => {
  it('uses the Poki SDK when the page has one', async () => {
    const sdk = fakeSdk()
    const ads = createAds({ sdk, dev: false })
    await ads.init()
    ads.loadingFinished()
    ads.gameplayStart()
    expect(await ads.rewardedBreak('chest')).toBe(true)
    await ads.commercialBreak()
    ads.gameplayStop()
    expect(sdk.calls).toEqual(['init', 'loaded', 'start', 'rewarded', 'commercial', 'stop'])
  })

  it('falls back to the stand-in when there is no SDK (and no window in tests)', () => {
    expect(createAds({ sdk: null, dev: true }).canReward()).toBe(true)
    expect(createAds({ sdk: null, dev: false }).canReward()).toBe(false)
    expect(() => createAds()).not.toThrow()
  })

  it('loads the game even when the SDK cannot initialise', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ads = createPokiAds(fakeSdk({ init: () => Promise.reject(new Error('blocked')) }))
    await expect(ads.init()).resolves.toBeUndefined()
    errors.mockRestore()
  })

  it('turns an SDK that throws into a missed reward, not a crash', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ads = createPokiAds(
      fakeSdk({
        rewardedBreak: () => {
          throw new Error('sdk broke')
        },
        gameplayStart: () => {
          throw new Error('sdk broke')
        },
      }),
    )
    expect(await ads.rewardedBreak('mod')).toBe(false)
    expect(() => ads.gameplayStart()).not.toThrow()
    errors.mockRestore()
  })
})
