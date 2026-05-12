import { normalizeExecutionSymbol, normalizeLedgerSymbol } from './symbol-normalizer'

describe('normalizeExecutionSymbol', () => {
  it('normalizes OKX native swap ids before open-order lookup', () => {
    expect(normalizeExecutionSymbol('BTC-USDT-SWAP', 'perp', 'okx')).toBe('BTC/USDT:PERP')
  })
})

describe('normalizeLedgerSymbol', () => {
  it('removes market suffixes before ledger position lookup', () => {
    expect(normalizeLedgerSymbol('BTCUSDT:PERP')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTCUSDT:SPOT')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTC/USDT:SPOT')).toBe('BTCUSDT')
  })
})
