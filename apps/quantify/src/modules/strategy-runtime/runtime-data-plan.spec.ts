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

  it('derives orderbook and open interest event stream requirements from upgraded atom predicates', () => {
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
          id: 'expr_orderbook_bid_dominant',
          nodeType: 'predicate',
          payload: {
            kind: 'orderbookImbalance',
            params: { sourceFeedId: 'orderbook.imbalance', side: 'bid', operator: 'GT', value: 1.5 },
          },
        },
        {
          id: 'expr_oi_up_5pct',
          nodeType: 'predicate',
          payload: {
            kind: 'openInterestCondition',
            params: { sourceFeedId: 'open_interest', direction: 'up', operator: 'GTE', value: 5 },
          },
        },
      ],
    })

    expect(plan.eventStreams).toEqual(expect.arrayContaining([
      { provider: 'external_feed', signalId: 'orderbook.imbalance', sourceFeedId: 'orderbook.imbalance', schemaRef: 'orderbook' },
      { provider: 'external_feed', signalId: 'open_interest', sourceFeedId: 'open_interest', schemaRef: 'open_interest' },
    ]))
  })

  it('derives fallback event stream requirements when upgraded atom params are omitted', () => {
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
        { id: 'expr_orderbook', nodeType: 'predicate', payload: { kind: 'orderbookImbalance' } },
        { id: 'expr_oi', nodeType: 'predicate', payload: { kind: 'openInterestCondition' } },
      ],
    })

    expect(plan.eventStreams).toEqual(expect.arrayContaining([
      { provider: 'external_feed', signalId: 'orderbook.imbalance', sourceFeedId: 'orderbook.imbalance', schemaRef: 'orderbook' },
      { provider: 'external_feed', signalId: 'open_interest', sourceFeedId: 'open_interest', schemaRef: 'open_interest' },
    ]))
  })

  it('derives event stream requirements from rules-only signal catalog predicates', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '1m',
      },
      stateTimeframes: [],
      scriptMetadata: {},
      orchestrationScopes: [],
      exprPool: {
        signalCatalog: {
          predicates: [
            {
              id: 'orderbook_depth_ratio',
              kind: 'orderbookImbalance',
              params: { schemaRef: 'orderbook', sourceFeedId: 'orderbook.imbalance' },
            },
            {
              id: 'spread_expand',
              kind: 'externalSignal',
              params: { provider: 'webhook', signalId: 'spread_expand', sourceFeedId: 'webhook.spread_expand' },
            },
          ],
        },
      },
    })

    expect(plan.eventStreams).toEqual(expect.arrayContaining([
      { provider: 'external_feed', signalId: 'orderbook.imbalance', sourceFeedId: 'orderbook.imbalance', schemaRef: 'orderbook' },
      { provider: 'webhook', signalId: 'spread_expand', sourceFeedId: 'webhook.spread_expand', schemaRef: 'webhook_event' },
    ]))
  })
})
