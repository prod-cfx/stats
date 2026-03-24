import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.listStrategies', () => {
  it('maps strategy rows to list dto with stats', async () => {
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [
          {
            id: 'inst-1',
            name: 'BTC 动量突破',
            status: 'running',
            params: {
              exchange: 'binance',
              symbol: 'BTCUSDT',
              timeframe: '3m/15m',
              positionPct: 10,
            },
            updatedAt: new Date('2026-03-20T10:00:00.000Z'),
            subscribed: true,
          },
        ],
      }),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map([
        ['inst-1', { totalPnlRate: 21.8, maxDrawdown: 12.3, winRate: 58.4, totalTradesCount: 74 }],
      ])),
    }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      marketDataIngestionService as any,
    )

    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20, status: 'running' })

    expect(result.total).toBe(1)
    expect(repo.listStrategiesForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      page: 1,
      limit: 20,
      status: 'running',
    })
    expect(result.items[0]).toMatchObject({
      id: 'inst-1',
      name: 'BTC 动量突破',
      status: 'running',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '3m/15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 21.8,
        maxDrawdownPct: 12.3,
        winRatePct: 58.4,
        tradeCount: 74,
      },
    })
  })

  it('maps paused strategy status to stopped for account ui', async () => {
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [{
          id: 'inst-2',
          name: 'ETH 回撤抄底',
          status: 'paused',
          params: null,
          updatedAt: new Date('2026-03-20T10:00:00.000Z'),
          subscribed: false,
        }],
      }),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map([
        ['inst-2', { totalPnlRate: 0, maxDrawdown: 0, winRate: 0, totalTradesCount: 0 }],
      ])),
    }

    const marketDataIngestionService = { ensureSymbolsSubscribed: jest.fn() }
    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      marketDataIngestionService as any,
    )
    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(result.items[0]?.status).toBe('stopped')
    expect(result.items[0]?.metrics.returnPct).toBe(0)
  })
})
