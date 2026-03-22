import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { ExchangeLongShortTimeRange } from '../src/modules/markets/dto/requests/get-exchange-long-short-ratio.request.dto'
import type { ExchangeLongShortRatioResponseDto } from '../src/modules/markets/dto/responses/exchange-long-short-ratio.response.dto'

import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/modules/app.module'
import { ACGuard } from '../src/modules/auth/guards/ac.guard'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

describe('Markets HTTP - exchange long/short ratio snapshot (E2E)', () => {
  let app: INestApplication

  const originalCwd = process.cwd()

  beforeAll(async () => {
    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    ensureE2eEnv()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ACGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleFixture.createNestApplication()

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: errors => {
          const errorMessages = errors.map(err => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value,
          }))
          return new BadRequestException(errorMessages)
        },
      }),
    )

    app.setGlobalPrefix('api/v1')

    await app.init()
  })

  afterAll(async () => {
    process.chdir(originalCwd)
    if (app) {
      await app.close()
    }
  })

  it('should return deterministic and well-formed exchange long/short ratio snapshot via HTTP', async () => {
    const symbol = 'BTC'
    const timeRange: ExchangeLongShortTimeRange = '4h'

    const server = app.getHttpServer()

    const firstRes = await request(server)
      .get('/api/v1/markets/long-short-ratio/exchanges')
      .query({ symbol, timeRange })
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    const secondRes = await request(server)
      .get('/api/v1/markets/long-short-ratio/exchanges')
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
    const server = app.getHttpServer()

    const res = await request(server)
      .get('/api/v1/markets/long-short-ratio/exchanges')
      .query({ symbol: '  btc? ', timeRange: '4h' })
      .set('Authorization', 'Bearer test-token')
      .expect(400)

    expect(res.body).toBeTruthy()
  })
})
