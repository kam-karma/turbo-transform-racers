import { createPokiAds, type PokiSdk } from './poki'

/** Why a rewarded video is offered (spec §13); used for logs and the dev stand-in. */
export type RewardReason =
  | 'x2' // results: double the race gold
  | 'mod' // garage: one video towards a visual mod
  | 'car-trial' // garage / pre-race: drive a locked car for one race (3 a day)
  | 'rocket-start' // pre-race: 3 s turbo start
  | 'continue' // Kaos: carry on after the car breaks
  | 'chest' // home: open the daily chest now
  | 'daily-mod' // garage: mod of the day
  | 'boss-shield' // boss: first catch does not count
  | 'rare-part' // Kurgu results: keep the rare part

/**
 * What the game needs from the portal it runs on.
 * On Poki this is backed by the Poki SDK; anywhere else by a stand-in,
 * so nothing else in the game has to know where it is running.
 */
export interface AdsPlatform {
  /** Connects to the portal. Never rejects: the game must start even if the portal is unreachable. */
  init(): Promise<void>
  /** Tells the portal the game is ready to play (it measures how many visitors get this far). */
  loadingFinished(): void
  /** Tells the portal the player is actively playing (it uses this to time ads). */
  gameplayStart(): void
  gameplayStop(): void
  /** False when no rewarded video can be shown at all; the offer is then not put on screen. */
  canReward(): boolean
  /** Shows a rewarded video. Resolves true only if the player watched it to the end. */
  rewardedBreak(reason?: RewardReason): Promise<boolean>
  /** Offers a pause for an ordinary ad. The portal may show nothing; resolves when play can go on. */
  commercialBreak(): Promise<void>
}

export interface LocalAdsOptions {
  /** Grant rewards without a video (development only; a release build must not give free rewards). */
  readonly grantRewards: boolean
  /** Fake "video" length in ms. */
  readonly delayMs: number
  readonly log: (message: string) => void
}

const devLog = (message: string): void => console.info(`[ads] ${message}`)

/**
 * Stand-in for when no portal SDK is present. In development a rewarded "video" resolves true
 * after `delayMs` (1 s) and is logged; in a release build without the SDK rewards are refused.
 */
export function createLocalAds(options: Partial<LocalAdsOptions> = {}): AdsPlatform {
  const { grantRewards = false, delayMs = 1000, log = devLog } = options
  return {
    init: (): Promise<void> => Promise.resolve(),
    loadingFinished: (): void => log('loading finished'),
    gameplayStart: (): void => log('gameplay start'),
    gameplayStop: (): void => log('gameplay stop'),
    canReward: (): boolean => grantRewards,
    rewardedBreak: (reason?: RewardReason): Promise<boolean> => {
      log(`rewarded video (${reason ?? 'unspecified'}) → ${grantRewards ? `granted after ${delayMs} ms` : 'refused'}`)
      if (!grantRewards) return Promise.resolve(false)
      return new Promise((resolve) => setTimeout(() => resolve(true), delayMs))
    },
    commercialBreak: (): Promise<void> => {
      log('commercial break (none shown)')
      return Promise.resolve()
    },
  }
}

export interface CreateAdsOptions {
  /** The SDK to use; default `window.PokiSDK` (injected by the Poki page), `null` forces the stand-in. */
  readonly sdk?: PokiSdk | null
  /** Development build? Default `import.meta.env.DEV`. */
  readonly dev?: boolean
}

function pageSdk(): PokiSdk | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.PokiSDK
  } catch {
    return undefined
  }
}

/**
 * The Poki SDK when the page provides one, otherwise the stand-in.
 * This never adds a script tag: the SDK is only used if it is already present on `window`.
 */
export function createAds(options: CreateAdsOptions = {}): AdsPlatform {
  const sdk = options.sdk === undefined ? pageSdk() : options.sdk
  const dev = options.dev ?? import.meta.env.DEV
  return sdk == null ? createLocalAds({ grantRewards: dev }) : createPokiAds(sdk)
}
