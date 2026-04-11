import { mapAccountStrategyDetailToRecord, mapAccountStrategyListItemToRecord } from './ai-quant-strategy-api-adapter'

describe('ai-quant-strategy-api-adapter', () => {
  it('maps list item status and metrics with safe normalization', () => {
    const record = mapAccountStrategyListItemToRecord({
      id: 'inst-1',
      name: 'test strategy',
      status: 'paused' as any,
      exchange: 'unknown' as any,
      symbol: null,
      timeframe: null,
      positionPct: Number.NaN,
      isSubscribed: false,
      paramSchema: {
        type: 'object',
        properties: {
          threshold: { type: 'number' },
        },
      },
      paramValues: {
        threshold: 0.25,
      },
      schemaVersion: 'v1',
      metrics: {
        returnPct: Number.NaN,
        maxDrawdownPct: undefined as any,
        winRatePct: null as any,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
    } as any)

    expect(record.status).toBe('stopped')
    expect(record.exchange).toBe('binance')
    expect(record.symbol).toBe('--')
    expect(record.timeframe).toBe('--')
    expect(record.positionPct).toBe(0)
    expect(record.metrics).toEqual({
      returnPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      tradeCount: 0,
    })
    expect(record.paramSchema).toEqual({
      type: 'object',
      properties: {
        threshold: { type: 'number' },
      },
    })
    expect(record.paramValues).toEqual({ threshold: 0.25 })
    expect(record.schemaVersion).toBe('v1')
    expect(record.supportsDynamicParams).toBe(true)
  })

  it('enforces dynamic param contract when schema is missing', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-2',
      name: 'detail strategy',
      status: 'running',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 12.5,
        maxDrawdownPct: 6.3,
        winRatePct: 50.1,
        tradeCount: 12,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: null,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        publishedSnapshotId: 'snapshot-2',
        snapshotHash: 'snapshot-hash-2',
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: {
          leverage: 3,
        },
        schemaVersion: null,
      },
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10120,
        availableBalance: 9800,
        totalPnl: 120,
        todayPnl: 20,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 1,
        closedPositionsCount: 3,
        totalRealizedPnl: 100,
        totalUnrealizedPnl: 20,
      },
      latestOrders: [{
        executedAt: '2026-03-20T01:00:00.000Z',
        side: 'BUY',
        symbol: 'BTCUSDT',
        price: 68000,
        quantity: 0.01,
        fee: 0.2,
        feeCurrency: 'USDT',
        orderId: 'ord-1',
      }],
      timeline: [],
    } as any)

    expect(record.totalPnl).toBe(0)
    expect(record.todayPnl).toBeNull()
    expect(record.accountOverview).toEqual({
      initialBalance: 10000,
      totalEquity: 10120,
      availableBalance: 9800,
      totalPnl: 120,
      todayPnl: 20,
      baseCurrency: 'USDT',
    })
    expect(record.positionOverview).toEqual({
      openPositionsCount: 1,
      closedPositionsCount: 3,
      totalRealizedPnl: 100,
      totalUnrealizedPnl: 20,
    })
    expect(record.latestOrders).toHaveLength(1)
    expect(record.latestOrders[0]?.orderId).toBe('ord-1')
    expect(record.status).toBe('running')
    expect(record.exchange).toBe('okx')
    expect(record.publishedSnapshotId).toBe('snapshot-2')
    expect(record.snapshotHash).toBe('snapshot-hash-2')
    expect(record.paramSchema).toBeNull()
    expect(record.paramValues).toBeNull()
    expect(record.schemaVersion).toBeNull()
    expect(record.supportsDynamicParams).toBe(false)
  })

  it('normalizes paramValues to empty object when schema exists but values are absent', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-3',
      name: 'detail strategy 2',
      status: 'running',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '5m',
      positionPct: 20,
      isSubscribed: true,
      metrics: {
        returnPct: 1,
        maxDrawdownPct: 2,
        winRatePct: 3,
        tradeCount: 4,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 1,
      todayPnl: 1,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '5m',
        positionPct: 20,
        deployAccountName: null,
        deployAt: null,
        paramSchema: {
          type: 'object',
          properties: {
            leverage: { type: 'number' },
          },
        },
        paramValues: undefined as any,
        schemaVersion: 'v2',
      },
      timeline: [],
    } as any)

    expect(record.paramSchema).toEqual({
      type: 'object',
      properties: {
        leverage: { type: 'number' },
      },
    })
    expect(record.paramValues).toEqual({})
    expect(record.schemaVersion).toBe('v2')
    expect(record.supportsDynamicParams).toBe(true)
  })

  it('derives detail initialCapital from account overview initial balance when available', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-4',
      name: 'detail strategy 3',
      status: 'running',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 60000 }],
      snapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
      },
      accountOverview: {
        initialBalance: 60000,
        totalEquity: 60000,
        availableBalance: 60000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      timeline: [],
      latestOrders: [],
    } as any)

    expect(record.initialCapital).toBe(60000)
  })

  it('prefers snapshot-truth display fields over drifted live fields', () => {
    const record = mapAccountStrategyDetailToRecord({
      id: 'inst-snapshot',
      name: 'snapshot detail',
      status: 'running',
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '5m',
      positionPct: 5,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      snapshot: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 12,
        publishedSnapshotId: 'snapshot-9',
        snapshotHash: 'snapshot-hash-9',
        deployAccountName: null,
        deployAt: null,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
      },
      accountOverview: {
        initialBalance: 10000,
        totalEquity: 10000,
        availableBalance: 10000,
        totalPnl: 0,
        todayPnl: 0,
        baseCurrency: 'USDT',
      },
      positionOverview: {
        openPositionsCount: 0,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      },
      latestOrders: [],
      timeline: [],
    } as any)

    expect(record.exchange).toBe('binance')
    expect(record.symbol).toBe('BTCUSDT')
    expect(record.timeframe).toBe('15m')
    expect(record.positionPct).toBe(12)
  })

})
