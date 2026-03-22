import type { INestApplication } from '@nestjs/common'
import type { WhaleTrackingService } from '@/modules/whale-tracking/whale-tracking.service'
import type { PrismaService } from '@/prisma/prisma.service'
import { WhaleTrackingService as WhaleTrackingServiceToken } from '@/modules/whale-tracking/whale-tracking.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

jest.setTimeout(180_000)

describe('WhaleTrackingService - trader performance (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleTrackingService: WhaleTrackingService

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    whaleTrackingService = app.get(WhaleTrackingServiceToken)

    // 清理历史测试数据，避免断言被污染
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should aggregate trader performance by address within lookback window', async () => {
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})

    const now = new Date()
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

    // 为地址 0xWhaleAddressPerf1 准备若干条预警数据：
    // - BTC: 多空各一条
    // - ETH: 多头一条
    // - 其中一条超出 timeRangeDays 窗口，应被排除
    await client.hyperliquidWhaleAlert.createMany({
      data: [
        {
          userAddress: '0xWhaleAddressPerf1',
          symbol: 'BTC',
          positionSize: '10', // 多头
          entryPrice: '60000',
          liquidationPrice: '55000',
          positionValueUsd: '600000',
          positionAction: 1,
          createTime: daysAgo(3),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddressPerf1',
          symbol: 'BTC',
          positionSize: '-5', // 空头
          entryPrice: '58000',
          liquidationPrice: '62000',
          positionValueUsd: '290000',
          positionAction: 2,
          createTime: daysAgo(2),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddressPerf1',
          symbol: 'ETH',
          positionSize: '20',
          entryPrice: '3000',
          liquidationPrice: '2600',
          positionValueUsd: '60000',
          positionAction: 1,
          createTime: daysAgo(1),
          source: 'TEST',
        },
        // 超出窗口的旧记录，应不计入统计
        {
          userAddress: '0xWhaleAddressPerf1',
          symbol: 'BTC',
          positionSize: '1',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '5000',
          positionAction: 1,
          createTime: daysAgo(40),
          source: 'TEST',
        },
      ],
    })

    const result = await whaleTrackingService.getTraderPerformance('0xWhaleAddressPerf1', {
      timeRangeDays: 30,
      limit: 10,
    })

    expect(result.summary.address).toBe('0xWhaleAddressPerf1')
    expect(result.summary.lookbackDays).toBe(30)
    // 仅统计窗口内的 3 条记录
    expect(result.summary.trades).toBe(3)
    expect(result.summary.positions).toBe(2)

    // 名义价值合计应为窗口内三条记录之和
    expect(result.summary.totalValueUsd).toBeCloseTo(600000 + 290000 + 60000, 2)

    // 多空计数
    expect(result.summary.longCount).toBe(2)
    expect(result.summary.shortCount).toBe(1)

    // byAsset 聚合：BTC/ETH 各一条
    const symbols = result.byAsset.map(a => a.symbol).sort()
    expect(symbols).toEqual(['BTC', 'ETH'])

    const btc = result.byAsset.find(a => a.symbol === 'BTC')
    expect(btc?.trades).toBe(2)
    expect(btc?.totalValueUsd).toBeCloseTo(600000 + 290000, 2)

    const eth = result.byAsset.find(a => a.symbol === 'ETH')
    expect(eth?.trades).toBe(1)
    expect(eth?.totalValueUsd).toBeCloseTo(60000, 2)

    // trades 明细应按时间倒序，且数量不超过 limit
    expect(result.trades.length).toBeLessThanOrEqual(10)
    if (result.trades.length > 1) {
      const times = result.trades.map(t => new Date(t.createTime).getTime())
      const sorted = [...times].sort((a, b) => b - a)
      expect(times).toEqual(sorted)
    }
  })

  it('should support symbol filter', async () => {
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})
    const now = new Date()
    await client.hyperliquidWhaleAlert.createMany({
      data: [
        {
          userAddress: '0xWhaleAddressPerf1',
          symbol: 'BTC',
          positionSize: '10',
          entryPrice: '60000',
          liquidationPrice: '55000',
          positionValueUsd: '600000',
          positionAction: 1,
          createTime: now,
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddressPerf1',
          symbol: 'BTC',
          positionSize: '-5',
          entryPrice: '58000',
          liquidationPrice: '62000',
          positionValueUsd: '290000',
          positionAction: 2,
          createTime: new Date(now.getTime() - 60 * 1000),
          source: 'TEST',
        },
      ],
    })

    const result = await whaleTrackingService.getTraderPerformance('0xWhaleAddressPerf1', {
      timeRangeDays: 30,
      symbol: 'BTC',
      limit: 10,
    })

    expect(result.summary.symbolFilter).toBe('BTC')
    expect(result.summary.trades).toBe(2)
    expect(result.summary.positions).toBe(1)

    expect(result.byAsset.length).toBe(1)
    expect(result.byAsset[0].symbol).toBe('BTC')

    const tradeSymbols = Array.from(new Set(result.trades.map(t => t.symbol)))
    expect(tradeSymbols).toEqual(['BTC'])
  })
})
