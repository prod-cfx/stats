import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.getStrategyDetail', () => {
  it('builds detail payload with equity series and mixed timeline', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'BTC 动量突破',
        status: 'running',
        createdBy: 'user-1',
        params: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '3m/15m', positionPct: 10 },
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [{
          userId: 'user-1',
          status: 'active',
          customParams: null,
          subscribedAt: new Date('2026-03-20T10:00:00.000Z'),
          exchangeAccount: { name: '主账户' },
        }],
        startedAt: new Date('2026-03-20T10:01:00.000Z'),
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-1',
        initialBalance: 10000,
        equity: 12000,
        totalRealizedPnl: 1500,
        totalUnrealizedPnl: 500,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([
        { date: new Date('2026-03-19T00:00:00.000Z'), equityEnd: 10100, maxDrawdown: 5.5, realizedPnl: 30, unrealizedPnl: 40 },
      ]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 74, closedCount: 10, winningCount: 6 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: {
          createdAt: new Date('2026-03-18T10:00:00.000Z'),
          startedAt: new Date('2026-03-20T10:01:00.000Z'),
          stoppedAt: null,
        },
        subscription: { subscribedAt: new Date('2026-03-20T10:00:00.000Z') },
        signalExecutions: [{ createdAt: new Date('2026-03-20T11:00:00.000Z'), status: 'SUCCESS', errorMessage: null }],
        trades: [{ executedAt: new Date('2026-03-20T11:01:00.000Z'), side: 'BUY', symbol: 'BTCUSDT', price: 68000 }],
      }),
    }
    const statsService = { calculateStats: jest.fn().mockResolvedValue(null), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }

    const service = new AccountStrategyViewService(repo as any, statsService as any, strategyInstancesService as any)
    const detail = await service.getStrategyDetail('user-1', 'inst-1')

    expect(detail.id).toBe('inst-1')
    expect(detail.metrics.tradeCount).toBe(74)
    expect(detail.snapshot.deployAccountName).toBe('主账户')
    expect(detail.equitySeries.length).toBe(1)
    expect(detail.timeline.some(e => e.eventType === 'system')).toBe(true)
    expect(detail.timeline.some(e => e.eventType === 'trade')).toBe(true)
    expect(detail.timeline[0]?.event).toBe('创建策略')
  })

  it('falls back to instance stats tradeCount when account trade stats are empty', async () => {
    const repo = {
      findStrategyForUser: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'BTC 动量突破',
        status: 'running',
        createdBy: 'user-1',
        params: null,
        strategyTemplateId: 'tpl-1',
        strategyTemplate: { defaultParams: {} },
        subscriptions: [],
        startedAt: null,
        updatedAt: new Date('2026-03-20T10:02:00.000Z'),
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'acc-1',
        initialBalance: 10000,
        equity: 12000,
        totalRealizedPnl: 1500,
        totalUnrealizedPnl: 500,
      }),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
      loadTradeStats: jest.fn().mockResolvedValue({ tradeCount: 0, closedCount: 0, winningCount: 0 }),
      loadTimeline: jest.fn().mockResolvedValue({
        instance: { createdAt: new Date('2026-03-18T10:00:00.000Z') },
        subscription: null,
        signalExecutions: [],
        trades: [],
      }),
    }
    const statsService = {
      calculateStats: jest.fn().mockResolvedValue({
        totalTradesCount: 74,
        maxDrawdown: 12.3,
        winRate: 58.4,
      }),
      calculateBatchStats: jest.fn(),
    }
    const strategyInstancesService = { updateInstance: jest.fn() }

    const service = new AccountStrategyViewService(repo as any, statsService as any, strategyInstancesService as any)
    const detail = await service.getStrategyDetail('user-1', 'inst-1')

    expect(detail.metrics.tradeCount).toBe(74)
  })
})
