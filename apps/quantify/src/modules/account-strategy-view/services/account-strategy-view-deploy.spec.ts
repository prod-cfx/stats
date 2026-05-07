import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
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

function createGridOrderProgramAstSnapshot() {
  return {
    astVersion: 'csa.v1',
    manifest: { compileVersion: 'compiler.v1' },
    runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
    orderPrograms: [{
      id: 'order_01_contract_order_program_grid',
      sourceRef: 'contract-order-program-grid',
      payload: {
        id: 'contract_order_program_grid',
        kind: 'LIMIT_LADDER',
        priceSource: 'level_set',
        levelSetRef: 'grid_levels',
        sidePolicy: 'spot_grid',
        quantity: { mode: 'fixed_quote', value: 50, asset: 'USDT' },
        orderType: 'limit',
        timeInForce: 'gtc',
        recycleOnFill: true,
        maxWorkingOrders: 4,
      },
    }],
    exprPool: [{
      id: 'grid_levels',
      nodeType: 'level_set',
      payload: {
        id: 'grid_levels',
        kind: 'ARITHMETIC_LEVEL_SET',
        hardBounds: {
          lowerRef: 'grid_lower',
          upperRef: 'grid_upper',
        },
      },
    }, {
      id: 'grid_lower',
      nodeType: 'series',
      payload: { id: 'grid_lower', kind: 'CONST', value: 90 },
    }, {
      id: 'grid_upper',
      nodeType: 'series',
      payload: { id: 'grid_upper', kind: 'CONST', value: 110 },
    }],
  }
}

function createCombinationDecisionAstSnapshot() {
  return new CanonicalStrategyAstCompilerService().compile(createDeployCombinationIrFixture())
}

