import type { AdsPlatform } from './ads'

/** The part of the Poki SDK this game uses. See developers.poki.com/guide/sdk-html5 */
export interface PokiSdk {
  init(): Promise<void>
  gameLoadingFinished(): void
  gameplayStart(): void
  gameplayStop(): void
  rewardedBreak(onStart?: () => void): Promise<boolean>
  commercialBreak(onStart?: () => void): Promise<unknown>
}

declare global {
  interface Window {
    /** Set by the Poki SDK script when the Poki page provides it; missing everywhere else. */
    PokiSDK?: PokiSdk
  }
}

/** Runs an SDK notification; a broken SDK must never stop the game. */
function safely(what: string, call: () => void): void {
  try {
    call()
  } catch (error) {
    console.error(`Poki ${what} failed:`, error)
  }
}

/** Wraps the Poki SDK in the shape the game expects. Every call is crash-proof. */
export function createPokiAds(sdk: PokiSdk): AdsPlatform {
  return {
    init: (): Promise<void> =>
      Promise.resolve()
        .then(() => sdk.init())
        .catch((error: unknown) => {
          // Poki's own guidance: if init fails, load the game anyway.
          console.error('Poki SDK could not initialise:', error)
        }),
    loadingFinished: (): void => safely('gameLoadingFinished', () => sdk.gameLoadingFinished()),
    gameplayStart: (): void => safely('gameplayStart', () => sdk.gameplayStart()),
    gameplayStop: (): void => safely('gameplayStop', () => sdk.gameplayStop()),
    canReward: (): boolean => true,
    rewardedBreak: (): Promise<boolean> =>
      Promise.resolve()
        .then(() => sdk.rewardedBreak())
        .then((watched) => watched === true)
        .catch((error: unknown) => {
          console.error('Poki rewardedBreak failed:', error)
          return false
        }),
    commercialBreak: (): Promise<void> =>
      Promise.resolve()
        .then(() => sdk.commercialBreak())
        .then(() => undefined)
        .catch((error: unknown) => {
          console.error('Poki commercialBreak failed:', error)
        }),
  }
}
