import { PositionSide, PositionStatus } from '@ai/shared'
import { MARKET_QUOTE_EVENT } from '@/modules/market-data/services/market-data-stream.service'
import { Prisma } from '@/prisma/prisma.types'
import { PositionsValuationService } from './positions-valuation.service'

describe('positionsValuationService', () => {
  it('updates raw-symbol open positions when quote uses canonical market suffix', async () => {
    const positionsRepository = {
      findOpenPositionsBySymbols: jest.fn().mockResolvedValue([{
        id: 'pos-1',
        userStrategyAccountId: 'acc-1',
        symbol: 'BTCUSDT',
        positionSide: PositionSide.LONG,
        avgEntryPrice: new Prisma.Decimal('68000'),
        quantity: new Prisma.Decimal('0.1'),
        status: PositionStatus.OPEN,
      }]),
      updatePositionUnrealizedPnl: jest.fn().mockResolvedValue(undefined),
      aggregateOpenPositionUnrealizedPnl: jest.fn().mockResolvedValue(new Prisma.Decimal('50')),
      findAccountBalance: jest.fn().mockResolvedValue(new Prisma.Decimal('900')),
      updateAccountValuation: jest.fn().mockResolvedValue(undefined),
    }

    const txHost = {
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }

    const service = new PositionsValuationService(txHost as any, positionsRepository as any)

    const result = await service.applyQuotes({
      quotes: [{ symbol: 'BTCUSDT:SPOT', price: '68500' }],
    })

    expect(result).toEqual({ updatedPositions: 1, updatedAccounts: 1 })
    expect(positionsRepository.findOpenPositionsBySymbols).toHaveBeenCalledWith(['BTCUSDT:SPOT', 'BTCUSDT'])
    expect(positionsRepository.updatePositionUnrealizedPnl).toHaveBeenCalledWith('pos-1', new Prisma.Decimal('50'))
    expect(positionsRepository.updateAccountValuation).toHaveBeenCalledWith('acc-1', new Prisma.Decimal('50'), new Prisma.Decimal('950'))
  })

  it('reacts to market quote events by delegating to quote valuation', async () => {
    const txHost = {
      tx: {},
      withTransaction: jest.fn(),
    }
    const service = new PositionsValuationService(txHost as any, {} as any)
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

  it('updates positions and accounts in deterministic order to reduce valuation deadlocks', async () => {
    const positionsRepository = {
      findOpenPositionsBySymbols: jest.fn().mockResolvedValue([
        {
          id: 'pos-b',
          userStrategyAccountId: 'acc-b',
          symbol: 'BTCUSDT',
          positionSide: PositionSide.LONG,
          avgEntryPrice: new Prisma.Decimal('68000'),
          quantity: new Prisma.Decimal('0.1'),
          status: PositionStatus.OPEN,
        },
        {
          id: 'pos-a',
          userStrategyAccountId: 'acc-a',
          symbol: 'ETHUSDT',
          positionSide: PositionSide.LONG,
          avgEntryPrice: new Prisma.Decimal('3000'),
          quantity: new Prisma.Decimal('1'),
          status: PositionStatus.OPEN,
        },
      ]),
      updatePositionUnrealizedPnl: jest.fn().mockResolvedValue(undefined),
      aggregateOpenPositionUnrealizedPnl: jest.fn().mockResolvedValue(new Prisma.Decimal('10')),
      findAccountBalance: jest.fn().mockResolvedValue(new Prisma.Decimal('100')),
      updateAccountValuation: jest.fn().mockResolvedValue(undefined),
    }

    const txHost = {
      withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
    }

    const service = new PositionsValuationService(txHost as any, positionsRepository as any)

    await service.applyQuotes({
      quotes: [
        { symbol: 'BTCUSDT', price: '68100' },
        { symbol: 'ETHUSDT', price: '3010' },
      ],
    })

    expect(positionsRepository.updatePositionUnrealizedPnl.mock.calls.map(call => call[0])).toEqual(['pos-a', 'pos-b'])
    expect(positionsRepository.updateAccountValuation.mock.calls.map(call => call[0])).toEqual(['acc-a', 'acc-b'])
  })

  it('ignores empty lastPrice in market quote events', async () => {
    const txHost = {
      tx: {},
      withTransaction: jest.fn(),
    }
    const service = new PositionsValuationService(txHost as any, {} as any)
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
