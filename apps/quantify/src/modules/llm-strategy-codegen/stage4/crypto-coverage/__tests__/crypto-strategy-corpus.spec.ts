import { CRYPTO_STRATEGY_COVERAGE_CORPUS } from '../crypto-strategy-corpus'

describe('crypto strategy coverage corpus', () => {
  it('contains only natural-language entry cases with atom expectations', () => {
    const invalid = CRYPTO_STRATEGY_COVERAGE_CORPUS.filter(item =>
      item.initialUserMessage.trim().length === 0 || item.expectedAtomKeys.length === 0,
    )
    expect(invalid).toEqual([])
  })

  it('includes B-scope orderbook, portfolio risk, execution, and C-scope unsupported samples', () => {
    const ids = new Set(CRYPTO_STRATEGY_COVERAGE_CORPUS.map(item => item.id))
    expect(ids.has('crypto-b-orderbook-spread-post-only')).toBe(true)
    expect(ids.has('crypto-b-portfolio-daily-loss-kill-switch')).toBe(true)
    expect(ids.has('crypto-b-limit-chase-reduce-only')).toBe(true)
    expect(ids.has('crypto-c-cross-exchange-transfer-arbitrage')).toBe(true)
    expect(ids.has('crypto-c-triangular-arbitrage-matching')).toBe(true)
    expect(ids.has('crypto-c-hft-market-making')).toBe(true)
    expect(ids.has('crypto-c-order-queue-alpha')).toBe(true)
  })

  it('uses labels as report dimensions, not task ownership', () => {
    const caseWithMultipleLabels = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === 'crypto-b-orderbook-spread-post-only')
    expect(caseWithMultipleLabels?.labels).toEqual(['orderbook', 'execution'])
  })
})
