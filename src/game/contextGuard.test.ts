import { describe, expect, it } from 'vitest'
import { lossAction } from './contextGuard'

describe('lossAction', () => {
  it('steps down to Low the first time the context is lost on High', () => {
    expect(lossAction('high', false)).toBe('drop-to-low')
  })

  it('never reloads twice in one session (no reload loop)', () => {
    expect(lossAction('high', true)).toBe('wait')
  })

  it('leaves Low to the renderer restore', () => {
    expect(lossAction('low', false)).toBe('wait')
  })
})