function createDeployCombinationIrFixture(): CanonicalStrategyIrV1 {
  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'d'.repeat(64)}`,
      specHash: `sha256:${'e'.repeat(64)}`,
    },
    market: {
      venue: 'okx',
      instrumentType: 'perpetual',
      symbol: 'ETHUSDT',
      timeframes: ['15m'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 12 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 15,
      maxLookback: 15,
      requiredTimeframes: ['15m'],
    },
    signalCatalog: {
      series: [
        { id: 'bar_index', kind: 'BAR_INDEX' },
        { id: 'bar_1', kind: 'CONST', value: 1 },
        { id: 'bar_2', kind: 'CONST', value: 2 },
        { id: 'zero', kind: 'CONST', value: 0 },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_on_first_bar', kind: 'EQ', args: ['bar_index', 'bar_1'] },
        { id: 'entry_gate_true', kind: 'EQ', args: ['bar_1', 'bar_1'] },
        { id: 'entry_and', kind: 'AND', args: ['entry_on_first_bar', 'entry_gate_true'] },
        { id: 'exit_on_second_bar', kind: 'EQ', args: ['bar_index', 'bar_2'] },
        { id: 'exit_never', kind: 'EQ', args: ['bar_index', 'zero'] },
        { id: 'exit_or', kind: 'OR', args: ['exit_never', 'exit_on_second_bar'] },
      ],
    },
    runtimeRequirements: {
      helpers: ['atr'],
      stateKeys: [],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_and',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 12 } },
        ],
      },
      {
        id: 'exit_long',
        phase: 'exit',
        when: 'exit_or',
        priority: 100,
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [],
      riskPredicates: [
        { id: 'risk-atr-stop', kind: 'atrMultipleStop', params: { multiple: 2 } },
      ],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'limit',
      timeInForce: 'ioc',
      allowPartialFill: false,
    },
  }
}

describe('accountStrategyViewService.deployStrategy', () => {
  it('routes deploys with AST orderPrograms to grid runtime instead of signal runtime states', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-grid-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-grid-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const runtimeExecutionStateService = createRuntimeExecutionStateService()
    const gridRuntimeService = {
      createFromDeployment: jest.fn().mockResolvedValue({ id: 'grid-runtime-1' }),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-grid-1',
        snapshotHash: 'snapshot-grid-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '1m',
          marketType: 'spot',
          positionSizing: { mode: 'fixed_quote', value: 50, asset: 'USDT' },
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'limit',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 1,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['limit'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-grid-1',
        strategyTemplateId: 'template-grid-1',
        astSnapshot: createGridOrderProgramAstSnapshot(),
      }),
    }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 1000, locked: 0, total: 1000 },
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
      runtimeExecutionStateService as any,
      undefined,
      undefined,
      gridRuntimeService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-grid-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX BTC grid',
      publishedSnapshotId: 'snapshot-grid-1',
      deployRequestId: 'deploy-req-grid-1',
      exchangeAccountId: 'acct-grid-1',
      mode: 'TESTNET',
    } as any)

    expect(gridRuntimeService.createFromDeployment).toHaveBeenCalledWith(expect.objectContaining({
      strategyInstanceId: 'inst-grid-1',
      publishedSnapshotId: 'snapshot-grid-1',
      userId: 'user-1',
      exchangeAccountId: 'acct-grid-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      astSnapshot: expect.objectContaining({ orderPrograms: expect.any(Array) }),
      fundingSnapshot: expect.objectContaining({
        asset: 'USDT',
        buyingPower: 1000,
        executionCapital: 1000,
      }),
    }))
    expect(runtimeExecutionStateService.buildExecutionSemanticKeysFromSnapshot).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.initializeStatesForDeploy).not.toHaveBeenCalled()
    expect(repo.activateStrategyInstanceForRuntime).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-grid-1',
      mode: 'TESTNET',
      userId: 'user-1',
    })
  })

  it('keeps mixed decision and order program snapshots on the signal runtime path', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-mixed-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-mixed-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const runtimeExecutionStateService = createRuntimeExecutionStateService()
    const gridRuntimeService = { createFromDeployment: jest.fn() }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-mixed-1',
        snapshotHash: 'snapshot-mixed-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '1m',
          marketType: 'spot',
          positionSizing: { mode: 'fixed_quote', value: 50, asset: 'USDT' },
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'limit',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 1,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['limit'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-mixed-1',
        strategyTemplateId: 'template-mixed-1',
        astSnapshot: {
          ...createGridOrderProgramAstSnapshot(),
          decisionPrograms: [{
            id: 'decision_01_entry',
            sourceRef: 'entry-primary',
            phase: 'entry',
            when: 'always',
            actions: [{ kind: 'OPEN_LONG' }],
          }],
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
      undefined,
      undefined,
      gridRuntimeService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-mixed-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX BTC mixed',
      publishedSnapshotId: 'snapshot-mixed-1',
      deployRequestId: 'deploy-req-mixed-1',
      exchangeAccountId: 'acct-mixed-1',
      mode: 'TESTNET',
    } as any)

    expect(gridRuntimeService.createFromDeployment).not.toHaveBeenCalled()
    expect(runtimeExecutionStateService.initializeStatesForDeploy).toHaveBeenCalledWith(expect.objectContaining({
      strategyInstanceId: 'inst-mixed-1',
      publishedSnapshotId: 'snapshot-mixed-1',
    }))
  })

  it('deploys combination snapshots with publishedSnapshotBinding and snapshot-derived deploymentExecutionConfig', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-combination-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-combination-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const runtimeExecutionStateService = createRuntimeExecutionStateService()
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-combination-1',
        snapshotHash: 'snapshot-combination-hash-1',
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
          orderType: 'limit',
          timeInForce: 'IOC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 3,
          supportedPriceSources: ['mark'],
          supportedOrderTypes: ['limit'],
          supportedTimeInForce: ['IOC'],
        },
        strategyInstanceId: 'inst-draft-combination-1',
        strategyTemplateId: 'template-combination-1',
        compiledManifest: {
          compileVersion: 'compiler.v1',
        },
        astSnapshot: createCombinationDecisionAstSnapshot(),
      }),
    }
    const tradingService = {
      getLeverageConstraints: jest.fn().mockResolvedValue({
        minLeverage: 1,
        maxLeverage: 5,
      }),
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 1000, locked: 0, total: 1000 },
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
      runtimeExecutionStateService as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-combination-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX ETH combination',
      publishedSnapshotId: 'snapshot-combination-1',
      deployRequestId: 'deploy-req-combination-1',
      exchangeAccountId: 'acct-combination-1',
      deploymentExecutionConfig: {
        leverage: 2,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'GTC',
      },
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 99,
      mode: 'TESTNET',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      positionPct: 12,
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: 'snapshot-combination-1',
        snapshotHash: 'snapshot-combination-hash-1',
        sourceStrategyInstanceId: 'inst-draft-combination-1',
        sourceStrategyTemplateId: 'template-combination-1',
      },
      deploymentExecutionConfig: {
        leverage: 2,
        priceSource: 'mark',
        orderType: 'limit',
        timeInForce: 'IOC',
      },
      executionConfigVersion: 1,
    }))
    expect(tradingService.getBalance).toHaveBeenCalledWith('user-1', 'okx', 'perp', 'acct-combination-1')
    expect(runtimeExecutionStateService.initializeStatesForDeploy).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-combination-1',
      publishedSnapshotId: 'snapshot-combination-1',
      snapshotHash: 'snapshot-combination-hash-1',
      snapshot: expect.objectContaining({ id: 'snapshot-combination-1' }),
    })
  })

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
})
