import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from './settings'

class MemoryStorage {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.get(k) ?? null }
  setItem(k: string, v: string): void { this.map.set(k, v) }
  removeItem(k: string): void { this.map.delete(k) }
}

describe('settings', () => {
  beforeEach(() => {
    ;(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage()
  })

  it('starts with manual gas, sound on and the given quality', () => {
    expect(loadSettings('low')).toEqual({ ...DEFAULT_SETTINGS, quality: 'low' })
    expect(DEFAULT_SETTINGS.autoGas).toBe(false)
    expect(DEFAULT_SETTINGS.sound).toBe(true)
  })

  it('falls back to defaults for broken JSON', () => {
    localStorage.setItem('kupa-avcilari-settings-v1', '{not json')
    expect(loadSettings('high')).toEqual({ ...DEFAULT_SETTINGS, quality: 'high' })
  })

  it('keeps valid fields and repairs invalid ones', () => {
    expect(parseSettings({ autoGas: true, quality: 'ultra', sound: 'yes', formHints: true }, 'low'))
      .toEqual({ ...DEFAULT_SETTINGS, autoGas: true, quality: 'low', formHints: true })
  })

  it('round-trips through storage', () => {
    const s = { ...DEFAULT_SETTINGS, autoGas: true, quality: 'low' as const }
    saveSettings(s)
    expect(loadSettings('high')).toEqual(s)
  })
})
