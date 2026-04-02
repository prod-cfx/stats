import { describe, expect, it } from '@jest/globals'

import { formatSignedAbsoluteChange, formatSignedPercentChange } from './change-formatters'

describe('public companies change formatters', () => {
  it('formats 24h percent from API percent field', () => {
    expect(formatSignedPercentChange('1.236')).toBe('+1.24%')
    expect(formatSignedPercentChange('-0.5')).toBe('-0.50%')
  })

  it('falls back to deriving percent from absolute change + price', () => {
    // previous close 100 -> current 110, change 10 => +10%
    expect(formatSignedPercentChange(null, '10', '110')).toBe('+10.00%')
  })

  it('formats 1D absolute change from priceChange field', () => {
    expect(formatSignedAbsoluteChange('3.5')).toBe('+3.50')
    expect(formatSignedAbsoluteChange('-2')).toBe('-2.00')
  })
})
