import { describe, expect, it } from '@jest/globals'
import { getCachedNumberFormatter } from '@/lib/number-format-cache'

describe('number format cache', () => {
  it('reuses equivalent locale and option formatters', () => {
    const first = getCachedNumberFormatter('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
    const second = getCachedNumberFormatter('en-US', {
      maximumFractionDigits: 2,
      notation: 'compact',
      currency: 'USD',
      style: 'currency',
    })

    expect(second).toBe(first)
  })

  it('keeps locale and option variants isolated', () => {
    const compact = getCachedNumberFormatter('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    })
    const currency = getCachedNumberFormatter('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
    const zhCompact = getCachedNumberFormatter('zh-CN', {
      notation: 'compact',
      maximumFractionDigits: 2,
    })

    expect(currency).not.toBe(compact)
    expect(zhCompact).not.toBe(compact)
  })

  it('matches native Intl.NumberFormat output', () => {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }

    expect(getCachedNumberFormatter('en-US', options).format(1234567)).toBe(
      new Intl.NumberFormat('en-US', options).format(1234567),
    )
  })
})
