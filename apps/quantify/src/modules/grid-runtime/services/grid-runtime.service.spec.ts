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
  return {
    planner,
    stateMachine,
    service: new GridRuntimeService(
      asDependency<ConstructorParameters<typeof GridRuntimeService>[0]>(repository),
      asDependency<ConstructorParameters<typeof GridRuntimeService>[1]>(planner),
      asDependency<ConstructorParameters<typeof GridRuntimeService>[2]>({ syncInstance: jest.fn() }),
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
      id: 'grid_levels',
      payload: {
        id: 'grid_levels',
        hardBounds: { lowerRef: 'grid_lower', upperRef: 'grid_upper' },
      },
    }, {
      id: 'grid_lower',
      payload: { kind: 'CONST', value: 90 },
    }, {
      id: 'grid_upper',
      payload: { kind: 'CONST', value: 110 },
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
})
