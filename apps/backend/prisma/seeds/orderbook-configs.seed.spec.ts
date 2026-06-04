import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('orderbook config seed', () => {
  const source = readFileSync(join(__dirname, 'orderbook-configs.seed.ts'), 'utf8')

  it('keeps a broad hot-market base list for aggregated orderbook search', () => {
    for (const base of ['LTC', 'BCH', 'DOT', 'TRX', 'TON', 'SUI', 'AAVE', 'UNI', 'NEAR', 'ARB', 'OP', 'APT', 'ETC', 'FIL', 'INJ', 'ATOM', 'SEI', 'WIF', 'ENA']) {
      expect(source).toContain(`'${base}'`)
    }
  })

  it('keeps Hyperliquid spot limited to real USDC spot markets that share CEX bases', () => {
    expect(source).toContain("{ base: 'BTC', spotIndex: 142 }")
    expect(source).toContain("{ base: 'ETH', spotIndex: 151 }")
    expect(source).toContain("{ base: 'SOL', spotIndex: 156 }")
    expect(source).toContain("{ base: 'HYPE', spotIndex: 107 }")
  })
})
