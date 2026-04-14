import { StrategyExecutionContextService } from '../strategy-execution-context.service'

describe('strategyExecutionContextService', () => {
  const service = new StrategyExecutionContextService()

  it('resolves exchange symbol marketType and timeframe from checklist truth', () => {
    const result = service.resolve({
      symbols: [' BTCUSDT '],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'binance',
        marketType: 'perp',
        positionPct: 10,
      },
      market: {
        defaultTimeframe: '3m',
      },
    })

    expect(result.context).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '3m',
    })
    expect(result.ambiguities).toEqual([])
  })

  it('emits execution-context ambiguity when exchange is missing', () => {
    const result = service.resolve({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      riskRules: {
        marketType: 'spot',
        positionPct: 10,
      },
      market: {
        defaultTimeframe: '1h',
      },
    })

    expect(result.context).toEqual({
      exchange: null,
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '1h',
    })
    expect(result.ambiguities).toEqual([
      expect.objectContaining({
        kind: 'execution_context_missing',
        field: 'exchange',
        reason: 'missing_exchange',
      }),
    ])
  })
})
