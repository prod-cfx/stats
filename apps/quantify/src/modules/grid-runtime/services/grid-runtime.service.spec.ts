import { GridRuntimeService } from './grid-runtime.service'
import { GridOrderPlannerService } from './grid-order-planner.service'
import { CanonicalSpecV2IrCompilerService } from '../../llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../../llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import type { CanonicalStrategySpecV2 } from '../../llm-strategy-codegen/types/canonical-strategy-spec'

function asDependency<T>(value: Partial<T>): T {
  return value as T
}

function createTradingService() {
  return {
    getInstrumentConstraints: jest.fn().mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      rawSymbol: 'BTC-USDT',
      priceTickSize: '0.01',
      quantityStepSize: '0.000001',
      minQuantity: '0.000001',
      contractValue: null,
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    }),
  }
}

function createPlannerMock() {
  return {
    planInitialOrders: jest.fn().mockReturnValue({
      levels: [
        { levelIndex: 0, price: '90', side: 'buy', role: 'spot_buy', baseQuantity: null, quoteBudget: '50', status: 'planned' },
        { levelIndex: 1, price: '100', side: 'buy', role: 'spot_buy', baseQuantity: null, quoteBudget: '50', status: 'planned' },
      ],
      orders: [
        { levelIndex: 0, side: 'buy', role: 'spot_buy', orderType: 'limit', timeInForce: 'gtc', price: '90', quantity: '0.555555555555555556', quoteBudget: '50' },
      ],
    }),
  }
}

function createService(
  repository: { createInstanceWithPlan: jest.Mock },
  overrides: {
    planner?: ReturnType<typeof createPlannerMock> | GridOrderPlannerService
    tradingService?: ReturnType<typeof createTradingService>
  } = {},
) {
  const planner = overrides.planner ?? createPlannerMock()
  const tradingService = overrides.tradingService ?? createTradingService()
  const stateMachine = {
    initialize: jest.fn().mockResolvedValue({ id: 'event-initializing' }),
    markRunning: jest.fn().mockResolvedValue({ id: 'event-running' }),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
  }
  const orderSync = { syncInstance: jest.fn(), stopAndCancelInstance: jest.fn().mockResolvedValue(undefined) }
  return {
    planner,
    orderSync,
    stateMachine,
    service: new GridRuntimeService(
      asDependency<ConstructorParameters<typeof GridRuntimeService>[0]>(repository),
      asDependency<ConstructorParameters<typeof GridRuntimeService>[1]>(planner),
      asDependency<ConstructorParameters<typeof GridRuntimeService>[2]>(orderSync),
      asDependency<ConstructorParameters<typeof GridRuntimeService>[3]>(stateMachine),
      asDependency<ConstructorParameters<typeof GridRuntimeService>[4]>(tradingService),
    ),
    tradingService,
  }
}

function createAstSnapshot() {
  return {
    orderPrograms: [{
      payload: {
        id: 'contract_order_program_grid',
        kind: 'LIMIT_LADDER',
        priceSource: 'level_set',
        levelSetRef: 'grid_levels',
        sidePolicy: 'spot_grid',
        quantity: { mode: 'fixed_quote', value: 50, asset: 'USDT' },
        orderType: 'limit',
        timeInForce: 'gtc',
        maxWorkingOrders: 4,
      },
    }],
    exprPool: [{
      id: 'expr_01_grid_levels',
      sourceRef: 'grid_levels',
      payload: {
        id: 'grid_levels',
        kind: 'ARITHMETIC_LEVEL_SET',
        spacing: { mode: 'absolute', value: 5 },
        hardBounds: { lowerRef: 'grid_lower', upperRef: 'grid_upper' },
      },
    }, {
      id: 'expr_02_grid_lower',
      sourceRef: 'grid_lower',
      payload: { kind: 'CONST', value: 90 },
    }, {
      id: 'expr_03_grid_upper',
      sourceRef: 'grid_upper',
      payload: { kind: 'CONST', value: 110 },
    }],
  }
}

