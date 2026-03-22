import type { INestApplication } from '@nestjs/common'
import type { ExchangeLongShortTimeRange } from '@/modules/markets/dto/requests/get-exchange-long-short-ratio.request.dto'
import type { ExchangeLongShortRatioResponseDto } from '@/modules/markets/dto/responses/exchange-long-short-ratio.response.dto'

import { ACGuard } from '@/modules/auth/guards/ac.guard'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('Markets HTTP - exchange long/short ratio snapshot (E2E)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const ctx = await createTestingApp({
      onBeforeInit: builder => builder
        .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
        .overrideGuard(ACGuard).useValue({ canActivate: () => true }),
    })
    app = ctx.app
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should return deterministic and well-formed exchange long/short ratio snapshot via HTTP', async () => {
    const symbol = 'BTC'
    const timeRange: ExchangeLongShortTimeRange = '4h'

    const api = createApiClient(app)

    const firstRes = await api.get('/markets/long-short-ratio/exchanges')
      .query({ symbol, timeRange })
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const secondRes = await api.get('/markets/long-short-ratio/exchanges')
      .query({ symbol, timeRange })
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const firstBody = firstRes.body as { data: ExchangeLongShortRatioResponseDto[] }
    const secondBody = secondRes.body as { data: ExchangeLongShortRatioResponseDto[] }

    const first = firstBody.data
    const second = secondBody.data

    expect(first.length).toBeGreaterThanOrEqual(5)

    // 应包含特定的核心交易所（数据来自 TakerBuySellVolume 表）
    const names = first.map(item => item.name)
    expect(names).toContain('Binance')

    // rank 应从 1 开始递增
    const ranks = first.map(item => item.rank)
    expect(Math.min(...ranks)).toBe(1)

    // 按总持仓金额从高到低排序
    const totals = first.map(item => item.longAmountUsd + item.shortAmountUsd)
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i]).toBeLessThanOrEqual(totals[i - 1])
    }

    // 每个条目的多空占比和金额应在合理范围内
    for (const item of first) {
      expect(item.longAmountUsd).toBeGreaterThan(0)
      expect(item.shortAmountUsd).toBeGreaterThan(0)

      const sumPercent = item.longPercent + item.shortPercent
      expect(sumPercent).toBeGreaterThanOrEqual(99.9)
      expect(sumPercent).toBeLessThanOrEqual(100.1)
    }

    // 相同参数下结果应保持确定性
    expect(second).toEqual(first)
  })

  it('should reject invalid symbol with validation error', async () => {
    const api = createApiClient(app)

    const res = await api.get('/markets/long-short-ratio/exchanges')
      .query({ symbol: '  btc? ', timeRange: '4h' })
      .set('Authorization', 'Bearer test-token')
      .expect(400)

    expect(res.body).toBeTruthy()
  })
})
