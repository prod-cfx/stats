import { Prisma } from '@/prisma/prisma.types'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { SignalExecutorService } from './signal-executor.service'

describe('signalExecutorService', () => {
  function createService() {
    const prisma = {}
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn() }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }

    return new SignalExecutorService(
      prisma as any,
      configService as any,
      tradingService as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )
  }

  it('rejects hyperliquid spot entries below minimum notional after precision rounding', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '4.64',
        positionSizeQuote: '12',
        symbol: {
          exchange: 'HYPERLIQUID',
          instrumentType: 'SPOT',
          baseAsset: 'PURR',
          quoteAsset: 'USDC',
          precisionPrice: 2,
          precisionQuantity: 0,
          lotSize: '1',
        },
      },
      {
        id: 'acct-spot-1',
        userId: 'user-spot-1',
        baseCurrency: 'USDC',
        balance: new Prisma.Decimal(1000),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
    )

    expect(result).toEqual({
      ok: false,
      reason: 'Estimated order notional 9.28 USDC below minimum 10 USDC after precision rounding',
    })
  })

  it('keeps hyperliquid spot entries executable once rounded notional meets the minimum', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '4.64',
        positionSizeQuote: '15',
        symbol: {
          exchange: 'HYPERLIQUID',
          instrumentType: 'SPOT',
          baseAsset: 'PURR',
          quoteAsset: 'USDC',
          precisionPrice: 2,
          precisionQuantity: 0,
          lotSize: '1',
        },
      },
      {
        id: 'acct-spot-2',
        userId: 'user-spot-2',
        baseCurrency: 'USDC',
        balance: new Prisma.Decimal(1000),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
    )

    expect(result).toMatchObject({
      ok: true,
      quoteBudget: new Prisma.Decimal(15),
      params: {
        exchangeId: 'hyperliquid',
        marketType: 'spot',
        symbol: 'PURR/USDC',
        side: 'buy',
        amount: 3,
        price: 4.64,
        reduceOnly: false,
      },
    })
  })

  it('does not markExecuted when a market order stays open with 0 fill after reconciliation', async () => {
    const prisma = {}
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn() }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }

    const service = new SignalExecutorService(
      prisma as any,
      configService as any,
      tradingService as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    const reservedQuote = new Prisma.Decimal(10)
    const reserveReference = 'reserve-ref'

    const openOrder = {
      id: 'ord-1',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'open',
      amount: 0.001,
      filled: 0,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-1' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.001,
        price: undefined,
        reduceOnly: false,
      },
      reservedQuote,
      reserveReference,
    })

    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(openOrder)

    tradingService.placeOrder.mockResolvedValue(openOrder)

    const result = await (service as any).processAccount(
      { id: 'sig-1', direction: 'BUY', symbol: { quoteAsset: 'USDT' } } as any,
      { id: 'acct-1', userId: 'user-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('failed')
    expect(executionRepository.markExecuted).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      'exec-1',
      'RECONCILE_REQUIRED',
      expect.objectContaining({ reconcileRequired: true }),
    )
    expect(executionRepository.markFailed).toHaveBeenCalled()
    expect((service as any).releaseReservation).not.toHaveBeenCalled()
  })

  it('does not markExecuted when a market order stays open with partial fill after reconciliation', async () => {
    const prisma = {}
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn() }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }

    const service = new SignalExecutorService(
      prisma as any,
      configService as any,
      tradingService as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    const reservedQuote = new Prisma.Decimal(10)
    const reserveReference = 'reserve-ref'

    const partialOpenOrder = {
      id: 'ord-1b',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'open',
      amount: 0.001,
      filled: 0.0004,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-1b' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.001,
        price: undefined,
        reduceOnly: false,
      },
      reservedQuote,
      reserveReference,
    })

    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(partialOpenOrder)

    tradingService.placeOrder.mockResolvedValue(partialOpenOrder)

    const result = await (service as any).processAccount(
      { id: 'sig-1b', direction: 'BUY', symbol: { quoteAsset: 'USDT' } } as any,
      { id: 'acct-1b', userId: 'user-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('failed')
    expect(executionRepository.markExecuted).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      'exec-1b',
      'RECONCILE_REQUIRED',
      expect.objectContaining({
        reconcileRequired: true,
        reason: 'ORDER_NOT_FINAL',
      }),
    )
    expect(executionRepository.markFailed).toHaveBeenCalledWith('exec-1b', 'ORDER_NOT_FINAL')
    expect((service as any).releaseReservation).not.toHaveBeenCalled()
  })

  it('does not markExecuted when a market order is canceled with 0 fill', async () => {
    const prisma = {}
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn() }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }

    const service = new SignalExecutorService(
      prisma as any,
      configService as any,
      tradingService as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    const reservedQuote = new Prisma.Decimal(10)
    const reserveReference = 'reserve-ref'

    const canceledOrder = {
      id: 'ord-2',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'canceled',
      amount: 0.001,
      filled: 0,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-2' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.001,
        price: undefined,
        reduceOnly: false,
      },
      reservedQuote,
      reserveReference,
    })

    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(canceledOrder)

    tradingService.placeOrder.mockResolvedValue(canceledOrder)

    const result = await (service as any).processAccount(
      { id: 'sig-2', direction: 'BUY', symbol: { quoteAsset: 'USDT' } } as any,
      { id: 'acct-2', userId: 'user-2' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('failed')
    expect(executionRepository.markExecuted).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      'exec-2',
      'RECONCILE_REQUIRED',
      expect.objectContaining({
        reconcileRequired: true,
        reason: 'ORDER_NOT_FILLED',
      }),
    )
    expect(executionRepository.markFailed).toHaveBeenCalledWith('exec-2', 'ORDER_NOT_FILLED')
    expect((service as any).releaseReservation).not.toHaveBeenCalled()
  })

  it('keeps reservation when order submitted but order query throws', async () => {
    const prisma = {}
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn() }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }

    const service = new SignalExecutorService(
      prisma as any,
      configService as any,
      tradingService as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    const reservedQuote = new Prisma.Decimal(10)
    const reserveReference = 'reserve-ref'

    const submittedOrder = {
      id: 'ord-3',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'open',
      amount: 0.001,
      filled: 0,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-3' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.001,
        price: undefined,
        reduceOnly: false,
      },
      reservedQuote,
      reserveReference,
    })

    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).resolveFinalOrderState = jest.fn().mockRejectedValue(new Error('getOrder timeout'))

    tradingService.placeOrder.mockResolvedValue(submittedOrder)

    const result = await (service as any).processAccount(
      { id: 'sig-3', direction: 'BUY', symbol: { quoteAsset: 'USDT' } } as any,
      { id: 'acct-3', userId: 'user-3' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('failed')
    expect(executionRepository.markExecuted).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      'exec-3',
      'RECONCILE_REQUIRED',
      expect.objectContaining({
        reconcileRequired: true,
        reason: 'ORDER_RECONCILE_ERROR',
      }),
    )
    expect(executionRepository.markFailed).toHaveBeenCalledWith('exec-3', 'ORDER_RECONCILE_ERROR')
    expect((service as any).releaseReservation).not.toHaveBeenCalled()
  })

  it('uses subscribed exchangeAccountId for llm subscription execution', async () => {
    const prisma = {
      userLlmStrategySubscription: {
        findFirst: jest.fn().mockResolvedValue({
          exchangeAccountId: 'exchange-account-1',
          exchangeAccount: { exchangeId: 'binance' },
        }),
      },
    }
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn() }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }

    const service = new SignalExecutorService(
      prisma as any,
      configService as any,
      tradingService as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    const filledOrder = {
      id: 'ord-fill-1',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'closed',
      amount: 0.001,
      filled: 0.001,
      average: 50000,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-llm-1' },
      orderParams: {
        exchangeId: 'binance',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.001,
        price: undefined,
        reduceOnly: false,
      },
      reservedQuote: new Prisma.Decimal(10),
      reserveReference: 'reserve-llm-1',
    })
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(filledOrder)
    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).reconcilePositionAndRecordTrade = jest.fn().mockResolvedValue(undefined)
    ;(service as any).buildExecutionResultSnapshot = jest.fn().mockReturnValue({})
    ;(service as any).buildOrderResponseSnapshot = jest.fn().mockReturnValue({})
    ;(service as any).mapTradeSide = jest.fn().mockReturnValue('buy')
    ;(service as any).mapPositionSide = jest.fn().mockReturnValue('LONG')

    tradingService.placeOrder.mockResolvedValue(filledOrder)

    const result = await (service as any).processAccount(
      {
        id: 'sig-llm-1',
        llmStrategyInstanceId: 'llm-instance-1',
        direction: 'BUY',
        symbol: {
          exchange: 'BINANCE',
          instrumentType: 'SPOT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
        },
      } as any,
      { id: 'acct-llm-1', userId: 'user-llm-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('executed')
    expect(prisma.userLlmStrategySubscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-llm-1',
        llmStrategyInstanceId: 'llm-instance-1',
        status: 'active',
      }),
    }))
    expect(tradingService.placeOrder).toHaveBeenCalledWith(
      'user-llm-1',
      'binance',
      'spot',
      expect.objectContaining({
        symbol: 'BTC/USDT',
        marketType: 'spot',
        side: 'buy',
      }),
      'exchange-account-1',
    )
  })
})
