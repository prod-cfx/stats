import type { INestApplication } from '@nestjs/common'

import { ACGuard } from '@/modules/auth/guards/ac.guard'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('Markets HTTP - ticker (E2E)', () => {
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

  it('should return well-formed ticker via HTTP, including optional high24h/low24h', async () => {
    const api = createApiClient(app)

    const res = await api.get('/markets/ticker')
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
