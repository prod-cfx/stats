import { describe, expect, it, jest } from '@jest/globals'
import type { CryptoStockQuoteLatest } from '@/lib/api'
import { fetchPublicCompanyQuotes } from './fetch-public-company-quotes'

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

describe('fetchPublicCompanyQuotes', () => {
  it('returns holdings data when BBX fails', async () => {
    const holdings = [baseQuote({ symbol: 'MSTR', source: 'BBX_SCRAPER', holdingsValue: '$58.00B' })]
    const fetcher = jest.fn(async ({ source }: { source: 'BBX_SCRAPER' | 'BBX' }) => {
      if (source === 'BBX_SCRAPER') return holdings
      throw new Error('bbx failed')
    })

    const merged = await fetchPublicCompanyQuotes(fetcher)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.symbol).toBe('MSTR')
    expect(merged[0]?.holdingsValue).toBe('$58.00B')
  })

  it('returns BBX data when holdings source fails', async () => {
    const prices = [baseQuote({ symbol: 'MSTR', source: 'BBX', price: '165.12', holdingsValue: null })]
    const fetcher = jest.fn(async ({ source }: { source: 'BBX_SCRAPER' | 'BBX' }) => {
      if (source === 'BBX') return prices
      throw new Error('holdings failed')
    })

    const merged = await fetchPublicCompanyQuotes(fetcher)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.source).toBe('BBX')
    expect(merged[0]?.price).toBe('165.12')
  })

  it('throws when both sources fail', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('all failed')
    })

    await expect(fetchPublicCompanyQuotes(fetcher)).rejects.toThrow('all failed')
  })
})
