import { Test } from '@nestjs/testing'
import { RedisService } from '../../common/services/redis.service'
import { KlineService } from './kline.service'
import { KlineRepository } from './repositories/kline.repository'

describe('klineService', () => {
  let service: KlineService

  const mockRedisClient = {
    get: jest.fn(),
    setex: jest.fn(),
  }

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
  }

  const mockKlineRepository = {
    findMany: jest.fn(),
    groupByTimestamp: jest.fn(),
    queryRawOpenClose: jest.fn(),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        KlineService,
        {
          provide: KlineRepository,
          useValue: mockKlineRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile()

    service = module.get<KlineService>(KlineService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['1m', 'm1'],
    ['5m', 'm5'],
    ['15m', 'm15'],
    ['30m', 'm30'],
    ['1h', 'h1'],
    ['4h', 'h4'],
    ['1d', 'd1'],
  ])('accepts supported interval %s', async (interval, prismaInterval) => {
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.setex.mockResolvedValue('OK')
    mockKlineRepository.findMany.mockResolvedValue([])

    await service.getKlineBars({
      symbol: 'BTCUSDT',
      interval,
      from: 1,
      to: 2,
      exchange: 'BINANCE',
    })

    expect(mockKlineRepository.findMany).toHaveBeenCalledWith({
      where: {
        symbol: 'BTCUSDT',
        interval: prismaInterval,
        timestamp: {
          gte: new Date(1000),
          lte: new Date(2000),
        },
        exchangeCode: 'BINANCE',
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    })
  })
})
