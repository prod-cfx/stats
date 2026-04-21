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

  it('emits ambiguities for remaining missing execution-context fields', () => {
    const result = service.resolve({
      riskRules: {
        exchange: 'okx',
        positionPct: 10,
      },
    })

    expect(result.context).toEqual({
      exchange: 'okx',
      symbol: null,
      marketType: null,
      timeframe: null,
    })
    expect(result.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution_context_missing',
        field: 'symbol',
        reason: 'missing_symbol',
      }),
      expect.objectContaining({
        kind: 'execution_context_missing',
        field: 'marketType',
        reason: 'missing_market_type',
      }),
      expect.objectContaining({
        kind: 'execution_context_missing',
        field: 'timeframe',
        reason: 'missing_timeframe',
      }),
    ]))
  })

  it('prefers market scope over risk-rule fallbacks when both are present', () => {
    const result = service.resolve({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
      },
      market: {
        exchange: 'hyperliquid',
        marketType: 'perp',
        defaultTimeframe: '3m',
      },
    })

    expect(result.context).toEqual({
      exchange: 'hyperliquid',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '3m',
    })
    expect(result.ambiguities).toEqual([])
  })

  it('keeps symbol missing when only a base asset is provided', () => {
    const result = service.resolve({
      symbols: ['BTC'],
      timeframes: ['1h'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
      },
      market: {
        defaultTimeframe: '1h',
      },
    })

    expect(result.context).toEqual({
      exchange: 'okx',
      symbol: null,
      marketType: 'spot',
      timeframe: '1h',
    })
    expect(result.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution_context_missing',
        field: 'symbol',
        reason: 'missing_symbol',
      }),
    ]))
  })

  it('accepts complete pair inputs across spot and perp notations', () => {
    const spot = service.resolve({
      symbols: ['BTC/USDT'],
      riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10 },
      market: { defaultTimeframe: '1h' },
    } as any)
    const perp = service.resolve({
      symbols: ['BTC-USDT-SWAP'],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
      market: { defaultTimeframe: '1h' },
    } as any)

    expect(spot.context.symbol).toBe('BTCUSDT')
    expect(perp.context.symbol).toBe('BTCUSDT')
  })

  it('does not force timeframe as a blocker when the strategy remains uniquely compilable without it', () => {
    const result = service.resolve({
      symbols: ['BTCUSDT'],
      market: { exchange: 'okx', marketType: 'perp' },
      entryRules: ['在 60000-80000 区间执行网格低买高卖'],
      exitRules: [],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.ambiguities).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'timeframe' })]),
    )
    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'timeframe_not_required_for_uniqueness' })]),
    )
  })

  it('does not force timeframe as a blocker for upper-grid-sell closed-loop wording', () => {
    const result = service.resolve({
      symbols: ['BTCUSDT'],
      market: { exchange: 'okx', marketType: 'perp' },
      entryRules: ['在 60000-80000 区间执行网格买入'],
      exitRules: ['价格触达上方网格时执行网格卖出平仓'],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.ambiguities).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'timeframe' })]),
    )
    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'timeframe_not_required_for_uniqueness' })]),
    )
  })
})
