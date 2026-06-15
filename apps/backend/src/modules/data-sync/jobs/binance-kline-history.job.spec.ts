import { BinanceKlineHistoryJob } from './binance-kline-history.job'

describe('BinanceKlineHistoryJob', () => {
  afterEach(() => {
    ;(globalThis as { fetch?: typeof fetch }).fetch = undefined
  })

  it('reads and writes kline history through repository', async () => {
    const repository = {
      findEarliestFuturesPriceHistory: jest.fn().mockResolvedValue(null),
      createFuturesPriceHistoryMany: jest.fn().mockResolvedValue(1),
    }

    ;(globalThis as { fetch?: typeof fetch }).fetch = (async () => ({
      ok: true,
      json: async () => [
        [
          1718400000000,
          '100',
          '110',
          '90',
          '105',
          '12',
          1718400299999,
          '1260',
          10,
          '6',
          '630',
          '0',
        ],
      ],
    })) as unknown as typeof fetch

    const job = new BinanceKlineHistoryJob(repository as any)

    const result = await job.run({
      taskId: 'task',
      key: 'binance-kline-history:BTCUSDT:PERPETUAL:5m',
      cursor: JSON.stringify({
        symbol: 'BTCUSDT',
        marketType: 'PERPETUAL',
        interval: '5m',
      }),
      meta: {},
      now: new Date('2026-06-15T00:00:00.000Z'),
    } as any)

    expect(repository.findEarliestFuturesPriceHistory).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      exchangeCode: 'BINANCE',
      contractType: 'PERPETUAL',
      interval: 'm5',
    })
    expect(repository.createFuturesPriceHistoryMany).toHaveBeenCalledWith([
      expect.objectContaining({
        symbol: 'BTCUSDT',
        exchangeCode: 'BINANCE',
        interval: 'm5',
        timestamp: new Date(1718400000000),
      }),
    ])
    expect(result.fetchedCount).toBe(1)
  })
})
