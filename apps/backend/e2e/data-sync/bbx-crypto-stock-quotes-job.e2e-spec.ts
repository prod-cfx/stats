import type { INestApplication } from '@nestjs/common'
import type { ClsService } from 'nestjs-cls'
import type { DataPullJobContext } from '@/modules/data-sync/contracts/data-pull-job'

import { ClsService as ClsServiceToken } from 'nestjs-cls'
import { BbxCryptoStockQuotesJob } from '@/modules/data-sync/jobs/bbx-crypto-stock-quotes.job'
import { PrismaService } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

describe('BBX crypto stock quotes job (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let job: BbxCryptoStockQuotesJob
  let cls: ClsService

  const originalFetch: typeof fetch | undefined = (globalThis as any).fetch

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: {
        BBX_API_KEY: 'test-bbx-api-key',
        BBX_CRYPTO_STOCK_SYMBOLS: 'MSTR,COIN',
        // JWT 配置在非 development 环境是必需的，这里为 e2e 提供一个固定值
        JWT_SECRET: 'test-jwt-secret',
      },
    })
    app = ctx.app

    prisma = app.get(PrismaService)
    job = app.get(BbxCryptoStockQuotesJob)
    cls = app.get(ClsServiceToken)

    // 清理测试相关数据，避免受历史数据影响
    const client = prisma.getClient()
    await client.cryptoStockQuote.deleteMany({
      where: {
        symbol: { in: ['MSTR'] },
      },
    })
  })

  afterAll(async () => {
    // 恢复原始 fetch 实现，避免污染其他测试
    ;(globalThis as any).fetch = originalFetch

    if (app) {
      await app.close()
    }
  })

  it('should insert crypto stock quotes and update cursor', async () => {
    const client = prisma.getClient()

    const quoteTime = 1_700_000_000_000

    const mockResponseBody = {
      success: true,
      code: 0,
      data: [
        {
          symbol: 'MSTR',
          name: 'MicroStrategy Inc.',
          exchange: 'NASDAQ',
          price: 100,
          open: 95,
          high: 105,
          low: 94,
          close: 98,
          volume: 1_000_000,
          turnover: 100_000_000,
          change: 2,
          changePercent: 2,
          marketCap: 50_000_000_000, // 50B
          holdingValue: 63_900_000_000, // 63.9B (≥1B，会被保留)
          peRatio: 30,
          high52w: 120,
          low52w: 60,
          timestamp: quoteTime,
        },
        {
          symbol: 'COIN',
          name: 'Coinbase Global Inc.',
          exchange: 'NASDAQ',
          price: 200,
          marketCap: 30_000_000_000, // 30B
          holdingValue: 500_000_000, // 500M（当前实现会保留）
          timestamp: quoteTime,
        },
      ],
    }

    let fetchCallCount = 0

    ;(globalThis as any).fetch = jest.fn(async () => {
      fetchCallCount += 1
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponseBody,
      } as any
    })

    const baseCtx: Omit<DataPullJobContext, 'cursor'> = {
      taskId: 1,
      key: job.key,
      meta: null,
      now: new Date(),
    }

    const result = await cls.run(() =>
      job.run({
        ...baseCtx,
        cursor: null,
      }),
    )

    expect(fetchCallCount).toBe(1)
    expect(result.fetchedCount).toBe(2)
    expect(result.newCursor).toBeDefined()

    const cursor = JSON.parse(result.newCursor as string) as {
      lastFetchTime?: string
    }
    expect(typeof cursor.lastFetchTime).toBe('string')

    const rows = await client.cryptoStockQuote.findMany({
      where: {
        symbol: { in: ['MSTR', 'COIN'] },
      },
      orderBy: {
        symbol: 'asc',
      },
    })

    expect(rows.length).toBe(2)

    const coin = rows.find(r => r.symbol === 'COIN')
    const mstr = rows.find(r => r.symbol === 'MSTR')

    expect(coin).toBeDefined()
    expect(coin?.quoteTimestamp.getTime()).toBe(quoteTime)
    expect(coin?.price.toString()).toBe('200')
    expect(coin?.source).toBe('BBX')

    expect(mstr).toBeDefined()
    expect(mstr?.quoteTimestamp.getTime()).toBe(quoteTime)
    expect(mstr?.price.toString()).toBe('100')
    expect(mstr?.source).toBe('BBX')
  })
})
