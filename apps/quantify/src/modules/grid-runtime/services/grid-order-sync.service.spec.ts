import { GridOrderSyncService } from './grid-order-sync.service'
import { PositionSide, TradeSide } from '@ai/shared'
import { ClientOrderIdFactoryService } from '../../trading-execution/services/client-order-id-factory.service'
import { OrderAdmissionGateService } from '../../trading-execution/services/order-admission-gate.service'
import { OrderNormalizerService } from '../../trading-execution/services/order-normalizer.service'
import { TradingExecutionService } from '../../trading-execution/services/trading-execution.service'
import { ExchangeOperationFailedException } from '../../trading/exceptions/exchange-operation-failed.exception'
import { OrderCreationFailedException } from '../../trading/exceptions/order-creation-failed.exception'

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
    markOrderSubmitting: jest.fn().mockResolvedValue(true),
    markOrderOpen: jest.fn().mockResolvedValue({ id: 'order-1' }),
    markOrderPlanned: jest.fn().mockResolvedValue(true),
    markOrdersCanceled: jest.fn().mockResolvedValue(1),
    updateInstanceLastSyncAt: jest.fn().mockResolvedValue({ id: 'grid-1' }),
    appendEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    findStrategyAccountForRuntime: jest.fn().mockResolvedValue({ id: 'account-1' }),
    findTradeByExternalTradeId: jest.fn().mockResolvedValue(null),
  }
}

function createTradingService() {
  return {
    getInstrumentConstraints: jest.fn().mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      rawSymbol: 'BTC-USDT',
      priceTickSize: '0.1',
      quantityStepSize: '0.00000001',
      minQuantity: '0.00000001',
      contractValue: null,
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    }),
    getOpenOrders: jest.fn().mockResolvedValue([]),
    getTicker: jest.fn().mockResolvedValue({
      symbol: 'BTC/USDT',
      last: 100,
      bid: 99,
      ask: 101,
      high: 110,
      low: 90,
      volume: 1000,
      raw: {},
    }),
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
    getOrderFills: jest.fn().mockResolvedValue([]),
    cancelOrder: jest.fn().mockResolvedValue({ id: 'exchange-order-1', status: 'canceled' }),
    getPositions: jest.fn().mockResolvedValue([]),
    placeOrder: jest.fn().mockImplementation(async (_userId, _exchangeId, _marketType, input) => ({
      id: 'exchange-order-created',
      clientOrderId: input.clientOrderId,
      symbol: input.symbol,
      marketType: input.marketType,
      side: input.side,
      type: input.type,
      price: input.price,
      amount: input.amount,
      filled: 0,
      status: 'open',
      createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
      raw: { orderId: 'exchange-order-created' },
    })),
  }
}

