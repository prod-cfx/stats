import { ClientOrderIdFactoryService } from './client-order-id-factory.service'
import { OrderAdmissionGateService } from './order-admission-gate.service'
import { OrderNormalizerService } from './order-normalizer.service'
import { TradingExecutionService } from './trading-execution.service'
import type { TradingService } from '@/modules/trading/trading.service'
import type { UnifiedInstrumentConstraints, UnifiedOrder, UnifiedPosition } from '@/modules/trading/core/types'
import type { OrderIntent } from '../types/trading-execution.types'

const constraints: UnifiedInstrumentConstraints = {
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
}

const intent: OrderIntent = {
  source: 'grid',
  sourceId: 'planned-open-long',
  userId: 'user-1',
  exchangeAccountId: 'exchange-account-1',
  exchangeId: 'okx',
  marketType: 'perp',
  symbol: 'BTC/USDT:PERP',
  side: 'buy',
  type: 'limit',
  amount: 0.1,
  price: 79200,
  role: 'open_long',
  timeInForce: 'GTC',
  tdMode: 'cross',
}

const order: UnifiedOrder = {
  id: 'order-1',
  clientOrderId: 'gplannedopenlong',
  symbol: 'BTC/USDT:PERP',
  marketType: 'perp',
  side: 'buy',
  type: 'limit',
  price: 79200,
  amount: 0.1,
  filled: 0,
  status: 'open',
  createdAt: 1710000000000,
  raw: {},
}

const shortPosition: UnifiedPosition = {
  symbol: 'BTC-USDT-SWAP',
  marketType: 'perp',
  side: 'short',
  size: 0.2,
  entryPrice: 80000,
  unrealizedPnl: 0,
  raw: {},
}

function createTradingServiceMock() {
  return {
    getInstrumentConstraints: jest.fn().mockResolvedValue(constraints),
    getPositions: jest.fn().mockResolvedValue([]),
    placeOrder: jest.fn().mockResolvedValue(order),
  } satisfies Pick<TradingService, 'getInstrumentConstraints' | 'getPositions' | 'placeOrder'>
}

function createService(tradingService = createTradingServiceMock()): TradingExecutionService {
  return new TradingExecutionService(
    tradingService as unknown as TradingService,
    new ClientOrderIdFactoryService(),
    new OrderNormalizerService(),
    new OrderAdmissionGateService(),
  )
}