function createCenteredPercentAstSnapshot() {
  const gridCount = 10
  const halfRangePct = 0.4
  const canonicalSpec = {
    version: 2,
    market: {
      exchange: 'okx',
      symbol: 'ETHUSDT',
      marketType: 'spot',
      defaultTimeframe: '1m',
    },
    indicators: [],
    sizing: null,
    executionPolicy: {
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'NEXT_BAR_OPEN',
    },
    dataRequirements: {
      requiredTimeframes: ['1m'],
    },
    rules: [],
    orderPrograms: [
      {
        id: 'contract-order-program-grid',
        kind: 'contract_order_program',
        mode: 'spot',
        levelSet: {
          mode: 'centered_percent_range',
          centerTiming: 'deployment',
          centerSource: 'last_price',
          halfRangePct,
          gridCount,
          spacingMode: 'arithmetic',
        },
        budget: {
          mode: 'per_order_quote',
          value: 10,
          asset: 'USDT',
        },
        orderType: 'limit',
        timeInForce: 'gtc',
        recycleOnFill: true,
        cancelOnStop: true,
      },
    ],
  } satisfies CanonicalStrategySpecV2

  const result = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec,
    fallback: {
      exchange: 'okx',
      symbol: 'ETHUSDT',
      baseTimeframe: '1m',
      positionPct: 10,
    },
  })

  return new CanonicalStrategyAstCompilerService().compile(result.ir)
}

function withExecutionModel<T extends Record<string, unknown>>(astSnapshot: T, executionModel: Record<string, unknown>): T {
  return {
    ...astSnapshot,
    executionModel,
  }
}

