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
  })

  it('preserves backend pnl values and maps null/undefined as expected', () => {
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
        deployAccountName: null,
        deployAt: null,
      },
      timeline: [],
    } as any)

    expect(record.totalPnl).toBe(0)
    expect(record.todayPnl).toBeNull()
    expect(record.status).toBe('running')
    expect(record.exchange).toBe('okx')
  })
})

