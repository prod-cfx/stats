import type { INestApplication } from '@nestjs/common'

import type { PrismaService } from '@/prisma/prisma.service'

import { PolymarketService } from '@/modules/polymarket/polymarket.service'
import { createTestingApp } from '../fixtures/fixtures'

describe('Polymarket markets service (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: PolymarketService

  beforeAll(async () => {
    const ctx = await createTestingApp()

    app = ctx.app
    prisma = ctx.prisma!
    service = ctx.moduleFixture.get(PolymarketService)

    // 仅在 e2e/test 数据库上清理与本测试相关的数据，增加安全保护
    const appEnv = process.env.APP_ENV
    const databaseUrl = process.env.DATABASE_URL ?? ''
    if (appEnv !== 'e2e' || (!databaseUrl.includes('e2e') && !databaseUrl.includes('test'))) {
      throw new Error(
        `Unsafe database environment for E2E test: APP_ENV=${appEnv}, DATABASE_URL=${databaseUrl}`,
      )
    }

    const client = prisma.getClient()

    await client.polymarketOrderbookSnapshot.deleteMany({
      where: {
        marketExternalId: {
          in: ['e2e-m-crypto', 'e2e-m-crypto-missing-prob', 'e2e-m-sports'],
        },
      },
    })

    await client.polymarketOutcome.deleteMany({
      where: {
        outcomeTokenId: {
          in: ['e2e-token-yes', 'e2e-token-no', 'e2e-token-missing-prob', 'e2e-token-suspect-zero'],
        },
      },
    })

    await client.polymarketMarket.deleteMany({
      where: {
        marketId: {
          in: [
            'e2e-m-crypto',
            'e2e-m-crypto-missing-prob',
            'e2e-m-crypto-suspect-zero',
            'e2e-m-sports',
          ],
        },
      },
    })

    // 插入一条 crypto 市场和一条 sports 市场，用于验证 category 过滤与映射逻辑
    const cryptoMarket = await client.polymarketMarket.create({
      data: {
        marketId: 'e2e-m-crypto',
        question: 'E2E: Will BTC go up?',
        category: 'crypto',
        status: 'open',
        liquidity: '1000',
        volume24h: '100',
        volumeTotal: '500',
        openInterest: '200',
        isActive: true,
        rawPayload: {},
      },
    })

    await client.polymarketOutcome.createMany({
      data: [
        {
          marketId: cryptoMarket.id,
          outcomeTokenId: 'e2e-token-yes',
          name: 'Yes',
          shortName: 'Yes',
          side: 'YES',
          price: '0.6',
          probability: '0.6',
          rawPayload: {},
        },
        {
          marketId: cryptoMarket.id,
          outcomeTokenId: 'e2e-token-no',
          name: 'No',
          shortName: 'No',
          side: 'NO',
          price: '0.4',
          probability: '0.4',
          rawPayload: {},
        },
      ],
    })

    const cryptoMarketMissingProb = await client.polymarketMarket.create({
      data: {
        marketId: 'e2e-m-crypto-missing-prob',
        question: 'E2E: Missing probability should fallback to price',
        category: 'crypto',
        status: 'open',
        isActive: true,
        rawPayload: {},
      },
    })

    await client.polymarketOutcome.create({
      data: {
        marketId: cryptoMarketMissingProb.id,
        outcomeTokenId: 'e2e-token-missing-prob',
        name: 'Yes',
        shortName: 'Yes',
        side: 'YES',
        price: '0.6',
        probability: null,
        rawPayload: {},
      },
    })

    const cryptoMarketSuspectZero = await client.polymarketMarket.create({
      data: {
        marketId: 'e2e-m-crypto-suspect-zero',
        question: 'E2E: Suspect probability=0 should be treated as missing',
        category: 'crypto',
        status: 'open',
        isActive: true,
        rawPayload: {},
      },
    })

    await client.polymarketOutcome.create({
      data: {
        marketId: cryptoMarketSuspectZero.id,
        outcomeTokenId: 'e2e-token-suspect-zero',
        name: 'Yes',
        shortName: 'Yes',
        side: 'YES',
        price: null,
        probability: '0',
        rawPayload: {},
      },
    })

    await client.polymarketMarket.create({
      data: {
        marketId: 'e2e-m-sports',
        question: 'E2E: Some sports market',
        category: 'sports',
        status: 'open',
        isActive: true,
        rawPayload: {},
      },
    })
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should return active crypto markets with mapped outcomes and numeric fields', async () => {
    const result = await service.listPredictionMarkets({
      category: 'crypto',
      onlyActive: true,
      offset: 0,
      limit: 10,
    })

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)

    const market = result.find(m => m.id === 'e2e-m-crypto')
    expect(market).toBeDefined()
    if (!market) return

    expect(market.id).toBe('e2e-m-crypto')
    expect(market.title).toBe('E2E: Will BTC go up?')
    expect(market.status).toBe('OPEN')

    // 24h/total/openInterest 应按字符串形式返回，供前端自行格式化
    expect(market.volume24h).toBe('100')
    expect(market.volumeTotal).toBe('500')
    expect(market.openInterest).toBe('200')

    // options 映射应保留 label 与概率字段
    expect(market.options).toBeDefined()

    const yes = market.options?.find(o => o.label === 'Yes')
    const no = market.options?.find(o => o.label === 'No')

    expect(yes?.probability).toBe('0.6')
    expect(no?.probability).toBe('0.4')

    const missingProbMarket = result.find(m => m.id === 'e2e-m-crypto-missing-prob')
    expect(missingProbMarket).toBeDefined()
    if (!missingProbMarket) return

    const missingProbOption = missingProbMarket.options?.find(o => o.label === 'Yes')
    expect(missingProbOption?.probability).toBe('0.6')

    const suspectZeroMarket = result.find(m => m.id === 'e2e-m-crypto-suspect-zero')
    expect(suspectZeroMarket).toBeDefined()
    if (!suspectZeroMarket) return

    const suspectZeroOption = suspectZeroMarket.options?.find(o => o.label === 'Yes')
    expect(suspectZeroOption?.probability).toBe('')
  })
})
