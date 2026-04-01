import { PositionSide, PositionStatus } from '@ai/shared'
import { Prisma } from '@/prisma/prisma.types'
import { MARKET_QUOTE_EVENT } from '@/modules/market-data/services/market-data-stream.service'
import { PositionsValuationService } from './positions-valuation.service'

describe('PositionsValuationService', () => {
  it('updates raw-symbol open positions when quote uses canonical market suffix', async () => {
    const tx = {
      position: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'pos-1',
          userStrategyAccountId: 'acc-1',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.LONG,
          avgEntryPrice: new Prisma.Decimal('68000'),
          quantity: new Prisma.Decimal('0.1'),
          status: PositionStatus.OPEN,
        }]),
        update: jest.fn().mockResolvedValue(undefined),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { unrealizedPnl: new Prisma.Decimal('50') },
        }),
      },
      userStrategyAccount: {
        findUnique: jest.fn().mockResolvedValue({ balance: new Prisma.Decimal('900') }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    }

    const txHost = {
      tx,
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }

    const service = new PositionsValuationService(txHost as any)

    const result = await service.applyQuotes({
      quotes: [{ symbol: 'BTCUSDT:SPOT', price: '68500' }],
    })

    expect(result).toEqual({ updatedPositions: 1, updatedAccounts: 1 })
    expect(tx.position.findMany).toHaveBeenCalledWith({
      where: {
        status: PositionStatus.OPEN,
        symbol: { in: ['BTCUSDT:SPOT', 'BTCUSDT'] },
      },
    })
    expect(tx.position.update).toHaveBeenCalledWith({
      where: { id: 'pos-1' },
      data: { unrealizedPnl: new Prisma.Decimal('50') },
    })
    expect(tx.userStrategyAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: {
        totalUnrealizedPnl: new Prisma.Decimal('50'),
        equity: new Prisma.Decimal('950'),
      },
    })
  })

  it('reacts to market quote events by delegating to quote valuation', async () => {
    const txHost = {
      tx: {},
      withTransaction: jest.fn(),
    }
    const service = new PositionsValuationService(txHost as any)
    const applyQuotesSpy = jest.spyOn(service, 'applyQuotes').mockResolvedValue({
      updatedPositions: 1,
      updatedAccounts: 1,
    })

    await service.handleMarketQuote({
      symbol: 'BTCUSDT:SPOT',
      data: {
        symbol: 'BTCUSDT:SPOT',
        lastPrice: '68600',
        eventTime: Date.now(),
        source: 'OKX_WS',
      },
    } as any)

    expect(applyQuotesSpy).toHaveBeenCalledWith({
      quotes: [{
        symbol: 'BTCUSDT:SPOT',
        price: '68600',
        source: 'OKX_WS',
        eventTime: expect.any(String),
      }],
    })
    applyQuotesSpy.mockRestore()
  })

  it('ignores empty lastPrice in market quote events', async () => {
    const txHost = {
      tx: {},
      withTransaction: jest.fn(),
    }
    const service = new PositionsValuationService(txHost as any)
    const applyQuotesSpy = jest.spyOn(service, 'applyQuotes').mockResolvedValue({
      updatedPositions: 0,
      updatedAccounts: 0,
    })

    await service.handleMarketQuote({
      symbol: MARKET_QUOTE_EVENT,
      data: {
        symbol: 'BTCUSDT:SPOT',
        lastPrice: '',
        eventTime: Date.now(),
        source: 'OKX_WS',
      },
    } as any)

    expect(applyQuotesSpy).not.toHaveBeenCalled()
    applyQuotesSpy.mockRestore()
  })
})
