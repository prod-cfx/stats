import { normalizeLedgerSymbol } from './symbol-normalizer'

describe('normalizeLedgerSymbol', () => {
  it('removes market suffixes before ledger position lookup', () => {
    expect(normalizeLedgerSymbol('BTCUSDT:PERP')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTCUSDT:SPOT')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTC/USDT:SPOT')).toBe('BTCUSDT')
  })
})
