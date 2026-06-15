import { CoinglassPairsMarketsJob } from './coinglass-pairs-markets.job'

describe('CoinglassPairsMarketsJob', () => {
  afterEach(() => {
    ;(globalThis as { fetch?: typeof fetch }).fetch = undefined
  })

  it('writes valid pairs-market points through repository', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'COINGLASS_API_KEY') return 'test-api-key'
        return undefined
      }),
    }
    const repository = {
      upsertPairsMarkets: jest.fn().mockResolvedValue({
        upsertedCount: 1,
        failedCount: 0,
        failures: [],
      }),
    }

    ;(globalThis as { fetch?: typeof fetch }).fetch = (async () => ({
      ok: true,
      json: async () => ({
        code: '0',
        msg: 'ok',
        data: [
          {
            instrument_id: 'BTCUSDT',
            exchange_name: 'Binance',
            symbol: 'BTC',
            current_price: 100,
            volume_usd: 1000,
          },
        ],
      }),
    })) as unknown as typeof fetch

    const job = new CoinglassPairsMarketsJob(configService as any, repository as any)

    const result = await job.run({
      taskId: 'task',
      key: job.key,
      cursor: JSON.stringify({ symbol: 'BTC' }),
      meta: {},
      now: new Date('2026-06-15T00:00:00.000Z'),
    } as any)

    expect(repository.upsertPairsMarkets).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          instrument_id: 'BTCUSDT',
          exchange_name: 'Binance',
          symbol: 'BTC',
        }),
      ]),
      expect.any(Date),
    )
    expect(result.fetchedCount).toBe(1)
    expect(result.meta).toEqual(expect.objectContaining({ upsertedCount: 1, failedCount: 0 }))
  })
})
