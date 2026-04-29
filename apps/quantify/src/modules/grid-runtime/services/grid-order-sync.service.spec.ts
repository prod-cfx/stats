import { GridOrderSyncService } from './grid-order-sync.service'

function asDependency<T>(value: Partial<T>): T {
  return value as T
}

const baseConfig = {
  mode: 'spot',
  lowerPrice: '90',
  upperPrice: '110',
  gridCount: 5,
  perOrderQuote: '100',
  quoteAsset: 'USDT',
  baseAsset: 'BTC',
  orderType: 'limit',
  timeInForce: 'gtc',
} as const

function createInstance() {
  return {
    id: 'grid-1',
    userId: 'user-1',
    exchangeAccountId: 'exchange-account-1',
    exchangeId: 'okx',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    status: 'RUNNING',
    configSnapshot: baseConfig,
    levels: [
      { id: 'level-0', levelIndex: 0, price: '90' },
      { id: 'level-1', levelIndex: 1, price: '95' },
      { id: 'level-2', levelIndex: 2, price: '100' },
    ],
  }
}

function createOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    gridRuntimeInstanceId: 'grid-1',
    gridLevelId: 'level-1',
    clientOrderId: 'grid-1-95-buy',
    exchangeOrderId: 'exchange-order-1',
    side: 'buy',
    role: 'spot_buy',
    orderType: 'limit',
    timeInForce: 'gtc',
    price: { toString: () => '95' },
    quantity: { toString: () => '1.052631578947368421' },
    filledQuantity: { toString: () => '0' },
    status: 'OPEN',
    ...overrides,
  }
}

function createRepository() {
  return {
    findInstanceForSync: jest.fn().mockResolvedValue(createInstance()),
    listOrders: jest.fn().mockResolvedValue([createOrder()]),
    updateOrderFromExchange: jest.fn().mockResolvedValue({ id: 'order-1' }),
    recordFillOnce: jest.fn().mockResolvedValue({ fill: { id: 'fill-1' }, newlyRecorded: true }),
    findFillByExchangeId: jest.fn().mockResolvedValue(null),
    createPlannedOrder: jest.fn().mockResolvedValue({ id: 'inverse-order-1' }),
    updateInstanceLastSyncAt: jest.fn().mockResolvedValue({ id: 'grid-1' }),
  }
}

function createTradingService() {
  return {
    getOpenOrders: jest.fn().mockResolvedValue([]),
    getClosedOrders: jest.fn().mockResolvedValue([
      {
        id: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'limit',
        price: 95,
        amount: 1.0526315789473684,
        filled: 1.0526315789473684,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'fill-1' },
      },
    ]),
    cancelOrder: jest.fn().mockResolvedValue({ id: 'exchange-order-1', status: 'canceled' }),
  }
}

function createStateMachine() {
  return {
    stop: jest.fn().mockResolvedValue(undefined),
    markReconcileRequired: jest.fn().mockResolvedValue(undefined),
  }
}

function createTxEvents() {
  const txEvents = {
    withAfterCommit<T>(callback: () => Promise<T>): Promise<T> {
      return callback()
    },
  }
  jest.spyOn(txEvents, 'withAfterCommit')
  return txEvents
}

function createService(
  repository: ReturnType<typeof createRepository>,
  tradingService = createTradingService(),
  stateMachine = createStateMachine(),
  txEvents = createTxEvents(),
) {
  return new GridOrderSyncService(
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[0]>(repository),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[1]>(tradingService),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[2]>(stateMachine),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[3]>(txEvents),
  )
}

