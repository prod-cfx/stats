import { ErrorCode, LedgerEntryType, PositionSide, TradeSide } from '@ai/shared'
import { Prisma } from '@/prisma/prisma.types'
import { PositionsService } from './positions.service'

describe('positionsService', () => {
  function createService(
    txHost: any = {},
    accountsService: any = {},
    tradingExecution: any = {},
    positionsRepository: any = {},
  ) {
    return new PositionsService(
      positionsRepository as any,
      accountsService as any,
      tradingExecution as any,
      txHost,
    )
  }

  it('maps locked position rows to Prisma field names', async () => {
    const lockOpenPosition = jest.fn(async () => [
      {
        id: 'position-1',
        userStrategyAccountId: 'account-1',
        symbol: 'BTCUSDT',
        positionSide: 'LONG',
        leverage: null,
        quantity: { toString: () => '0.00134' },
        avgEntryPrice: { toString: () => '74180.5' },
        realizedPnl: { toString: () => '0' },
        unrealizedPnl: { toString: () => '0' },
        status: 'OPEN',
        openedAt: new Date('2026-03-18T10:23:24.000Z'),
        closedAt: null,
        exchangeId: 'okx',
        marketType: 'spot',
        metadata: null,
        createdAt: new Date('2026-03-18T10:23:24.000Z'),
        updatedAt: new Date('2026-03-18T10:23:24.000Z'),
      },
    ])
    const service = createService({}, {}, {}, { lockOpenPosition })

    const position = await (service as any).loadAndLockPosition(
      'account-1',
      'BTCUSDT',
      PositionSide.LONG,
    )

    expect(position?.avgEntryPrice?.toString()).toBe('74180.5')
    expect(position?.realizedPnl?.toString()).toBe('0')
    expect(position?.marketType).toBe('spot')
  })

  it('credits spot close principal back to the account when recording a sell trade', async () => {
    const accountApplyLedgerDelta = jest.fn().mockResolvedValue(undefined)
    const txHost = {
      withTransaction: jest.fn(async (callback: () => Promise<any>) => callback()),
    }
    const positionsRepository = {
      findAccountById: jest.fn().mockResolvedValue({ id: 'account-1' }),
      findTradeByExternalTradeId: jest.fn().mockResolvedValue(null),
      createTrade: jest.fn().mockResolvedValue({
        id: 'trade-1',
        userStrategyAccountId: 'account-1',
        positionId: 'position-1',
        symbol: 'BTCUSDT',
        market: 'okx:spot',
        side: TradeSide.SELL,
        positionSide: PositionSide.LONG,
        price: new Prisma.Decimal(120),
        quantity: new Prisma.Decimal(1),
        fee: new Prisma.Decimal(0),
        feeCurrency: null,
        orderId: null,
        externalTradeId: null,
        provider: 'okx',
        executedAt: new Date('2026-04-01T01:00:00.000Z'),
        metadata: null,
        createdAt: new Date('2026-04-01T01:00:00.000Z'),
        updatedAt: new Date('2026-04-01T01:00:00.000Z'),
      }),
      lockOpenPosition: jest.fn().mockResolvedValue([
        {
          id: 'position-1',
          userStrategyAccountId: 'account-1',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.LONG,
          leverage: null,
          quantity: new Prisma.Decimal(1),
          avgEntryPrice: new Prisma.Decimal(100),
          realizedPnl: new Prisma.Decimal(0),
          unrealizedPnl: new Prisma.Decimal(0),
          status: 'OPEN',
          openedAt: new Date('2026-04-01T00:00:00.000Z'),
          closedAt: null,
          exchangeId: 'okx',
          marketType: 'spot',
          metadata: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ]),
      updatePosition: jest.fn().mockResolvedValue({
        id: 'position-1',
        userStrategyAccountId: 'account-1',
        symbol: 'BTCUSDT',
        positionSide: PositionSide.LONG,
        leverage: null,
        quantity: new Prisma.Decimal(0),
        avgEntryPrice: new Prisma.Decimal(100),
        realizedPnl: new Prisma.Decimal(20),
        unrealizedPnl: new Prisma.Decimal(0),
        status: 'CLOSED',
        openedAt: new Date('2026-04-01T00:00:00.000Z'),
        closedAt: new Date('2026-04-01T01:00:00.000Z'),
        exchangeId: 'okx',
        marketType: 'spot',
        metadata: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T01:00:00.000Z'),
      }),
      aggregateOpenPositionUnrealizedPnl: jest.fn().mockResolvedValue(new Prisma.Decimal(0)),
      refreshAccountEquityFromBalance: jest.fn().mockResolvedValue(undefined),
    }
    const service = createService(txHost, {
      applyLedgerDelta: accountApplyLedgerDelta,
    }, {}, positionsRepository)

    await service.recordTrade({
      userStrategyAccountId: 'account-1',
      symbol: 'BTCUSDT',
      market: 'okx:spot',
      side: TradeSide.SELL,
      positionSide: PositionSide.LONG,
      price: '120',
      quantity: '1',
      fee: '0',
      provider: 'okx',
      executedAt: '2026-04-01T01:00:00.000Z',
    } as any)

    expect(accountApplyLedgerDelta).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'account-1',
      delta: expect.any(Prisma.Decimal),
      ledgerType: LedgerEntryType.ADJUSTMENT,
      referenceId: 'trade-1:settlement',
      description: 'Spot close settlement BTCUSDT',
    }))
    expect(accountApplyLedgerDelta).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'account-1',
      delta: expect.any(Prisma.Decimal),
      ledgerType: LedgerEntryType.REALIZED_PNL,
      referenceId: 'trade-1',
      description: 'Realized PnL BTCUSDT',
    }))

    const settlementCall = accountApplyLedgerDelta.mock.calls.find(
      ([arg]) => arg.ledgerType === LedgerEntryType.ADJUSTMENT,
    )?.[0]
    const realizedCall = accountApplyLedgerDelta.mock.calls.find(
      ([arg]) => arg.ledgerType === LedgerEntryType.REALIZED_PNL,
    )?.[0]

    expect(settlementCall?.delta.toString()).toBe('100')
    expect(realizedCall?.delta.toString()).toBe('20')
  })

  it('locks positions by market when recording trades for the same account and symbol', async () => {
    const txHost = {
      withTransaction: jest.fn(async (callback: () => Promise<any>) => callback()),
    }
    const spotPosition = {
      id: 'position-spot',
      userStrategyAccountId: 'account-1',
      symbol: 'BTCUSDT',
      positionSide: PositionSide.LONG,
      leverage: null,
      quantity: new Prisma.Decimal(1),
      avgEntryPrice: new Prisma.Decimal(100),
      realizedPnl: new Prisma.Decimal(0),
      unrealizedPnl: new Prisma.Decimal(0),
      status: 'OPEN',
      openedAt: new Date('2026-04-01T00:00:00.000Z'),
      closedAt: null,
      exchangeId: 'okx',
      marketType: 'spot',
      metadata: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    }
    const perpPosition = {
      ...spotPosition,
      id: 'position-perp',
      marketType: 'perp',
      metadata: { market: 'okx:perp' },
    }
    const positionsRepository = {
      findAccountById: jest.fn().mockResolvedValue({ id: 'account-1' }),
      findTradeByExternalTradeId: jest.fn().mockResolvedValue(null),
      lockOpenPosition: jest.fn(async (_accountId, _symbol, _side, market) => [
        market?.marketType === 'perp' ? perpPosition : spotPosition,
      ]),
      updatePosition: jest.fn().mockResolvedValue({
        ...perpPosition,
        quantity: new Prisma.Decimal(0),
        status: 'CLOSED',
        closedAt: new Date('2026-04-01T01:00:00.000Z'),
      }),
      createTrade: jest.fn().mockResolvedValue({
        id: 'trade-1',
        userStrategyAccountId: 'account-1',
        positionId: 'position-perp',
        symbol: 'BTCUSDT',
        market: 'okx:perp',
        side: TradeSide.SELL,
        positionSide: PositionSide.LONG,
        price: new Prisma.Decimal(100),
        quantity: new Prisma.Decimal(1),
        fee: new Prisma.Decimal(0),
        feeCurrency: null,
        orderId: null,
        externalTradeId: null,
        provider: 'okx',
        executedAt: new Date('2026-04-01T01:00:00.000Z'),
        metadata: null,
        createdAt: new Date('2026-04-01T01:00:00.000Z'),
        updatedAt: new Date('2026-04-01T01:00:00.000Z'),
      }),
      aggregateOpenPositionUnrealizedPnl: jest.fn().mockResolvedValue(new Prisma.Decimal(0)),
      refreshAccountEquityFromBalance: jest.fn().mockResolvedValue(undefined),
    }
    const service = createService(txHost, { applyLedgerDelta: jest.fn() }, {}, positionsRepository)

    await service.recordTrade({
      userStrategyAccountId: 'account-1',
      symbol: 'BTCUSDT',
      market: 'okx:perp',
      side: TradeSide.SELL,
      positionSide: PositionSide.LONG,
      price: '100',
      quantity: '1',
      fee: '0',
      provider: 'okx',
      executedAt: '2026-04-01T01:00:00.000Z',
    } as any)

    expect(positionsRepository.lockOpenPosition).toHaveBeenCalledWith(
      'account-1',
      'BTCUSDT',
      PositionSide.LONG,
      { exchangeId: 'okx', marketType: 'perp', market: 'okx:perp' },
    )
    expect(positionsRepository.createTrade).toHaveBeenCalledWith(expect.objectContaining({
      positionId: 'position-perp',
      market: 'okx:perp',
    }))
    expect(positionsRepository.updatePosition).toHaveBeenCalledWith(
      'position-perp',
      expect.objectContaining({ status: 'CLOSED' }),
    )
  })

  it('uses trading execution kernel when placing a manual close order', async () => {
    const placeOrder = jest.fn()
    const executeIntent = jest.fn().mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'pt-close-1',
        normalizedAmount: '1',
        exchangeSize: '1',
        request: {
          clientOrderId: 'pt-close-1',
        },
      },
      order: {
        id: 'order-1',
        status: 'closed',
        amount: 1,
        filled: 1,
        price: 120,
        createdAt: Date.parse('2026-04-01T01:00:00.000Z'),
        marketType: 'spot',
        side: 'sell',
        type: 'market',
        symbol: 'BTC/USDT',
        raw: {},
      },
    })
    const recordTrade = jest.spyOn(PositionsService.prototype, 'recordTrade').mockResolvedValue({} as any)

    const service = createService(
      {},
      {},
      { executeIntent },
      {
        findUniqueWithAccount: jest.fn().mockResolvedValue({
          id: 'position-1',
          userStrategyAccountId: 'account-1',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.LONG,
          quantity: new Prisma.Decimal(1),
          avgEntryPrice: new Prisma.Decimal(100),
          status: 'OPEN',
          exchangeId: 'okx',
          marketType: 'spot',
          account: {
            id: 'account-1',
            userId: 'user-1',
          },
        }),
      },
    )

    await service.closePosition({
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'position-1',
      quantity: '1',
      exchangeId: 'okx',
      marketType: 'spot',
    } as any)

    expect(executeIntent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'position_tool',
      sourceId: expect.stringMatching(/^position-1:1:\d+:[0-9a-f-]+$/u),
      userId: 'user-1',
      exchangeId: 'okx',
      marketType: 'spot',
      symbol: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      amount: 1,
      role: 'close_long',
      reduceOnly: true,
    }))
    expect(executeIntent.mock.calls[0]?.[0]).not.toHaveProperty('tdMode')
    expect(placeOrder).not.toHaveBeenCalled()
    expect(recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      metadata: expect.objectContaining({
        tradingExecution: expect.objectContaining({
          status: 'submitted',
          clientOrderId: 'pt-close-1',
          normalizedAmount: '1',
          exchangeSize: '1',
        }),
      }),
    }))

    recordTrade.mockRestore()
  })

  it('sets cross margin close intent for perp positions', async () => {
    const executeIntent = jest.fn().mockResolvedValue({
      status: 'submitted',
      intent: {},
      normalized: {
        clientOrderId: 'pt-close-short-1',
        normalizedAmount: '1',
        exchangeSize: '10',
        request: {
          clientOrderId: 'pt-close-short-1',
        },
      },
      order: {
        id: 'order-short-1',
        status: 'closed',
        amount: 1,
        filled: 1,
        price: 120,
        createdAt: Date.parse('2026-04-01T01:00:00.000Z'),
        marketType: 'perp',
        side: 'buy',
        type: 'market',
        symbol: 'BTC/USDT:PERP',
        raw: {},
      },
    })
    const recordTrade = jest.spyOn(PositionsService.prototype, 'recordTrade').mockResolvedValue({} as any)

    const service = createService(
      {},
      {},
      { executeIntent },
      {
        findUniqueWithAccount: jest.fn().mockResolvedValue({
          id: 'position-short-1',
          userStrategyAccountId: 'account-1',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.SHORT,
          quantity: new Prisma.Decimal(1),
          avgEntryPrice: new Prisma.Decimal(100),
          status: 'OPEN',
          exchangeId: 'okx',
          marketType: 'perp',
          account: {
            id: 'account-1',
            userId: 'user-1',
          },
        }),
      },
    )

    await service.closePosition({
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'position-short-1',
      quantity: '1',
      exchangeId: 'okx',
      marketType: 'perp',
    } as any)

    expect(executeIntent).toHaveBeenCalledWith(expect.objectContaining({
      role: 'close_short',
      side: 'buy',
      reduceOnly: true,
      tdMode: 'cross',
      symbol: 'BTC/USDT:PERP',
    }))

    recordTrade.mockRestore()
  })

  it('does not record a trade when trading execution is waiting for a closeable position', async () => {
    const executeIntent = jest.fn().mockResolvedValue({
      status: 'waiting_position',
      intent: {},
      reason: 'reduce_only_position_missing',
      normalized: {
        clientOrderId: 'pt-close-waiting',
        normalizedAmount: '1',
        exchangeSize: '1',
        request: { clientOrderId: 'pt-close-waiting' },
      },
    })
    const recordTrade = jest.spyOn(PositionsService.prototype, 'recordTrade').mockResolvedValue({} as any)
    const service = createService(
      {},
      {},
      { executeIntent },
      {
        findUniqueWithAccount: jest.fn().mockResolvedValue({
          id: 'position-1',
          userStrategyAccountId: 'account-1',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.LONG,
          quantity: new Prisma.Decimal(1),
          avgEntryPrice: new Prisma.Decimal(100),
          status: 'OPEN',
          exchangeId: 'okx',
          marketType: 'spot',
          account: {
            id: 'account-1',
            userId: 'user-1',
          },
        }),
      },
    )

    await expect(service.closePosition({
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'position-1',
      quantity: '1',
      exchangeId: 'okx',
      marketType: 'spot',
    } as any)).rejects.toMatchObject({
      code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR,
      args: expect.objectContaining({
        status: 'waiting_position',
        reason: 'reduce_only_position_missing',
        clientOrderId: 'pt-close-waiting',
      }),
    })
    expect(recordTrade).not.toHaveBeenCalled()

    recordTrade.mockRestore()
  })

  it('does not record a trade when trading execution cannot confirm order submission', async () => {
    const executeIntent = jest.fn().mockResolvedValue({
      status: 'submit_failed',
      intent: {},
      reason: 'exchange_timeout',
      error: new Error('exchange_timeout'),
      normalized: {
        clientOrderId: 'pt-close-submit-failed',
        normalizedAmount: '0.9',
        exchangeSize: '9',
        request: { clientOrderId: 'pt-close-submit-failed', amount: 0.9 },
      },
    })
    const recordTrade = jest.spyOn(PositionsService.prototype, 'recordTrade').mockResolvedValue({} as any)
    const service = createService(
      {},
      {},
      { executeIntent },
      {
        findUniqueWithAccount: jest.fn().mockResolvedValue({
          id: 'position-1',
          userStrategyAccountId: 'account-1',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.LONG,
          quantity: new Prisma.Decimal(1),
          avgEntryPrice: new Prisma.Decimal(100),
          status: 'OPEN',
          exchangeId: 'okx',
          marketType: 'perp',
          account: {
            id: 'account-1',
            userId: 'user-1',
          },
        }),
      },
    )

    await expect(service.closePosition({
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'position-1',
      quantity: '1',
      exchangeId: 'okx',
      marketType: 'perp',
    } as any)).rejects.toMatchObject({
      code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR,
      args: expect.objectContaining({
        status: 'submit_failed',
        reason: 'exchange_timeout',
        clientOrderId: 'pt-close-submit-failed',
        normalizedAmount: '0.9',
        exchangeSize: '9',
      }),
    })
    await expect(service.closePosition({
      userId: 'user-1',
      userStrategyAccountId: 'account-1',
      positionId: 'position-1',
      quantity: '1',
      exchangeId: 'okx',
      marketType: 'perp',
    } as any)).rejects.toThrow(/exchange_timeout.*pt-close-submit-failed/u)
    expect(recordTrade).not.toHaveBeenCalled()

    recordTrade.mockRestore()
  })
})
