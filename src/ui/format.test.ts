import { describe, expect, it } from 'vitest'
import { clamp01, formatCountdown, formatGold, formatTime, ordinal, parsePopText, speedFraction } from './format'

describe('formatTime', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatTime(83.456)).toBe('1:23.4')
    expect(formatTime(5)).toBe('0:05.0')
    expect(formatTime(59.99)).toBe('0:59.9')
    expect(formatTime(60)).toBe('1:00.0')
  })
  it('never shows negative or NaN time', () => {
    expect(formatTime(-3)).toBe('0:00.0')
    expect(formatTime(Number.NaN)).toBe('0:00.0')
  })
})

describe('formatGold', () => {
  it('uses dots as thousands separators', () => {
    expect(formatGold(0)).toBe('0')
    expect(formatGold(950)).toBe('950')
    expect(formatGold(1250)).toBe('1.250')
    expect(formatGold(1234567)).toBe('1.234.567')
    expect(formatGold(-1500)).toBe('-1.500')
  })
})

describe('formatCountdown', () => {
  it('is empty when nothing is left', () => {
    expect(formatCountdown(0)).toBe('')
    expect(formatCountdown(-5)).toBe('')
  })
  it('picks the two largest units', () => {
    expect(formatCountdown(45_000)).toBe('45 sn')
    expect(formatCountdown(12 * 60_000 + 5_000)).toBe('12 dk 05 sn')
    expect(formatCountdown(3 * 3_600_000 + 12 * 60_000)).toBe('3 sa 12 dk')
  })
  it('rounds partial seconds up', () => {
    expect(formatCountdown(400)).toBe('1 sn')
  })
})

describe('small helpers', () => {
  it('ordinal', () => {
    expect(ordinal(1)).toBe('1.')
    expect(ordinal(0)).toBe('1.')
  })
  it('speedFraction caps at 1', () => {
    expect(speedFraction(100)).toBe(0.5)
    expect(speedFraction(400)).toBe(1)
    expect(speedFraction(-5)).toBe(0)
  })
  it('clamp01', () => {
    expect(clamp01(2)).toBe(1)
    expect(clamp01(Number.NaN)).toBe(0)
  })
})

describe('parsePopText', () => {
  it('splits icon tokens from text', () => {
    expect(parsePopText('{form-boat} Yanlış form!')).toEqual([
      { kind: 'icon', name: 'form-boat' },
      { kind: 'text', text: 'Yanlış form!' },
    ])
  })
  it('keeps plain text and malformed braces', () => {
    expect(parsePopText('MÜKEMMEL!')).toEqual([{ kind: 'text', text: 'MÜKEMMEL!' }])
    expect(parsePopText('a {Bad Token} b')).toEqual([{ kind: 'text', text: 'a {Bad Token} b' }])
  })
  it('handles several tokens', () => {
    expect(parsePopText('+{coin}50{star}')).toEqual([
      { kind: 'text', text: '+' },
      { kind: 'icon', name: 'coin' },
      { kind: 'text', text: '50' },
      { kind: 'icon', name: 'star' },
    ])
  })
})
