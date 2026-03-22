import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'

import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/modules/app.module'
import { ACGuard } from '../src/modules/auth/guards/ac.guard'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

describe('Markets HTTP - ticker (E2E)', () => {
  let app: INestApplication

  const originalCwd = process.cwd()

  beforeAll(async () => {
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

  it('should return well-formed ticker via HTTP, including optional high24h/low24h', async () => {
    const server = app.getHttpServer()

    const res = await request(server)
      .get('/api/v1/markets/ticker')
      .query({ symbol: 'BTC', exchange: 'Binance' })
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    expect(res.body).toBeTruthy()
    expect(typeof res.body).toBe('object')

    const data = (res.body as { data?: unknown }).data
    if (data == null) {
      return
    }

    expect(typeof data).toBe('object')

    const ticker = data as Record<string, unknown>
    expect(ticker.symbol).toBeTruthy()
    expect(typeof ticker.symbol).toBe('string')

    const exchange = ticker.exchange
    expect(exchange === undefined || typeof exchange === 'string').toBe(true)

    expect(typeof ticker.currentPrice).toBe('string')

    const high24h = ticker.high24h
    expect(high24h === undefined || typeof high24h === 'string').toBe(true)

    const low24h = ticker.low24h
    expect(low24h === undefined || typeof low24h === 'string').toBe(true)
  })
})
