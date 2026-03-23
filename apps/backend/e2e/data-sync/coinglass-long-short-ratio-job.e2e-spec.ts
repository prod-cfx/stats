import type { INestApplication } from '@nestjs/common'
import type { DataPullJobContext } from '@/modules/data-sync/contracts/data-pull-job'

import { CoinglassLongShortRatioJob } from '@/modules/data-sync/jobs/coinglass-long-short-ratio.job'
import { PrismaService } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

describe('Coinglass long/short ratio job (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let job: CoinglassLongShortRatioJob

  const originalFetch: typeof fetch | undefined = (globalThis as any).fetch

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { COINGLASS_API_KEY: 'test-coinglass-api-key' },
    })
    app = ctx.app

    prisma = app.get(PrismaService)
    job = app.get(CoinglassLongShortRatioJob)

    // 清理测试相关数据，避免受历史数据影响
    await prisma.longShortRatio.deleteMany({
      where: {
        tradingPairId: 'BTCUSDT.BINANCE.PERP',
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

  it('should insert long/short ratios and update cursor incrementally', async () => {

    // 模拟 Coinglass 全局多空账户比返回的两条数据（时间戳单位毫秒）
    const firstPointTime = 1_700_000_000_000
    const secondPointTime = 1_700_000_360_000

    const mockResponseBody = {
      code: '0',
      msg: 'success',
      data: [
        {
          time: firstPointTime,
          global_account_long_percent: 70.12,
          global_account_short_percent: 29.88,
          global_account_long_short_ratio: 2.35,
        },
        {
          time: secondPointTime,
          global_account_long_percent: 72.34,
          global_account_short_percent: 27.66,
          global_account_long_short_ratio: 2.61,
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
      tradingPairId: string
      symbol: string
      interval: string
      lastTimestamp: number
    }

    expect(cursor1.tradingPairId).toBe('BTCUSDT.BINANCE.PERP')
    expect(cursor1.symbol).toBe('BTCUSDT')
    expect(cursor1.interval).toBe('4h')
    expect(cursor1.lastTimestamp).toBe(secondPointTime)

    const rowsAfterFirstRun = await prisma.longShortRatio.findMany({
      where: {
        tradingPairId: 'BTCUSDT.BINANCE.PERP',
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    expect(rowsAfterFirstRun.length).toBe(2)
    expect(rowsAfterFirstRun[0].timestamp.getTime()).toBe(firstPointTime)
    expect(rowsAfterFirstRun[1].timestamp.getTime()).toBe(secondPointTime)
    expect(rowsAfterFirstRun[0].longShortRatio.toString()).toBe('2.35')
    expect(rowsAfterFirstRun[0].longAccountRatio?.toString()).toBe('70.12')
    expect(rowsAfterFirstRun[0].shortAccountRatio?.toString()).toBe('29.88')
    expect(rowsAfterFirstRun[1].longShortRatio.toString()).toBe('2.61')
    expect(rowsAfterFirstRun[1].longAccountRatio?.toString()).toBe('72.34')
    expect(rowsAfterFirstRun[1].shortAccountRatio?.toString()).toBe('27.66')

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

    const rowsAfterSecondRun = await prisma.longShortRatio.findMany({
      where: {
        tradingPairId: 'BTCUSDT.BINANCE.PERP',
      },
    })

    expect(rowsAfterSecondRun.length).toBe(2)
  })
})