describe('TradingExecutionService', () => {
  it('prepares an intent without fetching positions or submitting an order', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const result = await service.prepareIntent(intent)

    expect(result.status).toBe('prepared')
    if (result.status !== 'prepared') throw new Error('expected prepared result')
    expect(result.intent).toBe(intent)
    expect(result.normalized.clientOrderId).toEqual(expect.stringMatching(/^g[A-Za-z0-9]+$/u))
    expect(result.normalized.request).toEqual(expect.objectContaining({
      clientOrderId: result.normalized.clientOrderId,
      amount: 0.1,
      price: 79200,
    }))
    expect(tradingService.getPositions).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('submits a prepared intent with the prepared client order id', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const prepared = await service.prepareIntent(intent)
    if (prepared.status !== 'prepared') throw new Error('expected prepared result')
    const result = await service.submitPrepared(prepared)

    expect(result.status).toBe('submitted')
    if (result.status !== 'submitted') throw new Error('expected submitted result')
    expect(result.normalized.clientOrderId).toBe(prepared.normalized.clientOrderId)
    expect(tradingService.placeOrder).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      expect.objectContaining({ clientOrderId: prepared.normalized.clientOrderId }),
      'exchange-account-1',
    )
  })

  it('submits an open order without fetching positions', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const result = await service.executeIntent(intent)

    expect(result.status).toBe('submitted')
    if (result.status !== 'submitted') throw new Error('expected submitted result')
    expect(tradingService.getInstrumentConstraints).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      'BTC/USDT:PERP',
      'exchange-account-1',
    )
    expect(tradingService.getPositions).not.toHaveBeenCalled()
    expect(result.normalized.clientOrderId).toEqual(expect.stringMatching(/^g[A-Za-z0-9]+$/u))
    expect(result.normalized.request).toEqual(expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'limit',
      amount: 0.1,
      price: 79200,
      timeInForce: 'GTC',
      tdMode: 'cross',
      clientOrderId: expect.stringMatching(/^g[A-Za-z0-9]+$/u),
    }))
    expect(tradingService.placeOrder).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      result.normalized.request,
      'exchange-account-1',
    )
    expect(result.order).toBe(order)
  })

  it('returns waiting_constraints when constraints cannot be loaded', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('constraints unavailable'))
    const service = createService(tradingService)

    const result = await service.executeIntent(intent)

    expect(result).toEqual(expect.objectContaining({
      status: 'waiting_constraints',
      intent,
      reason: 'constraints unavailable',
    }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('prepares and submits Binance spot signal intents when Binance constraints are available', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'binance',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      rawSymbol: 'BTCUSDT',
      priceTickSize: '0.01',
      quantityStepSize: '0.00001',
      minQuantity: '0.00001',
      contractValue: null,
      clientOrderId: { maxLength: 36, pattern: '^[A-Za-z0-9_-]+$' },
      raw: {},
    })
    const service = createService(tradingService)
    const signalIntent: OrderIntent = {
      source: 'signal',
      sourceId: 'exec-binance-signal-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-binance-1',
      exchangeId: 'binance',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.00123456,
      role: 'spot_buy',
    }

    const result = await service.executeIntent(signalIntent)

    expect(result.status).toBe('submitted')
    if (result.status !== 'submitted') throw new Error('expected submitted result')
    expect(result.normalized.normalizedAmount).toBe('0.00123')
    expect(result.normalized.clientOrderId).toEqual(expect.stringMatching(/^sexecbinancesignal1[a-f0-9]{8}$/u))
    expect(tradingService.placeOrder).toHaveBeenCalledWith(
      'user-1',
      'binance',
      'spot',
      expect.objectContaining({
        symbol: 'BTC/USDT',
        clientOrderId: result.normalized.clientOrderId,
        amount: 0.00123,
      }),
      'exchange-account-binance-1',
    )
  })

  it('prepares Hyperliquid signal intents with exchange-compatible cloids', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      exchangeId: 'hyperliquid',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      rawSymbol: 'BTC/USDT:PERP',
      priceTickSize: '0.1',
      quantityStepSize: '0.00001',
      minQuantity: '0.00001',
      contractValue: '1',
      clientOrderId: { maxLength: 34, pattern: '^0x[0-9a-f]{32}$' },
      raw: {},
    })
    const service = createService(tradingService)
    const signalIntent: OrderIntent = {
      source: 'signal',
      sourceId: 'exec-hyperliquid-signal-1',
      userId: 'user-1',
      exchangeAccountId: 'exchange-account-hl-1',
      exchangeId: 'hyperliquid',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      side: 'buy',
      type: 'market',
      amount: 0.123456,
      role: 'open_long',
    }

    const prepared = await service.prepareIntent(signalIntent)

    expect(prepared.status).toBe('prepared')
    if (prepared.status !== 'prepared') throw new Error('expected prepared result')
    expect(prepared.normalized.clientOrderId).toEqual(expect.stringMatching(/^0x[0-9a-f]{32}$/u))
    expect(prepared.normalized.normalizedAmount).toBe('0.12345')
    expect(prepared.normalized.request).toEqual(expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      clientOrderId: prepared.normalized.clientOrderId,
      amount: 0.12345,
    }))
  })

  it('returns waiting_position for close/reduce-only intent without a matching position', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const closeIntent: OrderIntent = {
      ...intent,
      sourceId: 'planned-close-short',
      role: 'close_short',
      reduceOnly: true,
    }
    const result = await service.executeIntent(closeIntent)

    expect(result).toEqual(expect.objectContaining({
      status: 'waiting_position',
      intent: closeIntent,
      reason: 'missing_closable_short_position',
      normalized: expect.objectContaining({
        clientOrderId: expect.any(String),
        request: expect.objectContaining({
          clientOrderId: expect.any(String),
        }),
      }),
    }))
    expect(tradingService.getPositions).toHaveBeenCalledWith('user-1', 'okx', 'perp', 'exchange-account-1')
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('returns waiting_position when positions cannot be loaded for close/reduce-only intent', async () => {
    const tradingService = createTradingServiceMock()
    const error = new Error('positions fetch failed')
    tradingService.getPositions.mockRejectedValue(error)
    const service = createService(tradingService)

    const closeIntent: OrderIntent = {
      ...intent,
      sourceId: 'planned-close-short',
      role: 'close_short',
      reduceOnly: true,
    }
    const result = await service.executeIntent(closeIntent)

    expect(result).toEqual(expect.objectContaining({
      status: 'waiting_position',
      intent: closeIntent,
      reason: 'positions_unavailable',
      error,
      normalized: expect.objectContaining({
        clientOrderId: expect.any(String),
        request: expect.objectContaining({
          clientOrderId: expect.any(String),
        }),
      }),
    }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('returns rejected when client order id generation fails', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockResolvedValue({
      ...constraints,
      clientOrderId: { maxLength: 32, pattern: '^z+$' },
    })
    const service = createService(tradingService)

    const result = await service.executeIntent(intent)

    expect(result).toEqual({
      status: 'rejected',
      intent,
      reason: 'trading_execution_invalid_client_order_id',
    })
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('returns rejected when role and side mismatch', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const result = await service.executeIntent({ ...intent, side: 'sell' })

    expect(result).toEqual({
      status: 'rejected',
      intent: { ...intent, side: 'sell' },
      reason: 'open_long_requires_buy_side',
    })
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('rejects local role and side mismatch before fetching constraints', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockRejectedValue(new Error('constraints unavailable'))
    const service = createService(tradingService)

    const mismatchedIntent = { ...intent, side: 'sell' } satisfies OrderIntent
    const result = await service.executeIntent(mismatchedIntent)

    expect(result).toEqual({
      status: 'rejected',
      intent: mismatchedIntent,
      reason: 'open_long_requires_buy_side',
    })
    expect(tradingService.getInstrumentConstraints).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('rejects spot role on perp market before fetching constraints', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const spotIntent = { ...intent, role: 'spot_buy' } satisfies OrderIntent
    const result = await service.executeIntent(spotIntent)

    expect(result).toEqual({
      status: 'rejected',
      intent: spotIntent,
      reason: 'spot_role_requires_spot_market',
    })
    expect(tradingService.getInstrumentConstraints).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('rejects open-long reduce-only before fetching constraints', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const reduceOnlyIntent = { ...intent, reduceOnly: true } satisfies OrderIntent
    const result = await service.executeIntent(reduceOnlyIntent)

    expect(result).toEqual({
      status: 'rejected',
      intent: reduceOnlyIntent,
      reason: 'open_long_cannot_be_reduce_only',
    })
    expect(tradingService.getInstrumentConstraints).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('rejects roleless perp reduce-only before fetching constraints', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const reduceOnlyIntent = { ...intent, role: null, side: 'sell', reduceOnly: true } satisfies OrderIntent
    const result = await service.executeIntent(reduceOnlyIntent)

    expect(result).toEqual({
      status: 'rejected',
      intent: reduceOnlyIntent,
      reason: 'reduce_only_requires_close_role',
    })
    expect(tradingService.getInstrumentConstraints).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('converts non-Error thrown values to string reasons', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockRejectedValue('constraints unavailable')
    const service = createService(tradingService)

    const result = await service.executeIntent(intent)

    expect(result).toEqual(expect.objectContaining({
      status: 'waiting_constraints',
      intent,
      reason: 'constraints unavailable',
    }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('submits a close/reduce-only intent when a matching position exists', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getPositions.mockResolvedValue([shortPosition])
    const service = createService(tradingService)

    const closeIntent: OrderIntent = {
      ...intent,
      sourceId: 'planned-close-short',
      role: 'close_short',
      reduceOnly: true,
    }
    const result = await service.executeIntent(closeIntent)

    expect(result.status).toBe('submitted')
    expect(tradingService.getPositions).toHaveBeenCalledWith('user-1', 'okx', 'perp', 'exchange-account-1')
    expect(tradingService.placeOrder).toHaveBeenCalled()
  })

  it('submits close-short without caller reduceOnly as reduce-only short request', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getPositions.mockResolvedValue([shortPosition])
    const service = createService(tradingService)

    const closeIntent: OrderIntent = {
      ...intent,
      sourceId: 'planned-close-short',
      role: 'close_short',
      reduceOnly: undefined,
    }
    const result = await service.executeIntent(closeIntent)

    expect(result.status).toBe('submitted')
    if (result.status !== 'submitted') throw new Error('expected submitted result')
    expect(tradingService.getPositions).toHaveBeenCalledWith('user-1', 'okx', 'perp', 'exchange-account-1')
    expect(result.normalized.request).toEqual(expect.objectContaining({
      reduceOnly: true,
      positionSide: 'SHORT',
      posSide: 'short',
    }))
    expect(tradingService.placeOrder).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      result.normalized.request,
      'exchange-account-1',
    )
  })

  it('returns rejected when normalization fails', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.getInstrumentConstraints.mockResolvedValue({ ...constraints, rawSymbol: 'ETH-USDT-SWAP' })
    const service = createService(tradingService)

    const result = await service.executeIntent(intent)

    expect(result).toEqual({
      status: 'rejected',
      intent,
      reason: 'trading_execution_constraints_mismatch',
    })
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('returns submit_failed when order placement fails', async () => {
    const tradingService = createTradingServiceMock()
    tradingService.placeOrder.mockRejectedValue(new Error('exchange unavailable'))
    const service = createService(tradingService)

    const result = await service.executeIntent(intent)

    expect(result).toEqual(expect.objectContaining({
      status: 'submit_failed',
      intent,
      reason: 'exchange unavailable',
    }))
    expect(tradingService.placeOrder).toHaveBeenCalled()
  })
})
