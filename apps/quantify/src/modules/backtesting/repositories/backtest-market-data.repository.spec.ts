import { BacktestMarketDataRepository } from './backtest-market-data.repository'

describe('BacktestMarketDataRepository', () => {
  it('loads historical quotes from exact symbol first', async () => {
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'symbol-raw', code: 'BTCUSDT' }]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'quote-1' }]),
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
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ id: 'quote-1' }])
  })

  it('falls back to perp symbol quotes for raw perpetual backtest symbols', async () => {
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'symbol-perp', code: 'BTCUSDT:PERP' }]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'quote-perp' }]),
    }
    const repository = new BacktestMarketDataRepository({ tx } as never)

    const result = await repository.findHistoricalQuotes({
      symbol: 'BTCUSDT',
      fromTs: 1_000,
      toTs: 2_000,
      limit: 100,
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ id: 'quote-perp' }])
  })

  it('continues to perp symbol when raw symbol has no depth quotes', async () => {
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'symbol-raw', code: 'BTCUSDT' },
          { id: 'symbol-perp', code: 'BTCUSDT:PERP' },
        ]),
      },
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'quote-perp' }]),
    }
    const repository = new BacktestMarketDataRepository({ tx } as never)

    const result = await repository.findHistoricalQuotes({
      symbol: 'BTCUSDT',
      fromTs: 1_000,
      toTs: 2_000,
      limit: 100,
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(result).toEqual([{ id: 'quote-perp' }])
  })

  it('loads sampled usable-depth quotes chronologically', async () => {
    const older = { id: 'quote-old', eventTime: new Date(1_500) }
    const newest = { id: 'quote-new', eventTime: new Date(2_000) }
    const tx = {
      symbol: {
        findMany: jest.fn().mockResolvedValue([{ id: 'symbol-perp', code: 'BTCUSDT:PERP' }]),
      },
      $queryRaw: jest.fn().mockResolvedValue([older, newest]),
    }
    const repository = new BacktestMarketDataRepository({ tx } as never)

    const result = await repository.findHistoricalQuotes({
      symbol: 'BTCUSDT',
      fromTs: 1_000,
      toTs: 2_000,
      limit: 100,
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(result).toEqual([older, newest])
  })
})
