import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleAlertService } from '../src/modules/whale-alert/whale-alert.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'

let recentLongTime: Date
let recentShortTime: Date
let oldLongTime: Date

describe('Hyperliquid whale alert realtime API (service-level E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService

  beforeAll(async () => {
    // 确保在导入 AppModule/Prisma 之前就切到 e2e 环境，避免误连非测试库
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }
    if (process.env.APP_ENV !== 'e2e') {
      throw new Error(
        `Whale alert realtime E2E must run with APP_ENV="e2e" to avoid touching non-test databases, current: ${process.env.APP_ENV}`,
      )
    }

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境（ConfigModule/Prisma 会基于 cwd 解析 .env.e2e）
    process.chdir(resolve(__dirname, '../../..'))

    // 确保后续动态导入使用更新后的环境快照
    jest.resetModules()

    const [{ Test }, { AppModule }, { PrismaService }, { WhaleAlertService }] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/modules/app.module'),
      import('../src/prisma/prisma.service'),
      import('../src/modules/whale-alert/whale-alert.service'),
    ])

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    whaleAlertService = app.get(WhaleAlertService)

    // 清理历史测试数据，避免断言被污染
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should apply default filters and mapping correctly', async () => {
    const client = prisma.getClient()
    const now = new Date()

    recentLongTime = new Date(now.getTime() - 5 * 60 * 1000)
    recentShortTime = new Date(now.getTime() - 2 * 60 * 1000)
    oldLongTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // 插入多条不同条件的数据，覆盖默认过滤条件：
    // - 名义价值阈值（min_position_value_usd 默认 1_000_000）
    // - 时间窗口（默认最近 24 小时）
    await client.hyperliquidWhaleAlert.createMany({
      data: [
        // 最近的多头，名义价值 5,000,000（应被包含）
        {
          userAddress: '0xWhaleE2E1',
          symbol: 'E2E',
          positionSize: '10',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '5000000',
          positionAction: 1,
          createTime: recentLongTime,
          source: 'E2E',
        },
        // 最近的多头，但名义价值 200,000（低于默认阈值，应被过滤）
        {
          userAddress: '0xWhaleE2E2',
          symbol: 'E2E',
          positionSize: '2',
          entryPrice: '30000',
          liquidationPrice: '25000',
          positionValueUsd: '200000',
          positionAction: 1,
          createTime: recentShortTime,
          source: 'E2E',
        },
        // 最近的空头，名义价值 3,000,000（应被包含）
        {
          userAddress: '0xWhaleE2E3',
          symbol: 'E2E',
          positionSize: '-5',
          entryPrice: '3000',
          liquidationPrice: '2500',
          positionValueUsd: '3000000',
          positionAction: 2,
          createTime: recentShortTime,
          source: 'E2E',
        },
        // 很久之前的多头（超出默认 24 小时窗口，应被过滤）
        {
          userAddress: '0xWhaleE2E4',
          symbol: 'E2E',
          positionSize: '8',
          entryPrice: '45000',
          liquidationPrice: '40000',
          positionValueUsd: '7000000',
          positionAction: 1,
          createTime: oldLongTime,
          source: 'E2E',
        },
      ],
    })

    const result = await whaleAlertService.getRealtimeAlerts({
      symbol: 'E2E',
    })

    // 只应返回满足默认过滤条件的两条记录：E2E3 (空头) 和 E2E1 (多头)
    expect(result.length).toBe(2)

    // 按 create_time 倒序：最近的 ETH 在前，BTC 在后
    const [first, second] = result

    expect(first.user_address).toBe('0xWhaleE2E3')
    expect(first.symbol).toBe('E2E')
    expect(first.side).toBe('Short')
    expect(first.position_action).toBe(2)
    expect(first.position_value_usd).toBe(3_000_000)
    expect(new Date(first.create_time).toISOString()).toBe(recentShortTime.toISOString())

    expect(second.user_address).toBe('0xWhaleE2E1')
    expect(second.symbol).toBe('E2E')
    expect(second.side).toBe('Long')
    expect(second.position_action).toBe(1)
    expect(second.position_value_usd).toBe(5_000_000)
    expect(new Date(second.create_time).toISOString()).toBe(recentLongTime.toISOString())
  })

  it('should respect symbol filter and limit', async () => {
    const result = await whaleAlertService.getRealtimeAlerts({
      symbol: 'E2E',
      limit: 1,
    })

    expect(result.length).toBe(1)
    expect(result[0].symbol).toBe('E2E')
    // 最新的一条记录应为 E2E3（空头，时间更近）
    expect(result[0].user_address).toBe('0xWhaleE2E3')
  })

  it('should respect custom minPositionValueUsd', async () => {
    // 使用更高的阈值，并限制时间窗口仅覆盖最近一段时间，
    // 这样旧数据（E2E4）会被排除，只返回名义价值 >= 4,000,000 的记录（即 E2E1）
    const result = await whaleAlertService.getRealtimeAlerts({
      symbol: 'E2E',
      min_position_value_usd: 4_000_000,
      // 仅包含最近几分钟内的记录
      since: recentLongTime.toISOString(),
    })

    expect(result.length).toBe(1)
    expect(result[0].user_address).toBe('0xWhaleE2E1')
    expect(result[0].position_value_usd).toBeGreaterThanOrEqual(4_000_000)
  })
})


