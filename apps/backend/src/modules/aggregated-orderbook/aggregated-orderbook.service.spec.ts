import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { RedisService } from '@/common/services/redis.service'
import { AggregatedOrderbookService } from './aggregated-orderbook.service'

describe('aggregatedOrderbookService', () => {
  let service: AggregatedOrderbookService

  const mockRedisClient = {
    get: jest.fn(),
    mget: jest.fn(),
    setex: jest.fn(),
  }

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
  }

  beforeEach(async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-31T09:45:00.000Z'))

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregatedOrderbookService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile()

    service = module.get<AggregatedOrderbookService>(AggregatedOrderbookService)
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.setex.mockResolvedValue('OK')
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('ignores stale venue snapshots during aggregation', async () => {
    const freshBook = {
      venueId: 'binance-perp',
      marketKey: 'BTC-USDT:perp',
      bids: [{ price: 66480, size: 1.25 }],
      asks: [{ price: 66481, size: 1.1 }],
      exchangeTs: Date.now() - 500,
      receivedTs: Date.now() - 250,
      version: 123,
    }

    const staleBook = {
      venueId: 'okx-perp',
      marketKey: 'BTC-USDT:perp',
      bids: [{ price: 89930, size: 3 }],
      asks: [{ price: 89930.1, size: 2.5 }],
      exchangeTs: Date.now() - 90_000,
      receivedTs: Date.now() - 90_000,
      version: 456,
    }

    mockRedisClient.mget.mockResolvedValue([
      JSON.stringify(freshBook),
      null,
      null,
      null,
      null,
      null,
      JSON.stringify(staleBook),
      null,
    ])

    const result = await service.getAggregatedOrderbook({
      base: 'BTC',
      type: 'perp',
      venues: ['binance', 'bybit', 'bitmax', 'okx'],
      depth: 20,
      tickSize: 1,
    })

    expect(result.bids[0]?.price).toBe(66480)
    expect(result.asks[0]?.price).toBe(66481)
    expect(result.midPrice).toBe(66480.5)
    expect(result.venues).toEqual(['binance'])
  })
})
