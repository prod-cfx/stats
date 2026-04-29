import {
  canonicalizeStrategySymbolInput,
  isEquivalentMarketScopeValue,
  normalizeMarketScopeValue,
} from '../market-scope-equivalence'

describe('marketScopeEquivalence', () => {
  it('normalizes narrow market-scope values for comparison', () => {
    expect(normalizeMarketScopeValue('exchange', ' OKX ')).toBe('okx')
    expect(normalizeMarketScopeValue('marketType', ' PERP ')).toBe('perp')
    expect(normalizeMarketScopeValue('symbol', ' btcusdt ')).toBe('BTCUSDT')
    expect(normalizeMarketScopeValue('timeframe', ' 15M ')).toBe('15m')
  })

  it('canonicalizes complete strategy symbol inputs across spot and perp notations', () => {
    expect(canonicalizeStrategySymbolInput('btcusdt')).toBe('BTCUSDT')
    expect(canonicalizeStrategySymbolInput('BTC/USDT')).toBe('BTCUSDT')
    expect(canonicalizeStrategySymbolInput('BTC-USDT')).toBe('BTCUSDT')
    expect(canonicalizeStrategySymbolInput('BTC-USDT-SWAP')).toBe('BTCUSDT')
    expect(canonicalizeStrategySymbolInput('BTCUSDT:PERP')).toBe('BTCUSDT')
    expect(canonicalizeStrategySymbolInput('BTCUSDT:SPOT')).toBe('BTCUSDT')
  })

  it('rejects incomplete strategy symbol inputs that only provide a base asset', () => {
    expect(canonicalizeStrategySymbolInput('BTC')).toBeNull()
    expect(canonicalizeStrategySymbolInput('ETH')).toBeNull()
    expect(canonicalizeStrategySymbolInput('ORDI')).toBeNull()
  })

  it('rejects quote sizing answers that look like pure numeric symbols', () => {
    expect(canonicalizeStrategySymbolInput('1000USDT')).toBeNull()
    expect(canonicalizeStrategySymbolInput('1000-USDT')).toBeNull()
    expect(canonicalizeStrategySymbolInput('1INCHUSDT')).toBe('1INCHUSDT')
  })

  it('treats whitespace and casing drift as equivalent', () => {
    expect(isEquivalentMarketScopeValue('exchange', 'OKX', ' okx ')).toBe(true)
    expect(isEquivalentMarketScopeValue('marketType', 'PERP', 'perp')).toBe(true)
    expect(isEquivalentMarketScopeValue('symbol', 'BTCUSDT', ' btcusdt ')).toBe(true)
    expect(isEquivalentMarketScopeValue('timeframe', '15m', ' 15M ')).toBe(true)
  })

  it('does not collapse real market-scope changes', () => {
    expect(isEquivalentMarketScopeValue('exchange', 'okx', 'binance')).toBe(false)
    expect(isEquivalentMarketScopeValue('marketType', 'spot', 'perp')).toBe(false)
    expect(isEquivalentMarketScopeValue('symbol', 'BTCUSDT', 'ETHUSDT')).toBe(false)
    expect(isEquivalentMarketScopeValue('timeframe', '15m', '1h')).toBe(false)
  })
})
