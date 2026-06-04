import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { RedisService } from '@/common/services/redis.service'
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
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

  const mockOrderbookConfigService = {
    findEnabledConfigs: jest.fn(),
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
        {
          provide: OrderbookPairConfigService,
          useValue: mockOrderbookConfigService,
        },
      ],
    }).compile()

    service = module.get<AggregatedOrderbookService>(AggregatedOrderbookService)
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.setex.mockResolvedValue('OK')
    mockOrderbookConfigService.findEnabledConfigs.mockResolvedValue([])
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

  it('aggregates hyperliquid snapshots when venue is requested', async () => {
    const hyperliquidBook = {
      venueId: 'hyperliquid-perp',
      marketKey: 'SOL-USDC:perp',
      bids: [{ price: 153.1, size: 120 }],
      asks: [{ price: 153.2, size: 90 }],
      exchangeTs: Date.now() - 500,
      receivedTs: Date.now() - 250,
      version: 789,
    }

    mockRedisClient.mget.mockResolvedValue([null, JSON.stringify(hyperliquidBook)])

    const result = await service.getAggregatedOrderbook({
      base: 'SOL',
      type: 'perp',
      venues: ['hyperliquid'],
      depth: 20,
      tickSize: 0.1,
    })

    expect(mockRedisClient.mget).toHaveBeenCalledWith(
      'orderbook:hyperliquid-perp:SOL-USDT:perp',
      'orderbook:hyperliquid-perp:SOL-USDC:perp',
    )
    expect(result.bids[0]).toMatchObject({ price: 153.1, sizeTotal: 120 })
    expect(result.asks[0]).toMatchObject({ price: 153.2, sizeTotal: 90 })
    expect(result.venues).toEqual(['hyperliquid'])
  })

  it('lists enabled aggregated orderbook markets grouped by base and type', async () => {
    const freshBtcBook = {
      venueId: 'binance-perp',
      marketKey: 'BTC-USDT:perp',
      bids: [{ price: 66480, size: 1.25 }],
      asks: [{ price: 66481, size: 1.1 }],
      exchangeTs: Date.now() - 500,
      receivedTs: Date.now() - 250,
      version: 123,
    }

    mockOrderbookConfigService.findEnabledConfigs.mockResolvedValue([
      {
        venue: 'BINANCE',
        venueType: 'CEX',
        instrumentType: 'PERPETUAL',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
      },
      {
        venue: 'HYPERLIQUID',
        venueType: 'DEX',
        instrumentType: 'PERPETUAL',
        baseAsset: 'SOL',
        quoteAsset: 'USDC',
      },
      {
        venue: 'OKX',
        venueType: 'CEX',
        instrumentType: 'SPOT',
        baseAsset: 'SOL',
        quoteAsset: 'USDT',
      },
      {
        venue: 'UNSUPPORTED',
        venueType: 'CEX',
        instrumentType: 'PERPETUAL',
        baseAsset: 'DOGE',
        quoteAsset: 'USDT',
      },
    ])
    mockRedisClient.mget.mockResolvedValue([
      JSON.stringify(freshBtcBook),
      null,
      null,
      null,
      null,
      null,
    ])

    await expect(service.getAvailableMarkets()).resolves.toEqual([
      { base: 'BTC', type: 'perp', venues: ['binance'] },
    ])
  })
})
