import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PolymarketGammaMarket } from '../src/clients/polymarket/types'
import type { DataPullJobContext } from '../src/modules/data-sync/contracts/data-pull-job'
import type { PolymarketTaskMeta } from '../src/modules/data-sync/jobs/polymarket-markets.job'
import { resolve } from 'node:path'

import { Test } from '@nestjs/testing'
import { PolymarketGammaClient } from '../src/clients/polymarket/gamma-client'
import { AppModule } from '../src/modules/app.module'
import { PolymarketMarketsJob } from '../src/modules/data-sync/jobs/polymarket-markets.job'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Polymarket markets job (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let job: PolymarketMarketsJob
  let gammaClient: PolymarketGammaClient
  let listMarketsSpy: jest.SpyInstance | undefined

  beforeAll(async () => {
    // 强制使用 e2e 环境，避免误连开发/生产库
    process.env.APP_ENV = 'e2e'

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    job = app.get(PolymarketMarketsJob)
    gammaClient = app.get(PolymarketGammaClient)

    // 在清理数据前增加安全保护：仅允许在 e2e 测试数据库上执行
    const appEnv = process.env.APP_ENV
    const databaseUrl = process.env.DATABASE_URL ?? ''
    if (appEnv !== 'e2e' || (!databaseUrl.includes('e2e') && !databaseUrl.includes('test'))) {
      throw new Error(
        `Unsafe database environment for E2E test: APP_ENV=${appEnv}, DATABASE_URL=${databaseUrl}`,
      )
    }

    // 仅清理本测试中会用到的测试数据，避免误删其他数据
    const client = prisma.getClient()
    await client.$transaction([
      client.polymarketOrderbookSnapshot.deleteMany({
        where: {
          OR: [
            { marketExternalId: { in: ['m-1', 'm-3'] } },
            { outcomeTokenId: { in: ['token-yes', 'token-no', 'token-eth-yes'] } },
          ],
        },
      }),
      client.polymarketOutcome.deleteMany({
        where: {
          outcomeTokenId: { in: ['token-yes', 'token-no', 'token-eth-yes'] },
        },
      }),
      client.polymarketMarket.deleteMany({
        where: {
          marketId: { in: ['m-1', 'm-3'] },
        },
      }),
    ])
  })

  afterAll(async () => {
    // 确保 spy 总能被恢复，避免污染其他测试
    if (listMarketsSpy) {
      listMarketsSpy.mockRestore()
    }

    if (app) {
      await app.close()
    }
  })

  it('should upsert markets/outcomes and advance cursor with offset/cursor strategy', async () => {
    const client = prisma.getClient()

    const baseCtx: Omit<DataPullJobContext<PolymarketTaskMeta>, 'cursor'> = {
      taskId: 1,
      key: job.key,
      meta: {
        category: 'crypto',
        tags: ['btc', 'yes/no'],
      },
      now: new Date(),
    }

    /**
     * 场景设计：
     * - 第一次调用 gammaClient.listMarkets：返回 limit 数量的市场（满页），无 nextCursor，触发 offset++ 逻辑
     * - 第二次调用：返回少量市场（不足一页），仍无 nextCursor，触发 offset 重置为 0
     *
     * 同时验证：
     * - 只会持久化 category=crypto 的市场；
     * - outcomes 解析逻辑正常工作，并写入 polymarketOutcome 表。
     */

    // 第一页模拟“满页”数据：长度 = job 内部 batchSize(100)，以触发 offset 递增逻辑
    const mockedMarketsPage1: PolymarketGammaMarket[] = []

    // 1. 一个 crypto 市场（会被实际 upsert）
    mockedMarketsPage1.push({
      id: 'm-1',
      slug: 'btc-up-or-down',
      title: 'BTC up or down',
      question: 'Will BTC go up?',
      category: 'crypto',
      tags: ['btc'],
      outcomeType: 'binary',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      liquidity: '1000',
      volume24hr: '100',
      openInterest: '500',
      event: {
        id: 'e-1',
        slug: 'btc-event',
        title: 'BTC event',
        category: 'crypto',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        tags: ['btc', 'yes/no'],
      },
      outcomes: [
        {
          id: 'o-1',
          token_id: 'token-yes',
          name: 'Yes',
          side: 'YES',
          price: '0.6',
          probability: '0.6',
        },
        {
          id: 'o-2',
          token_id: 'token-no',
          name: 'No',
          side: 'NO',
          price: '0.4',
          probability: '0.4',
        },
      ],
    })

    // 2. 一个 sports 市场（应被 Job 通过 category 过滤掉）
    mockedMarketsPage1.push({
      id: 'm-2',
      slug: 'nfl-market',
      title: 'Some NFL market',
      question: 'NFL?',
      category: 'sports',
      tags: ['nfl'],
      outcomeType: 'binary',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      event: {
        id: 'e-2',
        slug: 'nfl-event',
        title: 'NFL event',
        category: 'sports',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        tags: ['nfl'],
      },
      outcomes: [],
    })

    // 3. 追加若干 sports 市场，使第一页长度达到 100（与 batchSize/effectiveLimit 对齐）
    for (let i = 0; i < 98; i += 1) {
      mockedMarketsPage1.push({
        id: `m-sports-${i}`,
        slug: `sports-${i}`,
        title: `Sports market ${i}`,
        question: `Sports Q${i}?`,
        category: 'sports',
        tags: ['sports'],
        outcomeType: 'binary',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        event: {
          id: `e-sports-${i}`,
          slug: `sports-event-${i}`,
          title: `Sports event ${i}`,
          category: 'sports',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          tags: ['sports'],
        },
        outcomes: [],
      })
    }

    const mockedMarketsPage2: PolymarketGammaMarket[] = [
      {
        id: 'm-3',
        slug: 'eth-up-or-down',
        title: 'ETH up or down',
        question: 'Will ETH go up?',
        category: 'crypto',
        tags: ['eth'],
        outcomeType: 'binary',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        event: {
          id: 'e-3',
          slug: 'eth-event',
          title: 'ETH event',
          category: 'crypto',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          tags: ['eth'],
        },
        outcomes: [
          {
            id: 'o-3',
            token_id: 'token-eth-yes',
            name: 'Yes',
            side: 'YES',
            price: '0.5',
            probability: '0.5',
          },
        ],
      },
    ]

    listMarketsSpy = jest
      .spyOn(gammaClient, 'listMarkets')
      .mockImplementationOnce(async () => ({
        markets: mockedMarketsPage1,
        nextCursor: null,
      }))
      .mockImplementationOnce(async () => ({
        markets: mockedMarketsPage2,
        nextCursor: null,
      }))

    const run1 = await job.run({
      ...baseCtx,
      cursor: null,
    })

    const cursor1 = JSON.parse(run1.newCursor as string) as {
      nextCursor?: string | null
      offset?: number
      usedCursor?: boolean
    }

    // 单次 run 会按 maxPagesPerRun 连续拉取页面：
    // 第一页(100条) + 第二页(1条) 共处理 2 个 crypto 市场，并在末页后重置 offset
    expect(run1.fetchedCount).toBe(2)
    expect(cursor1.offset).toBe(0)
    expect(cursor1.nextCursor).toBeNull()
    expect(cursor1.usedCursor).toBe(false)

    const marketsAfterRun1 = await client.polymarketMarket.findMany({
      where: {
        marketId: {
          in: ['m-1', 'm-3'],
        },
      },
      orderBy: { marketId: 'asc' },
    })
    expect(marketsAfterRun1.length).toBe(2)
    expect(marketsAfterRun1.map(m => m.marketId)).toEqual(['m-1', 'm-3'])
    expect(marketsAfterRun1[0].category).toBe('crypto')

    const outcomesAfterRun1 = await client.polymarketOutcome.findMany({
      where: {
        outcomeTokenId: {
          in: ['token-eth-yes', 'token-no', 'token-yes'],
        },
      },
      orderBy: { outcomeTokenId: 'asc' },
    })
    expect(outcomesAfterRun1.length).toBe(3)
    expect(outcomesAfterRun1.map(o => o.outcomeTokenId)).toEqual([
      'token-eth-yes',
      'token-no',
      'token-yes',
    ])

    // 验证 offset/cursor 策略：第二轮调用应基于第一轮返回数量推进 offset
    expect(listMarketsSpy).toHaveBeenCalledTimes(2)
    const firstCallArgs = listMarketsSpy.mock.calls[0]?.[0] as Record<string, unknown>
    const secondCallArgs = listMarketsSpy.mock.calls[1]?.[0] as Record<string, unknown>

    expect(firstCallArgs).toMatchObject({
      offset: 0,
      cursor: null,
    })
    expect(secondCallArgs).toMatchObject({
      offset: mockedMarketsPage1.length,
      cursor: null,
    })

  })
})

