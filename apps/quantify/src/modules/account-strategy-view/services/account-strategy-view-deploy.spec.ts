import { AccountStrategyViewService } from './account-strategy-view.service'

function createRuntimeExecutionStateService() {
  return {
    buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
    initializeStatesForDeploy: jest.fn().mockResolvedValue([]),
  }
}

function createStructuredRuntimeExecutionSemantics() {
  return [{
    semanticKey: 'on_start.entry.primary',
    trigger: 'on_start',
    phase: 'entry',
    consumePolicy: 'once',
    requiredRuntimeContext: {
      barIndex: 1,
      requiresReferenceBar: true,
      requiresSymbol: true,
      requiresTimeframe: true,
    },
    sourceRefs: ['entry-primary'],
  }]
}

describe('accountStrategyViewService.deployStrategy', () => {
  it('initializes runtime execution states from the published snapshot after deploy succeeds and before success is marked', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const runtimeExecutionStateService = {
      buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
      initializeStatesForDeploy: jest.fn().mockResolvedValue(['on_start.entry.primary']),
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
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
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
      runtimeExecutionStateService as any,
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

    expect(runtimeExecutionStateService.initializeStatesForDeploy).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-okx-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      snapshot: expect.objectContaining({ id: 'snapshot-1' }),
    })
    expect(repo.activateStrategyInstanceForRuntime).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-okx-1',
      mode: 'TESTNET',
      userId: 'user-1',
    })
    expect(repo.deployStrategyForUser.mock.invocationCallOrder[0]).toBeLessThan(
      runtimeExecutionStateService.initializeStatesForDeploy.mock.invocationCallOrder[0],
    )
    expect(runtimeExecutionStateService.initializeStatesForDeploy.mock.invocationCallOrder[0]).toBeLessThan(
      repo.markDeployRequestSucceeded.mock.invocationCallOrder[0],
    )
    expect(repo.markDeployRequestSucceeded.mock.invocationCallOrder[0]).toBeLessThan(
      repo.activateStrategyInstanceForRuntime.mock.invocationCallOrder[0],
    )
  })

  it('ensures market symbols are subscribed before deploying the strategy', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
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
      createRuntimeExecutionStateService() as any,
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
      marketType: 'spot',
      symbol: 'SOLUSDT',
      publishedSnapshotBinding: expect.objectContaining({
        publishedSnapshotId: 'snapshot-1',
        sourceStrategyInstanceId: 'inst-draft-1',
      }),
    }))
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-okx-1')
  })

  it('deploys fixed quote sizing snapshots without requiring legacy positionPct', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-fixed', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-fixed' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-fixed-quote',
        snapshotHash: 'snapshot-hash-fixed',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '1m',
          marketType: 'perp',
          positionPct: null,
          positionSizing: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
          tdMode: 'cross',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-fixed',
        strategyTemplateId: 'template-fixed',
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
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
      createRuntimeExecutionStateService() as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-fixed' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX BTC fixed',
      publishedSnapshotId: 'snapshot-fixed-quote',
      deployRequestId: 'deploy-req-fixed',
      exchangeAccountId: 'acc-1',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      positionPct: null,
      positionSizing: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
    }))
    expect(service.getStrategyDetail).toHaveBeenCalledWith('user-1', 'inst-okx-fixed')
  })

  it('deploys with buying power zero while preserving exchange total equity', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '5m',
          marketType: 'perp',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
          tdMode: 'cross',
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
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 0, locked: 4901.58222, total: 4901.58222 },
      ]),
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
      createRuntimeExecutionStateService() as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX BTC 5m',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      deployRequestId: 'deploy-req-1',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      initialBalanceQuote: 4901.58222,
      accountBalanceQuote: 0,
      fundingSnapshot: expect.objectContaining({
        totalEquity: 4901.58222,
        buyingPower: 0,
        executionCapital: 4901.58222,
        nonTradableReason: 'exchange_available_balance_zero',
      }),
    }))
  })

  it('does not rewrite a completed deploy as failed when detail hydration throws after activation', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const runtimeExecutionStateService = createRuntimeExecutionStateService()

    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      undefined,
      snapshotsRepository as any,
      runtimeExecutionStateService as any,
    )
    service.getStrategyDetail = jest.fn().mockRejectedValue(new Error('detail hydration failed'))

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      exchange: 'okx',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      deployRequestId: 'deploy-req-1',
      exchangeAccountId: 'acc-1',
    } as any)).rejects.toThrow('detail hydration failed')

    expect(repo.markDeployRequestSucceeded).toHaveBeenCalledWith('req-1', 'inst-okx-1')
    expect(repo.activateStrategyInstanceForRuntime).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-okx-1',
      mode: 'TESTNET',
      userId: 'user-1',
    })
    expect(repo.markDeployRequestFailed).not.toHaveBeenCalled()
    expect(repo.markStrategyInstanceRuntimeBindingFailed).not.toHaveBeenCalled()
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
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
      createRuntimeExecutionStateService() as any,
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
      marketType: 'spot',
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
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
      createRuntimeExecutionStateService() as any,
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

  it('fails closed when the published snapshot is missing marketType truth', async () => {
    const repo = {
      deployStrategyForUser: jest.fn(),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-missing-market-type',
        snapshotHash: 'snapshot-hash-missing-market-type',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'SOLUSDT',
          baseTimeframe: '5m',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 1,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
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
      createRuntimeExecutionStateService() as any,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'missing market type',
      publishedSnapshotId: 'snapshot-missing-market-type',
      deployRequestId: 'deploy-req-missing-market-type',
      exchangeAccountId: 'acc-1',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.deploy_missing_required_fields',
    })
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
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
      createRuntimeExecutionStateService() as any,
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

  it('resolves the default exchange account before reading deploy funding when no account id is provided', async () => {
    const repo = {
      resolveDeployExchangeAccount: jest.fn().mockResolvedValue({
        id: 'exchange-account-default',
        isTestnet: true,
        exchangeId: 'okx',
      }),
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-default-account-balance',
        snapshotHash: 'snapshot-hash-default-account',
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 58000, locked: 2000, total: 60000 },
      ]),
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
      createRuntimeExecutionStateService() as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX SOL 5m',
      publishedSnapshotId: 'snapshot-default-account-balance',
      deployRequestId: 'deploy-req-default-account-balance',
    } as any)

    expect(repo.resolveDeployExchangeAccount).toHaveBeenCalledWith({
      userId: 'user-1',
      exchange: 'okx',
      exchangeAccountId: null,
    })
    expect(tradingService.getBalance).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'exchange-account-default')
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchangeAccountId: 'exchange-account-default',
      initialBalanceQuote: 60000,
      accountBalanceQuote: 58000,
    }))
  })

  it('uses the resolved default exchange account for perp leverage constraints', async () => {
    const repo = {
      resolveDeployExchangeAccount: jest.fn().mockResolvedValue({
        id: 'exchange-account-default-perp',
        isTestnet: true,
        exchangeId: 'okx',
      }),
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-perp-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-default-perp-account',
        snapshotHash: 'snapshot-hash-default-perp-account',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'ETHUSDT',
          baseTimeframe: '15m',
          marketType: 'perp',
          positionPct: 12,
        },
        deploymentExecutionDefaults: {
          leverage: 3,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'IOC',
          tdMode: 'cross',
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 4,
      }),
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 58000, locked: 2000, total: 60000 },
      ]),
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
      createRuntimeExecutionStateService() as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-perp-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX ETH 15m',
      publishedSnapshotId: 'snapshot-default-perp-account',
      deployRequestId: 'deploy-req-default-perp-account',
      deploymentExecutionConfig: {
        leverage: 4,
      },
    } as any)

    expect(tradingService.getLeverageConstraints).toHaveBeenCalledWith({
      userId: 'user-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'ETHUSDT',
      exchangeAccountId: 'exchange-account-default-perp',
    })
    expect(tradingService.getBalance).toHaveBeenCalledWith('user-1', 'okx', 'perp', 'exchange-account-default-perp')
    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchangeAccountId: 'exchange-account-default-perp',
      deploymentExecutionConfig: expect.objectContaining({
        leverage: 4,
      }),
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
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
      createRuntimeExecutionStateService() as any,
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
      createRuntimeExecutionStateService() as any,
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
      createRuntimeExecutionStateService() as any,
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
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
          tdMode: 'cross',
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
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
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
      createRuntimeExecutionStateService() as any,
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
        tdMode: 'cross',
      },
      executionConfigVersion: 1,
    }))
  })

  it('allows requested perp leverage for legacy generated snapshots whose platform max was only a placeholder', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-legacy-exec-1', mode: 'LIVE' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-legacy-exec-1',
        snapshotHash: 'snapshot-legacy-exec-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '1m',
          marketType: 'perp',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
          tdMode: 'cross',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 1,
          strategyDeclaredLeverageRange: null,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 3,
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
      createRuntimeExecutionStateService() as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-legacy-exec-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX BTC 1m',
      publishedSnapshotId: 'snapshot-legacy-exec-1',
      deployRequestId: 'deploy-req-legacy-exec-1',
      exchangeAccountId: 'acct-1',
      deploymentExecutionConfig: {
        leverage: 2,
      },
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      deploymentExecutionConfig: expect.objectContaining({
        leverage: 2,
      }),
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
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-legacy-deploy-1',
        snapshotHash: 'snapshot-legacy-deploy-hash-1',
        paramsSnapshot: { symbol: 'ETHUSDT', timeframe: '15m' },
        lockedParams: { exchange: 'okx', positionPct: 12 },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
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
      createRuntimeExecutionStateService() as any,
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

  it('fails closed for deploy when perp snapshot tdMode is unsupported by constraints', async () => {
    const repo = {
      deployStrategyForUser: jest.fn(),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-invalid-td-mode-1',
        snapshotHash: 'snapshot-invalid-td-mode-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          marketType: 'perp',
          positionPct: 12,
        },
        deploymentExecutionDefaults: {
          leverage: 2,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'ioc',
          tdMode: 'banana',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          strategyDeclaredLeverageRange: { min: 1, max: 3 },
          defaultLeverage: 2,
          supportedPriceSources: ['mark'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['ioc'],
          supportedTdModes: ['cross'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        astSnapshot: {
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 3,
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
      createRuntimeExecutionStateService() as any,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'invalid td mode deploy',
      publishedSnapshotId: 'snapshot-invalid-td-mode-1',
      deployRequestId: 'deploy-req-invalid-td-mode-1',
      exchangeAccountId: 'acct-1',
    } as any)).rejects.toMatchObject({
      message: 'account_strategy.invalid_snapshot_execution_config',
    })
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })
})
