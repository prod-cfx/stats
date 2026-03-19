import { Prisma } from '@/prisma/prisma.types'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { SignalExecutorService } from './signal-executor.service'

describe('SignalExecutorService', () => {
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
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
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
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
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
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
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
})
