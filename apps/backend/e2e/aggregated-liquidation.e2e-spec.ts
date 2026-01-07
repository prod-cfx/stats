import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'

import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'

import { AggregatedLiquidationService } from '../src/modules/aggregated-liquidation/aggregated-liquidation.service'
import { AppModule } from '../src/modules/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Aggregated liquidation service (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: AggregatedLiquidationService

  beforeAll(async () => {
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-jwt-secret'
    }

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    service = app.get(AggregatedLiquidationService)

    const client = prisma.getClient()

    // 清理 BTC 相关的聚合爆仓历史，避免受历史数据影响
    await client.aggregatedLiquidationHistory.deleteMany({
      where: {
        symbol: 'BTC',
      },
    })

    // 插入测试数据：
    // - interval = 1h: 仅 AGGREGATED 行，用于验证 summary 中聚合分支
    // - interval = 4h: 多交易所行，用于验证 summary 中汇总分支 & exchange breakdown
    const baseTime = new Date('2025-01-01T00:00:00Z')
    const t1hLatest = new Date(baseTime.getTime() + 60 * 60 * 1000)
    const t4hLatest = new Date(baseTime.getTime() + 4 * 60 * 60 * 1000)

    await client.aggregatedLiquidationHistory.createMany({
      data: [
        // 1h 聚合行（优先使用 AGGREGATED）
        {
          symbol: 'BTC',
          exchangeCode: 'AGGREGATED',
          interval: '1h',
          timestamp: t1hLatest,
          longLiquidationUsd: '100',
          shortLiquidationUsd: '50',
          source: 'TEST',
        },
        // 4h 多交易所行（不包含 AGGREGATED），用于验证求和逻辑
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
      ],
      skipDuplicates: true,
    })
  })

  afterAll(async () => {
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

    // 4h: 对 BINANCE + OKX 行求和
    expect(item4h?.longUsd).toBe(200 + 150)
    expect(item4h?.shortUsd).toBe(80 + 70)
    expect(item4h?.totalUsd).toBe(200 + 150 + 80 + 70)
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

    const binance = breakdown.rows.find(row => row.exchange === 'BINANCE')
    const okx = breakdown.rows.find(row => row.exchange === 'OKX')

    expect(binance).toBeDefined()
    expect(okx).toBeDefined()

    expect(binance?.longUsd).toBe(200)
    expect(binance?.shortUsd).toBe(80)
    expect(okx?.longUsd).toBe(150)
    expect(okx?.shortUsd).toBe(70)
  })
})







