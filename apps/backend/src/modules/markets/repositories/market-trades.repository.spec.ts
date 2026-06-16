import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { MarketTrade } from '@/prisma/prisma.types'
import { HttpStatus, Logger } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
import { MarketTradesRepository } from './market-trades.repository'

type MockableMarketTradesRepository = MarketTradesRepository & {
  generateMockTrades: (exchange: string, instrumentType: string, symbol: string, limit: number) => MarketTrade[]
}

function createRepository(marketTrade: {
  findMany?: jest.Mock
  count?: jest.Mock
}) {
  return new MarketTradesRepository({
    tx: {
      marketTrade: {
        findMany: marketTrade.findMany ?? jest.fn(),
        count: marketTrade.count ?? jest.fn(),
      },
    },
  } as unknown as TransactionHost<TransactionalAdapterPrisma>)
}

describe('MarketTradesRepository', () => {
  const originalUseMockData = process.env.USE_MOCK_DATA
  const originalAppEnv = process.env.APP_ENV
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.USE_MOCK_DATA = 'false'
    process.env.APP_ENV = 'production'
    process.env.NODE_ENV = 'production'
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    if (originalUseMockData === undefined) {
      delete process.env.USE_MOCK_DATA
    } else {
      process.env.USE_MOCK_DATA = originalUseMockData
    }
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV
    } else {
      process.env.APP_ENV = originalAppEnv
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
    jest.restoreAllMocks()
  })

  it('returns an empty list for empty findTrades results outside mock mode', async () => {
    const repository = createRepository({ findMany: jest.fn().mockResolvedValue([]) })
    const mockSpy = jest.spyOn(
      repository as unknown as MockableMarketTradesRepository,
      'generateMockTrades',
    )

    await expect(repository.findTrades({ symbol: 'BTCUSDT', limit: 10 })).resolves.toEqual([])
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('returns an empty page for empty latest trades outside mock mode', async () => {
    const repository = createRepository({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    })
    const mockSpy = jest.spyOn(
      repository as unknown as MockableMarketTradesRepository,
      'generateMockTrades',
    )

    await expect(repository.findLatestTrades('Binance', 'FUTURES', 'BTCUSDT')).resolves.toEqual({
      items: [],
      total: 0,
    })
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('throws a domain exception when findTrades database access fails outside mock mode', async () => {
    const repository = createRepository({ findMany: jest.fn().mockRejectedValue(new Error('db down')) })

    await expect(repository.findTrades({ symbol: 'BTCUSDT' })).rejects.toMatchObject({
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })

  it('throws a domain exception when findLatestTrades database access fails outside mock mode', async () => {
    const repository = createRepository({
      findMany: jest.fn().mockRejectedValue(new Error('db down')),
      count: jest.fn(),
    })

    await expect(repository.findLatestTrades('Binance', 'FUTURES', 'BTCUSDT')).rejects.toMatchObject({
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { detail: 'DatabaseError' },
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    } satisfies Partial<DomainException> & { status: HttpStatus })
  })

  it('keeps returning mock trades when mock mode is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    process.env.APP_ENV = 'development'
    const repository = createRepository({ findMany: jest.fn() })

    const trades = await repository.findTrades({ symbol: 'BTCUSDT', limit: 3 })

    expect(trades).toHaveLength(3)
  })

  it('keeps returning latest mock trades when mock mode is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    process.env.APP_ENV = 'development'
    const findMany = jest.fn()
    const count = jest.fn()
    const repository = createRepository({ findMany, count })

    const result = await repository.findLatestTrades('Binance', 'FUTURES', 'BTCUSDT', 4)

    expect(result.items).toHaveLength(4)
    expect(result.total).toBe(4)
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        exchange: 'Binance',
        instrumentType: 'FUTURES',
        symbol: 'BTCUSDT',
      }),
    ]))
    expect(findMany).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })

  it('queries trades in production even when USE_MOCK_DATA is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    process.env.APP_ENV = 'production'
    const row = { id: 1, symbol: 'BTCUSDT' } as MarketTrade
    const findMany = jest.fn().mockResolvedValue([row])
    const repository = createRepository({ findMany })
    const mockSpy = jest.spyOn(
      repository as unknown as MockableMarketTradesRepository,
      'generateMockTrades',
    )

    await expect(repository.findTrades({ symbol: 'BTCUSDT', limit: 10 })).resolves.toEqual([row])

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('queries latest trades in production even when USE_MOCK_DATA is enabled', async () => {
    process.env.USE_MOCK_DATA = 'true'
    process.env.APP_ENV = 'production'
    const row = { id: 1, symbol: 'BTCUSDT' } as MarketTrade
    const findMany = jest.fn().mockResolvedValue([row])
    const count = jest.fn().mockResolvedValue(1)
    const repository = createRepository({ findMany, count })
    const mockSpy = jest.spyOn(
      repository as unknown as MockableMarketTradesRepository,
      'generateMockTrades',
    )

    await expect(repository.findLatestTrades('Binance', 'FUTURES', 'BTCUSDT')).resolves.toEqual({
      items: [row],
      total: 1,
    })

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenCalledTimes(1)
    expect(mockSpy).not.toHaveBeenCalled()
  })
})