describe('GridRuntimeService', () => {
  it('creates a grid runtime plan from AST order programs', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-1' }) }
    const { service, planner, stateMachine } = createService(repository)

    await service.createFromDeployment({
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      astSnapshot: createAstSnapshot(),
      currentPrice: '100',
    })

    expect(planner.planInitialOrders).toHaveBeenCalledWith({
      config: expect.objectContaining({
        mode: 'spot',
        lowerPrice: '90',
        upperPrice: '110',
        gridCount: 4,
        perOrderQuote: '50',
        quoteAsset: 'USDT',
        baseAsset: 'BTC',
        orderType: 'limit',
        timeInForce: 'gtc',
        spacingMode: 'arithmetic',
        spacingValue: '5',
        activeWhen: null,
      }),
      currentPrice: '100',
    })
    expect(repository.createInstanceWithPlan).toHaveBeenCalledWith(expect.objectContaining({
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      mode: 'spot',
      levels: expect.any(Array),
      plannedOrders: [expect.objectContaining({
        levelIndex: 0,
        side: 'buy',
        role: 'spot_buy',
        orderType: 'limit',
        timeInForce: 'gtc',
        rawPayload: { source: 'deployment', quoteBudget: '50' },
      })],
    }))
    expect(stateMachine.initialize).toHaveBeenCalledWith('grid-runtime-1')
    expect(stateMachine.markRunning).toHaveBeenCalledWith('grid-runtime-1')
    expect(repository.createInstanceWithPlan.mock.invocationCallOrder[0]).toBeLessThan(
      stateMachine.initialize.mock.invocationCallOrder[0],
    )
    expect(stateMachine.initialize.mock.invocationCallOrder[0]).toBeLessThan(
      stateMachine.markRunning.mock.invocationCallOrder[0],
    )
  })

  it('integrates compiler centered-percent AST into an 11-point grid runtime plan', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-centered-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDT',
      rawSymbol: 'ETH-USDT',
      priceTickSize: '0.01',
      quantityStepSize: '0.000001',
      minQuantity: '0.000001',
      contractValue: null,
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    const { service } = createService(repository, {
      planner: new GridOrderPlannerService(),
      tradingService,
    })

    await service.createFromDeployment({
      strategyInstanceId: 'strategy-centered-1',
      publishedSnapshotId: 'snapshot-centered-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDT',
      astSnapshot: createCenteredPercentAstSnapshot(),
      currentPrice: '100',
    })

    const created = repository.createInstanceWithPlan.mock.calls[0]?.[0]
    const config = created?.configSnapshot as Record<string, unknown>
    expect(config).toEqual(expect.objectContaining({
      mode: 'spot',
      gridCount: 10,
      pricePointCount: 11,
      perOrderQuote: '10',
      quoteAsset: 'USDT',
      baseAsset: 'ETH',
      orderType: 'limit',
      timeInForce: 'gtc',
      spacingMode: 'arithmetic',
      spacingValue: '0.08',
      pairingPolicy: 'adjacent_level',
      activeWhen: expect.any(String),
      tickSize: '0.01',
      lotSize: '0.000001',
    }))
    expect(Number(config.lowerPrice)).toBeLessThan(100)
    expect(Number(config.upperPrice)).toBeGreaterThan(100)
    expect(created?.levels).toHaveLength(11)
    expect(created?.levels.map((level: { price: string }) => level.price)).toContain('100')
  })

  it('rejects invalid level-set side counts instead of falling back to maxWorkingOrders', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-invalid-levels-1' }) }
    const astSnapshot = createAstSnapshot()
    const levelSetPayload = astSnapshot.exprPool[0]!.payload as Record<string, unknown>
    levelSetPayload.levelsPerSide = { down: 1.5, up: 2 }
    const { service, planner } = createService(repository)

    await expect(service.createFromDeployment({
      strategyInstanceId: 'strategy-invalid-levels-1',
      publishedSnapshotId: 'snapshot-invalid-levels-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      astSnapshot,
      currentPrice: '100',
    })).rejects.toThrow('grid_runtime_invalid_order_program')
    expect(planner.planInitialOrders).not.toHaveBeenCalled()
    expect(repository.createInstanceWithPlan).not.toHaveBeenCalled()
  })

  it('creates a perpetual neutral grid runtime plan from pct-equity order programs', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-perp-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.01',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    const { service, planner } = createService(repository, { tradingService })
    const astSnapshot = createAstSnapshot() as ReturnType<typeof createAstSnapshot> & {
      executionModel?: Record<string, unknown>
    }
    astSnapshot.executionModel = {
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
    }
    astSnapshot.orderPrograms[0]!.payload.sidePolicy = 'perp_neutral'
    astSnapshot.orderPrograms[0]!.payload.quantity = { mode: 'pct_equity', value: 10 } as {
      mode: string
      value: number
      asset: string
    }

    await service.createFromDeployment({
      strategyInstanceId: 'strategy-perp-1',
      publishedSnapshotId: 'snapshot-perp-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'perpetual',
      symbol: 'BTC/USDT:PERP',
      astSnapshot,
      currentPrice: '100',
      fundingSnapshot: {
        asset: 'USDT',
        buyingPower: 1000,
        executionCapital: 1000,
      },
    })

    expect(planner.planInitialOrders).toHaveBeenCalledWith({
      config: expect.objectContaining({
      mode: 'perp_neutral',
      perOrderQuote: '100',
      quoteAsset: 'USDT',
      baseAsset: 'BTC',
      tickSize: '0.01',
      lotSize: '0.01',
      minQuantity: '0.01',
    }),
      currentPrice: '100',
    })
  })

  it('normalizes initial planned orders with exchange constraints before persisting', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-normalized-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDT',
      rawSymbol: 'ETH-USDT',
      priceTickSize: '0.1',
      quantityStepSize: '0.001',
      minQuantity: '0.001',
      contractValue: null,
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    const { service } = createService(repository, {
      planner: new GridOrderPlannerService(),
      tradingService,
    })

    await service.createFromDeployment({
      strategyInstanceId: 'strategy-normalized-1',
      publishedSnapshotId: 'snapshot-normalized-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDT',
      astSnapshot: createCenteredPercentAstSnapshot(),
      currentPrice: '100',
    })

    const persisted = repository.createInstanceWithPlan.mock.calls[0]?.[0]
    expect(persisted.levels.every((level: { price: string }) => Number.isInteger(Number(level.price) * 10))).toBe(true)
    expect(persisted.plannedOrders.length).toBeGreaterThan(0)
    expect(persisted.plannedOrders.every((order: { price: string, quantity: string }) =>
      Number.isInteger(Number(order.price) * 10)
      && Number.isInteger(Number(order.quantity) * 1000),
    )).toBe(true)
  })

  it('rejects exchange constraints without min quantity before creating a plan', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-missing-min-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      rawSymbol: 'BTC-USDT',
      priceTickSize: '0.01',
      quantityStepSize: '0.000001',
      minQuantity: null,
      contractValue: null,
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    const { service, planner } = createService(repository, { tradingService })

    await expect(service.createFromDeployment({
      strategyInstanceId: 'strategy-missing-min-1',
      publishedSnapshotId: 'snapshot-missing-min-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      astSnapshot: createAstSnapshot(),
      currentPrice: '100',
    })).rejects.toThrow('grid_runtime_missing_min_quantity')
    expect(planner.planInitialOrders).not.toHaveBeenCalled()
    expect(repository.createInstanceWithPlan).not.toHaveBeenCalled()
  })

  it('falls back to complete AST execution constraints when exchange constraints are unavailable', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-ast-fallback-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('constraints unavailable'))
    const { service, planner } = createService(repository, { tradingService })

    await service.createFromDeployment({
      strategyInstanceId: 'strategy-ast-fallback-1',
      publishedSnapshotId: 'snapshot-ast-fallback-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'demo',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      astSnapshot: withExecutionModel(createAstSnapshot(), {
        tickSize: 0.01,
        lotSize: 0.000001,
        minQuantity: 0.0001,
      }),
      currentPrice: '100',
    })

    expect(planner.planInitialOrders).toHaveBeenCalledWith({
      config: expect.objectContaining({
        tickSize: '0.01',
        lotSize: '0.000001',
        minQuantity: '0.0001',
        constraintsSource: 'ast',
      }),
      currentPrice: '100',
    })
    expect(repository.createInstanceWithPlan).toHaveBeenCalled()
  })

  it('does not fall back to AST execution constraints when OKX constraints are unavailable', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-okx-no-fallback-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('OKX constraints unavailable'))
    const { service, planner } = createService(repository, { tradingService })

    await expect(service.createFromDeployment({
      strategyInstanceId: 'strategy-okx-no-fallback-1',
      publishedSnapshotId: 'snapshot-okx-no-fallback-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      astSnapshot: withExecutionModel(createAstSnapshot(), {
        tickSize: 0.01,
        lotSize: 0.000001,
        minQuantity: 0.0001,
      }),
      currentPrice: '100',
    })).rejects.toThrow('grid_runtime_instrument_constraints_unavailable')
    expect(planner.planInitialOrders).not.toHaveBeenCalled()
    expect(repository.createInstanceWithPlan).not.toHaveBeenCalled()
  })

  it('rejects AST fallback when min quantity is missing', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-ast-missing-min-1' }) }
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('constraints unavailable'))
    const { service, planner } = createService(repository, { tradingService })

    await expect(service.createFromDeployment({
      strategyInstanceId: 'strategy-ast-missing-min-1',
      publishedSnapshotId: 'snapshot-ast-missing-min-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'demo',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      astSnapshot: withExecutionModel(createAstSnapshot(), {
        tickSize: 0.01,
        lotSize: 0.000001,
      }),
      currentPrice: '100',
    })).rejects.toThrow('grid_runtime_missing_min_quantity')
    expect(planner.planInitialOrders).not.toHaveBeenCalled()
    expect(repository.createInstanceWithPlan).not.toHaveBeenCalled()
  })

  it('stops through order sync so exchange orders are canceled before terminal state', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-1' }) }
    const { service, orderSync, stateMachine } = createService(repository)

    await service.stop('grid-runtime-1', 'user_stop')

    expect(orderSync.stopAndCancelInstance).toHaveBeenCalledWith('grid-runtime-1', 'user_stop')
    expect(stateMachine.stop).not.toHaveBeenCalled()
  })
})
