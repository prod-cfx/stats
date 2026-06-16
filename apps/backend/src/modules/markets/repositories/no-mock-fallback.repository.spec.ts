import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { Logger } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
import { FuturesPairsMarketRepository } from './futures-pairs-market.repository'
import { LongShortRatioRepository } from './long-short-ratio.repository'
import { TakerBuySellVolumeRepository } from './taker-buy-sell-volume.repository'

type MockableTakerBuySellVolumeRepository = TakerBuySellVolumeRepository & {
  generateMockVolumes: (params: { symbol: string, range: string }) => unknown[]
}

type MockableFuturesPairsMarketRepository = FuturesPairsMarketRepository & {
  generateMockVolumes: (params: { limit: number, offset: number }) => unknown
  generateMockOI: () => unknown[]
}

type MockableLongShortRatioRepository = LongShortRatioRepository & {
  generateMockRatios: (query: { tradingPairId: string, interval: string, limit?: number }) => unknown[]
}

function createTxHost(tx: Record<string, unknown>) {
  return { tx } as unknown as TransactionHost<TransactionalAdapterPrisma>
}

describe('market repositories no mock fallback', () => {
  const originalUseMockData = process.env.USE_MOCK_DATA
  const originalAppEnv = process.env.APP_ENV
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.USE_MOCK_DATA = 'false'
    process.env.APP_ENV = 'production'
    process.env.NODE_ENV = 'production'
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    if (originalUseMockData === undefined) delete process.env.USE_MOCK_DATA
    else process.env.USE_MOCK_DATA = originalUseMockData

    if (originalAppEnv === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = originalAppEnv

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv

    jest.restoreAllMocks()
  })

  it('returns an empty taker volume list when latest timestamps are empty', async () => {
    const repository = new TakerBuySellVolumeRepository(createTxHost({
      takerBuySellVolume: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn(),
      },
    }))
    const mockSpy = jest.spyOn(
      repository as unknown as MockableTakerBuySellVolumeRepository,
      'generateMockVolumes',
    )

    await expect(repository.findLatestBySymbol({ symbol: 'BTCUSDT', range: '1h' })).resolves.toEqual([])
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('throws a domain exception when taker volume latest timestamp query fails', async () => {
    const repository = new TakerBuySellVolumeRepository(createTxHost({
      takerBuySellVolume: {
        groupBy: jest.fn().mockRejectedValue(new Error('db down')),
        findMany: jest.fn(),
      },
    }))

    await expect(repository.findLatestBySymbol({ symbol: 'BTCUSDT', range: '1h' })).rejects.toMatchObject({
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })

  it('returns an empty futures volume page when grouped volume data is empty', async () => {
    const repository = new FuturesPairsMarketRepository(createTxHost({
      futuresPairsMarket: {
        groupBy: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
    }))
    const mockSpy = jest.spyOn(
      repository as unknown as MockableFuturesPairsMarketRepository,
      'generateMockVolumes',
    )

    await expect(repository.findVolumesBySymbol({ symbol: 'BTC', limit: 10, offset: 0 })).resolves.toEqual({
      data: [],
      total: 0,
    })
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('throws a domain exception when futures volume query fails', async () => {
    const repository = new FuturesPairsMarketRepository(createTxHost({
      futuresPairsMarket: {
        groupBy: jest.fn().mockRejectedValue(new Error('db down')),
      },
    }))

    await expect(repository.findVolumesBySymbol({ symbol: 'BTC', limit: 10, offset: 0 })).rejects.toMatchObject({
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })

  it('returns an empty open interest list when grouped OI data is empty', async () => {
    const repository = new FuturesPairsMarketRepository(createTxHost({
      futuresPairsMarket: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    }))
    const mockSpy = jest.spyOn(
      repository as unknown as MockableFuturesPairsMarketRepository,
      'generateMockOI',
    )

    await expect(repository.aggregateOIByExchange({ symbol: 'BTC' })).resolves.toEqual([])
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('throws a domain exception when open interest query fails', async () => {
    const repository = new FuturesPairsMarketRepository(createTxHost({
      futuresPairsMarket: {
        groupBy: jest.fn().mockRejectedValue(new Error('db down')),
      },
    }))

    await expect(repository.aggregateOIByExchange({ symbol: 'BTC' })).rejects.toMatchObject({
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })

  it('returns an empty long-short ratio page when database data is empty', async () => {
    const repository = new LongShortRatioRepository(createTxHost({
      longShortRatio: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    }))
    const mockSpy = jest.spyOn(
      repository as unknown as MockableLongShortRatioRepository,
      'generateMockRatios',
    )

    await expect(repository.findByPairAndTime({ tradingPairId: 'pair-1', interval: '1h' })).resolves.toEqual({
      items: [],
      total: 0,
    })
    expect(mockSpy).not.toHaveBeenCalled()
  })

  it('throws a domain exception when long-short ratio query fails', async () => {
    const repository = new LongShortRatioRepository(createTxHost({
      longShortRatio: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
        count: jest.fn(),
      },
    }))

    await expect(repository.findByPairAndTime({ tradingPairId: 'pair-1', interval: '1h' })).rejects.toMatchObject({
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { detail: 'DatabaseError' },
    } satisfies Partial<DomainException>)
  })
})
