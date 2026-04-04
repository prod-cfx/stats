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
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
        lockedParams: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
      }),
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
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      deployRequestId: 'deploy-req-1',
      exchangeAccountId: 'acc-1',
      strategyInstanceId: 'inst-draft-1',
    } as any)

    expect(marketDataIngestionService.ensureSymbolsSubscribed).toHaveBeenCalledWith(['SOLUSDT'])
    expect(snapshotsRepository.findByIdForUser).toHaveBeenCalledWith('snapshot-1', 'user-1')
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      strategyInstanceId: 'inst-draft-1',
      publishedSnapshotBinding: expect.objectContaining({
        publishedSnapshotId: 'snapshot-1',
      }),
    }))
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-okx-1')
  })

  it('resolves deploy params from publishedSnapshotId and ignores UI overrides', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-2',
        snapshotHash: 'snapshot-hash-2',
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
        lockedParams: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
      }),
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
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 99,
      publishedSnapshotId: 'snapshot-2',
      deployRequestId: 'deploy-req-2',
      exchangeAccountId: 'acc-1',
      strategyInstanceId: 'inst-draft-1',
    } as any)

    expect(marketDataIngestionService.ensureSymbolsSubscribed).toHaveBeenCalledWith(['SOLUSDT'])
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotBinding: expect.objectContaining({
        publishedSnapshotId: 'snapshot-2',
      }),
    }))
  })

  it('seeds deploy account balances from the bound exchange account snapshot when available', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-live-balance',
        snapshotHash: 'snapshot-hash-3',
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
        lockedParams: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
      }),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = {
      ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 58000, locked: 2000, total: 60000 },
      ]),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      tradingService as any,
      snapshotsRepository as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-live-balance',
      deployRequestId: 'deploy-req-live-balance',
      exchangeAccountId: 'exchange-account-1',
      strategyInstanceId: 'inst-draft-1',
    } as any)

    expect(tradingService.getBalance).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'exchange-account-1')
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      initialBalanceQuote: 60000,
      accountBalanceQuote: 58000,
    }))
  })

  it('ignores exchange balance snapshots when the preferred quote asset is unavailable', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-missing-asset',
        snapshotHash: 'snapshot-hash-4',
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
        lockedParams: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          positionPct: 10,
        },
      }),
    }
    const statsService = { calculateStats: jest.fn(), calculateBatchStats: jest.fn() }
    const strategyInstancesService = { updateInstance: jest.fn() }
    const marketDataIngestionService = {
      ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'BTC', free: 0.8, locked: 0, total: 0.8 },
      ]),
    }

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      tradingService as any,
      snapshotsRepository as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-missing-asset',
      deployRequestId: 'deploy-req-missing-quote-asset',
      exchangeAccountId: 'exchange-account-1',
      strategyInstanceId: 'inst-draft-1',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.not.objectContaining({
      initialBalanceQuote: expect.anything(),
      accountBalanceQuote: expect.anything(),
    }))
  })

  it('hashes deploy payload with publishedSnapshotId semantics and ignores UI field drift', () => {
    const repo = {}
    const statsService = {}
    const strategyInstancesService = {}
    const marketDataIngestionService = {}
    const snapshotsRepository = {}

    const service = new AccountStrategyViewService(
      repo as any,
      statsService as any,
      strategyInstancesService as any,
      marketDataIngestionService as any,
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )

    const hashA = (service as any).hashDeployPayload({
      name: 'snapshot deploy',
      publishedSnapshotId: 'snapshot-same',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      deployRequestId: 'deploy-req-hash',
    })
    const hashB = (service as any).hashDeployPayload({
      name: 'snapshot deploy',
      publishedSnapshotId: 'snapshot-same',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 99,
      deployRequestId: 'deploy-req-hash',
    })

    expect(hashA).toBe(hashB)
  })

  it('rejects deploy when published snapshot is not owned by current user', async () => {
    const repo = {
      deployStrategyForUser: jest.fn(),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue(null),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      {} as any,
      {} as any,
      { ensureSymbolsSubscribed: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'snapshot deploy',
      publishedSnapshotId: 'snapshot-foreign',
      deployRequestId: 'deploy-req-foreign',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.published_snapshot_not_found',
    })
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })
})
