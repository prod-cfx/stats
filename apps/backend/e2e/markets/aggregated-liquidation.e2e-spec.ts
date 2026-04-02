import type { INestApplication } from '@nestjs/common'

import { AggregatedLiquidationService } from '@/modules/aggregated-liquidation/aggregated-liquidation.service'
import { PrismaService } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

type AggregatedLiquidationHistorySeedData = Parameters<PrismaService['aggregatedLiquidationHistory']['createMany']>[0]['data']

function buildAggregatedLiquidationHistorySeedData(baseTime: Date): AggregatedLiquidationHistorySeedData {
  const t1hLatest = new Date(baseTime.getTime() + 60 * 60 * 1000)
  const t4hLatest = new Date(baseTime.getTime() + 4 * 60 * 60 * 1000)

  return [
    {
      symbol: 'BTC',
      exchangeCode: 'AGGREGATED',
      interval: '1h',
      timestamp: t1hLatest,
      longLiquidationUsd: '100',
      shortLiquidationUsd: '50',
      source: 'TEST',
    },
    {
      symbol: 'BTC',
      exchangeCode: 'AGGREGATED',
      interval: '4h',
      timestamp: t4hLatest,
      longLiquidationUsd: '9999',
      shortLiquidationUsd: '8888',
      source: 'TEST',
    },
    {
      symbol: 'BTC',
      exchangeCode: 'BINANCE',
      interval: '4h',
      timestamp: t4hLatest,
      longLiquidationUsd: '200',
      shortLiquidationUsd: '80',
      source: 'TEST',
    },
    {
      symbol: 'BTC',
      exchangeCode: 'OKX',
      interval: '4h',
      timestamp: t4hLatest,
      longLiquidationUsd: '150',
      shortLiquidationUsd: '70',
      source: 'TEST',
    },
  ]
}

const seedAggregatedLiquidationHistory = async (prisma: PrismaService, data: AggregatedLiquidationHistorySeedData) => {
  await prisma.aggregatedLiquidationHistory.createMany({
    data,
    skipDuplicates: true,
  })
}

describe('Aggregated liquidation service (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: AggregatedLiquidationService

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { JWT_SECRET: 'test-jwt-secret' },
    })
    app = ctx.app

    prisma = app.get(PrismaService)
    service = app.get(AggregatedLiquidationService)


    // 仅清理本测试写入的 BTC 聚合爆仓历史，避免影响真实业务数据
    await prisma.aggregatedLiquidationHistory.deleteMany({
      where: {
        symbol: 'BTC',
        source: 'TEST',
      },
    })

    // 插入测试数据：
    // - interval = 1h: 仅 AGGREGATED 行，用于验证 summary 中聚合分支
    // - interval = 4h: 同时包含 AGGREGATED 行和多交易所行，用于验证 summary 汇总分支 & exchange breakdown 过滤聚合行
    const baseTime = new Date('2025-01-01T00:00:00Z')
    await seedAggregatedLiquidationHistory(
      prisma,
      buildAggregatedLiquidationHistorySeedData(baseTime),
    )
  })

  afterAll(async () => {
    if (prisma) {
      // 清理本测试写入的数据，避免污染后续真实环境或其他用例
      await prisma.aggregatedLiquidationHistory.deleteMany({
        where: {
          symbol: 'BTC',
          source: 'TEST',
        },
      })
    }

    if (app) {
      await app.close()
    }
  })

  it('should aggregate summary for BTC across 1h/4h intervals', async () => {
    const summary = await service.getSummary('BTC')

    expect(summary.symbol).toBe('BTC')
    expect(Array.isArray(summary.items)).toBe(true)
    expect(summary.items.length).toBeGreaterThan(0)

    const item1h = summary.items.find(item => item.timeframe === '1h')
    const item4h = summary.items.find(item => item.timeframe === '4h')

    expect(item1h).toBeDefined()
    expect(item4h).toBeDefined()

    // 1h: 直接使用 AGGREGATED 行
    expect(item1h?.longUsd).toBe(100)
    expect(item1h?.shortUsd).toBe(50)
    expect(item1h?.totalUsd).toBe(150)

    // 4h: summary 存在 AGGREGATED 行时优先使用该行
    expect(item4h?.longUsd).toBe(9999)
    expect(item4h?.shortUsd).toBe(8888)
    expect(item4h?.totalUsd).toBe(9999 + 8888)
  })

  it('should return exchange breakdown with TOTAL row for BTC 4h', async () => {
    const breakdown = await service.getExchangeBreakdown('BTC', '4h')

    expect(breakdown.symbol).toBe('BTC')
    expect(breakdown.timeframe).toBe('4h')
    expect(Array.isArray(breakdown.rows)).toBe(true)
    expect(breakdown.rows.length).toBeGreaterThan(0)

    const totalRow = breakdown.rows[0]
    expect(totalRow.isTotal).toBe(true)
    expect(totalRow.exchange).toBe('TOTAL')

    const expectedLong = 200 + 150
    const expectedShort = 80 + 70
    const expectedTotal = expectedLong + expectedShort

    expect(totalRow.longUsd).toBe(expectedLong)
    expect(totalRow.shortUsd).toBe(expectedShort)
    expect(totalRow.amountUsd).toBe(expectedTotal)
    expect(totalRow.longShare).toBeCloseTo(expectedLong / expectedTotal, 6)

    const aggregated = breakdown.rows.find(row => row.exchange === 'AGGREGATED')
    const binance = breakdown.rows.find(row => row.exchange === 'BINANCE')
    const okx = breakdown.rows.find(row => row.exchange === 'OKX')

    expect(aggregated).toBeUndefined()
    expect(binance).toBeDefined()
    expect(okx).toBeDefined()

    expect(binance?.longUsd).toBe(200)
    expect(binance?.shortUsd).toBe(80)
    expect(okx?.longUsd).toBe(150)
    expect(okx?.shortUsd).toBe(70)
  })
})
