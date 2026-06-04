import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

const FRONT_ROOT = join(__dirname, '../..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('AggregatedOrderbookView markets', () => {
  it('loads available markets instead of limiting symbols to BTC and ETH', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('fetchAggregatedOrderbookMarkets')
    expect(source).toContain('availableMarkets')
    expect(source).not.toContain("onClick={() => setSymbol('BTC')}")
    expect(source).not.toContain("onClick={() => setSymbol('ETH')}")
  })

  it('includes hyperliquid in selectable aggregated orderbook venues', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('hyperliquid')
  })

  it('uses a dropdown for market symbols so hot coin lists fit', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('<select')
    expect(source).toContain('handleSymbolChange')
    expect(source).toContain('marketOptions.map')
    expect(source).toContain('ChevronDown')
  })

  it('does not keep fallback symbols visible when the live market list is empty', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('useState<AggregatedOrderbookMarket[]>([])')
    expect(source).toContain('setAvailableMarkets(markets)')
    expect(source).toContain('if (markets.length === 0) return')
  })

  it('sorts market symbols by hot-market priority before alphabetical fallback', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('HOT_MARKET_PRIORITY')
    expect(source).toContain('sortMarketsByPriority')
    expect(source).toContain("['BTC', 'ETH', 'SOL', 'BNB'")
  })

  it('uses symbol-specific tick-size options so small coins keep enough depth levels', () => {
    const source = readFrontSource('components/aggregated-orderbook/AggregatedOrderbookView.tsx')

    expect(source).toContain('getTickSizeOptionsForBase')
    expect(source).toContain("ADA: ['0.0001', '0.001', '0.01']")
    expect(source).toContain('getDefaultTickSizeForBase(nextMarket.base)')
    expect(source).not.toContain("options={['1', '10', '100']}")
  })
})
