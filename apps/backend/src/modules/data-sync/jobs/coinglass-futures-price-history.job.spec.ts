import { CoinglassFuturesPriceHistoryJob } from './coinglass-futures-price-history.job'

describe('coinglassFuturesPriceHistoryJob', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-02-04T14:06:03.822Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(globalThis as { fetch?: typeof fetch }).fetch = undefined
  })

  it('includes interval from meta and sets start_time on first run', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'COINGLASS_API_KEY') return 'test-api-key'
        return undefined
      },
    }

    const prisma = {
      getClient: () => ({
        futuresPriceHistory: {
          findFirst: async () => null,
          createMany: async () => ({ count: 0 }),
        },
      }),
    }

    const job = new CoinglassFuturesPriceHistoryJob(configService as any, prisma as any)

    let requestedUrl: string | null = null
    ;(globalThis as { fetch?: typeof fetch }).fetch = (async (url: string) => {
      requestedUrl = url
      return {
        ok: true,
        json: async () => ({ code: '0', msg: 'ok', data: [] }),
      } as any
    }) as unknown as typeof fetch

    await job.run({
      taskId: 'task',
      key: 'coinglass-futures-price-history:BTCUSDT:PERPETUAL:15m',
      cursor: null,
      meta: {
        symbol: 'BTCUSDT',
        exchangeCode: 'BINANCE',
        contractType: 'PERPETUAL',
        interval: '15m',
      },
      now: new Date(),
    } as any)

    expect(requestedUrl).toBeTruthy()

    const url = new URL(requestedUrl!)
    expect(url.searchParams.get('interval')).toBe('15m')

    const startTime = url.searchParams.get('start_time')
    expect(startTime).toBeTruthy()
    expect(Number.isFinite(Number(startTime))).toBe(true)
    // ms timestamp should be 13 digits for current era
    expect(startTime!.length).toBeGreaterThanOrEqual(13)
  })

  it('treats contractType=null as spot and does not send contractType param', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'COINGLASS_API_KEY') return 'test-api-key'
        return undefined
      },
    }

    const prisma = {
      getClient: () => ({
        futuresPriceHistory: {
          findFirst: async () => null,
          createMany: async () => ({ count: 0 }),
        },
      }),
    }

    const job = new CoinglassFuturesPriceHistoryJob(configService as any, prisma as any)

    let requestedUrl: string | null = null
    ;(globalThis as { fetch?: typeof fetch }).fetch = (async (url: string) => {
      requestedUrl = url
      return {
        ok: true,
        json: async () => ({ code: '0', msg: 'ok', data: [] }),
      } as any
    }) as unknown as typeof fetch

    await job.run({
      taskId: 'task',
      key: 'coinglass-futures-price-history:BTCUSDT:SPOT:15m',
      cursor: null,
      meta: {
        symbol: 'BTCUSDT',
        exchangeCode: 'BINANCE',
        contractType: null,
        interval: '15m',
      },
      now: new Date(),
    } as any)

    const url = new URL(requestedUrl!)
    expect(url.pathname).toBe('/api/spot/price/history')
    expect(url.searchParams.get('contractType')).toBeNull()
  })

  it('ignores invalid meta.interval and falls back to default interval', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'COINGLASS_API_KEY') return 'test-api-key'
        return undefined
      },
    }

    const prisma = {
      getClient: () => ({
        futuresPriceHistory: {
          findFirst: async () => null,
          createMany: async () => ({ count: 0 }),
        },
      }),
    }

    const job = new CoinglassFuturesPriceHistoryJob(configService as any, prisma as any)

    let requestedUrl: string | null = null
    ;(globalThis as { fetch?: typeof fetch }).fetch = (async (url: string) => {
      requestedUrl = url
      return {
        ok: true,
        json: async () => ({ code: '0', msg: 'ok', data: [] }),
      } as any
    }) as unknown as typeof fetch

    await job.run({
      taskId: 'task',
      key: 'coinglass-futures-price-history:BTCUSDT:PERPETUAL:BAD',
      cursor: null,
      meta: {
        symbol: 'BTCUSDT',
        exchangeCode: 'BINANCE',
        contractType: 'PERPETUAL',
        interval: 'bad-interval',
      },
      now: new Date(),
    } as any)

    const url = new URL(requestedUrl!)
    expect(url.searchParams.get('interval')).toBe('4h')
  })
})
