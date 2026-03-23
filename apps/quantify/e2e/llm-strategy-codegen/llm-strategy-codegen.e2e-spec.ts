import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { EnvService } from '@/common/services/env.service'
import { AiService } from '@/modules/ai/ai.service'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

const TEST_ENGINE_SECRET = 'e2e-engine-test-secret'

const PLANNER_READY_JSON = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  logic: {
    entryRules: ['rsi < 30'],
    exitRules: ['atr stop'],
    symbols: ['BTCUSDT'],
    timeframes: ['1h'],
  },
})

const PLANNER_CONFIRM_JSON = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '已确认逻辑，开始生成。',
})

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
        EventEmitterModule.forRoot(),
        EnvModule,
        ClsConfigModule,
        LlmStrategyCodegenModule,
      ],
    })
      .overrideProvider(MarketDataIngestionService)
      .useValue({ onModuleInit: () => {}, onModuleDestroy: () => {}, handleGapFill: () => {}, handleDynamicSymbolRefresh: () => {} })
      .overrideProvider(EnvService)
      .useValue({
        getString: (key: string) => (key === 'APP_SECRET' ? TEST_ENGINE_SECRET : undefined),
        isProd: () => false,
        isDev: () => false,
        isTest: () => true,
        isE2E: () => true,
        isDebugMode: () => false,
        getNumber: () => undefined,
        getBoolean: () => undefined,
      })
      .compile()

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
    const chatSpy = jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({ content: PLANNER_READY_JSON })
      .mockResolvedValueOnce({ content: PLANNER_CONFIRM_JSON })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 80 }',
        toolCalls: [],
      })

    const server = app.getHttpServer()

    const startRes = await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/sessions')).send({
      userId: 'u-e2e-1',
      initialMessage: '用 RSI 低于 30 做多，ATR 止损',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }).expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string

    const continueRes = await supertestRequest(server).post(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}/messages`)).send({
      userId: 'u-e2e-1',
      message: '确认逻辑图，请生成脚本',
      confirmGenerate: true,
    }).expect(201)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('PUBLISHED')
    expect(continuePayload.specDesc).toBeTruthy()
    expect(chatSpy).toHaveBeenCalledTimes(3)
    const systemPrompt = String(chatSpy.mock.calls[2]?.[0]?.messages?.[0]?.content ?? '')
    expect(systemPrompt).toContain('helpers.finance')
    expect(systemPrompt).not.toContain('helpers.math')

    const client = prisma.getClient()
    const versions = await client.llmStrategyCodeVersion.findMany({ where: { sessionId } })
    expect(versions.length).toBe(1)
    expect(versions[0]?.staticPassed).toBe(true)
    expect(versions[0]?.runtimePassed).toBe(true)
    expect(versions[0]?.outputPassed).toBe(true)
  })

  it('rejects out-of-scope helper usage', async () => {
    jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({ content: PLANNER_READY_JSON })
      .mockResolvedValueOnce({ content: PLANNER_CONFIRM_JSON })
      .mockResolvedValueOnce({
        content: 'return helpers.custom.foo()',
      })

    const server = app.getHttpServer()

    const startRes = await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/sessions')).send({
      userId: 'u-e2e-2',
      initialMessage: '用 RSI 低于 30 做多，ATR 止损',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }).expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string

    const continueRes = await supertestRequest(server).post(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}/messages`)).send({
      userId: 'u-e2e-2',
      message: '确认逻辑图，请生成脚本',
      confirmGenerate: true,
    }).expect(201)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('REJECTED')
    expect(String(continuePayload.rejectReason)).toContain('未授权 helper')
  })

  it('rejects legacy helpers.math namespace', async () => {
    jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({ content: PLANNER_READY_JSON })
      .mockResolvedValueOnce({ content: PLANNER_CONFIRM_JSON })
      .mockResolvedValueOnce({
        content: 'return helpers.math.avg([1,2,3])',
      })

    const server = app.getHttpServer()

    const startRes = await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/sessions')).send({
      userId: 'u-e2e-3',
      initialMessage: '用 RSI 低于 30 做多，ATR 止损',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['rsi < 30'],
      exitRules: ['atr stop'],
      riskRules: { maxPositionPct: 0.1 },
    }).expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string

    const continueRes = await supertestRequest(server).post(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}/messages`)).send({
      userId: 'u-e2e-3',
      message: '确认逻辑图，请生成脚本',
      confirmGenerate: true,
    }).expect(201)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('REJECTED')
    expect(String(continuePayload.rejectReason)).toContain('helpers.math')
  })

  it('tests engine endpoint with provider/model overrides', async () => {
    const chatSpy = jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 80 }',
        toolCalls: [],
      })

    const server = app.getHttpServer()
    const res = await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .set('x-user-id', 'u-e2e-4')
      .send({
        userId: 'u-e2e-4',
        message: '请测试引擎生成策略脚本',
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
        riskRules: { maxPositionPct: 0.1 },
        providerCode: 'uniapi',
        model: 'gpt-4.1-mini',
        temperature: 0.1,
        maxTokens: 900,
      }).expect(200)

    const payload = res.body.data ?? res.body
    expect(payload.staticPassed).toBe(true)
    expect(payload.runtimePassed).toBe(true)
    expect(payload.outputPassed).toBe(true)
    expect(payload.providerCode).toBe('strategy-codegen')
    expect(payload.model).toBe('gpt-4.1-mini')
    expect(chatSpy).toHaveBeenCalledWith(expect.objectContaining({
      providerCode: 'strategy-codegen',
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      maxTokens: 900,
    }))
  })

  it('rejects engine test when required checklist fields are missing', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .set('x-user-id', 'u-e2e-5')
      .send({
        userId: 'u-e2e-5',
        message: '测试',
      }).expect(400)
  })

  it('rejects engine test when caller identity header is missing', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .send({
        userId: 'u-e2e-6',
        message: '测试',
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
        riskRules: { maxPositionPct: 0.1 },
      }).expect(401)
  })

  it('rejects engine test when caller identity does not match userId', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .set('x-user-id', 'u-e2e-7')
      .send({
        userId: 'u-e2e-8',
        message: '测试',
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
        riskRules: { maxPositionPct: 0.1 },
      }).expect(403)
  })
})
