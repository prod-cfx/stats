import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { QuantifyAiQuantClient } from '@/modules/ai-quant-proxy/clients/quantify-ai-quant.client'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('AI Quant proxy HTTP (E2E)', () => {
  let app: INestApplication
  let quantifyClient: {
    listAccountStrategies: jest.Mock
    startCodegen: jest.Mock
  }

  beforeAll(async () => {
    quantifyClient = {
      listAccountStrategies: jest.fn(),
      startCodegen: jest.fn(),
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
    quantifyClient.listAccountStrategies.mockResolvedValue({
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

    expect(quantifyClient.listAccountStrategies).toHaveBeenCalledWith(
      {
        page: 1,
        limit: 20,
        status: 'running',
        subscribedOnly: undefined,
        excludeDraft: undefined,
      },
      { userId: 'e2e-user-id', headers: { 'x-user-id': 'e2e-user-id', authorization: 'Bearer test-token' } },
    )
  })

  it('should inject authenticated user id into codegen session creation', async () => {
    quantifyClient.startCodegen.mockResolvedValue({
      id: 'session-1',
      status: 'CONFIRM_GATE',
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

    expect(quantifyClient.startCodegen).toHaveBeenCalledWith({
      initialMessage: 'build me a strategy',
      symbols: ['BTCUSDT'],
      timeframes: undefined,
      entryRules: undefined,
      exitRules: undefined,
      riskRules: undefined,
      guideConfig: undefined,
    }, expect.objectContaining({
      userId: 'e2e-user-id',
      timeoutMs: 60_000,
    }))
  })
})
