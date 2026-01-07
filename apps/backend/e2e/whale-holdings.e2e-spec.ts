import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleHoldingsService } from '../src/modules/whale-holdings/whale-holdings.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'

describe('WhaleHoldingsService (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleHoldingsService: WhaleHoldingsService

  beforeAll(async () => {
    // 确保在导入 AppModule/Prisma 之前就切到 e2e 环境，避免误连非测试库
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }
    if (process.env.APP_ENV !== 'e2e') {
      throw new Error(
        `WhaleHoldings E2E must run with APP_ENV="e2e" to avoid touching non-test databases, current: ${process.env.APP_ENV}`,
      )
    }

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境（ConfigModule/Prisma 会基于 cwd 解析 .env.e2e）
    process.chdir(resolve(__dirname, '../../..'))

    // 确保后续动态导入使用更新后的环境快照
    jest.resetModules()

    const [{ Test }, { AppModule }, { PrismaService }, { WhaleHoldingsService }] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/modules/app.module'),
      import('../src/prisma/prisma.service'),
      import('../src/modules/whale-holdings/whale-holdings.service'),
    ])

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    whaleHoldingsService = app.get(WhaleHoldingsService)

    // 清理历史测试数据，避免断言被污染
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should aggregate latest open whale positions per (user, symbol)', async () => {
    const client = prisma.getClient()

    const now = new Date()
    const minutes = (n: number) => new Date(now.getTime() - n * 60 * 1000)

    // 准备测试数据：
    // - user1/BTC: 先开仓再平仓 => 不应出现在当前持仓结果中
    // - user2/BTC: 仅开仓 => 应作为当前持仓返回
    // - user3/ETH: 仅开仓，名义价值较小 => 在较低 minPositionValueUsd 下才会返回
    await client.hyperliquidWhaleAlert.createMany({
      data: [
        {
          userAddress: '0xWhaleAddress1',
          symbol: 'BTC',
          positionSize: '10',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '500000', // 50w
          positionAction: 1, // 开仓
          createTime: minutes(30),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress1',
          symbol: 'BTC',
          positionSize: '0',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '0',
          positionAction: 2, // 平仓（最新一条，会被 DISTINCT 选中，然后在外层被过滤掉）
          createTime: minutes(10),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress2',
          symbol: 'BTC',
          positionSize: '20',
          entryPrice: '60000',
          liquidationPrice: '55000',
          positionValueUsd: '1200000', // 120w
          positionAction: 1, // 开仓
          createTime: minutes(5),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress3',
          symbol: 'ETH',
          positionSize: '5',
          entryPrice: '3000',
          liquidationPrice: '2500',
          positionValueUsd: '200000', // 20w
          positionAction: 1, // 开仓
          createTime: minutes(3),
          source: 'TEST',
        },
      ],
    })

    // 1）仅筛选 BTC，且设置较高的 minPositionValueUsd，只应命中 user2/BTC
    const btcHoldings = await whaleHoldingsService.getCurrentHoldings({
      symbol: 'BTC',
      minPositionValueUsd: 1_000_000,
      timeRangeHours: 24,
      limit: 10,
    })

    expect(btcHoldings.length).toBe(1)
    const btc = btcHoldings[0]
    expect(btc.userAddress).toBe('0xWhaleAddress2')
    expect(btc.symbol).toBe('BTC')
    expect(btc.positionValueUsd).toBe(1_200_000)
    expect(btc.side).toBe('LONG')

    // 2）不传 symbol，降低 minPositionValueUsd，应包含 BTC 与 ETH 两个地址
    const allHoldings = await whaleHoldingsService.getCurrentHoldings({
      minPositionValueUsd: 100_000,
      timeRangeHours: 24,
      limit: 10,
    })

    const addresses = allHoldings.map(h => `${h.userAddress}-${h.symbol}`).sort()
    expect(addresses).toEqual([
      '0xWhaleAddress2-BTC',
      '0xWhaleAddress3-ETH',
    ])
  })
})


