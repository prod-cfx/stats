import { normalizeExecutionSymbol, normalizeLedgerSymbol } from './symbol-normalizer'

describe('normalizeExecutionSymbol', () => {
  it('normalizes OKX native dash symbols without inventing a different market', () => {
    expect(normalizeExecutionSymbol('BTC-USDT-SWAP', 'perp', 'okx')).toBe('BTC/USDT:PERP')
    expect(normalizeExecutionSymbol('BTC-USDT', 'spot', 'okx')).toBe('BTC/USDT')
  })
})

describe('normalizeLedgerSymbol', () => {
  it('removes market suffixes before ledger position lookup', () => {
    expect(normalizeLedgerSymbol('BTCUSDT:PERP')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTCUSDT:SPOT')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTC/USDT:SPOT')).toBe('BTCUSDT')
    expect(normalizeLedgerSymbol('BTC-USDT-SWAP')).toBe('BTCUSDT')
  })
})
