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
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          marketType: 'spot',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          symbol: 'SOLUSDT',
          timeframe: '5m',
        },
        lockedParams: {
          exchange: 'okx',
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
    } as any)

    expect(marketDataIngestionService.ensureSymbolsSubscribed).toHaveBeenCalledWith(['SOLUSDT'])
    expect(snapshotsRepository.findByIdForUser).toHaveBeenCalledWith('snapshot-1', 'user-1')
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'SOLUSDT',
      publishedSnapshotBinding: expect.objectContaining({
        publishedSnapshotId: 'snapshot-1',
        sourceStrategyInstanceId: 'inst-draft-1',
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
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          marketType: 'spot',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          symbol: 'SOLUSDT',
          timeframe: '5m',
        },
        lockedParams: {
          exchange: 'okx',
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

  it('rejects deploy when the published snapshot has no source strategy instance binding', async () => {
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
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-missing-instance',
        snapshotHash: 'snapshot-hash-missing-instance',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          marketType: 'spot',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: null,
        strategyTemplateId: 'template-1',
      }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      publishedSnapshotId: 'snapshot-missing-instance',
      deployRequestId: 'deploy-req-missing-instance',
      exchangeAccountId: 'acc-1',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deploy_snapshot_requires_republish',
    })
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
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
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          marketType: 'spot',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          symbol: 'SOLUSDT',
          timeframe: '5m',
        },
        lockedParams: {
          exchange: 'okx',
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
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          marketType: 'spot',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        paramsSnapshot: {
          symbol: 'SOLUSDT',
          timeframe: '5m',
        },
        lockedParams: {
          exchange: 'okx',
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
    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })

  it('writes deployment execution config from snapshot baseline plus user leverage selection', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-exec-1', mode: 'LIVE' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-exec-1',
        snapshotHash: 'snapshot-exec-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '15m',
          marketType: 'perp',
          positionPct: 12,
          strategyDeclaredLeverageRange: { min: 1, max: 8 },
        },
        deploymentExecutionDefaults: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          strategyDeclaredLeverageRange: { min: 1, max: 8 },
          defaultLeverage: 3,
          supportedPriceSources: ['mark'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['IOC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
      }),
    }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 4,
      }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      tradingService as any,
      snapshotsRepository as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-exec-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX ETH 15m',
      publishedSnapshotId: 'snapshot-exec-1',
      deployRequestId: 'deploy-req-exec-1',
      exchangeAccountId: 'acct-1',
      deploymentExecutionConfig: {
        leverage: 4,
      },
    } as any)

    expect(tradingService.getLeverageConstraints).toHaveBeenCalledWith({
      userId: 'user-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'ETHUSDT',
      exchangeAccountId: 'acct-1',
    })
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      positionPct: 12,
      deploymentExecutionConfig: {
        leverage: 4,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'IOC',
      },
      executionConfigVersion: 1,
    }))
  })

  it('fails closed for deploy when snapshot formal execution fields are missing', async () => {
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
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-legacy-deploy-1',
        snapshotHash: 'snapshot-legacy-deploy-hash-1',
        paramsSnapshot: { symbol: 'ETHUSDT', timeframe: '15m' },
        lockedParams: { exchange: 'okx', positionPct: 12 },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
      }),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'legacy deploy',
      publishedSnapshotId: 'snapshot-legacy-deploy-1',
      deployRequestId: 'deploy-req-legacy-deploy-1',
      exchangeAccountId: 'acct-1',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.invalid_snapshot_execution_config',
    })
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })
})
