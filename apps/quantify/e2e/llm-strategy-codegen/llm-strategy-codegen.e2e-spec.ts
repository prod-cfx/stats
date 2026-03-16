import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { AiService } from '@/modules/ai/ai.service'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { PrismaService } from '@/prisma/prisma.service'
import { supertestRequest } from '../helpers/supertest-compat'

describe('llm strategy codegen (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let aiService: AiService

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.e2e.local', '.env.e2e'],
        }),
        EnvModule,
        ClsConfigModule,
        LlmStrategyCodegenModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    app.setGlobalPrefix('api/v1')
    await app.init()

    prisma = moduleFixture.get(PrismaService)
    aiService = moduleFixture.get(AiService)
  })

  afterEach(async () => {
    const client = prisma.getClient()
    await client.llmStrategyCodeVersion.deleteMany()
    await client.llmStrategyCodegenSession.deleteMany()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  it('publishes strategy script when checks pass', async () => {
    jest.spyOn(aiService, 'chat').mockResolvedValue({
      content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 80 }',
      toolCalls: [],
    })

    const server = app.getHttpServer()

    const startRes = await supertestRequest(server).post('/api/v1/llm-strategy-codegen/sessions').send({
      userId: 'u-e2e-1',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }).expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string

    const continueRes = await supertestRequest(server).post(`/api/v1/llm-strategy-codegen/sessions/${sessionId}/messages`).send({
      userId: 'u-e2e-1',
      message: 'please generate a strategy script',
    }).expect(201)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('PUBLISHED')
    expect(continuePayload.specDesc).toBeTruthy()

    const client = prisma.getClient()
    const versions = await client.llmStrategyCodeVersion.findMany({ where: { sessionId } })
    expect(versions.length).toBe(1)
    expect(versions[0]?.staticPassed).toBe(true)
    expect(versions[0]?.runtimePassed).toBe(true)
    expect(versions[0]?.outputPassed).toBe(true)
  })

  it('rejects out-of-scope helper usage', async () => {
    jest.spyOn(aiService, 'chat').mockResolvedValue({
      content: 'return helpers.custom.foo()',
    })

    const server = app.getHttpServer()

    const startRes = await supertestRequest(server).post('/api/v1/llm-strategy-codegen/sessions').send({
      userId: 'u-e2e-2',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }).expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string

    const continueRes = await supertestRequest(server).post(`/api/v1/llm-strategy-codegen/sessions/${sessionId}/messages`).send({
      userId: 'u-e2e-2',
      message: 'please generate a strategy script',
    }).expect(201)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('REJECTED')
    expect(String(continuePayload.rejectReason)).toContain('鏈巿鏉?helper')
  })
})
