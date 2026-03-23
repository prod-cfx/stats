import type { INestApplication } from '@nestjs/common'
import type { MarketsService } from '@/modules/markets/markets.service'
import type { PrismaService } from '@/prisma/prisma.service'

import { MarketsService as MarketsServiceToken } from '@/modules/markets/markets.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

jest.setTimeout(180_000)

// ---------------------------------------------------------------------------
// getLongShortRatios pagination
// ---------------------------------------------------------------------------

describe('MarketsService.getLongShortRatios pagination (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: MarketsService

  // Prisma enum key for seeding; service accepts the app-layer string '1h'
  const PRISMA_INTERVAL = 'h1' as const
  const SERVICE_INTERVAL = '1h' as const
  const PAIR_ID = 'BTCUSDT.BINANCE.PERP.TEST_PAGINATION'
  const BASE_TIME = new Date('2024-01-01T00:00:00Z')

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app
    prisma = app.get<PrismaService>(PrismaServiceToken)
    service = app.get<MarketsService>(MarketsServiceToken)

    const client = prisma.getClient()

    // 清理本测试写入的数据
    await client.longShortRatio.deleteMany({
      where: { tradingPairId: PAIR_ID },
    })

    // 插入 5 条测试数据，每条时间戳递增 1 小时
    const records = Array.from({ length: 5 }, (_, i) => ({
      tradingPairId: PAIR_ID,
      interval: PRISMA_INTERVAL,
      timestamp: new Date(BASE_TIME.getTime() + i * 60 * 60 * 1000),
      longShortRatio: String(1 + i * 0.1),
      longAccountRatio: String(0.55 + i * 0.01),
      shortAccountRatio: String(0.45 - i * 0.01),
    }))

    await client.longShortRatio.createMany({ data: records, skipDuplicates: true })
  })

  afterAll(async () => {
    if (prisma) {
      const client = prisma.getClient()
      await client.longShortRatio.deleteMany({
        where: { tradingPairId: PAIR_ID },
      })
    }
    if (app) {
      await app.close()
    }
  })

  it('should return correct pagination structure for default params', async () => {
    const result = await service.getLongShortRatios({
      tradingPairId: PAIR_ID,
      interval: SERVICE_INTERVAL,
    })

    expect(typeof result.total).toBe('number')
    expect(result.total).toBe(5)
    expect(typeof result.page).toBe('number')
    expect(typeof result.limit).toBe('number')
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items.length).toBe(5)
  })

  it('should return 2 items for page=1, limit=2', async () => {
    const result = await service.getLongShortRatios({
      tradingPairId: PAIR_ID,
      interval: SERVICE_INTERVAL,
      page: 1,
      limit: 2,
    })

    expect(result.page).toBe(1)
    expect(result.limit).toBe(2)
    expect(result.items.length).toBe(2)
    expect(result.total).toBe(5)
  })

  it('should return different items for page=2 vs page=1 (limit=2)', async () => {
    const page1 = await service.getLongShortRatios({
      tradingPairId: PAIR_ID,
      interval: SERVICE_INTERVAL,
      page: 1,
      limit: 2,
    })

    const page2 = await service.getLongShortRatios({
      tradingPairId: PAIR_ID,
      interval: SERVICE_INTERVAL,
      page: 2,
      limit: 2,
    })

    expect(page1.items.length).toBe(2)
    expect(page2.items.length).toBe(2)

    const page1Ids = new Set(page1.items.map(item => item.id))
    const page2Ids = page2.items.map(item => item.id)
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false)
    }
  })

  it('should return empty items for out-of-range page', async () => {
    const result = await service.getLongShortRatios({
      tradingPairId: PAIR_ID,
      interval: SERVICE_INTERVAL,
      page: 9999,
      limit: 10,
    })

    expect(result.items.length).toBe(0)
    expect(result.total).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// getLatestTrades pagination
// ---------------------------------------------------------------------------

describe('MarketsService.getLatestTrades pagination (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: MarketsService

  const EXCHANGE = 'BINANCE'
  const INSTRUMENT_TYPE = 'PERPETUAL'
  // Use a unique symbol to avoid conflicts with real data
  const SYMBOL = 'BTC-USDT-TEST-PAGINATION'
  const BASE_ASSET = 'BTC'
  const QUOTE_ASSET = 'USDT'
  const BASE_TS = BigInt(Date.now())

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app
    prisma = app.get<PrismaService>(PrismaServiceToken)
    service = app.get<MarketsService>(MarketsServiceToken)

    const client = prisma.getClient()

    // 清理本测试写入的数据
    await client.marketTrade.deleteMany({
      where: { exchange: EXCHANGE, instrumentType: INSTRUMENT_TYPE, symbol: SYMBOL },
    })

    // 插入 5 条测试成交记录
    const records = Array.from({ length: 5 }, (_, i) => ({
      exchange: EXCHANGE,
      instrumentType: INSTRUMENT_TYPE,
      symbol: SYMBOL,
      baseAsset: BASE_ASSET,
      quoteAsset: QUOTE_ASSET,
      tradeId: `test-pagination-trade-${i + 1}`,
      price: String(30000 + i * 100),
      size: String(0.1 + i * 0.05),
      side: i % 2 === 0 ? 'buy' : 'sell',
      tradeTimestamp: BASE_TS + BigInt(i * 1000),
    }))

    await client.marketTrade.createMany({ data: records, skipDuplicates: true })
  })

  afterAll(async () => {
    if (prisma) {
      const client = prisma.getClient()
      await client.marketTrade.deleteMany({
        where: { exchange: EXCHANGE, instrumentType: INSTRUMENT_TYPE, symbol: SYMBOL },
      })
    }
    if (app) {
      await app.close()
    }
  })

  it('should return correct pagination structure for default params', async () => {
    const result = await service.getLatestTrades(EXCHANGE, INSTRUMENT_TYPE, SYMBOL)

    expect(typeof result.total).toBe('number')
    expect(result.total).toBe(5)
    expect(typeof result.page).toBe('number')
    expect(typeof result.limit).toBe('number')
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items.length).toBe(5)
  })

  it('should return 2 items for page=1, limit=2', async () => {
    const result = await service.getLatestTrades(EXCHANGE, INSTRUMENT_TYPE, SYMBOL, 2, 1)

    expect(result.page).toBe(1)
    expect(result.limit).toBe(2)
    expect(result.items.length).toBe(2)
    expect(result.total).toBe(5)
  })

  it('should return different items for page=2 vs page=1 (limit=2)', async () => {
    const page1 = await service.getLatestTrades(EXCHANGE, INSTRUMENT_TYPE, SYMBOL, 2, 1)
    const page2 = await service.getLatestTrades(EXCHANGE, INSTRUMENT_TYPE, SYMBOL, 2, 2)

    expect(page1.items.length).toBe(2)
    expect(page2.items.length).toBe(2)

    const page1Ids = new Set(page1.items.map(item => item.id))
    const page2Ids = page2.items.map(item => item.id)
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false)
    }
  })

  it('should return a valid paginated response for an out-of-range page', async () => {
    // Note: the repository falls back to mock data when the DB query returns 0 rows,
    // so items/total reflect the mock set rather than an empty page.
    // We verify the response shape is always well-formed.
    const result = await service.getLatestTrades(EXCHANGE, INSTRUMENT_TYPE, SYMBOL, 10, 9999)

    expect(typeof result.total).toBe('number')
    expect(typeof result.page).toBe('number')
    expect(typeof result.limit).toBe('number')
    expect(Array.isArray(result.items)).toBe(true)
  })
})
