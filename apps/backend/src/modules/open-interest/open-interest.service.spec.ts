import type { TestingModule } from '@nestjs/testing';
import type { CreateOpenInterestDto } from './dto/open-interest.dto'
import { Test } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenInterestService } from './open-interest.service'

describe('openInterestService', () => {
  let service: OpenInterestService
  let prismaService: PrismaService

  const mockPrismaService = {
    openInterest: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenInterestService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    service = module.get<OpenInterestService>(OpenInterestService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('upsert', () => {
    it('should create or update open interest data', async () => {
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

      mockPrismaService.openInterest.upsert.mockResolvedValue(mockResult)

      const result = await service.upsert(mockData)

      expect(result).toEqual(mockResult)
      expect(prismaService.openInterest.upsert).toHaveBeenCalledTimes(1)
      expect(prismaService.openInterest.upsert).toHaveBeenCalledWith({
        where: {
          unique_oi_record: {
            exchange: mockData.exchange,
            symbol: mockData.symbol,
            dataTimestamp: new Date(mockData.data_timestamp),
          },
        },
        update: expect.any(Object),
        create: expect.any(Object),
      })
    })

    it('should handle errors when upserting', async () => {
      const mockData: CreateOpenInterestDto = {
        exchange: 'All',
        symbol: 'BTC',
        open_interest_usd: 57437891724.5572,
        open_interest_quantity: 659557.3064,
        data_timestamp: '2025-12-24T10:00:00Z',
      } as CreateOpenInterestDto

      mockPrismaService.openInterest.upsert.mockRejectedValue(
        new Error('Database error'),
      )

      await expect(service.upsert(mockData)).rejects.toThrow('Database error')
    })
  })

  describe('batchUpsert', () => {
    it('should batch upsert multiple records', async () => {
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

      mockPrismaService.openInterest.upsert.mockResolvedValue({})

      const result = await service.batchUpsert(mockDataList)

      expect(result).toHaveLength(2)
      expect(prismaService.openInterest.upsert).toHaveBeenCalledTimes(2)
    })

    it('should return empty array for empty input', async () => {
      const result = await service.batchUpsert([])

      expect(result).toEqual([])
      expect(prismaService.openInterest.upsert).not.toHaveBeenCalled()
    })
  })

  describe('query', () => {
    it('should query open interest data with filters', async () => {
      const mockQuery = {
        exchange: 'All',
        symbol: 'BTC',
        startTime: '2025-12-24T00:00:00Z',
        endTime: '2025-12-24T23:59:59Z',
        limit: 100,
        offset: 0,
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

      mockPrismaService.openInterest.findMany.mockResolvedValue(mockData)
      mockPrismaService.openInterest.count.mockResolvedValue(1)

      const result = await service.query(mockQuery)

      expect(result).toEqual({
        data: mockData,
        total: 1,
        limit: 100,
        offset: 0,
      })
      expect(prismaService.openInterest.findMany).toHaveBeenCalledWith({
        where: {
          exchange: 'All',
          symbol: 'BTC',
          dataTimestamp: {
            gte: new Date(mockQuery.startTime),
            lte: new Date(mockQuery.endTime),
          },
        },
        orderBy: { dataTimestamp: 'desc' },
        take: 100,
        skip: 0,
      })
    })
  })

  describe('getLatest', () => {
    it('should get the latest open interest data', async () => {
      const mockData = {
        id: 1,
        exchange: 'All',
        symbol: 'BTC',
        openInterestUsd: '57437891724.5572',
        dataTimestamp: new Date(),
      }

      mockPrismaService.openInterest.findFirst.mockResolvedValue(mockData)

      const result = await service.getLatest('All', 'BTC')

      expect(result).toEqual(mockData)
      expect(prismaService.openInterest.findFirst).toHaveBeenCalledWith({
        where: { exchange: 'All', symbol: 'BTC' },
        orderBy: { dataTimestamp: 'desc' },
      })
    })
  })

  describe('getStats', () => {
    it('should calculate statistics for a time range', async () => {
      const startTime = new Date('2025-12-24T00:00:00Z')
      const endTime = new Date('2025-12-24T23:59:59Z')

      const mockData = [
        {
          openInterestUsd: '57000000000',
          dataTimestamp: new Date('2025-12-24T00:00:00Z'),
        },
        {
          openInterestUsd: '57500000000',
          dataTimestamp: new Date('2025-12-24T12:00:00Z'),
        },
        {
          openInterestUsd: '58000000000',
          dataTimestamp: new Date('2025-12-24T23:59:59Z'),
        },
      ]

      mockPrismaService.openInterest.findMany.mockResolvedValue(mockData)

      const result = await service.getStats('BTC', startTime, endTime)

      expect(result).toMatchObject({
        symbol: 'BTC',
        startTime,
        endTime,
        dataPoints: 3,
        max: 58000000000,
        min: 57000000000,
        latest: 58000000000,
        earliest: 57000000000,
        change: 1000000000,
      })
      expect(result.changePercent).toBeCloseTo(1.75, 2)
    })

    it('should return null when no data is found', async () => {
      const startTime = new Date('2025-12-24T00:00:00Z')
      const endTime = new Date('2025-12-24T23:59:59Z')

      mockPrismaService.openInterest.findMany.mockResolvedValue([])

      const result = await service.getStats('BTC', startTime, endTime)

      expect(result).toBeNull()
    })

    it('should handle zero division when earliest value is zero', async () => {
      const startTime = new Date('2025-12-24T00:00:00Z')
      const endTime = new Date('2025-12-24T23:59:59Z')

      const mockData = [
        {
          openInterestUsd: '0',
          dataTimestamp: new Date('2025-12-24T00:00:00Z'),
        },
        {
          openInterestUsd: '58000000000',
          dataTimestamp: new Date('2025-12-24T23:59:59Z'),
        },
      ]

      mockPrismaService.openInterest.findMany.mockResolvedValue(mockData)

      const result = await service.getStats('BTC', startTime, endTime)

      expect(result.changePercent).toBe(0)
      expect(result.earliest).toBe(0)
    })

    it('should throw error when startTime is after endTime', async () => {
      const startTime = new Date('2025-12-25T00:00:00Z')
      const endTime = new Date('2025-12-24T00:00:00Z')

      await expect(service.getStats('BTC', startTime, endTime)).rejects.toThrow(
        'startTime must be before endTime',
      )
    })

    it('should throw error when parameters are missing', async () => {
      const startTime = new Date('2025-12-24T00:00:00Z')
      const endTime = new Date('2025-12-24T23:59:59Z')

      await expect(
        service.getStats('', startTime, endTime),
      ).rejects.toThrow('Symbol, startTime, and endTime are required')
    })
  })
})
