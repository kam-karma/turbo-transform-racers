/**
 * Versioned save + the store that keeps it in browser storage.
 * Storage is injected (tests pass a fake; the game passes nothing and gets localStorage when the
 * browser allows it). Nothing here throws: blocked or full storage just means an in-memory save.
 */
import { defaultSave, type SaveData } from './saveData'
import { repairSave } from './saveRepair'

export { SAVE_VERSION, defaultLook, defaultPerf, defaultSave } from './saveData'
export type { DailyTask, SaveData, SaveOffers, StarSet } from './saveData'
export { repairSave } from './saveRepair'

export const SAVE_KEY = 'kupa-avcilari-save-v1'
/** A save that could not be parsed is copied here once, so it is not lost silently. */
const CORRUPT_KEY = `${SAVE_KEY}-bozuk`

/** The part of the DOM Storage API the store uses (window.localStorage fits). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type SaveListener = (save: SaveData) => void

function browserStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage
    return ls ?? null
  } catch {
    // Some sandboxed iframes throw on mere access.
    return null
  }
}

export class SaveStore {
  private readonly storage: StorageLike | null
  private readonly listeners = new Set<SaveListener>()
  private current: SaveData

  /** `undefined` → browser localStorage when available; `null` → memory only. */
  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? browserStorage() : storage
    this.current = this.load()
  }

  /** The current save. Do not mutate it; use update(). */
  get(): SaveData {
    return this.current
  }

  /**
   * Replaces the save with `fn(current)` (repaired, persisted, listeners told) and returns it.
   * If `fn` throws, the save stays as it was.
   */
  update(fn: (s: SaveData) => SaveData): SaveData {
    let next: SaveData
    try {
      next = repairSave(fn(this.current))
    } catch (error) {
      console.error('Save update failed, keeping the previous save:', error)
      return this.current
    }
    this.current = next
    this.write(next)
    this.emit()
    return next
  }

  /** Starts over with a new player's save. */
  reset(): void {
    this.current = defaultSave()
    try {
      this.storage?.removeItem(SAVE_KEY)
    } catch (error) {
      console.error('Saved game could not be cleared:', error)
    }
    this.emit()
  }

  /** Called after every update/reset. Returns an unsubscribe function. */
  subscribe(listener: SaveListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private load(): SaveData {
    let text: string | null = null
    try {
      text = this.storage?.getItem(SAVE_KEY) ?? null
    } catch (error) {
      console.error('Saved game could not be read:', error)
      return defaultSave()
    }
    if (text === null) return defaultSave()
    try {
      return repairSave(JSON.parse(text) as unknown)
    } catch {
      this.keepCorrupt(text)
      return defaultSave()
    }
  }

  private keepCorrupt(text: string): void {
    try {
      this.storage?.setItem(CORRUPT_KEY, text)
    } catch {
      // Nothing more to do: the game goes on with a new save.
    }
  }

  private write(save: SaveData): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(save))
    } catch (error) {
      console.error('Game could not be saved:', error)
    }
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(this.current)
      } catch (error) {
        console.error('Save listener failed:', error)
      }
    }
  }
}