function createStateMachine() {
  return {
    stop: jest.fn().mockResolvedValue(undefined),
    markStopped: jest.fn().mockResolvedValue(undefined),
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

function createPositionsService() {
  return {
    recordTrade: jest.fn().mockResolvedValue({ id: 'trade-1' }),
  }
}

function createService(
  repository: ReturnType<typeof createRepository>,
  tradingService = createTradingService(),
  stateMachine = createStateMachine(),
  txEvents = createTxEvents(),
  positionsService = createPositionsService(),
) {
  const tradingExecution = new TradingExecutionService(
    asDependency<ConstructorParameters<typeof TradingExecutionService>[0]>(tradingService),
    new ClientOrderIdFactoryService(),
    new OrderNormalizerService(),
    new OrderAdmissionGateService(),
  )
  return new GridOrderSyncService(
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[0]>(repository),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[1]>(tradingService),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[2]>(tradingExecution),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[3]>(stateMachine),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[4]>(txEvents),
    asDependency<ConstructorParameters<typeof GridOrderSyncService>[5]>(positionsService),
  )
}

describe('GridOrderSyncService', () => {
  it('submits planned limit orders to the exchange before sync matching', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(repository.markOrderSubmitting).toHaveBeenCalledWith({
      id: 'planned-order-1',
      clientOrderId: expect.stringMatching(/^g[A-Za-z0-9]+$/u),
      rawPayload: expect.objectContaining({ source: 'grid_order_sync' }),
    })
    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(tradingService.placeOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', {
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'limit',
      amount: 1.05263157,
      price: 95,
      timeInForce: 'GTC',
      reduceOnly: undefined,
      tdMode: undefined,
      positionSide: undefined,
      posSide: undefined,
      clientOrderId: submittedClientOrderId,
    }, 'exchange-account-1')
    expect(repository.markOrderOpen).toHaveBeenCalledWith({
      id: 'planned-order-1',
      exchangeOrderId: 'exchange-order-created',
      price: '95',
      quantity: '1.05263157',
      rawPayload: expect.objectContaining({
        exchange: { orderId: 'exchange-order-created' },
        execution: expect.objectContaining({
          status: 'submitted',
          clientOrderId: submittedClientOrderId,
        }),
      }),
    })
    expect(repository.updateInstanceLastSyncAt).toHaveBeenCalledWith('grid-1')
  })

  it('reuses instrument constraints and limits planned submissions per sync cycle', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '94' },
      }),
      createOrder({
        id: 'planned-order-2',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '95' },
      }),
      createOrder({
        id: 'planned-order-3',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '96' },
      }),
      createOrder({
        id: 'planned-order-4',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '97' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(tradingService.getInstrumentConstraints).toHaveBeenCalledTimes(1)
    expect(repository.markOrderSubmitting).toHaveBeenCalledTimes(3)
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(3)
    expect(repository.markOrderSubmitting.mock.calls.map(call => call[0].id)).toEqual([
      'planned-order-1',
      'planned-order-2',
      'planned-order-3',
    ])
  })

  it('does not apply the OKX submission limit to other exchanges', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      exchangeId: 'binance',
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '94' },
      }),
      createOrder({
        id: 'planned-order-2',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '95' },
      }),
      createOrder({
        id: 'planned-order-3',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '96' },
      }),
      createOrder({
        id: 'planned-order-4',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '97' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'binance',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      rawSymbol: 'BTCUSDT',
      priceTickSize: '0.1',
      quantityStepSize: '0.00000001',
      minQuantity: '0.00000001',
      contractValue: null,
      clientOrderId: { maxLength: 36, pattern: '^[A-Za-z0-9_-]+$' },
      raw: {},
    })
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(tradingService.getInstrumentConstraints).toHaveBeenCalledTimes(1)
    expect(repository.markOrderSubmitting).toHaveBeenCalledTimes(4)
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(4)
    expect(repository.markOrderSubmitting.mock.calls.map(call => call[0].id)).toEqual([
      'planned-order-1',
      'planned-order-2',
      'planned-order-3',
      'planned-order-4',
    ])
  })

  it('marks reconcile required when planned order constraints cannot be loaded', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('constraints unavailable'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'order_constraints_unavailable', expect.objectContaining({
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      error: expect.objectContaining({ message: 'constraints unavailable' }),
    }))
    expect(repository.markOrderSubmitting).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('keeps scanning planned orders when close orders are waiting for positions', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_neutral' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-close-short-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'buy',
        role: 'close_short',
        quantity: { toString: () => '0.1' },
      }),
      createOrder({
        id: 'planned-close-short-2',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'buy',
        role: 'close_short',
        quantity: { toString: () => '0.1' },
      }),
      createOrder({
        id: 'planned-close-short-3',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'buy',
        role: 'close_short',
        quantity: { toString: () => '0.1' },
      }),
      createOrder({
        id: 'planned-open-long',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'buy',
        role: 'open_long',
        quantity: { toString: () => '0.1' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    tradingService.getPositions.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(repository.markOrderPlanned).toHaveBeenCalledTimes(3)
    expect(repository.markOrderPlanned.mock.calls.map(call => call[0].id)).toEqual([
      'planned-close-short-1',
      'planned-close-short-2',
      'planned-close-short-3',
    ])
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
    expect(tradingService.placeOrder).toHaveBeenCalledWith('user-1', 'okx', 'perp', expect.objectContaining({
      side: 'buy',
      tdMode: 'cross',
    }), 'exchange-account-1')
    expect(repository.markOrderSubmitting.mock.calls.map(call => call[0].id)).toEqual([
      'planned-close-short-1',
      'planned-close-short-2',
      'planned-close-short-3',
      'planned-open-long',
    ])
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('keeps generated client order ids within OKX alphanumeric limits', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: '0123456789abcdefghijklmnopqrstuvwxyz---tail',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    const clientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(clientOrderId).toEqual(expect.stringMatching(/^g[A-Za-z0-9]+$/u))
    expect(clientOrderId).toHaveLength(32)
    expect(tradingService.placeOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', expect.objectContaining({
      clientOrderId,
    }), 'exchange-account-1')
  })

  it('persists exchange-accepted price and quantity when opening a submitted order', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '79283.333333333333333' },
        quantity: { toString: () => '0.100000000000000000' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockResolvedValue({
      id: 'exchange-order-created',
      clientOrderId: 'gplannedorder1',
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'limit',
      price: 79283.4,
      amount: 0.09,
      filled: 0,
      status: 'open',
      createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
      raw: { orderId: 'exchange-order-created' },
    })
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(repository.markOrderOpen).toHaveBeenCalledWith({
      id: 'planned-order-1',
      exchangeOrderId: 'exchange-order-created',
      price: '79283.4',
      quantity: '0.09',
      rawPayload: expect.objectContaining({
        exchange: { orderId: 'exchange-order-created' },
        execution: expect.objectContaining({ status: 'submitted' }),
      }),
    })
  })

  it('submits perp close orders as reduce-only limit orders', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      configSnapshot: { ...baseConfig, mode: 'perp_long' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-close-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'sell',
        role: 'close_long',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    tradingService.getPositions.mockResolvedValue([
      {
        symbol: 'BTC/USDT:PERP',
        marketType: 'perp',
        side: 'long',
        size: 1,
        entryPrice: 100,
        unrealizedPnl: 0,
        raw: {},
      },
    ])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(tradingService.placeOrder).toHaveBeenCalledWith('user-1', 'okx', 'perp', expect.objectContaining({
      marketType: 'perp',
      side: 'sell',
      tdMode: 'cross',
      reduceOnly: true,
    }), 'exchange-account-1')
  })

  it('skips perp close orders when the account has no matching position', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_neutral' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-open-long',
        clientOrderId: null,
        exchangeOrderId: null,
      status: 'PLANNED',
      side: 'buy',
      role: 'open_long',
      quantity: { toString: () => '0.1' },
    }),
      createOrder({
        id: 'planned-close-short',
        clientOrderId: null,
        exchangeOrderId: null,
      status: 'PLANNED',
      side: 'buy',
      role: 'close_short',
      quantity: { toString: () => '0.1' },
    }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    tradingService.getPositions.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(tradingService.getPositions).toHaveBeenCalledWith('user-1', 'okx', 'perp', 'exchange-account-1')
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
    expect(tradingService.placeOrder).toHaveBeenCalledWith('user-1', 'okx', 'perp', expect.objectContaining({
      side: 'buy',
    }), 'exchange-account-1')
    expect(repository.markOrderSubmitting).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-close-short',
    }))
    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-close-short',
      rawPayload: expect.objectContaining({
        execution: expect.objectContaining({
          status: 'waiting_position',
          reason: 'missing_closable_short_position',
        }),
      }),
    }))
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('marks reconcile required when waiting-position planned-state CAS loses', async () => {
    const repository = createRepository()
    repository.markOrderPlanned.mockResolvedValue(false)
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_short' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-close-short',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'buy',
        role: 'close_short',
        quantity: { toString: () => '0.1' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    tradingService.getPositions.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({ id: 'planned-close-short' }))
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'order_waiting_position_state_race', expect.objectContaining({
      orderId: 'planned-close-short',
      status: 'waiting_position',
      reason: 'missing_closable_short_position',
    }))
  })

  it('records position fetch errors in waiting-position payload', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_short' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-close-short',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        side: 'buy',
        role: 'close_short',
        quantity: { toString: () => '0.1' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC-USDT-SWAP',
      priceTickSize: '0.1',
      quantityStepSize: '1',
      minQuantity: '1',
      contractValue: '0.01',
      clientOrderId: { maxLength: 32, pattern: '^[A-Za-z0-9]+$' },
      raw: {},
    })
    tradingService.getPositions.mockRejectedValue(new Error('positions timeout'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-close-short',
      rawPayload: expect.objectContaining({
        execution: expect.objectContaining({
          status: 'waiting_position',
          reason: 'positions_unavailable',
          error: expect.objectContaining({ message: 'positions timeout' }),
        }),
      }),
    }))
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('does not submit a planned order when another sync worker already claimed it', async () => {
    const repository = createRepository()
    repository.markOrderSubmitting.mockResolvedValue(false)
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(repository.markOrderOpen).not.toHaveBeenCalled()
  })

  it('records exchange submit errors in reconcile event payload', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(Object.assign(new Error('OKX error 51000: Parameter px error'), {
      code: 'TRADING_ORDER_CREATION_FAILED',
      args: { exchangeId: 'okx', reason: 'OKX error 51000: Parameter px error' },
    }))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'order_submit_failed', expect.objectContaining({
      orderId: 'planned-order-1',
      clientOrderId: expect.stringMatching(/^g[A-Za-z0-9]+$/u),
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      status: 'submit_failed',
      normalized: expect.objectContaining({ clientOrderId: expect.stringMatching(/^g[A-Za-z0-9]+$/u) }),
      error: expect.objectContaining({
        message: 'OKX error 51000: Parameter px error',
        code: 'TRADING_ORDER_CREATION_FAILED',
        args: { exchangeId: 'okx', reason: 'OKX error 51000: Parameter px error' },
      }),
    }))
  })

  it('keeps runtime running and restores planned order when OKX rate limits submission', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
      createOrder({
        id: 'planned-order-2',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(new Error('OKX order creation failed: OKX error 50011: Too Many Requests'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderSubmitting).toHaveBeenCalledTimes(1)
    expect(repository.markOrderPlanned).toHaveBeenCalledWith({
      id: 'planned-order-1',
      rawPayload: expect.objectContaining({
        source: 'grid_order_sync',
        execution: expect.objectContaining({
          status: 'rate_limited',
          clientOrderId: submittedClientOrderId,
          reason: 'OKX order creation failed: OKX error 50011: Too Many Requests',
        }),
      }),
    })
    expect(repository.appendEvent).toHaveBeenCalledWith({
      gridRuntimeInstanceId: 'grid-1',
      eventType: 'runtime_rate_limited',
      severity: 'warn',
      status: 'RUNNING',
      message: 'OKX order creation failed: OKX error 50011: Too Many Requests',
      payload: expect.objectContaining({
        orderId: 'planned-order-1',
        clientOrderId: submittedClientOrderId,
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
      }),
    })
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
  })

  it('marks reconcile required when rate-limit restore to planned loses CAS', async () => {
    const repository = createRepository()
    repository.markOrderPlanned.mockResolvedValue(false)
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(new Error('OKX order creation failed: OKX error 50011: Too Many Requests'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-order-1',
    }))
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'order_rate_limit_restore_state_race', expect.objectContaining({
      orderId: 'planned-order-1',
      clientOrderId: submittedClientOrderId,
      status: 'rate_limited',
      reason: 'OKX order creation failed: OKX error 50011: Too Many Requests',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      error: expect.objectContaining({
        message: 'OKX order creation failed: OKX error 50011: Too Many Requests',
      }),
    }))
    expect(repository.appendEvent).not.toHaveBeenCalled()
  })

  it('keeps runtime running when submit failure carries numeric OKX rate-limit code', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(Object.assign(new Error('OKX throttled'), { code: 50011 }))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-order-1',
      rawPayload: expect.objectContaining({
        execution: expect.objectContaining({
          status: 'rate_limited',
          clientOrderId: submittedClientOrderId,
        }),
      }),
    }))
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'runtime_rate_limited',
      severity: 'warn',
      status: 'RUNNING',
      message: 'OKX throttled',
      payload: expect.objectContaining({
        orderId: 'planned-order-1',
        clientOrderId: submittedClientOrderId,
        exchangeId: 'okx',
      }),
    }))
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
  })

  it('keeps runtime running when submit failure carries RATE_LIMIT code', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(Object.assign(new Error('exchange throttled'), { code: 'RATE_LIMIT' }))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-order-1',
      rawPayload: expect.objectContaining({
        execution: expect.objectContaining({
          status: 'rate_limited',
          clientOrderId: submittedClientOrderId,
        }),
      }),
    }))
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'runtime_rate_limited',
      severity: 'warn',
      status: 'RUNNING',
      message: 'exchange throttled',
      payload: expect.objectContaining({
        orderId: 'planned-order-1',
        clientOrderId: submittedClientOrderId,
        exchangeId: 'okx',
      }),
    }))
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
  })

  it('keeps runtime running when OKX submit failure wraps rate-limit reason in domain args', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(new OrderCreationFailedException({
      exchangeId: 'okx',
      reason: 'OKX error 50011: Too Many Requests',
    }))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderPlanned).toHaveBeenCalledWith(expect.objectContaining({
      id: 'planned-order-1',
      rawPayload: expect.objectContaining({
        execution: expect.objectContaining({
          status: 'rate_limited',
          clientOrderId: submittedClientOrderId,
          error: expect.objectContaining({
            args: expect.objectContaining({
              reason: 'OKX error 50011: Too Many Requests',
            }),
          }),
        }),
      }),
    }))
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'runtime_rate_limited',
      status: 'RUNNING',
      payload: expect.objectContaining({
        orderId: 'planned-order-1',
        clientOrderId: submittedClientOrderId,
        exchangeId: 'okx',
      }),
    }))
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('keeps runtime running when OKX constraints failure wraps rate-limit reason in domain args', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.getInstrumentConstraints.mockRejectedValue(new ExchangeOperationFailedException({
      operation: 'fetch instrument constraints',
      exchangeId: 'okx',
      reason: 'OKX error 50011: Too Many Requests',
    }))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(repository.markOrderSubmitting).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'runtime_rate_limited',
      status: 'RUNNING',
      payload: expect.objectContaining({
        orderId: null,
        clientOrderId: null,
        exchangeId: 'okx',
        error: expect.objectContaining({
          args: expect.objectContaining({
            reason: 'OKX error 50011: Too Many Requests',
          }),
        }),
      }),
    }))
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('keeps non-OKX rate-limit-like submit failures on the reconcile path', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      exchangeId: 'binance',
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'binance',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      rawSymbol: 'BTCUSDT',
      priceTickSize: '0.1',
      quantityStepSize: '0.00000001',
      minQuantity: '0.00000001',
      contractValue: null,
      clientOrderId: { maxLength: 36, pattern: '^[A-Za-z0-9_-]+$' },
      raw: {},
    })
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(Object.assign(new Error('Too Many Requests'), { code: 'RATE_LIMIT' }))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderPlanned).not.toHaveBeenCalled()
    expect(repository.appendEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'runtime_rate_limited',
    }))
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'order_submit_failed', expect.objectContaining({
      orderId: 'planned-order-1',
      clientOrderId: submittedClientOrderId,
      exchangeId: 'binance',
      status: 'submit_failed',
      reason: 'Too Many Requests',
      error: expect.objectContaining({
        message: 'Too Many Requests',
        code: 'RATE_LIMIT',
      }),
    }))
  })

  it('cancels a just-created exchange order when local open CAS loses to stop', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    repository.markOrderOpen.mockResolvedValue(false)
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
    expect(repository.markOrderOpen).toHaveBeenCalledWith({
      id: 'planned-order-1',
      exchangeOrderId: 'exchange-order-created',
      price: '95',
      quantity: '1.05263157',
      rawPayload: expect.objectContaining({
        exchange: { orderId: 'exchange-order-created' },
        execution: expect.objectContaining({ status: 'submitted' }),
      }),
    })
    expect(tradingService.cancelOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'exchange-order-created', 'BTC/USDT', 'exchange-account-1')
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'order_submit_race')
  })

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
      gridLevelId: 'level-2',
      side: 'sell',
      role: 'spot_sell',
      orderType: 'limit',
      timeInForce: 'gtc',
      price: '100',
      quantity: '1.0526315789473684',
    }))
    expect(txEvents.withAfterCommit).toHaveBeenCalled()
  })

  it('records every exchange fill for one completed order instead of collapsing to the order summary', async () => {
    const repository = createRepository()
    const tradingService = createTradingService()
    tradingService.getOrderFills.mockResolvedValue([
      {
        id: 'trade-1',
        tradeId: 'trade-1',
        orderId: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        price: 95,
        amount: 0.4,
        fee: 0.01,
        feeCurrency: 'USDT',
        executedAt: Date.parse('2026-04-29T00:00:30.000Z'),
        raw: { tradeId: 'trade-1', fillPx: '95', fillSz: '0.4' },
      },
      {
        id: 'trade-2',
        tradeId: 'trade-2',
        orderId: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        price: 95.1,
        amount: 0.6526315789473684,
        fee: 0.02,
        feeCurrency: 'USDT',
        executedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { tradeId: 'trade-2', fillPx: '95.1', fillSz: '0.6526315789473684' },
      },
    ])
    const positionsService = createPositionsService()
    const service = createService(repository, tradingService, createStateMachine(), createTxEvents(), positionsService)

    await service.syncInstance('grid-1')

    expect(tradingService.getOrderFills).toHaveBeenCalledWith('user-1', 'okx', 'spot', {
      symbol: 'BTC/USDT',
      orderId: 'exchange-order-1',
      clientOrderId: 'grid-1-95-buy',
    }, 'exchange-account-1')
    expect(repository.recordFillOnce).toHaveBeenCalledTimes(2)
    expect(repository.recordFillOnce).toHaveBeenNthCalledWith(1, expect.objectContaining({
      exchangeFillId: 'trade-1',
      price: '95',
      quantity: '0.4',
      fee: '0.01',
      filledAt: new Date('2026-04-29T00:00:30.000Z'),
    }))
    expect(repository.recordFillOnce).toHaveBeenNthCalledWith(2, expect.objectContaining({
      exchangeFillId: 'trade-2',
      price: '95.1',
      quantity: '0.6526315789473685',
      fee: '0.02',
      filledAt: new Date('2026-04-29T00:01:00.000Z'),
    }))
    expect(positionsService.recordTrade).toHaveBeenCalledTimes(2)
    expect(positionsService.recordTrade).toHaveBeenNthCalledWith(1, expect.objectContaining({
      externalTradeId: 'grid:trade-1',
      quantity: '0.4',
    }))
    expect(positionsService.recordTrade).toHaveBeenNthCalledWith(2, expect.objectContaining({
      externalTradeId: 'grid:trade-2',
      quantity: '0.6526315789473685',
    }))
  })

  it('mirrors newly recorded grid fills into the strategy account trade ledger', async () => {
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
        amount: 1.0526315789473684,
        filled: 1.0526315789473684,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'fill-1', fee: 0.01, feeCurrency: 'USDT' },
      },
    ])
    const positionsService = createPositionsService()
    const service = createService(repository, tradingService, createStateMachine(), createTxEvents(), positionsService)

    await service.syncInstance('grid-1')

    expect(repository.findStrategyAccountForRuntime).toHaveBeenCalledWith('grid-1')
    expect(positionsService.recordTrade).toHaveBeenCalledWith({
      userStrategyAccountId: 'account-1',
      symbol: 'BTCUSDT',
      market: 'okx:spot',
      side: TradeSide.BUY,
      positionSide: PositionSide.LONG,
      price: '95',
      quantity: '1.0526315789473684',
      fee: '0.01',
      feeCurrency: 'USDT',
      orderId: 'exchange-order-1',
      externalTradeId: 'grid:fill-1',
      provider: 'okx',
      executedAt: '2026-04-29T00:01:00.000Z',
      metadata: expect.objectContaining({
        source: 'grid-runtime',
        gridRuntimeInstanceId: 'grid-1',
        gridOrderId: 'order-1',
        gridFillId: 'fill-1',
        exchangeAccountId: 'exchange-account-1',
      }),
    })
  })

  it('records canceled partial fills and plans the inverse with filled quantity only', async () => {
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
        amount: 1.0526315789473684,
        filled: 0.25,
        status: 'canceled',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'partial-fill-1' },
      },
    ])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(repository.recordFillOnce).toHaveBeenCalledWith(expect.objectContaining({
      exchangeFillId: 'partial-fill-1',
      quantity: '0.25',
    }))
    expect(repository.createPlannedOrder).toHaveBeenCalledWith(expect.objectContaining({
      quantity: '0.25',
    }))
  })

  it('does not create another inverse order when duplicate fill was already recorded', async () => {
    const repository = createRepository()
    repository.recordFillOnce.mockResolvedValue({ fill: { id: 'fill-existing' }, newlyRecorded: false })
    const positionsService = createPositionsService()
    const service = createService(repository, createTradingService(), createStateMachine(), createTxEvents(), positionsService)

    await service.syncInstance('grid-1')

    expect(repository.recordFillOnce).toHaveBeenCalled()
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      externalTradeId: 'grid:fill-1',
      metadata: expect.objectContaining({
        gridFillId: 'fill-existing',
      }),
    }))
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

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch', expect.objectContaining({
      mismatches: expect.arrayContaining([
        expect.objectContaining({
          gridOrderId: 'order-1',
          clientOrderId: 'grid-1-95-buy',
          reason: 'order_contract_mismatch',
        }),
      ]),
    }))
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

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch', expect.objectContaining({
      mismatches: expect.arrayContaining([
        expect.objectContaining({
          gridOrderId: 'order-1',
          clientOrderId: 'grid-1-95-buy',
          reason: 'order_contract_mismatch',
        }),
      ]),
    }))
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('accepts tiny relative JS rounding differences on large prices', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        price: { toString: () => '123456789.12345678' },
        quantity: { toString: () => '0.01' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getClosedOrders.mockResolvedValue([
      {
        id: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'limit',
        price: 123456789.12345679,
        amount: 0.01,
        filled: 0.01,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:00:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:01:00.000Z'),
        raw: { fillId: 'fill-1' },
      },
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(repository.recordFillOnce).toHaveBeenCalled()
  })

  it('accepts equivalent exchange symbol formatting during order matching', async () => {
    const repository = createRepository()
    const tradingService = createTradingService()
    tradingService.getClosedOrders.mockResolvedValue([
      {
        id: 'exchange-order-1',
        clientOrderId: 'grid-1-95-buy',
        symbol: 'BTC-USDT',
        marketType: 'SPOT' as never,
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
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(repository.recordFillOnce).toHaveBeenCalled()
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

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch', expect.objectContaining({
      mismatches: expect.arrayContaining([
        expect.objectContaining({
          gridOrderId: 'order-1',
          clientOrderId: 'grid-1-95-buy',
          reason: 'order_contract_mismatch',
        }),
      ]),
    }))
    expect(repository.createPlannedOrder).not.toHaveBeenCalled()
  })

  it('converges reduce-only close order quantity when exchange accepts less than the local plan', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'ETH/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_short' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'close-short-1',
        clientOrderId: 'grid-close-short-1',
        exchangeOrderId: 'exchange-close-short-1',
        side: 'buy',
        role: 'close_short',
        price: { toString: () => '2300' },
        quantity: { toString: () => '0.043' },
        status: 'OPEN',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      {
        id: 'exchange-close-short-1',
        clientOrderId: 'grid-close-short-1',
        symbol: 'ETH/USDT:PERP',
        marketType: 'perp',
        side: 'buy',
        type: 'limit',
        price: 2300,
        amount: 0.041,
        filled: 0,
        status: 'open',
        createdAt: Date.parse('2026-05-06T01:44:46.000Z'),
        updatedAt: Date.parse('2026-05-06T01:44:46.000Z'),
        raw: { orderId: 'exchange-close-short-1' },
      },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(repository.updateOrderFromExchange).toHaveBeenCalledWith(expect.objectContaining({
      id: 'close-short-1',
      exchangeOrderId: 'exchange-close-short-1',
      status: 'OPEN',
      filledQuantity: '0',
      acceptedQuantity: '0.041',
      rawPayload: expect.objectContaining({
        source: 'grid_order_sync',
        exchange: { orderId: 'exchange-close-short-1' },
        quantityConvergence: {
          reason: 'okx_reduce_only_close_accepted_quantity',
          role: 'close_short',
          originalQuantity: '0.043',
          acceptedQuantity: '0.041',
        },
      }),
    }))
  })

  it('keeps exact OKX close quantity matches out of quantity convergence', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'ETH/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_short' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'close-short-1',
        clientOrderId: 'grid-close-short-1',
        exchangeOrderId: 'exchange-close-short-1',
        side: 'buy',
        role: 'close_short',
        price: { toString: () => '2300' },
        quantity: { toString: () => '0.041' },
        status: 'OPEN',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      {
        id: 'exchange-close-short-1',
        clientOrderId: 'grid-close-short-1',
        symbol: 'ETH/USDT:PERP',
        marketType: 'perp',
        side: 'buy',
        type: 'limit',
        price: 2300,
        amount: 0.041,
        filled: 0,
        status: 'open',
        createdAt: Date.parse('2026-05-06T01:44:46.000Z'),
        updatedAt: Date.parse('2026-05-06T01:44:46.000Z'),
        raw: { orderId: 'exchange-close-short-1' },
      },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(repository.updateOrderFromExchange).toHaveBeenCalledWith(expect.objectContaining({
      id: 'close-short-1',
      acceptedQuantity: null,
      rawPayload: { orderId: 'exchange-close-short-1' },
    }))
  })

  it('preserves original quantity convergence audit after local quantity has converged', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      marketType: 'perp',
      symbol: 'ETH/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_short' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'close-short-1',
        clientOrderId: 'grid-close-short-1',
        exchangeOrderId: 'exchange-close-short-1',
        side: 'buy',
        role: 'close_short',
        price: { toString: () => '2300' },
        quantity: { toString: () => '0.041' },
        status: 'OPEN',
        rawPayload: {
          source: 'grid_order_sync',
          exchange: { orderId: 'exchange-close-short-1' },
          quantityConvergence: {
            reason: 'okx_reduce_only_close_accepted_quantity',
            role: 'close_short',
            originalQuantity: '0.043',
            acceptedQuantity: '0.041',
          },
        },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      {
        id: 'exchange-close-short-1',
        clientOrderId: 'grid-close-short-1',
        symbol: 'ETH/USDT:PERP',
        marketType: 'perp',
        side: 'buy',
        type: 'limit',
        price: 2300,
        amount: 0.041,
        filled: 0,
        status: 'open',
        createdAt: Date.parse('2026-05-06T01:44:46.000Z'),
        updatedAt: Date.parse('2026-05-06T01:44:46.000Z'),
        raw: { orderId: 'exchange-close-short-1', syncedAgain: true },
      },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(repository.updateOrderFromExchange).toHaveBeenCalledWith(expect.objectContaining({
      id: 'close-short-1',
      acceptedQuantity: null,
      rawPayload: expect.objectContaining({
        exchange: { orderId: 'exchange-close-short-1', syncedAgain: true },
        quantityConvergence: {
          reason: 'okx_reduce_only_close_accepted_quantity',
          role: 'close_short',
          originalQuantity: '0.043',
          acceptedQuantity: '0.041',
        },
      }),
    }))
  })

  it.each([
    {
      name: 'non-OKX perp close order accepts less than the local plan',
      exchangeId: 'binance',
      side: 'buy',
      role: 'close_short',
      exchangeAmount: 0.041,
    },
    {
      name: 'OKX perp open order accepts less than the local plan',
      exchangeId: 'okx',
      side: 'sell',
      role: 'open_short',
      exchangeAmount: 0.041,
    },
    {
      name: 'OKX perp close order accepts more than the local plan',
      exchangeId: 'okx',
      side: 'buy',
      role: 'close_short',
      exchangeAmount: 0.044,
    },
  ])('moves to RECONCILE_REQUIRED when $name', async ({ exchangeId, side, role, exchangeAmount }) => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      exchangeId,
      marketType: 'perp',
      symbol: 'ETH/USDT:PERP',
      configSnapshot: { ...baseConfig, mode: 'perp_short' },
    })
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'perp-order-1',
        clientOrderId: 'grid-perp-order-1',
        exchangeOrderId: 'exchange-perp-order-1',
        side,
        role,
        price: { toString: () => '2300' },
        quantity: { toString: () => '0.043' },
        status: 'OPEN',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      {
        id: 'exchange-perp-order-1',
        clientOrderId: 'grid-perp-order-1',
        symbol: 'ETH/USDT:PERP',
        marketType: 'perp',
        side,
        type: 'limit',
        price: 2300,
        amount: exchangeAmount,
        filled: 0,
        status: 'open',
        createdAt: Date.parse('2026-05-06T01:44:46.000Z'),
        updatedAt: Date.parse('2026-05-06T01:44:46.000Z'),
        raw: { orderId: 'exchange-perp-order-1' },
      },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch', expect.objectContaining({
      mismatches: expect.arrayContaining([
        expect.objectContaining({
          gridOrderId: 'perp-order-1',
          clientOrderId: 'grid-perp-order-1',
          reason: 'order_contract_mismatch',
        }),
      ]),
    }))
    expect(repository.updateOrderFromExchange).not.toHaveBeenCalled()
  })

  it('records matched fills before marking reconcile when another local order mismatches', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'mismatch-order',
        clientOrderId: 'grid-1-95-buy',
        exchangeOrderId: 'exchange-order-1',
      }),
      createOrder({
        id: 'matched-order',
        gridLevelId: 'level-0',
        clientOrderId: 'grid-1-90-buy',
        exchangeOrderId: 'exchange-order-2',
        price: { toString: () => '90' },
        quantity: { toString: () => '0.5' },
      }),
    ])
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
        raw: { fillId: 'mismatch-fill' },
      },
      {
        id: 'exchange-order-2',
        clientOrderId: 'grid-1-90-buy',
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
        type: 'limit',
        price: 90,
        amount: 0.5,
        filled: 0.5,
        status: 'closed',
        createdAt: Date.parse('2026-04-29T00:02:00.000Z'),
        updatedAt: Date.parse('2026-04-29T00:03:00.000Z'),
        raw: { fillId: 'matched-fill' },
      },
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(repository.recordFillOnce).toHaveBeenCalledWith(expect.objectContaining({
      gridOrderId: 'matched-order',
      exchangeFillId: 'matched-fill',
      quantity: '0.5',
    }))
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'exchange_mismatch', expect.objectContaining({
      source: 'grid_order_sync',
      mismatches: [expect.objectContaining({ gridOrderId: 'mismatch-order' })],
    }))
  })

  it('keeps RECONCILE_REQUIRED paused but still backfills terminal exchange fills', async () => {
    const repository = createRepository()
    repository.findInstanceForSync.mockResolvedValue({
      ...createInstance(),
      status: 'RECONCILE_REQUIRED',
    })
    repository.listOrders.mockResolvedValue([
      createOrder({ status: 'PLANNED', clientOrderId: null, exchangeOrderId: null }),
      createOrder({ id: 'filled-order', status: 'OPEN', clientOrderId: 'grid-1-95-buy', exchangeOrderId: 'exchange-order-1' }),
    ])
    const tradingService = createTradingService()
    tradingService.getTicker.mockResolvedValue({ symbol: 'BTC/USDT', last: 120, bid: 119, ask: 121, high: 125, low: 90, volume: 1000, raw: {} })
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(stateMachine.stop).not.toHaveBeenCalled()
    expect(repository.recordFillOnce).toHaveBeenCalledWith(expect.objectContaining({
      gridOrderId: 'filled-order',
      exchangeFillId: 'fill-1',
    }))
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
    tradingService.getTicker.mockResolvedValue({ symbol: 'BTC/USDT', last: 120, bid: 119, ask: 121, high: 125, low: 90, volume: 1000, raw: {} })
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'own-exchange', clientOrderId: 'grid-1-95-buy', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
      { id: 'foreign-exchange', clientOrderId: 'manual-order', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(stateMachine.markStopped).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(tradingService.cancelOrder).toHaveBeenCalledTimes(1)
    expect(tradingService.cancelOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'own-exchange', 'BTC/USDT', 'exchange-account-1')
    expect(repository.markOrdersCanceled).toHaveBeenCalledWith({
      ids: ['own-open'],
      rawPayload: expect.objectContaining({
        source: 'grid_order_sync',
        reason: 'boundary_break',
      }),
    })
  })

  it('moves to STOPPING and cancels own submitting order matched by client order id on boundary break', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'own-submitting',
        clientOrderId: 'grid-1-95-buy',
        exchangeOrderId: null,
        status: 'SUBMITTING',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getTicker.mockResolvedValue({ symbol: 'BTC/USDT', last: 80, bid: 79, ask: 81, high: 110, low: 75, volume: 1000, raw: {} })
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'exchange-submitting', clientOrderId: 'grid-1-95-buy', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(stateMachine.markStopped).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(tradingService.cancelOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'exchange-submitting', 'BTC/USDT', 'exchange-account-1')
    expect(repository.markOrdersCanceled).toHaveBeenCalledWith({
      ids: ['own-submitting'],
      rawPayload: expect.objectContaining({
        source: 'grid_order_sync',
        reason: 'boundary_break',
      }),
    })
  })

  it('marks reconcile required when boundary break sees a pending local submission without exchange order yet', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'own-submitting',
        clientOrderId: 'grid-1-95-buy',
        exchangeOrderId: null,
        status: 'SUBMITTING',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getTicker.mockResolvedValue({ symbol: 'BTC/USDT', last: 80, bid: 79, ask: 81, high: 110, low: 75, volume: 1000, raw: {} })
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'boundary_pending_submit')
    expect(stateMachine.markStopped).not.toHaveBeenCalled()
  })

  it('marks reconcile required when boundary break cannot cancel an own live order', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({ id: 'own-open', clientOrderId: 'grid-1-95-buy', exchangeOrderId: 'own-exchange', status: 'OPEN' }),
    ])
    const tradingService = createTradingService()
    tradingService.getTicker.mockResolvedValue({ symbol: 'BTC/USDT', last: 120, bid: 119, ask: 121, high: 125, low: 90, volume: 1000, raw: {} })
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'own-exchange', clientOrderId: 'grid-1-95-buy', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 120, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.cancelOrder.mockRejectedValue(new Error('exchange down'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'boundary_break')
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'boundary_cancel_failed')
    expect(stateMachine.markStopped).not.toHaveBeenCalled()
  })

  it('stops and cancels own live orders on explicit user stop', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({ id: 'own-open', clientOrderId: 'grid-1-95-buy', exchangeOrderId: 'own-exchange', status: 'OPEN' }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'own-exchange', clientOrderId: 'grid-1-95-buy', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 95, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
      { id: 'foreign-exchange', clientOrderId: 'manual-order', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 95, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.stopAndCancelInstance('grid-1', 'user_stop')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'user_stop')
    expect(tradingService.cancelOrder).toHaveBeenCalledTimes(1)
    expect(tradingService.cancelOrder).toHaveBeenCalledWith('user-1', 'okx', 'spot', 'own-exchange', 'BTC/USDT', 'exchange-account-1')
    expect(repository.markOrdersCanceled).toHaveBeenCalledWith({
      ids: ['own-open'],
      rawPayload: expect.objectContaining({
        source: 'grid_order_sync',
        reason: 'user_stop',
      }),
    })
    expect(stateMachine.markStopped).toHaveBeenCalledWith('grid-1', 'user_stop')
  })

  it('marks reconcile required when explicit stop sees a pending local submission without exchange order yet', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'own-submitting',
        clientOrderId: 'grid-1-95-buy',
        exchangeOrderId: null,
        status: 'SUBMITTING',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.stopAndCancelInstance('grid-1', 'user_stop')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'user_stop')
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'stop_pending_submit')
    expect(stateMachine.markStopped).not.toHaveBeenCalled()
  })

  it('marks reconcile required when explicit stop cannot cancel an own live order', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({ id: 'own-open', clientOrderId: 'grid-1-95-buy', exchangeOrderId: 'own-exchange', status: 'OPEN' }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([
      { id: 'own-exchange', clientOrderId: 'grid-1-95-buy', symbol: 'BTC/USDT', marketType: 'spot', side: 'buy', type: 'limit', price: 95, amount: 1, filled: 0, status: 'open', createdAt: 1, raw: {} },
    ])
    tradingService.cancelOrder.mockRejectedValue(new Error('exchange down'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.stopAndCancelInstance('grid-1', 'user_stop')

    expect(stateMachine.stop).toHaveBeenCalledWith('grid-1', 'user_stop')
    expect(stateMachine.markReconcileRequired).toHaveBeenCalledWith('grid-1', 'stop_cancel_failed')
    expect(stateMachine.markStopped).not.toHaveBeenCalled()
  })
})
