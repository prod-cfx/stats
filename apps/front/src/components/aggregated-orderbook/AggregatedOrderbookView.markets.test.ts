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
})
