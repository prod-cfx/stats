import { GridRuntimeService } from './grid-runtime.service'

function asDependency<T>(value: Partial<T>): T {
  return value as T
}

function createService(repository: { createInstanceWithPlan: jest.Mock }) {
  const planner = {
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
    ),
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
  return {
    orderPrograms: [{
      payload: {
        id: 'contract_order_program_limit_ladder',
        kind: 'LIMIT_LADDER',
        priceSource: 'level_set',
        levelSetRef: 'expr_03_centered_levels',
        sidePolicy: 'spot_grid',
        quantity: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
        orderType: 'limit',
        timeInForce: 'gtc',
        maxWorkingOrders: 10,
        pairingPolicy: 'adjacent_level',
        activeWhen: 'expr_04_active_level_set',
      },
    }],
    exprPool: [{
      id: 'expr_01_close_1m',
      sourceRef: 'close_1m',
      payload: { kind: 'PRICE', field: 'close', timeframe: '1m' },
    }, {
      id: 'expr_02_deployment_close_1m',
      sourceRef: 'deployment_close_1m',
      payload: { kind: 'DEPLOYMENT_PRICE', field: 'close', timeframe: '1m' },
    }, {
      id: 'expr_03_centered_levels',
      sourceRef: 'contract_order_program_limit_ladder_centered_percent_range',
      deps: ['expr_02_deployment_close_1m'],
      payload: {
        id: 'contract_order_program_limit_ladder_centered_percent_range',
        kind: 'ARITHMETIC_LEVEL_SET',
        anchorRef: 'deployment_close_1m',
        levelsPerSide: { down: 4, up: 5 },
        spacing: { mode: 'pct', value: 0.08 },
      },
    }, {
      id: 'expr_04_active_level_set',
      sourceRef: 'contract_order_program_limit_ladder_active_level_set',
      payload: { kind: 'WITHIN_LEVEL_SET' },
    }],
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
      config: {
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
      },
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

  it('creates a grid runtime plan from centered-percent deployment price order programs', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-centered-1' }) }
    const { service, planner } = createService(repository)

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

    const config = planner.planInitialOrders.mock.calls[0]?.[0]?.config
    expect(config).toEqual(expect.objectContaining({
      mode: 'spot',
      gridCount: 10,
      perOrderQuote: '10',
      quoteAsset: 'USDT',
      baseAsset: 'ETH',
      orderType: 'limit',
      timeInForce: 'gtc',
      spacingMode: 'arithmetic',
      spacingValue: '0.08',
      pairingPolicy: 'adjacent_level',
      activeWhen: 'expr_04_active_level_set',
    }))
    expect(Number(config.lowerPrice)).toBeLessThan(100)
    expect(Number(config.upperPrice)).toBeGreaterThan(100)
  })

  it('stops through order sync so exchange orders are canceled before terminal state', async () => {
    const repository = { createInstanceWithPlan: jest.fn().mockResolvedValue({ id: 'grid-runtime-1' }) }
    const { service, orderSync, stateMachine } = createService(repository)

    await service.stop('grid-runtime-1', 'user_stop')

    expect(orderSync.stopAndCancelInstance).toHaveBeenCalledWith('grid-runtime-1', 'user_stop')
    expect(stateMachine.stop).not.toHaveBeenCalled()
  })
})
