import { LedgerEntryType, PositionSide, TradeSide } from '@ai/shared'
import { Prisma } from '@/prisma/prisma.types'
import { PositionsService } from './positions.service'

describe('positionsService', () => {
  function createService(
    txHost: any = {},
    accountsService: any = {},
    tradingService: any = {},
    positionsRepository: any = {},
  ) {
    return new PositionsService(
      positionsRepository as any,
      accountsService as any,
      tradingService as any,
      txHost,
    )
  }

  it('maps locked position rows to Prisma field names', async () => {
    const $queryRaw = jest.fn(async () => [
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
    const service = createService({ tx: { $queryRaw } })

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
    const tx = {
      userStrategyAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 'account-1' }),
      },
      trade: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
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
      },
      $queryRaw: jest.fn().mockResolvedValue([
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
      position: {
        update: jest.fn().mockResolvedValue({
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
        aggregate: jest.fn().mockResolvedValue({
          _sum: { unrealizedPnl: new Prisma.Decimal(0) },
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    }
    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<any>) => callback()),
    }
    const service = createService(txHost, {
      applyLedgerDelta: accountApplyLedgerDelta,
    })

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

  it('uses unified exchange symbol when placing a manual close order', async () => {
    const placeOrder = jest.fn().mockResolvedValue({
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
    })
    const recordTrade = jest.spyOn(PositionsService.prototype, 'recordTrade').mockResolvedValue({} as any)

    const service = createService(
      {},
      {},
      { placeOrder },
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

    expect(placeOrder).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'spot',
      expect.objectContaining({
        symbol: 'BTC/USDT',
        side: 'sell',
        type: 'market',
      }),
    )

    recordTrade.mockRestore()
  })
})
