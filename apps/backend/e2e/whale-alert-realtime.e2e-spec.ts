import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleAlertService } from '../src/modules/whale-alert/whale-alert.service'
import type { PrismaService } from '../src/prisma/prisma.service'

import { ensureE2eEnv } from './helpers/setup-e2e-env'

jest.setTimeout(180_000)

let recentLongTime: Date
let recentShortTime: Date
let oldLongTime: Date

describe('Hyperliquid whale alert realtime API (service-level E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService

  beforeAll(async () => {
    ensureE2eEnv({ strict: true, label: 'WhaleAlertRealtime' })

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

    // 默认 min_position_value_usd=1000，应返回 E2E1/E2E2/E2E3（E2E4 超时窗被过滤）
    expect(result.length).toBe(3)
    expect(result.map(item => item.user_address).sort()).toEqual([
      '0xWhaleE2E1',
      '0xWhaleE2E2',
      '0xWhaleE2E3',
    ])
  })

  it('should respect symbol filter and limit', async () => {
    const client = prisma.getClient()
    const now = new Date()
    await client.hyperliquidWhaleAlert.deleteMany({})
    await client.hyperliquidWhaleAlert.createMany({
      data: [
        {
          userAddress: '0xWhaleE2E1',
          symbol: 'E2E',
          positionSize: '10',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '5000000',
          positionAction: 1,
          createTime: new Date(now.getTime() - 5 * 60 * 1000),
          source: 'E2E',
        },
        {
          userAddress: '0xWhaleE2E3',
          symbol: 'E2E',
          positionSize: '-5',
          entryPrice: '3000',
          liquidationPrice: '2500',
          positionValueUsd: '3000000',
          positionAction: 2,
          createTime: new Date(now.getTime() - 2 * 60 * 1000),
          source: 'E2E',
        },
      ],
    })

    const result = await whaleAlertService.getRealtimeAlerts({
      symbol: 'E2E',
      min_position_value_usd: 1_000_000,
      limit: 1,
    })

    expect(result.length).toBe(1)
    expect(result[0].symbol).toBe('E2E')
    // 在 >=1,000,000 阈值下，最新一条应为 E2E3（空头，时间更近）
    expect(result[0].user_address).toBe('0xWhaleE2E3')
  })

  it('should respect custom minPositionValueUsd', async () => {
    const client = prisma.getClient()
    const localSince = new Date(Date.now() - 10 * 60 * 1000)
    await client.hyperliquidWhaleAlert.deleteMany({})
    await client.hyperliquidWhaleAlert.create({
      data: {
        userAddress: '0xWhaleE2E1',
        symbol: 'E2E',
        positionSize: '10',
        entryPrice: '50000',
        liquidationPrice: '45000',
        positionValueUsd: '5000000',
        positionAction: 1,
        createTime: localSince,
        source: 'E2E',
      },
    })

    // 使用更高的阈值，并限制时间窗口仅覆盖最近一段时间，
    // 这样旧数据（E2E4）会被排除，只返回名义价值 >= 4,000,000 的记录（即 E2E1）
    const result = await whaleAlertService.getRealtimeAlerts({
      symbol: 'E2E',
      min_position_value_usd: 4_000_000,
      // 仅包含最近几分钟内的记录
      since: localSince.toISOString(),
    })

    expect(result.length).toBe(1)
    expect(result[0].user_address).toBe('0xWhaleE2E1')
    expect(result[0].position_value_usd).toBeGreaterThanOrEqual(4_000_000)
  })
})