describe('GridOrderSyncService', () => {
  it('records a completed fill once and creates a paired inverse planned order', async () => {
    const repository = createRepository()
    const tradingService = createTradingService()
    const stateMachine = createStateMachine()
    const txEvents = createTxEvents()
    const service = createService(repository, tradingService, stateMachine, txEvents)

    await service.syncInstance('grid-1')

    expect(tradingService.getOpenOrders).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'BTC/USDT', 'exchange-account-1')
    expect(tradingService.getClosedOrders).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'BTC/USDT', 'exchange-account-1')
    expect(repository.updateOrderFromExchange).toHaveBeenCalledWith(expect.objectContaining({
      id: 'order-1',
      exchangeOrderId: 'exchange-order-1',
      status: 'FILLED',
      filledQuantity: '1.0526315789473684',
      avgFillPrice: '95',
    }))
    expect(repository.recordFillOnce).toHaveBeenCalledWith(expect.objectContaining({
      gridRuntimeInstanceId: 'grid-1',
      gridOrderId: 'order-1',
      exchangeFillId: 'fill-1',
      side: 'buy',
      price: '95',
    }))
    expect(repository.createPlannedOrder).toHaveBeenCalledWith(expect.objectContaining({
      gridRuntimeInstanceId: 'grid-1',
      gridLevelId: 'level-1',
      side: 'sell',
      role: 'spot_sell',
      orderType: 'limit',
      timeInForce: 'gtc',
      price: '95',
    }))
    expect(txEvents.withAfterCommit).toHaveBeenCalled()
  })

  it('does not create another inverse order when duplicate fill was already recorded', async () => {
    const repository = createRepository()
    repository.recordFillOnce.mockResolvedValue({ fill: { id: 'fill-existing' }, newlyRecorded: false })
    const service = createService(repository)

    await service.syncInstance('grid-1')

    expect(repository.recordFillOnce).toHaveBeenCalled()
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('does not create inverse order when recordFillOnce returns an existing fill', async () => {
    const repository = createRepository()
    repository.recordFillOnce.mockResolvedValue({ fill: { id: 'fill-existing' }, newlyRecorded: false })
    const service = createService(repository)

    await service.syncInstance('grid-1')

    expect(repository.recordFillOnce).toHaveBeenCalled()
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('moves to RECONCILE_REQUIRED when exchange side mismatches local order', async () => {
    const repository = createRepository()
    const tradingService = createTradingService()
    tradingService.getClosedOrders.mockResolvedValue([
      {
        id: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'sell',
        type: 'limit',
        price: 95,
        amount: 1.0526315789473684,
        filled: 1.0526315789473684,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'fill-1' },
      },
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch')
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('moves to RECONCILE_REQUIRED when exchange price mismatches local order', async () => {
    const repository = createRepository()
    const tradingService = createTradingService()
    tradingService.getClosedOrders.mockResolvedValue([
      {
        id: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'limit',
        price: 96,
        amount: 1.0526315789473684,
        filled: 1.0526315789473684,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'fill-1' },
      },
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch')
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('moves to RECONCILE_REQUIRED when exchange quantity mismatches local order', async () => {
    const repository = createRepository()
    const tradingService = createTradingService()
    tradingService.getClosedOrders.mockResolvedValue([
      {
        id: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'limit',
        price: 95,
        amount: 2,
        filled: 2,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'fill-1' },
      },
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch')
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('ignores foreign out-of-range open orders for boundary break', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({ id: 'own-open', clientOrderId: 'grid-1-95-buy', exchangeOrderId: 'own-exchange', status: 'OPEN' }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'foreign-exchange', clientOrderId: 'manual-order', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.stop).not.toHaveBeenCalled()
    expect(tradingService.cancelOrder).not.toHaveBeenCalled()
    expect(repository.updateInstanceLastSyncAt).toHaveBeenCalledWith('grid-1')
  })

  it('moves to STOPPING and cancels only own open orders on boundary break', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({ id: 'own-open', clientOrderId: 'grid-1-95-buy', exchangeOrderId: 'own-exchange', status: 'OPEN' }),
      createOrder({ id: 'planned', clientOrderId: null, exchangeOrderId: null, status: 'PLANNED' }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'own-exchange', clientOrderId: 'grid-1-95-buy', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
      { id: 'foreign-exchange', clientOrderId: 'manual-order', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(tradingService.cancelOrder).toHaveBeenCalledTimes(1)
    expect(tradingService.cancelOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'own-exchange', 'BTC/USDT', 'exchange-account-1')
  })
})
