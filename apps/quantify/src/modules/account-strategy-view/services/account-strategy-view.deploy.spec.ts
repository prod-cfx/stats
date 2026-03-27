import { AccountStrategyViewService } from './account-strategy-view.service'

describe('accountStrategyViewService.deployStrategy', () => {
  it('ensures market symbols are subscribed before deploying the strategy', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = {
      ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      deployRequestId: 'deploy-req-1',
      exchangeAccountId: 'acc-1',
      strategyInstanceId: 'inst-draft-1',
    } as any)

    expect(marketDataIngestionService.ensureSymbolsSubscribed).toHaveBeenCalledWith(['SOLUSDT'])
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      strategyInstanceId: 'inst-draft-1',
    }))
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-okx-1')
  })

  it('falls back to strategy instance params when deploy payload fields are missing', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue({
        params: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
        strategyTemplate: { defaultParams: {} },
        subscriptions: [],
      }),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = {
      ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: undefined as any,
      symbol: undefined as any,
      timeframe: undefined as any,
      positionPct: undefined as any,
      deployRequestId: 'deploy-req-2',
      exchangeAccountId: 'acc-1',
      strategyInstanceId: 'inst-draft-1',
    } as any)

    expect(repo.findStrategyForUser).toHaveBeenCalledWith('user-1', 'inst-draft-1')
    expect(marketDataIngestionService.ensureSymbolsSubscribed).toHaveBeenCalledWith(['SOLUSDT'])
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
    }))
  })
})
