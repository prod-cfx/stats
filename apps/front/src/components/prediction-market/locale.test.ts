import { describe, expect, it } from '@jest/globals'

import { toPolymarketLocale } from './locale'

describe('toPolymarketLocale', () => {
  it('maps zh variants to zh', () => {
    expect(toPolymarketLocale('zh')).toBe('zh')
    expect(toPolymarketLocale('zh-CN')).toBe('zh')
    expect(toPolymarketLocale('ZH-hans')).toBe('zh')
  })

  it('maps non-zh to en', () => {
    expect(toPolymarketLocale('en')).toBe('en')
    expect(toPolymarketLocale('en-US')).toBe('en')
    expect(toPolymarketLocale('fr')).toBe('en')
    expect(toPolymarketLocale('')).toBe('en')
    expect(toPolymarketLocale(undefined)).toBe('en')
  })
})
