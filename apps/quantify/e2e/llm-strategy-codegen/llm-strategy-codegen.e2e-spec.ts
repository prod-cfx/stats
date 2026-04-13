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
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

const TEST_ENGINE_SECRET = 'e2e-engine-test-secret'
const TERMINAL_STATUSES = new Set(['PUBLISHED', 'REJECTED', 'CONSISTENCY_FAILED'])

function withBearer(userId: string): Record<string, string> {
  return { authorization: `Bearer ${userId}` }
}

async function waitForTerminalSession(
  server: ReturnType<INestApplication['getHttpServer']>,
  sessionId: string,
  userId: string,
): Promise<Record<string, any>> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const res = await supertestRequest(server)
      .get(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}`))
      .set(withBearer(userId))
      .expect(200)
    const payload = res.body.data ?? res.body
    if (TERMINAL_STATUSES.has(String(payload.status))) {
      return payload
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`session ${sessionId} did not reach terminal status in time`)
}

const PLANNER_READY_JSON = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  logic: {
    entryRules: ['价格突破阻力位入场'],
    exitRules: ['跌破支撑位出场'],
    symbols: ['BTCUSDT'],
    timeframes: ['1h'],
    riskRules: {
      exchange: 'okx',
      marketType: 'spot',
      positionPct: 10,
      stopLossPct: 5,
      stopLossBasis: 'entry_avg_price',
      takeProfitPct: 10,
      takeProfitBasis: 'entry_avg_price',
    },
  },
})

const VALID_STRATEGY_SCRIPT = 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }'

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
      .overrideProvider(MarketSymbolCatalogService)
      .useValue({
        onApplicationBootstrap: () => {},
        ensureExchangeSymbolAvailable: async () => 'supported',
      })
      .overrideProvider(CallerIdentityService)
      .useValue({
        async resolveCallerUserIdFromAuthorization(authorization?: string) {
          const token = authorization?.replace(/^Bearer\s+/i, '').trim()
          if (!token) {
            throw new Error('missing bearer token for test')
          }
          return token
        },
      })
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
    await prisma.llmStrategyCodeVersion.deleteMany()
    await prisma.llmStrategyCodegenSession.deleteMany()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  it('publishes strategy script when checks pass', async () => {
    const chatSpy = jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({ content: PLANNER_READY_JSON })

    const server = app.getHttpServer()

    const startRes = await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/sessions')).send({
      userId: 'u-e2e-1',
      initialMessage: '价格突破阻力位入场，跌破支撑位出场',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['价格突破阻力位入场'],
      exitRules: ['跌破支撑位出场'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    }).set(withBearer('u-e2e-1')).expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string
    const canonicalDigest = startPayload.canonicalDigest as string

    expect(canonicalDigest).toBeTruthy()

    const continueRes = await supertestRequest(server).post(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}/messages`)).send({
      userId: 'u-e2e-1',
      message: '确认逻辑图，请生成脚本',
      confirmGenerate: true,
      confirmedCanonicalDigest: canonicalDigest,
    }).set(withBearer('u-e2e-1')).expect(202)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('GENERATING')

    const finalPayload = await waitForTerminalSession(server, sessionId, 'u-e2e-1')
    expect(finalPayload.status).toBe('PUBLISHED')
    expect(finalPayload.specDesc).toBeTruthy()
    expect(chatSpy).toHaveBeenCalledTimes(1)

    const versions = await prisma.llmStrategyCodeVersion.findMany({ where: { sessionId } })
    expect(versions.length).toBe(1)
    expect(versions[0]?.staticPassed).toBe(true)
    expect(versions[0]?.runtimePassed).toBe(true)
    expect(versions[0]?.outputPassed).toBe(true)
  })

  it('tests engine endpoint with provider/model overrides', async () => {
    const chatSpy = jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({
        content: JSON.stringify({ code: VALID_STRATEGY_SCRIPT }),
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
