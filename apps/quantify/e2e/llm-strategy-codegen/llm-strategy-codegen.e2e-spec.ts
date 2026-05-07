import type { INestApplication } from '@nestjs/common'
import type { Response } from 'supertest'
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
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      {
        key: 'price.percent_change',
        phase: 'entry',
        params: { valuePct: -1, window: '3m', basis: 'prev_close' },
      },
      {
        key: 'price.percent_change',
        phase: 'exit',
        params: { valuePct: 2, window: '15m', basis: 'prev_close' },
      },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    risk: [
      { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
      { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
    contextSlots: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      timeframe: '1h',
    },
  },
})

const VALID_STRATEGY_SCRIPT = 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }'
const ENGINE_TEST_CANONICAL_SPEC = {
  version: 2,
  market: {
    exchange: 'okx',
    symbol: 'BTCUSDT',
    marketType: 'perp',
    defaultTimeframe: '1h',
  },
  indicators: [
    { kind: 'rsi', params: { period: 14 } },
    { kind: 'atr', params: { period: 14 } },
  ],
  sizing: {
    mode: 'RATIO',
    value: 0.1,
  },
  executionPolicy: {
    signalTiming: 'BAR_CLOSE',
    fillTiming: 'NEXT_BAR_OPEN',
  },
  dataRequirements: {
    requiredTimeframes: ['1h'],
  },
  rules: [
    {
      id: 'entry-rsi',
      phase: 'entry',
      sideScope: 'long',
      priority: 100,
      condition: {
        kind: 'atom',
        key: 'rsi.value',
        semanticScope: 'market',
        op: 'LTE',
        value: 30,
      },
      actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
    },
    {
      id: 'exit-atr',
      phase: 'exit',
      sideScope: 'long',
      priority: 90,
      condition: {
        kind: 'atom',
        key: 'atr.trailing_stop',
        semanticScope: 'position',
      },
      actions: [{ type: 'CLOSE_LONG' }],
    },
  ],
}

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
        getString: (key: string) => {
          if (key === 'APP_SECRET') {
            return TEST_ENGINE_SECRET
          }
          return process.env[key] ?? process.env[`QUANTIFY_${key}`]
        },
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
      initialMessage: '3分钟跌1%买入，15分钟涨2%卖出',
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
        canonicalSpec: ENGINE_TEST_CANONICAL_SPEC,
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

  it('rejects engine test when semantic input is missing', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .set('x-user-id', 'u-e2e-5')
      .send({
        userId: 'u-e2e-5',
        message: '测试',
      }).expect(400)
      .expect((res: Response) => {
        const errorArgs = res.body?.error?.args ?? res.body?.args
        expect(errorArgs).toMatchObject({ missingFields: ['semanticState'] })
      })
  })

  it('rejects engine test when only legacy checklist body is sent', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .set('x-user-id', 'u-e2e-legacy')
      .send({
        userId: 'u-e2e-legacy',
        message: '测试',
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
        riskRules: { maxPositionPct: 0.1 },
      }).expect(400)
      .expect((res: Response) => {
        const errorArgs = res.body?.error?.args ?? res.body?.args
        expect(errorArgs).toMatchObject({ missingFields: ['semanticState'] })
      })
  })

  it('rejects engine test when caller identity header is missing', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server).post(buildApiUrl('llm-strategy-codegen/engine/test'))
      .set('x-engine-test-token', TEST_ENGINE_SECRET)
      .send({
        userId: 'u-e2e-6',
        message: '测试',
        canonicalSpec: ENGINE_TEST_CANONICAL_SPEC,
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
        canonicalSpec: ENGINE_TEST_CANONICAL_SPEC,
      }).expect(403)
  })
})
