import { buildMultiLegStrategyContext } from './context-builder'

describe('buildMultiLegStrategyContext', () => {
  it('derives compatibility state from recent bars only', () => {
    const bars = Array.from({ length: 120 }, (_, index) => ({
      open: index < 100 ? 200 : 100 + (index - 100),
      high: index < 100 ? 260 : 100.2 + (index - 100),
      low: index < 100 ? 140 : 99.8 + (index - 100),
      close: index < 100 ? 200 : 100 + (index - 100),
      volume: 1,
      timestamp: index,
    }))

    const context = buildMultiLegStrategyContext({
      data: {
        primary: {
          '15m': {
            bars,
            indicators: {},
            currentPrice: bars[bars.length - 1]!.close,
          },
        },
      },
      execution: { timeframe: '15m' },
      legs: [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      dataRequirements: { primary: ['15m'] },
      timestamp: bars[bars.length - 1]!.timestamp,
      params: { marketType: 'perp' },
    })

    expect(context.trendDirection).toBe('up')
    expect(context.volatilityState).toBe('low')
  })
})
