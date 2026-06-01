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

  it('derives webhook event stream requirements from externalSignal predicates', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
      },
      stateTimeframes: [],
      scriptMetadata: {},
      orchestrationScopes: [],
      exprPool: [
        {
          id: 'expr_webhook_whale_buy',
          nodeType: 'predicate',
          payload: {
            kind: 'externalSignal',
            params: {
              provider: 'webhook',
              signalId: 'whale_buy',
              sourceFeedId: 'webhook.whale_buy',
              ttlMs: 60_000,
            },
          },
        },
      ],
    })

    expect(plan.eventStreams).toEqual([
      {
        provider: 'webhook',
        signalId: 'whale_buy',
        sourceFeedId: 'webhook.whale_buy',
        ttlMs: 60_000,
        schemaRef: 'webhook_event',
      },
    ])
  })

  it('derives funding and liquidation event stream requirements from market data predicates', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
      },
      stateTimeframes: [],
      scriptMetadata: {},
      orchestrationScopes: [],
      exprPool: [
        {
          id: 'expr_funding_positive',
          nodeType: 'predicate',
          payload: {
            kind: 'fundingRateCondition',
            params: { schemaRef: 'funding', sourceFeedId: 'funding.rate', operator: 'GT', value: 0 },
          },
        },
        {
          id: 'expr_long_liq_gt_1m',
          nodeType: 'predicate',
          payload: {
            kind: 'liquidationCondition',
            params: { schemaRef: 'liquidation', sourceFeedId: 'liquidation.events', operator: 'GT', side: 'long', value: 1_000_000 },
          },
        },
      ],
    })

    expect(plan.eventStreams).toEqual(expect.arrayContaining([
      { provider: 'external_feed', signalId: 'funding.rate', sourceFeedId: 'funding.rate', schemaRef: 'funding' },
      { provider: 'external_feed', signalId: 'liquidation.events', sourceFeedId: 'liquidation.events', schemaRef: 'liquidation' },
    ]))
  })
})
