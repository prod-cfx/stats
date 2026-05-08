import type { TestingModule } from '@nestjs/testing'
import type { CreateOpenInterestDto } from './dto/open-interest.dto'
import { Test } from '@nestjs/testing'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
import { Prisma } from '@/prisma/prisma.types'
import { OpenInterestRepository } from './open-interest.repository'
import { OpenInterestService } from './open-interest.service'

describe('openInterestService', () => {
  let service: OpenInterestService

  const mockRepository = {
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findLatest: jest.fn(),
    queryRawStats: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenInterestService,
        {
          provide: OpenInterestRepository,
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<OpenInterestService>(OpenInterestService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('upsert', () => {
    it('delegates upsert to the repository', async () => {
      const mockData: CreateOpenInterestDto = {
        exchange: 'All',
        symbol: 'BTC',
        open_interest_usd: 57437891724.5572,
        open_interest_quantity: 659557.3064,
        open_interest_by_stable_coin_margin: 48920274435.15,
        open_interest_quantity_by_coin_margin: 97551.2547,
        open_interest_quantity_by_stable_coin_margin: 562006.0517,
        open_interest_change_percent_5m: 0.34,
        open_interest_change_percent_15m: 0.59,
        open_interest_change_percent_30m: 1.42,
        open_interest_change_percent_1h: 2.27,
        open_interest_change_percent_4h: 2.95,
        open_interest_change_percent_24h: 0.9,
        data_timestamp: '2025-12-24T10:00:00Z',
      }

      const mockResult = {
        id: 1,
        ...mockData,
        dataTimestamp: new Date(mockData.data_timestamp),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.upsert.mockResolvedValue(mockResult)

      const result = await service.upsert(mockData)

      expect(result).toEqual(mockResult)
      expect(mockRepository.upsert).toHaveBeenCalledTimes(1)
      expect(mockRepository.upsert).toHaveBeenCalledWith(mockData)
    })

    it('propagates repository errors', async () => {
      const mockData: CreateOpenInterestDto = {
        exchange: 'All',
        symbol: 'BTC',
        open_interest_usd: 57437891724.5572,
        open_interest_quantity: 659557.3064,
        data_timestamp: '2025-12-24T10:00:00Z',
      } as CreateOpenInterestDto

      mockRepository.upsert.mockRejectedValue(new Error('Database error'))

      await expect(service.upsert(mockData)).rejects.toThrow('Database error')
    })
  })

  describe('batchUpsert', () => {
    it('upserts each record in the batch', async () => {
      const mockDataList: CreateOpenInterestDto[] = [
        {
          exchange: 'All',
          symbol: 'BTC',
          open_interest_usd: 57437891724.5572,
          open_interest_quantity: 659557.3064,
          data_timestamp: '2025-12-24T10:00:00Z',
        } as CreateOpenInterestDto,
        {
          exchange: 'All',
          symbol: 'ETH',
          open_interest_usd: 12345678901.2345,
          open_interest_quantity: 123456.789,
          data_timestamp: '2025-12-24T10:00:00Z',
        } as CreateOpenInterestDto,
      ]

      mockRepository.upsert.mockResolvedValue({})

      const result = await service.batchUpsert(mockDataList)

      expect(result).toHaveLength(2)
      expect(mockRepository.upsert).toHaveBeenCalledTimes(2)
    })

    it('returns an empty array for empty input', async () => {
      const result = await service.batchUpsert([])

      expect(result).toEqual([])
      expect(mockRepository.upsert).not.toHaveBeenCalled()
    })
  })

  describe('query', () => {
    it('forwards filters and pagination to the repository', async () => {
      const mockQuery = {
        exchange: 'All',
        symbol: 'BTC',
        startTime: '2025-12-24T00:00:00Z',
        endTime: '2025-12-24T23:59:59Z',
        limit: 100,
        page: 1,
      }

      const mockData = [
        {
          id: 1,
          exchange: 'All',
          symbol: 'BTC',
          openInterestUsd: '57437891724.5572',
          dataTimestamp: new Date(),
        },
      ]

      mockRepository.findMany.mockResolvedValue(mockData)
      mockRepository.count.mockResolvedValue(1)

      const result = await service.query(mockQuery)

      expect(result).toEqual(expect.objectContaining({
        items: mockData,
        total: 1,
        page: 1,
        limit: 100,
      }))
      expect(mockRepository.findMany).toHaveBeenCalledWith(
        {
          exchange: 'All',
          symbol: 'BTC',
          dataTimestamp: {
            gte: new Date(mockQuery.startTime),
            lte: new Date(mockQuery.endTime),
          },
        },
        100,
        0,
      )
      expect(mockRepository.count).toHaveBeenCalledTimes(1)
    })
  })

  describe('getLatest', () => {
    it('returns the latest record from the repository', async () => {
      const mockData = {
        id: 1,
        exchange: 'All',
        symbol: 'BTC',
        openInterestUsd: '57437891724.5572',
        dataTimestamp: new Date(),
      }

      mockRepository.findLatest.mockResolvedValue(mockData)

      const result = await service.getLatest('All', 'BTC')

      expect(result).toEqual(mockData)
      expect(mockRepository.findLatest).toHaveBeenCalledWith('All', 'BTC')
    })
  })

  describe('getStats', () => {
    const startTime = new Date('2025-12-24T00:00:00Z')
    const endTime = new Date('2025-12-24T23:59:59Z')

    const buildRow = (overrides?: Partial<{
      min: string
      max: string
      avg: string
      earliest: string
      latest: string
      dataPoints: number
    }>) => {
      const {
        min = '57000000000',
        max = '58000000000',
        avg = '57500000000',
        earliest = '57000000000',
        latest = '58000000000',
        dataPoints = 3,
      } = overrides ?? {}

      return {
        min: new Prisma.Decimal(min),
        max: new Prisma.Decimal(max),
        avg: new Prisma.Decimal(avg),
        data_points: BigInt(dataPoints),
        earliest: new Prisma.Decimal(earliest),
        latest: new Prisma.Decimal(latest),
      }
    }

    it('calculates statistics for a time range', async () => {
      mockRepository.queryRawStats.mockResolvedValue([buildRow()])

      const result = await service.getStats('BTC', startTime, endTime)

      expect(result).toEqual({
        symbol: 'BTC',
        startTime,
        endTime,
        dataPoints: 3,
        max: 58_000_000_000,
        min: 57_000_000_000,
        avg: 57_500_000_000,
        latest: 58_000_000_000,
        earliest: 57_000_000_000,
        change: 1_000_000_000,
        changePercent: (1_000_000_000 / 57_000_000_000) * 100,
      })
      expect(mockRepository.queryRawStats).toHaveBeenCalledWith('BTC', startTime, endTime)
    })

    it('returns null when no data is found', async () => {
      mockRepository.queryRawStats.mockResolvedValue([])

      const result = await service.getStats('BTC', startTime, endTime)

      expect(result).toBeNull()
    })

    it('handles a zero earliest value', async () => {
      mockRepository.queryRawStats.mockResolvedValue([
        buildRow({ earliest: '0', latest: '58000000000' }),
      ])

      const result = await service.getStats('BTC', startTime, endTime)

      expect(result?.earliest).toBe(0)
      expect(result?.changePercent).toBe(0)
    })

    it('rejects when startTime is after endTime', async () => {
      const invalidStart = new Date('2025-12-25T00:00:00Z')
      const invalidEnd = new Date('2025-12-24T00:00:00Z')

      await expect(service.getStats('BTC', invalidStart, invalidEnd))
        .rejects.toMatchObject({
          name: DomainException.name,
          code: ErrorCode.OPEN_INTEREST_INVALID_PARAMS,
          args: { reason: 'startTime must be before endTime' },
        })
    })

    it('rejects when parameters are missing', async () => {
      await expect(service.getStats('', startTime, endTime))
        .rejects.toMatchObject({
          name: DomainException.name,
          code: ErrorCode.OPEN_INTEREST_INVALID_PARAMS,
        })
    })

    it('rejects when range exceeds 31 days', async () => {
      const longStart = new Date('2025-01-01T00:00:00Z')
      const longEnd = new Date('2025-03-15T00:00:00Z')

      await expect(service.getStats('BTC', longStart, longEnd))
        .rejects.toMatchObject({
          name: DomainException.name,
          code: ErrorCode.OPEN_INTEREST_RANGE_EXCEEDED,
        })
    })
  })
})
