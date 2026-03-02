import { describe, expect, it } from 'vitest'
import type { CryptoStockQuoteLatest } from '@/lib/api'
import { mergeQuotesBySymbol } from './merge-quotes'

const baseQuote = (overrides: Partial<CryptoStockQuoteLatest>): CryptoStockQuoteLatest =>
  ({
    id: 1,
    symbol: 'MSTR',
    name: 'MicroStrategy',
    exchange: 'NASDAQ',
    price: '100',
    openPrice: null,
    highPrice: null,
    lowPrice: null,
    closePrice: null,
    volume: null,
    turnover: null,
    priceChange: null,
    priceChangePercent: null,
    marketCap: null,
    peRatio: null,
    high52Week: null,
    low52Week: null,
    assetSymbol: 'BTC',
    assetLogoUrl: null,
    companyLogoUrl: null,
    holdingsValue: '$1.00B',
    holdingsAmount: '1.00K BTC',
    mNav: '1.00',
    holdingValue: null,
    holdingQuantity: null,
    companyType: null,
    infoParagraphs: [],
    source: 'BBX_SCRAPER',
    quoteTimestamp: '2026-03-02T00:00:00.000Z',
    createdAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
    ...overrides,
  }) as CryptoStockQuoteLatest

describe('mergeQuotesBySymbol', () => {
  it('prefers BBX price change fields while keeping holdings fields', () => {
    const holdings = [
      baseQuote({
        symbol: 'MSTR',
        priceChangePercent: '0',
        priceChange: null,
        holdingsValue: '$58.00B',
        source: 'BBX_SCRAPER',
      }),
    ]
    const prices = [
      baseQuote({
        symbol: 'MSTR',
        price: '165.12',
        priceChangePercent: '2.37',
        priceChange: '3.82',
        holdingsValue: null,
        source: 'BBX',
      }),
    ]

    const merged = mergeQuotesBySymbol(holdings, prices)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.priceChangePercent).toBe('2.37')
    expect(merged[0]?.priceChange).toBe('3.82')
    expect(merged[0]?.holdingsValue).toBe('$58.00B')
  })

  it('keeps holdings quotes when no matching BBX symbol exists', () => {
    const holdings = [baseQuote({ symbol: 'COIN' })]
    const prices = [baseQuote({ symbol: 'MSTR', source: 'BBX', priceChangePercent: '1.20' })]

    const merged = mergeQuotesBySymbol(holdings, prices)
    expect(merged[0]?.symbol).toBe('COIN')
    expect(merged[0]?.source).toBe('BBX_SCRAPER')
  })
})
