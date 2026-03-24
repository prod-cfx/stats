import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { QuantifyAiQuantClient } from '@/modules/ai-quant-proxy/clients/quantify-ai-quant.client'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('AI Quant proxy HTTP (E2E)', () => {
  let app: INestApplication
  let quantifyClient: {
    get: jest.Mock
    post: jest.Mock
    patch: jest.Mock
    delete: jest.Mock
  }

  beforeAll(async () => {
    quantifyClient = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    }

    const ctx = await createTestingApp({
      envDefaults: {
        JWT_SECRET: 'test-jwt-secret',
      },
      onBeforeInit: builder => builder
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            const req = context.switchToHttp().getRequest()
            req.user = {
              id: 'e2e-user-id',
              email: 'e2e-user@example.com',
              roles: [],
              principalType: 'user',
            }
            return true
          },
        })
        .overrideProvider(QuantifyAiQuantClient)
        .useValue(quantifyClient),
    })

    app = ctx.app
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should ignore client-supplied userId when listing account strategies', async () => {
    quantifyClient.get.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const api = createApiClient(app)

    await api.get('/account/ai-quant/strategies')
      .query({ userId: 'forged-user-id', page: 1, limit: 20, status: 'running' })
      .set('Authorization', 'Bearer test-token')
      .expect(200)

    expect(quantifyClient.get).toHaveBeenCalledWith(
      '/account/ai-quant/strategies?userId=e2e-user-id&page=1&limit=20&status=running',
      { headers: { 'x-user-id': 'e2e-user-id' } },
    )
  })

  it('should inject authenticated user id into codegen session creation', async () => {
    quantifyClient.post.mockResolvedValue({
      id: 'session-1',
      status: 'CHECKLIST_GATE',
    })

    const api = createApiClient(app)

    await api.post('/llm-strategy-codegen/sessions')
      .set('Authorization', 'Bearer test-token')
      .send({
        userId: 'forged-user-id',
        initialMessage: 'build me a strategy',
        symbols: ['BTCUSDT'],
      })
      .expect(201)

    expect(quantifyClient.post).toHaveBeenCalledWith('/llm-strategy-codegen/sessions', {
      userId: 'e2e-user-id',
      initialMessage: 'build me a strategy',
      symbols: ['BTCUSDT'],
    })
  })
})
