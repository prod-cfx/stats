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
      findUserStrategyAccount: jest.fn(),
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

    const result = await service.listStrategies({
      userId: 'user-1',
      page: 1,
      limit: 20,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
    } as any)

    expect(result.total).toBe(1)
    expect(repo.listStrategiesForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      page: 1,
      limit: 20,
      status: 'running',
      subscribedOnly: true,
      excludeDraft: true,
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
      findUserStrategyAccount: jest.fn(),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map()),
    }
    const marketDataIngestionService = { ingestAndComputeIndicators: jest.fn() }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      marketDataIngestionService as any,
    )
    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(result.items[0]?.paramSchema).toBeNull()
    expect(result.items[0]?.metrics).toEqual({
      returnPct: null,
      maxDrawdownPct: null,
      winRatePct: null,
      tradeCount: null,
    })
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
      findUserStrategyAccount: jest.fn(),
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
    expect(repo.findUserStrategyAccount).not.toHaveBeenCalled()
  })

  it('does not borrow fallback account metrics from another strategy with the same symbol', async () => {
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [{
          id: 'inst-new',
          name: 'New BTC Strategy',
          status: 'running',
          strategyTemplateId: 'tpl-new',
          params: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
          defaultParams: null,
          customParams: null,
          strategySchema: null,
          schemaVersion: null,
          updatedAt: new Date('2026-04-01T08:00:00.000Z'),
          subscribed: true,
        }],
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'account-new',
        initialBalance: 1000,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 0,
      }),
      loadTradeStats: jest.fn().mockResolvedValue({
        tradeCount: 0,
        closedCount: 0,
        winningCount: 0,
      }),
      findLatestExecutedAccountByUserAndSymbol: jest.fn().mockResolvedValue({
        id: 'account-old',
        initialBalance: 1000,
        totalRealizedPnl: -12,
        totalUnrealizedPnl: -3,
      }),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map([
        ['inst-new', { totalPnlRate: 0, maxDrawdown: undefined, winRate: 0, totalTradesCount: 0 }],
      ])),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
    )

    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(repo.findUserStrategyAccount).not.toHaveBeenCalled()
    expect(result.items[0]?.metrics).toMatchObject({
      returnPct: 0,
      maxDrawdownPct: null,
      winRatePct: 0,
      tradeCount: 0,
    })
  })

  it('skips account fallback queries when batch stats are complete', async () => {
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [{
          id: 'inst-complete',
          name: 'Complete Stats Strategy',
          status: 'running',
          strategyTemplateId: 'tpl-complete',
          params: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
          defaultParams: null,
          customParams: null,
          strategySchema: null,
          schemaVersion: null,
          updatedAt: new Date('2026-05-15T07:33:00.000Z'),
          subscribed: true,
        }],
      }),
      findUserStrategyAccount: jest.fn(),
      loadTradeStats: jest.fn(),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map([
        ['inst-complete', { totalPnlRate: 12.5, maxDrawdown: 4.2, winRate: 66.67, totalTradesCount: 9 }],
      ])),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
    )

    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(repo.findUserStrategyAccount).not.toHaveBeenCalled()
    expect(repo.loadTradeStats).not.toHaveBeenCalled()
    expect(result.items[0]?.metrics).toMatchObject({
      returnPct: 12.5,
      maxDrawdownPct: 4.2,
      winRatePct: 66.67,
      tradeCount: 9,
    })
  })

  it('derives list metrics from account activity when instance stats are empty', async () => {
    const startedAt = new Date('2026-05-15T00:00:00.000Z')
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [{
          id: 'inst-live',
          name: 'Live BTC Strategy',
          status: 'running',
          strategyTemplateId: 'tpl-live',
          params: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m' },
          defaultParams: null,
          customParams: null,
          strategySchema: null,
          schemaVersion: null,
          startedAt,
          createdAt: startedAt,
          updatedAt: new Date('2026-05-15T07:33:00.000Z'),
          subscribed: true,
        }],
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'account-live',
        initialBalance: 1000,
        totalRealizedPnl: 999,
        totalUnrealizedPnl: 0,
      }),
      loadTradeStats: jest.fn().mockResolvedValue({
        tradeCount: 4,
        closedCount: 2,
        winningCount: 1,
      }),
      loadPositionOverview: jest.fn().mockResolvedValue({
        openCount: 1,
        closedCount: 2,
      }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 100,
        totalRealizedPnl: 20,
        totalUnrealizedPnl: -5,
      }),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([
        { openedAt: new Date('2026-05-15T01:00:00.000Z'), closedAt: new Date('2026-05-15T02:00:00.000Z'), realizedPnl: 100 },
        { openedAt: new Date('2026-05-15T03:00:00.000Z'), closedAt: new Date('2026-05-15T04:00:00.000Z'), realizedPnl: -200 },
      ]),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map([
        ['inst-live', { totalPnlRate: undefined, maxDrawdown: undefined, winRate: undefined, totalTradesCount: undefined }],
      ])),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
    )

    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(repo.findUserStrategyAccount).toHaveBeenCalledWith('user-1', 'tpl-live')
    expect(repo.loadTradeStats).toHaveBeenCalledWith('account-live', startedAt)
    expect(repo.loadPositionFinancials).toHaveBeenCalledWith('account-live', startedAt)
    expect(repo.loadClosedPositionPnlSeries).toHaveBeenCalledWith('account-live', 500, startedAt)
    expect(result.items[0]?.metrics).toMatchObject({
      returnPct: 1.5,
      maxDrawdownPct: 18.18,
      winRatePct: 50,
      tradeCount: 4,
    })
  })

  it('keeps fallback win rate unknown when there are no closed trades', async () => {
    const startedAt = new Date('2026-05-15T00:00:00.000Z')
    const repo = {
      listStrategiesForUser: jest.fn().mockResolvedValue({
        total: 1,
        page: 1,
        limit: 20,
        items: [{
          id: 'inst-open-only',
          name: 'Open Only Strategy',
          status: 'running',
          strategyTemplateId: 'tpl-open-only',
          params: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m' },
          defaultParams: null,
          customParams: null,
          strategySchema: null,
          schemaVersion: null,
          startedAt,
          createdAt: startedAt,
          updatedAt: new Date('2026-05-15T07:33:00.000Z'),
          subscribed: true,
        }],
      }),
      findUserStrategyAccount: jest.fn().mockResolvedValue({
        id: 'account-open-only',
        initialBalance: 1000,
      }),
      loadTradeStats: jest.fn().mockResolvedValue({
        tradeCount: 2,
        closedCount: 0,
        winningCount: 0,
      }),
      loadPositionFinancials: jest.fn().mockResolvedValue({
        openCostBasis: 100,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 10,
      }),
      loadClosedPositionPnlSeries: jest.fn().mockResolvedValue([]),
      loadEquitySeries: jest.fn().mockResolvedValue([]),
    }
    const statsService = {
      calculateBatchStats: jest.fn().mockResolvedValue(new Map([
        ['inst-open-only', { totalPnlRate: undefined, maxDrawdown: undefined, winRate: undefined, totalTradesCount: undefined }],
      ])),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      null as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
    )

    const result = await service.listStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(result.items[0]?.metrics).toMatchObject({
      returnPct: 1,
      winRatePct: null,
      tradeCount: 2,
    })
  })
})
