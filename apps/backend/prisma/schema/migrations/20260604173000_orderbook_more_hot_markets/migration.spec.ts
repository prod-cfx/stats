import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('20260604173000_orderbook_more_hot_markets migration', () => {
  const sql = readFileSync(join(__dirname, 'migration.sql'), 'utf8')

  it('upserts additional hot bases for CEX spot and perpetual venues', () => {
    for (const base of ['LTC', 'BCH', 'DOT', 'TRX', 'TON', 'SUI', 'AAVE', 'UNI', 'NEAR', 'ARB', 'OP', 'APT', 'ETC', 'FIL', 'INJ', 'ATOM', 'SEI', 'WIF', 'ENA']) {
      expect(sql).toContain(`('${base}'`)
    }

    expect(sql).toContain("('BINANCE', 0)")
    expect(sql).toContain("('BYBIT', 1)")
    expect(sql).toContain("('BITMAX', 2)")
    expect(sql).toContain("('OKX', 3)")
    expect(sql).toContain("('SPOT', 0)")
    expect(sql).toContain("('PERPETUAL', 1)")
  })

  it('upserts Hyperliquid perpetual rows for the same additional hot bases', () => {
    expect(sql).toContain("base_asset || 'USDT.HYPERLIQUID.PERPETUAL'")
    expect(sql).toContain("'HYPERLIQUID' AS venue")
  })
})
