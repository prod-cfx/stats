import { MARKET_TIMEFRAMES } from '@ai/shared'
import {
  isLegacyDefaultBacktestCapabilityConfig,
  resolveConfiguredBacktestCapabilityConfig,
  normalizeBacktestCapabilityConfig,
} from './backtest-capability-config'

describe('backtestCapabilityConfig', () => {
  it('defaults allowed base timeframes to all supported market timeframes', () => {
    expect(resolveConfiguredBacktestCapabilityConfig({})).toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: [...MARKET_TIMEFRAMES],
    })
  })

  it('identifies the exact legacy default capability tuple', () => {
    expect(isLegacyDefaultBacktestCapabilityConfig({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })).toBe(true)
  })

  it('preserves the legacy default tuple in online reads until an explicit repair runs', () => {
    expect(normalizeBacktestCapabilityConfig({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })).toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })
  })

  it('preserves explicit narrowed capability configs when they are not the legacy default tuple', () => {
    expect(normalizeBacktestCapabilityConfig({
      allowedSymbols: ['ETHUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })).toEqual({
      allowedSymbols: ['ETHUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })
  })

  it('rejects configs containing unsupported base timeframes', () => {
    expect(normalizeBacktestCapabilityConfig({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['3m', 'not-a-timeframe'],
    })).toBeNull()
  })

  it('preserves the valid timeframe subset when env config mixes valid and invalid values', () => {
    expect(resolveConfiguredBacktestCapabilityConfig({
      BACKTEST_CAPABILITY_ALLOWED_SYMBOLS: 'BTCUSDT,ETHUSDT',
      BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES: '3m,not-a-timeframe',
    })).toEqual({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['3m'],
    })
  })

  it('throws when env config provides only invalid base timeframes', () => {
    expect(() => resolveConfiguredBacktestCapabilityConfig({
      BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES: 'not-a-timeframe',
    })).toThrow('BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES')
  })
})
