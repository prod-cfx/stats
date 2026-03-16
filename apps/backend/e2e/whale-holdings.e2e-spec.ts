import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleHoldingsService } from '../src/modules/whale-holdings/whale-holdings.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'

jest.setTimeout(180_000)

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
    await client.hyperliquidWhalePosition.deleteMany({})
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

    // 准备测试数据（HyperliquidWhalePosition 使用 (userAddress, symbol) 唯一约束）：
    // - user1/BTC: 持仓价值 500k（低于 1M 阈值）
    // - user2/BTC: 持仓价值 1.2M（高于 1M 阈值）
    // - user3/ETH: 持仓价值 200k（低于 1M 但高于 100k 阈值）
    await client.hyperliquidWhalePosition.createMany({
      data: [
        {
          userAddress: '0xWhaleAddress1',
          symbol: 'BTC',
          positionSize: '10',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '500000', // 50w - below 1M threshold
          pnl: '5000',
          roe: '0.01',
          snapshotTime: minutes(30),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress2',
          symbol: 'BTC',
          positionSize: '20',
          entryPrice: '60000',
          liquidationPrice: '55000',
          positionValueUsd: '1200000', // 120w - above 1M threshold
          pnl: '50000',
          roe: '0.04',
          snapshotTime: minutes(5),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress3',
          symbol: 'ETH',
          positionSize: '5',
          entryPrice: '3000',
          liquidationPrice: '2500',
          positionValueUsd: '200000', // 20w - below 1M but above 100k
          pnl: '-1000',
          roe: '-0.005',
          snapshotTime: minutes(3),
          source: 'TEST',
        },
      ],
    })

    // 1）仅筛选 BTC，且设置较高的 minPositionValueUsd，只应命中 user2/BTC
    const btcHoldings = await whaleHoldingsService.getCurrentHoldings({
      symbol: 'BTC',
      minPositionValueUsd: 1_000_000,
      limit: 10,
    })

    expect(btcHoldings.length).toBe(1)
    const btc = btcHoldings[0]
    expect(btc.userAddress).toBe('0xWhaleAddress2')
    expect(btc.symbol).toBe('BTC')
    expect(btc.positionValueUsd).toBe(1_200_000)
    expect(btc.side).toBe('LONG')

    // 2）不传 symbol，minPositionValueUsd=100k 时应包含三条记录
    const allHoldings = await whaleHoldingsService.getCurrentHoldings({
      minPositionValueUsd: 100_000,
      limit: 10,
    })

    const addresses = allHoldings.map(h => `${h.userAddress}-${h.symbol}`).sort()
    expect(addresses).toEqual([
      '0xWhaleAddress1-BTC',
      '0xWhaleAddress2-BTC',
      '0xWhaleAddress3-ETH',
    ])
  })
})





