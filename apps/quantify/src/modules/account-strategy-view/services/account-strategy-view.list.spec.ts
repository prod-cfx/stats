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
            defaultParams: {
              timeframe: '1m/5m',
              riskMode: 'balanced',
            },
            customParams: {
              riskMode: 'aggressive',
            },
            strategySchema: {
              type: 'object',
              properties: {
                timeframe: { type: 'string' },
                riskMode: { type: 'string' },
              },
            },
            schemaVersion: 'v3',
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

    const service = new AccountStrategyViewService(repo as any, statsService as any, null as any)

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
      paramSchema: {
        type: 'object',
        properties: {
          timeframe: { type: 'string' },
          riskMode: { type: 'string' },
        },
      },
      paramValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '3m/15m',
        positionPct: 10,
        riskMode: 'aggressive',
      },
      schemaVersion: 'v3',
      isSubscribed: true,
      metrics: {
        returnPct: 21.8,
        maxDrawdownPct: 12.3,
        winRatePct: 58.4,
        tradeCount: 74,
      },
    })
  })

  it('returns null dynamic param fields when strategy schema is missing', async () => {
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [{
          id: 'inst-legacy',
          name: 'Legacy 模板策略',
          status: 'running',
          params: { exchange: 'binance', symbol: 'ETHUSDT' },
          defaultParams: { timeframe: '1h' },
          customParams: { positionPct: 20 },
          strategySchema: null,
          schemaVersion: 'v2',
          updatedAt: new Date('2026-03-20T10:00:00.000Z'),
          subscribed: true,
        }],
      }),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map()),
    }

    const service = new AccountStrategyViewService(repo as any, statsService as any, null as any)
    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(result.items[0]?.paramSchema).toBeNull()
    expect(result.items[0]?.paramValues).toBeNull()
    expect(result.items[0]?.schemaVersion).toBeNull()
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

    const service = new AccountStrategyViewService(repo as any, statsService as any, null as any)
    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(result.items[0]?.status).toBe('stopped')
    expect(result.items[0]?.metrics.returnPct).toBe(0)
  })
})
