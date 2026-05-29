import { resolveRuntimeDataPlan } from './runtime-data-plan.resolver'

describe('resolveRuntimeDataPlan', () => {
  it('derives 15m primary clock plus 1h and 4h secondary series for EMA20 example', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
      },
      stateTimeframes: ['1h', '4h'],
      scriptMetadata: {
        indicators: [
          { indicator: 'ema', period: 20, timeframe: '15m' },
          { indicator: 'ema', period: 20, timeframe: '1h' },
          { indicator: 'ema', period: 20, timeframe: '4h' },
        ],
      },
      orchestrationScopes: [],
    })

    expect(plan.primaryClock).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    })
    expect(plan.marketSeries.map(item => item.timeframe)).toEqual(['15m', '1h', '4h'])
    expect(plan.indicators).toEqual([
      { indicator: 'ema', period: 20, timeframe: '15m' },
      { indicator: 'ema', period: 20, timeframe: '1h' },
      { indicator: 'ema', period: 20, timeframe: '4h' },
    ])
  })

  it('keeps explicit dataSource scopes separate from normal market series', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
      },
      stateTimeframes: [],
      scriptMetadata: {},
      orchestrationScopes: [
        {
          id: 'event-feed',
          scopeKind: 'dataSource',
          role: 'event',
          feedId: 'webhook.tradingview.alert',
          schemaRef: 'webhook_event',
        },
      ],
    })

    expect(plan.marketSeries.map(item => item.timeframe)).toEqual(['15m'])
    expect(plan.externalDataSources).toEqual([
      { role: 'event', feedId: 'webhook.tradingview.alert', schemaRef: 'webhook_event' },
    ])
  })
})
