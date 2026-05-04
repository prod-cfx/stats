import { Prisma } from '@/prisma/prisma.types'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { PositionAdmissionService } from './position-admission.service'
import { SignalExecutorService } from './signal-executor.service'

describe('signalExecutorService', () => {
  function createSchedulerRegistry() {
    return { addCronJob: jest.fn(), deleteCronJob: jest.fn() }
  }

  function createService() {
    const configService = { get: jest.fn() }
    const schedulerRegistry = createSchedulerRegistry()
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
    const accountsService = { applyLedgerDelta: jest.fn() }
    const positionsService = { recordTrade: jest.fn() }
    const tradingSignalRepository = { updateStatus: jest.fn(), findById: jest.fn().mockResolvedValue(null) }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const telemetry = { recordExecutionSummary: jest.fn() }
    const positionAdmissionService = new PositionAdmissionService()
    const executorRepository = {
      findRecoverableSignals: jest.fn().mockResolvedValue([]),
    }
    const txHost = { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) }

    const service = new SignalExecutorService(
      executorRepository as any,
      configService as any,
      schedulerRegistry as any,
      tradingService as any,
      tradingExecution as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      txHost as any,
      positionAdmissionService,
    )
    return service
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

  it('delegates signal-created events to the execution pipeline when enabled', async () => {
    const withTransaction = jest.fn(async (fn: () => Promise<void>) => fn())
    const config = {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
      execution: {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
        enabled: true,
      },
    }
    const service = createService()
    ;(service as any).configService.get.mockReturnValue(config)
    ;(service as any).txHost.withTransaction = withTransaction
    const executeSignalForSubscribedUsers = jest
      .spyOn(service as any, 'executeSignalForSubscribedUsers')
      .mockResolvedValue(undefined)

    await service.handleSignalCreated({ signalId: 'signal-1' } as any)

    expect(withTransaction).toHaveBeenCalled()
    expect(executeSignalForSubscribedUsers).toHaveBeenCalledWith('signal-1', config)
  })

  it('recovers only aged executable signals on startup when execution is enabled', async () => {
    const service = createService()
    const config = {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
      execution: {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
        enabled: true,
      },
    }
    ;(service as any).configService.get.mockReturnValue(config)
    ;(service as any).executorRepository.findRecoverableSignals.mockResolvedValue([
      { id: 'signal-1' },
      { id: 'signal-2' },
    ])
    const executeSignalForSubscribedUsers = jest
      .spyOn(service as any, 'executeSignalForSubscribedUsers')
      .mockResolvedValue(undefined)

    await service.onModuleInit()

    expect((service as any).executorRepository.findRecoverableSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 50,
        readyBefore: expect.any(Date),
      }),
    )
    expect(executeSignalForSubscribedUsers).toHaveBeenCalledTimes(2)
    expect(executeSignalForSubscribedUsers).toHaveBeenNthCalledWith(1, 'signal-1', config)
    expect(executeSignalForSubscribedUsers).toHaveBeenNthCalledWith(2, 'signal-2', config)
    expect((service as any).schedulerRegistry.addCronJob).toHaveBeenCalled()
    service.onModuleDestroy()
  })

  it('skips recovery on startup when execution is disabled', async () => {
    const service = createService()
    const config = {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
      execution: {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
        enabled: false,
      },
    }
    ;(service as any).configService.get.mockReturnValue(config)

    await service.onModuleInit()

    expect((service as any).executorRepository.findRecoverableSignals).not.toHaveBeenCalled()
    expect((service as any).schedulerRegistry.addCronJob).not.toHaveBeenCalled()
  })

  it('replays the extracted recovery logic from the scheduled cron handler', async () => {
    const service = createService()
    const config = {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
      cronExpression: '* * * * * *',
      execution: {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
        enabled: true,
      },
    }
    ;(service as any).configService.get.mockReturnValue(config)
    const recoverExecutableSignals = jest
      .spyOn(service as any, 'recoverExecutableSignals')
      .mockResolvedValue(undefined)
    const futureCronConfig = {
      ...config,
      cronExpression: '0 0 1 1 * *',
    }
    ;(service as any).configService.get.mockReturnValue(futureCronConfig)

    await service.onModuleInit()

    const cronJob = (service as any).schedulerRegistry.addCronJob.mock.calls[0]?.[1]
    expect(cronJob).toBeDefined()

    await cronJob.fireOnTick()

    expect(recoverExecutableSignals).toHaveBeenCalledTimes(2)
    service.onModuleDestroy()
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

  it('skips opening orders when buying power is below the minimum threshold even if equity is positive', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'SELL',
        entryPrice: '77789.4',
        positionSizeRatio: '0.1',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 6,
          lotSize: '0.000001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal('4901.58222'),
        initialBalance: new Prisma.Decimal('4901.58222'),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
    )

    expect(result).toEqual({
      ok: false,
      reason: 'Buying power below minimum threshold',
    })
  })

  it('builds OKX perpetual order params with perp market type', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'SELL',
        entryPrice: '50000',
        positionSizeQuote: '100',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 6,
          lotSize: '0.000001',
        },
      },
      {
        id: 'account-perp-1',
        userId: 'user-perp-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(1000),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
    )

    expect(result).toMatchObject({
      ok: true,
      params: {
        marketType: 'perp',
        symbol: 'BTC/USDT:PERP',
        side: 'sell',
        reduceOnly: false,
      },
    })
  })

  it('rejects inconsistent execution market type', () => {
    const service = createService()

    const result = (service as any).validateOrderMarketTypeConsistency({
      expectedMarketType: 'perp',
      symbolInstrumentType: 'SPOT',
      orderMarketType: 'spot',
    })

    expect(result).toEqual({ ok: false, reason: 'MARKET_TYPE_MISMATCH' })
  })

  it('skips order submission when runtime market type mismatches final order params', async () => {
    const service = createService()
    const executionRepository = (service as any).executionRepository
    const tradingService = (service as any).tradingService
    const reservedQuote = new Prisma.Decimal(10)
    const reserveReference = 'reserve-market-mismatch'

    jest.spyOn(service as any, 'prepareExecution').mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-market-mismatch' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.01,
        price: 100,
        reduceOnly: false,
      },
      reservedQuote,
      reserveReference,
    })
    const releaseReservation = jest
      .spyOn(service as any, 'releaseReservation')
      .mockResolvedValue(undefined)

    const result = await (service as any).processAccount(
      {
        id: 'sig-market-mismatch',
        direction: 'BUY',
        signalType: 'ENTRY',
        symbol: {
          instrumentType: 'SPOT',
          quoteAsset: 'USDT',
        },
        metadata: {
          runtimeProvenance: {
            marketType: 'perp',
          },
        },
      },
      { id: 'acct-market-mismatch', userId: 'user-market-mismatch' },
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('skipped')
    expect(executionRepository.markSkipped).toHaveBeenCalledWith(
      'exec-market-mismatch',
      'MARKET_TYPE_MISMATCH',
    )
    expect(releaseReservation).toHaveBeenCalledWith(
      'acct-market-mismatch',
      reservedQuote,
      reserveReference,
    )
    expect(executionRepository.markStage).not.toHaveBeenCalledWith(
      'exec-market-mismatch',
      'ORDER_SUBMITTED',
      expect.anything(),
    )
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('submits OKX spot strategy signals through trading execution with the subscribed exchange account', async () => {
    const service = createService()
    const executorRepository = (service as any).executorRepository
    const executionRepository = (service as any).executionRepository
    const tradingExecution = (service as any).tradingExecution
    const tradingService = (service as any).tradingService

    executorRepository.findStrategyInstanceMode = jest.fn().mockResolvedValue({ mode: 'TESTNET' })
    executorRepository.findActiveSubscriptionNetwork = jest.fn().mockResolvedValue({
      exchangeAccountId: 'exchange-account-spot-1',
      exchangeAccount: { isTestnet: true },
    })

    const filledOrder = {
      id: 'ord-spot-execution-1',
      symbol: 'ORDI/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'closed',
      amount: 10,
      filled: 10,
      price: 4.5,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-okx-spot-1' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'ORDI/USDT',
        side: 'buy',
        amount: 10,
        price: 4.5,
        reduceOnly: false,
      },
      reservedQuote: new Prisma.Decimal(45),
      reserveReference: 'reserve-okx-spot-1',
    })
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(filledOrder)
    ;(service as any).releaseReservation = jest.fn().mockResolvedValue(undefined)

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-okx-spot-1',
        normalizedAmount: '10',
        exchangeSize: '10',
        request: {
          symbol: 'ORDI/USDT',
          marketType: 'spot',
          side: 'buy',
          type: 'market',
          amount: 10,
          price: 4.5,
          clientOrderId: 'sig-exec-okx-spot-1',
        },
        constraints: {},
      },
      order: filledOrder,
    })

    const result = await (service as any).processAccount(
      {
        id: 'sig-okx-spot-1',
        strategyInstanceId: 'inst-okx-spot-1',
        direction: 'BUY',
        signalType: 'ENTRY',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'SPOT',
          baseAsset: 'ORDI',
          quoteAsset: 'USDT',
        },
      } as any,
      { id: 'acct-okx-spot-1', userId: 'user-okx-spot-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('executed')
    expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'signal',
      sourceId: 'exec-okx-spot-1',
      userId: 'user-okx-spot-1',
      exchangeAccountId: 'exchange-account-spot-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'ORDI/USDT',
      side: 'buy',
      type: 'market',
      amount: 10,
      price: 4.5,
      reduceOnly: false,
      role: 'spot_buy',
    }))
    expect(tradingExecution.executeIntent.mock.calls[0][0]).not.toHaveProperty('tdMode')
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      'exec-okx-spot-1',
      'ORDER_SUBMITTED',
      expect.objectContaining({
        tradingExecution: expect.objectContaining({
          status: 'submitted',
          clientOrderId: 'sig-exec-okx-spot-1',
          normalizedRequest: expect.objectContaining({
            clientOrderId: 'sig-exec-okx-spot-1',
          }),
        }),
      }),
    )
  })

  it.each([
    ['CLOSE_LONG', 'sell', 'close_long'],
    ['CLOSE_SHORT', 'buy', 'close_short'],
  ] as const)('submits OKX perp %s close signals as reduce-only trading execution intents', async (direction, side, role) => {
    const service = createService()
    const tradingExecution = (service as any).tradingExecution
    const tradingService = (service as any).tradingService

    const filledOrder = {
      id: `ord-${role}-1`,
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side,
      type: 'market',
      status: 'closed',
      amount: 0.25,
      filled: 0.25,
      price: 50000,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: `exec-${role}-1` },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'perp',
        symbol: 'BTC/USDT:PERP',
        side,
        amount: 0.25,
        price: 50000,
        reduceOnly: true,
      },
      reservedQuote: new Prisma.Decimal(0),
      reserveReference: `reserve-${role}-1`,
    })
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(filledOrder)
    ;(service as any).releaseReservation = jest.fn().mockResolvedValue(undefined)

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: `sig-${role}-1`,
        normalizedAmount: '0.25',
        exchangeSize: '0.25',
        request: {
          symbol: 'BTC/USDT:PERP',
          marketType: 'perp',
          side,
          type: 'market',
          amount: 0.25,
          price: 50000,
          reduceOnly: true,
          tdMode: 'cross',
          clientOrderId: `sig-${role}-1`,
        },
        constraints: {},
      },
      order: filledOrder,
    })

    const result = await (service as any).processAccount(
      {
        id: `sig-${role}-1`,
        direction,
        signalType: 'EXIT',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
        },
      } as any,
      { id: `acct-${role}-1`, userId: `user-${role}-1` } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('executed')
    expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'signal',
      sourceId: `exec-${role}-1`,
      userId: `user-${role}-1`,
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTC/USDT:PERP',
      side,
      type: 'market',
      amount: 0.25,
      price: 50000,
      reduceOnly: true,
      role,
      tdMode: 'cross',
    }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it.each([
    [
      'rejected',
      {
        status: 'rejected',
        reason: 'amount_below_min',
        intent: {},
        normalized: {
          clientOrderId: 'sig-rejected-1',
          normalizedAmount: '0',
          exchangeSize: '0',
          request: { symbol: 'BTC/USDT', clientOrderId: 'sig-rejected-1' },
          constraints: {},
        },
      },
    ],
    [
      'waiting_constraints',
      {
        status: 'waiting_constraints',
        reason: 'constraints_unavailable',
        intent: {},
      },
    ],
    [
      'submit_failed',
      {
        status: 'submit_failed',
        reason: 'exchange_submit_error',
        intent: {},
        normalized: {
          clientOrderId: 'sig-submit-failed-1',
          normalizedAmount: '0.001',
          exchangeSize: '0.001',
          request: { symbol: 'BTC/USDT', clientOrderId: 'sig-submit-failed-1' },
          constraints: {},
        },
        error: new Error('exchange_submit_error'),
      },
    ],
    [
      'waiting_position',
      {
        status: 'waiting_position',
        reason: 'missing_closable_long_position',
        intent: {},
        normalized: {
          clientOrderId: 'sig-waiting-position-1',
          normalizedAmount: '0.001',
          exchangeSize: '0.001',
          request: { symbol: 'BTC/USDT', clientOrderId: 'sig-waiting-position-1' },
          constraints: {},
        },
      },
    ],
  ] as const)('fails and releases reservation when trading execution returns %s', async (status, executionResult) => {
    const service = createService()
    const executionRepository = (service as any).executionRepository
    const tradingExecution = (service as any).tradingExecution
    const tradingService = (service as any).tradingService
    const reservedQuote = new Prisma.Decimal(10)
    const reserveReference = `reserve-${status}-1`
    const releaseReservation = jest
      .spyOn(service as any, 'releaseReservation')
      .mockResolvedValue(undefined)
    const resolveFinalOrderState = jest
      .spyOn(service as any, 'resolveFinalOrderState')
      .mockResolvedValue({} as any)

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: `exec-${status}-1` },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.001,
        price: 100,
        reduceOnly: false,
      },
      reservedQuote,
      reserveReference,
    })
    tradingExecution.executeIntent.mockResolvedValue(executionResult)

    const result = await (service as any).processAccount(
      {
        id: `sig-${status}-1`,
        direction: 'BUY',
        signalType: 'ENTRY',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'SPOT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
        },
      } as any,
      { id: `acct-${status}-1`, userId: `user-${status}-1` } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('failed')
    expect(executionRepository.markFailed).toHaveBeenCalledWith(`exec-${status}-1`, executionResult.reason)
    expect(releaseReservation).toHaveBeenCalledWith(`acct-${status}-1`, reservedQuote, reserveReference)
    expect(resolveFinalOrderState).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      `exec-${status}-1`,
      'ORDER_SUBMITTED',
      expect.objectContaining({
        tradingExecution: expect.objectContaining({
          status,
          reason: executionResult.reason,
        }),
      }),
    )
    if ('normalized' in executionResult) {
      expect(executionRepository.markStage).toHaveBeenCalledWith(
        `exec-${status}-1`,
        'ORDER_SUBMITTED',
        expect.objectContaining({
          tradingExecution: expect.objectContaining({
            clientOrderId: executionResult.normalized.clientOrderId,
            normalizedRequest: expect.objectContaining({
              clientOrderId: executionResult.normalized.clientOrderId,
            }),
          }),
        }),
      )
    }
  })

  it('sizes ratio orders from execution capital and caps budget by buying power', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '100',
        positionSizeRatio: '0.1',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 4,
          lotSize: '0.0001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(120),
        equity: new Prisma.Decimal(4901.58222),
        initialBalance: new Prisma.Decimal(4901.58222),
      },
      {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          minBalanceThreshold: 50,
          maxRiskFraction: 1,
        },
      } as any,
    )

    expect(result).toMatchObject({
      ok: true,
      quoteBudget: new Prisma.Decimal(120),
      params: expect.objectContaining({
        amount: 1.2,
      }),
    })
  })

  it('does not require quote buying power for close signals', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '100',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 4,
          lotSize: '0.0001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal(4901.58222),
        initialBalance: new Prisma.Decimal(4901.58222),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
      new Prisma.Decimal('0.25'),
    )

    expect(result).toMatchObject({
      ok: true,
      quoteBudget: new Prisma.Decimal(0),
      params: expect.objectContaining({
        reduceOnly: true,
        amount: 0.25,
      }),
    })
  })

  it('keeps OKX perp reduce-only close quantity before contract-size conversion', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '94500',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 6,
          lotSize: '0.001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal(4901.58222),
        initialBalance: new Prisma.Decimal(4901.58222),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
      new Prisma.Decimal('0.0359'),
    )

    expect(result).toMatchObject({
      ok: true,
      params: expect.objectContaining({
        reduceOnly: true,
        amount: 0.0359,
      }),
    })
  })

  it('keeps OKX perp reduce-only close quantity when recalculating for target exchange', () => {
    const service = createService()

    const result = (service as any).recalculateOrderParamsForTargetExchange(
      {
        exchangeId: 'binance',
        marketType: 'perp',
        symbol: 'BTC/USDT:PERP',
        side: 'sell',
        amount: 0.0359,
        price: 94500,
        reduceOnly: true,
      },
      {
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        instrumentType: 'PERPETUAL',
      },
      {
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        instrumentType: 'PERPETUAL',
        precisionPrice: 2,
        precisionQuantity: 6,
        lotSize: '0.001',
      },
      'okx',
    )

    expect(result).toMatchObject({
      ok: true,
      params: expect.objectContaining({
        exchangeId: 'okx',
        marketType: 'perp',
        symbol: 'BTC/USDT:PERP',
        reduceOnly: true,
        amount: 0.0359,
      }),
    })
  })

  it('uses runtime market identity when locating close positions', async () => {
    const service = createService()
    const executorRepository = (service as any).executorRepository
    const executionRepository = (service as any).executionRepository
    const accountsService = (service as any).accountsService

    executionRepository.findBySignalAndAccount = jest.fn().mockResolvedValue(null)
    executorRepository.lockAccount = jest.fn().mockResolvedValue([
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal(1000),
        initialBalance: new Prisma.Decimal(1000),
      },
    ])
    executorRepository.findOpenPositionForClose = jest.fn().mockResolvedValue({
      id: 'pos-perp-1',
      quantity: new Prisma.Decimal('0.25'),
    })
    executorRepository.findRiskProfileByStrategyInstanceId = jest.fn().mockResolvedValue(null)
    executionRepository.create = jest.fn().mockResolvedValue({ id: 'exec-close-1' })

    const result = await (service as any).prepareExecution(
      {
        id: 'sig-close-1',
        direction: 'CLOSE_LONG',
        signalType: 'EXIT',
        entryPrice: '100',
        metadata: {
          runtimeProvenance: {
            marketType: 'perp',
          },
        },
        symbol: {
          code: 'BTCUSDT:SPOT',
          exchange: 'OKX',
          instrumentType: 'SPOT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 4,
          lotSize: '0.0001',
        },
      } as any,
      { id: 'account-1', userId: 'user-1' } as any,
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
      'SELL',
      'LONG',
    )

    expect(result).toMatchObject({
      type: 'ready',
      orderParams: expect.objectContaining({
        marketType: 'perp',
        symbol: 'BTC/USDT:PERP',
        reduceOnly: true,
        amount: 0.25,
      }),
    })
    expect(executorRepository.findOpenPositionForClose).toHaveBeenCalledWith({
      accountId: 'account-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
    })
    expect(accountsService.applyLedgerDelta).not.toHaveBeenCalled()
  })

  it('blocks entry execution when portfolio constraints disallow adding to an open position', async () => {
    const service = createService()
    const executorRepository = (service as any).executorRepository
    const executionRepository = (service as any).executionRepository
    const accountsService = (service as any).accountsService

    executionRepository.findBySignalAndAccount = jest.fn().mockResolvedValue(null)
    executorRepository.lockAccount = jest.fn().mockResolvedValue([
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(1000),
        equity: new Prisma.Decimal(1000),
        initialBalance: new Prisma.Decimal(1000),
      },
    ])
    executorRepository.findOpenPositionsForAdmission = jest.fn().mockResolvedValue([
      { positionSide: 'LONG', quantity: new Prisma.Decimal('0.0359') },
    ])
    executorRepository.hasPendingReconcileRequiredEntryExecution = jest.fn().mockResolvedValue(false)
    executionRepository.create = jest.fn().mockResolvedValue({ id: 'exec-entry-blocked-1' })

    const result = await (service as any).prepareExecution(
      {
        id: 'sig-entry-1',
        direction: 'BUY',
        signalType: 'ENTRY',
        entryPrice: '100',
        metadata: {
          runtimeProvenance: {
            marketType: 'perp',
            portfolio: {
              positionMode: 'long_only',
              maxConcurrentPositions: 1,
              allowPyramiding: false,
            },
          },
        },
        symbol: {
          code: 'BTCUSDT:PERP',
          exchange: 'OKX',
          instrumentType: 'PERPETUAL',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 4,
          lotSize: '0.0001',
        },
      } as any,
      { id: 'account-1', userId: 'user-1' } as any,
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
      'BUY',
      'LONG',
    )

    expect(result).toEqual({
      type: 'skip',
      reason: 'ENTRY_BLOCKED_BY_MAX_CONCURRENT_POSITIONS',
      executionId: 'exec-entry-blocked-1',
    })
    expect(executorRepository.findOpenPositionsForAdmission).toHaveBeenCalledWith({
      accountId: 'account-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
    })
    expect(accountsService.applyLedgerDelta).not.toHaveBeenCalled()
  })

  it('does not markExecuted when a market order stays open with 0 fill after reconciliation', async () => {
    const prisma = {}
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
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
      createSchedulerRegistry() as any,
      tradingService as any,
      tradingExecution as any,
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

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-1',
        normalizedAmount: '0.001',
        exchangeSize: '0.001',
        request: { symbol: 'BTC/USDT', clientOrderId: 'sig-exec-1' },
        constraints: {},
      },
      order: openOrder,
    })

    const result = await (service as any).processAccount(
      { id: 'sig-1', direction: 'BUY', symbol: { instrumentType: 'SPOT', quoteAsset: 'USDT' } } as any,
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
    const tradingExecution = { executeIntent: jest.fn() }
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
      createSchedulerRegistry() as any,
      tradingService as any,
      tradingExecution as any,
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

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-1b',
        normalizedAmount: '0.001',
        exchangeSize: '0.001',
        request: { symbol: 'BTC/USDT', clientOrderId: 'sig-exec-1b' },
        constraints: {},
      },
      order: partialOpenOrder,
    })

    const result = await (service as any).processAccount(
      { id: 'sig-1b', direction: 'BUY', symbol: { instrumentType: 'SPOT', quoteAsset: 'USDT' } } as any,
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
    const tradingExecution = { executeIntent: jest.fn() }
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
      createSchedulerRegistry() as any,
      tradingService as any,
      tradingExecution as any,
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

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-2',
        normalizedAmount: '0.001',
        exchangeSize: '0.001',
        request: { symbol: 'BTC/USDT', clientOrderId: 'sig-exec-2' },
        constraints: {},
      },
      order: canceledOrder,
    })

    const result = await (service as any).processAccount(
      { id: 'sig-2', direction: 'BUY', symbol: { instrumentType: 'SPOT', quoteAsset: 'USDT' } } as any,
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
    const tradingExecution = { executeIntent: jest.fn() }
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
      createSchedulerRegistry() as any,
      tradingService as any,
      tradingExecution as any,
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

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-3',
        normalizedAmount: '0.001',
        exchangeSize: '0.001',
        request: { symbol: 'BTC/USDT', clientOrderId: 'sig-exec-3' },
        constraints: {},
      },
      order: submittedOrder,
    })

    const result = await (service as any).processAccount(
      { id: 'sig-3', direction: 'BUY', symbol: { instrumentType: 'SPOT', quoteAsset: 'USDT' } } as any,
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
    const executorRepository = {
      findActiveLlmSubscription: jest.fn().mockResolvedValue({
        exchangeAccountId: 'exchange-account-1',
        exchangeAccount: { exchangeId: 'binance' },
      }),
    }
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
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

    const schedulerRegistry = createSchedulerRegistry()
    const service = new SignalExecutorService(
      executorRepository as any,
      configService as any,
      schedulerRegistry as any,
      tradingService as any,
      tradingExecution as any,
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

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-llm-1',
        normalizedAmount: '0.001',
        exchangeSize: '0.001',
        request: { symbol: 'BTC/USDT', clientOrderId: 'sig-exec-llm-1' },
        constraints: {},
      },
      order: filledOrder,
    })

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
    expect(executorRepository.findActiveLlmSubscription).toHaveBeenCalledWith('user-llm-1', 'llm-instance-1')
    expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'signal',
      sourceId: 'exec-llm-1',
      userId: 'user-llm-1',
      exchangeAccountId: 'exchange-account-1',
      exchangeId: 'binance',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      side: 'buy',
      role: 'spot_buy',
    }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
  })

  it('does not enforce live/testnet mismatch gate for PAPER mode strategy instances', async () => {
    const executorRepository = {
      findStrategyInstanceMode: jest.fn().mockResolvedValue({ mode: 'PAPER' }),
      findActiveSubscriptionNetwork: jest.fn().mockResolvedValue({
        exchangeAccount: { isTestnet: true },
      }),
    }
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
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

    const schedulerRegistry = createSchedulerRegistry()
    const service = new SignalExecutorService(
      executorRepository as any,
      configService as any,
      schedulerRegistry as any,
      tradingService as any,
      tradingExecution as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'duplicate',
    })
    ;(service as any).mapTradeSide = jest.fn().mockReturnValue('buy')
    ;(service as any).mapPositionSide = jest.fn().mockReturnValue('LONG')

    const result = await (service as any).processAccount(
      {
        id: 'sig-paper-1',
        strategyInstanceId: 'inst-paper-1',
        direction: 'BUY',
        symbol: { quoteAsset: 'USDT' },
      } as any,
      { id: 'acct-paper-1', userId: 'user-paper-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('skipped')
    expect(executorRepository.findStrategyInstanceMode).toHaveBeenCalledWith('inst-paper-1')
    expect(executorRepository.findActiveSubscriptionNetwork).toHaveBeenCalledWith('user-paper-1', 'inst-paper-1')
  })

  it('uses subscribed exchangeAccountId for strategy instance execution', async () => {
    const executorRepository = {
      findStrategyInstanceMode: jest.fn().mockResolvedValue({ mode: 'TESTNET' }),
      findActiveSubscriptionNetwork: jest.fn().mockResolvedValue({
        exchangeAccountId: 'exchange-account-spot-1',
        exchangeAccount: { isTestnet: true },
      }),
    }
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
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

    const schedulerRegistry = createSchedulerRegistry()
    const service = new SignalExecutorService(
      executorRepository as any,
      configService as any,
      schedulerRegistry as any,
      tradingService as any,
      tradingExecution as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    const filledOrder = {
      id: 'ord-spot-1',
      symbol: 'ORDI/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'closed',
      amount: 10,
      filled: 10,
      average: 4.5,
      createdAt: Date.now(),
      raw: {},
    }

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-spot-1' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'ORDI/USDT',
        side: 'buy',
        amount: 10,
        price: 4.5,
        reduceOnly: false,
      },
      reservedQuote: new Prisma.Decimal(45),
      reserveReference: 'reserve-spot-1',
    })
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(filledOrder)
    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).reconcilePositionAndRecordTrade = jest.fn().mockResolvedValue(undefined)
    ;(service as any).buildExecutionResultSnapshot = jest.fn().mockReturnValue({})
    ;(service as any).buildOrderResponseSnapshot = jest.fn().mockReturnValue({})
    ;(service as any).mapTradeSide = jest.fn().mockReturnValue('buy')
    ;(service as any).mapPositionSide = jest.fn().mockReturnValue('LONG')

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-spot-1',
        normalizedAmount: '10',
        exchangeSize: '10',
        request: { symbol: 'ORDI/USDT', clientOrderId: 'sig-exec-spot-1' },
        constraints: {},
      },
      order: filledOrder,
    })

    const result = await (service as any).processAccount(
      {
        id: 'sig-spot-1',
        strategyInstanceId: 'inst-spot-1',
        direction: 'BUY',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'SPOT',
          baseAsset: 'ORDI',
          quoteAsset: 'USDT',
        },
      } as any,
      { id: 'acct-spot-1', userId: 'user-spot-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('executed')
    expect(executorRepository.findActiveSubscriptionNetwork).toHaveBeenCalledWith('user-spot-1', 'inst-spot-1')
    expect(tradingExecution.executeIntent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'signal',
      sourceId: 'exec-spot-1',
      userId: 'user-spot-1',
      exchangeAccountId: 'exchange-account-spot-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'ORDI/USDT',
      side: 'buy',
      role: 'spot_buy',
    }))
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect(executionRepository.markStage).toHaveBeenCalledWith(
      'exec-spot-1',
      'ORDER_SUBMITTED',
      expect.objectContaining({
        exchangeAccountId: 'exchange-account-spot-1',
        tradingExecution: expect.objectContaining({
          status: 'submitted',
          clientOrderId: 'sig-exec-spot-1',
        }),
      }),
    )
  })

  it('skips strategy instance execution when the active subscription lacks an exchange account binding', async () => {
    const executorRepository = {
      findStrategyInstanceMode: jest.fn().mockResolvedValue({ mode: 'TESTNET' }),
      findActiveSubscriptionNetwork: jest.fn().mockResolvedValue({
        exchangeAccountId: null,
        exchangeAccount: { isTestnet: true },
      }),
    }
    const configService = { get: jest.fn() }
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
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

    const schedulerRegistry = createSchedulerRegistry()
    const service = new SignalExecutorService(
      executorRepository as any,
      configService as any,
      schedulerRegistry as any,
      tradingService as any,
      tradingExecution as any,
      accountsService as any,
      {} as any,
      positionsService as any,
      tradingSignalRepository as any,
      executionRepository as any,
      telemetry as any,
      {} as any,
    )

    ;(service as any).prepareExecution = jest.fn().mockResolvedValue({
      type: 'ready',
      execution: { id: 'exec-missing-acct-1' },
      orderParams: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'ORDI/USDT',
        side: 'buy',
        amount: 10,
        price: 4.5,
        reduceOnly: false,
      },
      reservedQuote: new Prisma.Decimal(45),
      reserveReference: 'reserve-missing-acct-1',
    })
    ;(service as any).releaseReservation = jest.fn()
    ;(service as any).mapTradeSide = jest.fn().mockReturnValue('buy')
    ;(service as any).mapPositionSide = jest.fn().mockReturnValue('LONG')

    const result = await (service as any).processAccount(
      {
        id: 'sig-missing-acct-1',
        strategyInstanceId: 'inst-missing-acct-1',
        direction: 'BUY',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'SPOT',
          baseAsset: 'ORDI',
          quoteAsset: 'USDT',
        },
      } as any,
      { id: 'acct-missing-acct-1', userId: 'user-missing-acct-1' } as any,
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(result).toBe('skipped')
    expect(executionRepository.markSkipped).toHaveBeenCalledWith(
      'exec-missing-acct-1',
      'SUBSCRIPTION_EXCHANGE_ACCOUNT_MISSING',
    )
    expect(tradingService.placeOrder).not.toHaveBeenCalled()
    expect((service as any).releaseReservation).toHaveBeenCalledWith(
      'acct-missing-acct-1',
      expect.any(Prisma.Decimal),
      'reserve-missing-acct-1',
    )
  })

  it('stores runtime provenance on execution records during preparation', async () => {
    const executionRepository = {
      findBySignalAndAccount: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'exec-1' }),
    }
    const accountsService = { applyLedgerDelta: jest.fn().mockResolvedValue(undefined) }
    const service = new SignalExecutorService(
      {} as any,
      { get: jest.fn() } as any,
      createSchedulerRegistry() as any,
      {} as any,
      { executeIntent: jest.fn() } as any,
      accountsService as any,
      {} as any,
      {} as any,
      {} as any,
      executionRepository as any,
      {} as any,
      { withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()) } as any,
    )

    jest.spyOn(service as any, 'lockAccount').mockResolvedValue({
      id: 'acct-1',
      userId: 'user-1',
      baseCurrency: 'USDT',
      balance: new Prisma.Decimal(1000),
    })
    jest.spyOn(service as any, 'buildOrderParamsWithLockedAccount').mockReturnValue({
      ok: true,
      params: {
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 0.01,
        price: 100,
        reduceOnly: false,
      },
      quoteBudget: new Prisma.Decimal(10),
    })

    await (service as any).prepareExecution(
      {
        id: 'sig-1',
        direction: 'BUY',
        signalType: 'ENTRY',
        metadata: {
          runtimeProvenance: {
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash-1',
          },
        },
      },
      { id: 'acct-1', userId: 'user-1' },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
      'BUY',
      'LONG',
    )

    expect(executionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        runtimeProvenance: expect.objectContaining({
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        }),
      }),
    }))
  })

  it('propagates runtime provenance into recorded trade metadata', async () => {
    const tradingService = { placeOrder: jest.fn() }
    const tradingExecution = { executeIntent: jest.fn() }
    const positionsService = { recordTrade: jest.fn().mockResolvedValue(undefined) }
    const executionRepository = {
      markStage: jest.fn(),
      markExecuted: jest.fn(),
      markFailed: jest.fn(),
      markSkipped: jest.fn(),
    }
    const service = new SignalExecutorService(
      {} as any,
      { get: jest.fn() } as any,
      createSchedulerRegistry() as any,
      tradingService as any,
      tradingExecution as any,
      { applyLedgerDelta: jest.fn() } as any,
      {} as any,
      positionsService as any,
      {} as any,
      executionRepository as any,
      {} as any,
      {} as any,
    )

    const filledOrder = {
      id: 'ord-1',
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      status: 'closed',
      amount: 0.01,
      filled: 0.01,
      price: 100,
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
        amount: 0.01,
        price: 100,
        reduceOnly: false,
      },
      reservedQuote: new Prisma.Decimal(10),
      reserveReference: 'reserve-1',
    })
    ;(service as any).resolveFinalOrderState = jest.fn().mockResolvedValue(filledOrder)
    ;(service as any).releaseReservation = jest.fn().mockResolvedValue(undefined)

    tradingExecution.executeIntent.mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'sig-exec-runtime-provenance-1',
        normalizedAmount: '0.01',
        exchangeSize: '0.01',
        request: { symbol: 'BTC/USDT', clientOrderId: 'sig-exec-runtime-provenance-1' },
        constraints: {},
      },
      order: filledOrder,
    })

    await (service as any).processAccount(
      {
        id: 'sig-1',
        direction: 'BUY',
        signalType: 'ENTRY',
        symbol: {
          instrumentType: 'SPOT',
          quoteAsset: 'USDT',
        },
        metadata: {
          runtimeProvenance: {
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'snapshot-hash-1',
          },
        },
      },
      { id: 'acct-1', userId: 'user-1' },
      { ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, dryRun: false } } as any,
    )

    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        signalId: 'sig-1',
        executionId: 'exec-1',
        runtimeProvenance: expect.objectContaining({
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        }),
      }),
    }))
  })

  it('falls back to fill commissions when raw order fee is empty', () => {
    const service = new SignalExecutorService(
      {} as any,
      { get: jest.fn() } as any,
      createSchedulerRegistry() as any,
      {} as any,
      { executeIntent: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const fee = (service as any).extractOrderFee({
      raw: {
        fee: null,
        fills: [
          { commission: '0.001', commissionAsset: 'BNB' },
          { commission: '0.002', commissionAsset: 'BNB' },
        ],
      },
    })

    expect(fee).toEqual({ amount: 0.003, currency: 'BNB' })
  })
})
