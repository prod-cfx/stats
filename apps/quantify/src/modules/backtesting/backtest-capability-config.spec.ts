import { MARKET_TIMEFRAMES } from '@ai/shared'
import {
  normalizeBacktestCapabilityConfig,
  resolveConfiguredBacktestCapabilityConfig,
} from './backtest-capability-config'

describe('backtestCapabilityConfig', () => {
  it('defaults allowed base timeframes to all supported market timeframes', () => {
    expect(resolveConfiguredBacktestCapabilityConfig({})).toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: [...MARKET_TIMEFRAMES],
    })
  })

  it('upgrades legacy default timeframe config to all supported market timeframes', () => {
    expect(normalizeBacktestCapabilityConfig({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })).toEqual({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: [...MARKET_TIMEFRAMES],
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

  it('falls back to shared defaults when env config contains unsupported base timeframes', () => {
    expect(resolveConfiguredBacktestCapabilityConfig({
      BACKTEST_CAPABILITY_ALLOWED_SYMBOLS: 'BTCUSDT,ETHUSDT',
      BACKTEST_CAPABILITY_ALLOWED_BASE_TIMEFRAMES: '3m,not-a-timeframe',
    })).toEqual({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: [...MARKET_TIMEFRAMES],
    })
  })
})
