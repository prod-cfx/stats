import type { BacktestRunInput, SignalIntent } from './backtesting.types'

describe('backtesting types', () => {
  it('should allow target-position intent', () => {
    const intent: SignalIntent = { type: 'TARGET_POSITION', targetQty: 1 }
    expect(intent.type).toBe('TARGET_POSITION')
  })

  it('should shape run input', () => {
    const input: BacktestRunInput = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: { id: 's1', params: {}, fn: () => ({ type: 'NOOP' }) },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    expect(input.symbols).toHaveLength(1)
  })
})
