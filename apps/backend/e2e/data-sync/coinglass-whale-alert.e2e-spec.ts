import type { INestApplication } from '@nestjs/common'

import { CoinglassWhaleAlertJob } from '@/modules/data-sync/jobs/coinglass-whale-alert.job'
import { PrismaService } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'
import { getE2eEnvValue } from '../helpers/setup-e2e-env'

jest.setTimeout(180_000)

describe('Coinglass Hyperliquid whale alert data-pull job (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let job: CoinglassWhaleAlertJob

  beforeAll(async () => {
    const ctx = await createTestingApp({
      envDefaults: { COINGLASS_API_KEY: 'test-api-key' },
    })
    app = ctx.app

    prisma = app.get(PrismaService)
    job = app.get(CoinglassWhaleAlertJob)

    // 清理历史测试数据，避免断言被污染
    await prisma.hyperliquidWhaleAlert.deleteMany({})
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should fetch whale alerts (via mocked API) and persist to database correctly', async () => {
    await prisma.hyperliquidWhaleAlert.deleteMany({})

    const nowSeconds = Math.floor(Date.now() / 1000)
    const mockData = [
      {
        user: '0xWhaleAddress1',
        symbol: 'BTC',
        position_size: 123.456,
        entry_price: 50000,
        liq_price: 45000,
        position_value_usd: 6172800,
        position_action: 1, // 开仓
        // 使用秒级时间戳，验证 job 中的毫秒转换逻辑
        create_time: nowSeconds - 60,
      },
      {
        user: '0xWhaleAddress2',
        symbol: 'ETH',
        position_size: -10.5,
        entry_price: 3000,
        liq_price: 2500,
        position_value_usd: 31500,
        position_action: 2, // 平仓
        create_time: nowSeconds - 30,
      },
    ]

    const mockResponse = {
      code: '0',
      msg: 'ok',
      data: mockData,
    }

    // 直接 mock 私有的 fetchWhaleAlertJson，避免真正访问外网
    const spy = jest.spyOn(job as any, 'fetchWhaleAlertJson').mockResolvedValue(mockResponse as any)

    try {
      const result = await job.run({ cursor: null })

      // 1）Job 运行结果基础断言
      expect(result.fetchedCount).toBe(2)
      expect(result.newCursor).toBeTruthy()
      expect(typeof result.meta).toBe('object')

      const parsedCursor = JSON.parse(result.newCursor as string) as { lastTimestamp?: number }
      expect(typeof parsedCursor.lastTimestamp).toBe('number')
      // cursor 应该记录最新的时间戳（秒级被转换为毫秒）
      const expectedLatestMs = mockData
        .map(p => (p.create_time >= 1_000_000_000_000 ? p.create_time : p.create_time * 1000))
        .reduce((a, b) => Math.max(a, b), 0)
      expect(parsedCursor.lastTimestamp).toBe(expectedLatestMs)

      // meta 中的统计字段
      const meta = result.meta as any
      expect(meta.apiDataCount).toBe(2)
      expect(meta.insertedCount).toBe(2)
      expect(meta.stats).toEqual({
        longPositions: 1,
        shortPositions: 1,
        openActions: 1,
        closeActions: 1,
      })

      // 2）数据库数据断言（确认映射 & 幂等键逻辑）
      const rows = await prisma.hyperliquidWhaleAlert.findMany({
        where: {
          source: 'COINGLASS',
          userAddress: { in: mockData.map(item => item.user) },
          symbol: { in: mockData.map(item => item.symbol) },
        },
        orderBy: { createTime: 'asc' },
      })

      expect(rows.length).toBe(2)

      const [row1, row2] = rows

      // 第一条：多头开仓
      expect(row1.userAddress).toBe(mockData[0].user)
      expect(row1.symbol).toBe(mockData[0].symbol)
      expect(row1.positionSize.toString()).toBe(mockData[0].position_size.toString())
      expect(row1.entryPrice.toString()).toBe(mockData[0].entry_price.toString())
      expect(row1.liquidationPrice.toString()).toBe(mockData[0].liq_price.toString())
      expect(row1.positionValueUsd.toString()).toBe(mockData[0].position_value_usd.toString())
      expect(row1.positionAction).toBe(mockData[0].position_action)
      expect(row1.createTime.getTime()).toBe(
        (mockData[0].create_time >= 1_000_000_000_000
          ? mockData[0].create_time
          : mockData[0].create_time * 1000),
      )
      expect(row1.source).toBe('COINGLASS')

      // 第二条：空头平仓
      expect(row2.userAddress).toBe(mockData[1].user)
      expect(row2.symbol).toBe(mockData[1].symbol)
      expect(row2.positionSize.toString()).toBe(mockData[1].position_size.toString())
      expect(row2.entryPrice.toString()).toBe(mockData[1].entry_price.toString())
      expect(row2.liquidationPrice.toString()).toBe(mockData[1].liq_price.toString())
      expect(row2.positionValueUsd.toString()).toBe(mockData[1].position_value_usd.toString())
      expect(row2.positionAction).toBe(mockData[1].position_action)
      expect(row2.createTime.getTime()).toBe(
        (mockData[1].create_time >= 1_000_000_000_000
          ? mockData[1].create_time
          : mockData[1].create_time * 1000),
      )
      expect(row2.source).toBe('COINGLASS')

      // 3）确认内部 HTTP 封装被调用了一次，且传入了正确的 API key
      expect(spy).toHaveBeenCalledTimes(1)
      const [urlArg, apiKeyArg] = spy.mock.calls[0]
      expect(String(urlArg)).toContain('/hyperliquid/whale-alert')
      expect(apiKeyArg).toBe(getE2eEnvValue('COINGLASS_API_KEY'))
    } finally {
      spy.mockRestore()
    }
  })
})
