import { buildAccountStrategyLatestOrders, buildAccountStrategyMixedTimeline } from './account-strategy-view-detail-projection'

describe('buildAccountStrategyMixedTimeline', () => {
  it('keeps the newest 30 events while preserving chronological display order', () => {
    const timeline = buildAccountStrategyMixedTimeline({
      instance: null,
      subscription: null,
      signalExecutions: Array.from({ length: 35 }, (_, index) => ({
        createdAt: new Date(Date.UTC(2026, 2, 20, 10, index)),
        status: 'SUCCESS',
        errorMessage: null,
      })),
      trades: [],
    })

    expect(timeline).toHaveLength(30)
    expect(timeline[0].at).toBe('2026-03-20T10:05:00.000Z')
    expect(timeline[29].at).toBe('2026-03-20T10:34:00.000Z')
  })
})

describe('buildAccountStrategyLatestOrders', () => {
  it('returns the newest trades first before truncating latest order evidence', () => {
    const orders = buildAccountStrategyLatestOrders(
      Array.from({ length: 12 }, (_, index) => ({
        executedAt: new Date(Date.UTC(2026, 2, 20, 10, index)),
        side: index % 2 === 0 ? 'BUY' : 'SELL',
        symbol: 'DOGEUSDT',
        price: 0.1,
        quantity: 100 + index,
        fee: 0,
        feeCurrency: 'USDT',
        orderId: `ord-${index}`,
      })),
    )

    expect(orders).toHaveLength(10)
    expect(orders[0]?.orderId).toBe('ord-11')
    expect(orders[9]?.orderId).toBe('ord-2')
  })
})
