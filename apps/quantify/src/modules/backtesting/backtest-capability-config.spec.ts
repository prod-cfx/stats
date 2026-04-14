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
})
