// Player settings, kept apart from progress so a reset never loses them.
export type Quality = 'low' | 'high'

export interface Settings {
  /** Car always on the throttle (the player only steers, brakes and transforms). */
  readonly autoGas: boolean
  readonly quality: Quality
  readonly sound: boolean
  /** Flash the needed form button before each surface change (always on in the first race). */
  readonly formHints: boolean
}

export const DEFAULT_SETTINGS: Settings = { autoGas: false, quality: 'high', sound: true, formHints: false }

const KEY = 'kupa-avcilari-settings-v1'

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

/** Repairs whatever was stored: unknown or wrong-typed fields fall back to the defaults. */
export function parseSettings(raw: unknown, quality: Quality): Settings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    autoGas: bool(o.autoGas, DEFAULT_SETTINGS.autoGas),
    quality: o.quality === 'low' || o.quality === 'high' ? o.quality : quality,
    sound: bool(o.sound, DEFAULT_SETTINGS.sound),
    formHints: bool(o.formHints, DEFAULT_SETTINGS.formHints),
  }
}

/** `quality` is the automatic first pick, used when nothing valid is stored. */
export function loadSettings(quality: Quality): Settings {
  try {
    const text = localStorage.getItem(KEY)
    return parseSettings(text === null ? null : JSON.parse(text), quality)
  } catch {
    return parseSettings(null, quality)
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private mode or full storage: settings simply do not persist.
  }
}
