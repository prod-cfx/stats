import type { INestApplication } from '@nestjs/common'
import type { DataPullJobContext } from '@/modules/data-sync/contracts/data-pull-job'

import { CoinglassAggregatedLiquidationJob } from '@/modules/data-sync/jobs/coinglass-aggregated-liquidation.job'
import { PrismaService } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

describe('Coinglass aggregated liquidation history job (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let job: CoinglassAggregatedLiquidationJob

  const originalFetch: typeof fetch | undefined = (globalThis as any).fetch

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { COINGLASS_API_KEY: 'test-coinglass-api-key' },
    })
    app = ctx.app

    prisma = app.get(PrismaService)
    job = app.get(CoinglassAggregatedLiquidationJob)

    // 清理测试相关数据，避免受历史数据影响
    const client = prisma.getClient()
    await client.aggregatedLiquidationHistory.deleteMany({
      where: {
        symbol: 'BTC',
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

  it('should insert aggregated liquidation history and update cursor incrementally', async () => {
    const client = prisma.getClient()

    // 模拟 Coinglass 聚合爆仓历史返回的两条数据（时间戳单位毫秒）
    const firstPointTime = 1_700_000_000_000
    const secondPointTime = 1_700_000_360_000

    const mockResponseBody = {
      code: '0',
      msg: 'success',
      data: [
        {
          time: firstPointTime,
          aggregated_long_liquidation_usd: 100,
          aggregated_short_liquidation_usd: 50,
        },
        {
          time: secondPointTime,
          aggregated_long_liquidation_usd: 200,
          aggregated_short_liquidation_usd: 80,
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

    // 第一次执行：从 null cursor 开始，应插入两条记录，并将 cursor 推进到最新时间点
    const result1 = await job.run({
      ...baseCtx,
      cursor: null,
    })

    expect(fetchCallCount).toBe(1)
    expect(result1.fetchedCount).toBe(2)
    expect(result1.newCursor).toBeDefined()

    const cursor1 = JSON.parse(result1.newCursor as string) as {
      symbol: string
      exchangeCode: string
      interval: string
      lastTimestamp: number
    }

    expect(cursor1.symbol).toBe('BTC')
    expect(cursor1.interval).toBe('4h')
    expect(cursor1.lastTimestamp).toBe(secondPointTime)

    const rowsAfterFirstRun = await client.aggregatedLiquidationHistory.findMany({
      where: {
        symbol: 'BTC',
        exchangeCode: cursor1.exchangeCode,
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    expect(rowsAfterFirstRun.length).toBe(2)
    expect(rowsAfterFirstRun[0].timestamp.getTime()).toBe(firstPointTime)
    expect(rowsAfterFirstRun[1].timestamp.getTime()).toBe(secondPointTime)
    expect(rowsAfterFirstRun[0].longLiquidationUsd.toString()).toBe('100')
    expect(rowsAfterFirstRun[0].shortLiquidationUsd.toString()).toBe('50')
    expect(rowsAfterFirstRun[1].longLiquidationUsd.toString()).toBe('200')
    expect(rowsAfterFirstRun[1].shortLiquidationUsd.toString()).toBe('80')

    // 第二次执行：使用第一次返回的 cursor，再次返回相同数据，应不再插入新记录
    ;(globalThis as any).fetch = jest.fn(async () => {
      fetchCallCount += 1
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponseBody,
      } as any
    })

    const result2 = await job.run({
      ...baseCtx,
      cursor: (result1.newCursor as string | null) ?? null,
    })

    expect(fetchCallCount).toBe(2)
    expect(result2.fetchedCount).toBe(0)

    const rowsAfterSecondRun = await client.aggregatedLiquidationHistory.findMany({
      where: {
        symbol: 'BTC',
        exchangeCode: cursor1.exchangeCode,
      },
    })

    expect(rowsAfterSecondRun.length).toBe(2)
  })
})
