import type { AdsPlatform, RewardReason } from './ads'

export type { RewardReason } from './ads'

/**
 * The one place that talks to the portal about playing and ads (ported from İstanbul Taksi).
 * It keeps the portal's rules in one spot:
 *  - gameplayStart / gameplayStop strictly alternate, starting with a start;
 *  - nothing reaches the portal while an ad is on screen, however long it runs;
 *    gameplay is stopped for the ad and restored afterwards only if the game still wants it;
 *  - a rewarded video only by the player's choice (call `rewarded` from a button), the promise
 *    resolves true once, and only when the video was watched to the end;
 *  - a failing SDK never blocks the game: the ad just counts as not shown.
 * Spec §13 UI rules stay with the UI: reward buttons are never green, and the normal
 * "continue" button is at least as large as the reward button.
 */
export interface AdFlow {
  /** A race (or other real play) is running. */
  gameplayStart(): void
  /** Play stopped: pause menu, results, menus. */
  gameplayStop(): void
  /** Natural break (results → next race / garage). Poki decides whether an ad shows. */
  commercialBreak(): Promise<void>
  /** Rewarded video. True only when watched; false when busy, unavailable or skipped. */
  rewarded(reason: RewardReason): Promise<boolean>
  /** Show reward offers only when this is true. */
  canReward(): boolean
  isAdRunning(): boolean
  /** Ad shown / ad over (mute and unmute audio here). Returns an unsubscribe function. */
  onAdChange(listener: (running: boolean) => void): () => void
}

export function createAdFlow(ads: AdsPlatform): AdFlow {
  let wantPlay = false
  let playing = false
  let adRunning = false
  const listeners = new Set<(running: boolean) => void>()

  const play = (): void => {
    if (playing) return
    playing = true
    ads.gameplayStart()
  }
  const halt = (): void => {
    if (!playing) return
    playing = false
    ads.gameplayStop()
  }
  const emit = (running: boolean): void => {
    for (const listener of [...listeners]) {
      try {
        listener(running)
      } catch (error) {
        console.error('Ad listener failed:', error)
      }
    }
  }

  /**
   * Shows an ad with gameplay stopped. There is deliberately no timeout: restarting under a
   * running video would break every rule above at once.
   */
  const runAd = async (show: () => Promise<boolean>): Promise<boolean> => {
    adRunning = true
    halt()
    emit(true)
    let watched = false
    try {
      watched = (await show()) === true
    } catch (error) {
      console.error('Ad break failed:', error)
    }
    adRunning = false
    emit(false)
    if (wantPlay) play()
    return watched
  }

  return {
    gameplayStart(): void {
      wantPlay = true
      if (!adRunning) play()
    },
    gameplayStop(): void {
      wantPlay = false
      if (!adRunning) halt()
    },
    async commercialBreak(): Promise<void> {
      if (adRunning) return
      await runAd(() => ads.commercialBreak().then(() => false))
    },
    rewarded(reason: RewardReason): Promise<boolean> {
      if (adRunning || !safeCanReward(ads)) return Promise.resolve(false)
      return runAd(() => ads.rewardedBreak(reason))
    },
    canReward: (): boolean => safeCanReward(ads),
    isAdRunning: (): boolean => adRunning,
    onAdChange(listener: (running: boolean) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function safeCanReward(ads: AdsPlatform): boolean {
  try {
    return ads.canReward()
  } catch {
    return false
  }
}
