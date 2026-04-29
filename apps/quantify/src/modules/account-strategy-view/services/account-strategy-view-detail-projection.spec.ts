import { buildAccountStrategyLatestOrders, buildAccountStrategyMixedTimeline, buildAccountStrategyRuntimeSemanticSummary } from './account-strategy-view-detail-projection'

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

  it('excludes reconciliation sync trades from latest exchange order evidence', () => {
    const orders = buildAccountStrategyLatestOrders([
      {
        executedAt: new Date(Date.UTC(2026, 3, 29, 4, 30)),
        side: 'BUY',
        symbol: 'BTCUSDT',
        price: 76891.8,
        quantity: 4,
        fee: 0,
        feeCurrency: 'USDT',
        orderId: 'sync-adjust-position-1',
      },
      {
        executedAt: new Date(Date.UTC(2026, 3, 29, 4, 10)),
        side: 'BUY',
        symbol: 'BTCUSDT',
        price: 76891.8,
        quantity: 0.04,
        fee: 1.5,
        feeCurrency: 'USDT',
        orderId: 'okx-order-1',
      },
    ])

    expect(orders).toHaveLength(1)
    expect(orders[0]?.orderId).toBe('okx-order-1')
    expect(orders[0]?.quantity).toBe(0.04)
  })

  it('includes filled exchange executions that still require local ledger reconciliation', () => {
    const orders = buildAccountStrategyLatestOrders(
      [{
        executedAt: new Date(Date.UTC(2026, 3, 29, 6, 25, 1)),
        side: 'BUY',
        symbol: 'BTCUSDT',
        price: 77093,
        quantity: 0.0359,
        fee: 1.3,
        feeCurrency: 'USDT',
        orderId: 'okx-ledger-1',
      }],
      [{
        createdAt: new Date(Date.UTC(2026, 3, 29, 6, 45, 1)),
        status: 'FAILED',
        orderSide: 'BUY',
        errorMessage: 'Transaction API error: Unable to start a transaction',
        metadata: {
          ledgerApplied: false,
          reconcileRequired: true,
          orderResponse: {
            id: 'okx-missing-ledger-1',
            status: 'closed',
            amount: 0.031,
            filled: 0.031,
            price: 77093,
            createdAt: '2026-04-29T06:45:01.000Z',
            raw: {
              fee: '-1.2',
              feeCcy: 'USDT',
            },
          },
        },
        signal: {
          direction: 'BUY',
          signalType: 'ENTRY',
          symbol: { code: 'BTCUSDT' },
        },
      }],
    )

    expect(orders).toHaveLength(2)
    expect(orders[0]).toEqual(expect.objectContaining({
      orderId: 'okx-missing-ledger-1',
      source: 'execution_reconcile_required',
      ledgerApplied: false,
      reconcileRequired: true,
      executionStatus: 'FAILED',
      quantity: 0.031,
      fee: 1.2,
      feeCurrency: 'USDT',
    }))
    expect(orders[1]).toEqual(expect.objectContaining({
      orderId: 'okx-ledger-1',
      source: 'ledger',
      ledgerApplied: true,
      reconcileRequired: false,
    }))
  })
})

describe('buildAccountStrategyRuntimeSemanticSummary', () => {
  it('keeps reconciliation sync close trades out of exit order evidence', () => {
    const summary = buildAccountStrategyRuntimeSemanticSummary({
      status: 'running',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      openPositionsCount: 0,
      ruleSummary: {
        rules: [
          {
            phase: 'entry',
            label: '入场',
            conditions: ['close_1m > high_1m_1'],
            actions: ['OPEN_LONG'],
          },
          {
            phase: 'exit',
            label: '出场',
            conditions: ['close_1m < low_1m_1'],
            actions: ['CLOSE_LONG'],
          },
        ],
      },
      trades: [
        {
          executedAt: new Date(Date.UTC(2026, 3, 29, 10, 25)),
          side: 'SELL',
          symbol: 'BTCUSDT',
          price: 95000,
          quantity: 0.01,
          fee: 0,
          feeCurrency: 'USDT',
          orderId: 'sync-close-1777458341703',
        },
        {
          executedAt: new Date(Date.UTC(2026, 3, 29, 10, 20)),
          side: 'BUY',
          symbol: 'BTCUSDT',
          price: 94000,
          quantity: 0.01,
          fee: 0,
          feeCurrency: 'USDT',
          orderId: 'okx-entry-1',
        },
      ],
    })

    expect(summary.evidence.entryOrders).toEqual([
      { orderId: 'okx-entry-1', executedAt: '2026-04-29T10:20:00.000Z' },
    ])
    expect(summary.evidence.exitOrders).toEqual([])
    expect(summary.evidence.syncOrders).toEqual([
      { orderId: 'sync-close-1777458341703', executedAt: '2026-04-29T10:25:00.000Z' },
    ])
    expect(summary.evidence.latestExitOrderId).toBeNull()
    expect(summary.evidence.latestSyncOrderId).toBe('sync-close-1777458341703')
  })
})
