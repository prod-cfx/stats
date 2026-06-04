import { BacktestMarketDataRepository } from './backtest-market-data.repository'

describe('BacktestMarketDataRepository', () => {
  it('loads historical quotes from exact symbol first', async () => {
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'symbol-raw', code: 'BTCUSDT' }]),
      },
      marketQuote: {
        findMany: jest.fn().mockResolvedValue([{ id: 'quote-1' }]),
      },
    }
    const repository = new BacktestMarketDataRepository({ tx } as never)

    const result = await repository.findHistoricalQuotes({
      symbol: 'BTCUSDT',
      fromTs: 1_000,
      toTs: 2_000,
      limit: 100,
    })

    expect(tx.symbol.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: { in: ['BTCUSDT', 'BTCUSDT:PERP', 'BTCUSDT:SPOT'] } },
    }))
    expect(tx.marketQuote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ symbolId: 'symbol-raw' }),
    }))
    expect(result).toEqual([{ id: 'quote-1' }])
  })

  it('falls back to perp symbol quotes for raw perpetual backtest symbols', async () => {
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'symbol-perp', code: 'BTCUSDT:PERP' }]),
      },
      marketQuote: {
        findMany: jest.fn().mockResolvedValue([{ id: 'quote-perp' }]),
      },
    }
    const repository = new BacktestMarketDataRepository({ tx } as never)

    const result = await repository.findHistoricalQuotes({
      symbol: 'BTCUSDT',
      fromTs: 1_000,
      toTs: 2_000,
      limit: 100,
    })

    expect(tx.marketQuote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ symbolId: 'symbol-perp' }),
    }))
    expect(result).toEqual([{ id: 'quote-perp' }])
  })

  it('loads latest quotes with usable depth and returns them chronologically', async () => {
    const newest = { id: 'quote-new', eventTime: new Date(2_000) }
    const older = { id: 'quote-old', eventTime: new Date(1_500) }
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'symbol-perp', code: 'BTCUSDT:PERP' }]),
      },
      marketQuote: {
        findMany: jest.fn().mockResolvedValue([newest, older]),
      },
    }
    const repository = new BacktestMarketDataRepository({ tx } as never)

    const result = await repository.findHistoricalQuotes({
      symbol: 'BTCUSDT',
      fromTs: 1_000,
      toTs: 2_000,
      limit: 100,
    })

    expect(tx.marketQuote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        bidPrice: { not: null },
        bidQty: { not: null },
        askPrice: { not: null },
        askQty: { not: null },
      }),
      orderBy: { eventTime: 'desc' },
    }))
    expect(result).toEqual([older, newest])
  })
})
