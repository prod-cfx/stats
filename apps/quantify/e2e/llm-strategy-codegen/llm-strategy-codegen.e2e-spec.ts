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
import { ordinarySemanticGraphStrategyFixtures } from '@/modules/llm-strategy-codegen/services/__tests__/fixtures/semantic-graph-strategies'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

const TEST_ENGINE_SECRET = 'e2e-engine-test-secret'
const multiTimeframeFixture = ordinarySemanticGraphStrategyFixtures.find(
  fixture => fixture.id === 'multi-timeframe-drop-rise',
)

if (!multiTimeframeFixture) {
  throw new Error('missing multi-timeframe ordinary strategy fixture')
}

const PLANNER_READY_JSON = JSON.stringify(multiTimeframeFixture.planner)

function createBearerToken(userId: string): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify({
    sub: userId,
    principalType: 'user',
    exp: 4_102_444_800,
  })).toString('base64url')
  return `${encodedHeader}.${encodedPayload}.signature`
}

function extractBearerToken(authorization: string | undefined): string | null {
  const normalized = authorization?.replace(/^Bearer\s+/i, '').trim()
  return normalized || null
}

function decodeBearerSub(token: string | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

function createGraphSnapshot() {
  return {
    version: 3,
    status: 'confirmed' as const,
    trigger: [
      {
        id: 'trigger-entry-1',
        phase: 'entry' as const,
        operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))',
      },
      {
        id: 'trigger-exit-1',
        phase: 'exit' as const,
        operator: 'CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))',
      },
    ],
    actions: [
      { id: 'action-buy-1', action: 'BUY' as const, target: 'BTCUSDT', amount: '25%' },
      { id: 'action-sell-1', action: 'SELL' as const, target: 'BTCUSDT', amount: '25%' },
    ],
    risk: ['stopLossPct: STOP_LOSS_PCT(4)'],
    meta: {
      exchange: 'binance' as const,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 25,
      executionTags: [],
    },
  }
}

function createSemanticGraph() {
  return {
    version: 1,
    market: {
      symbol: 'BTCUSDT',
      primaryTimeframe: '3m',
    },
    nodes: [
      {
        id: 'entry-drop-1',
        phase: 'entry',
        kind: 'price_change_pct',
        params: {
          timeframe: '3m',
          left: { source: 'close', offsetBars: 0 },
          right: { source: 'close', offsetBars: 1 },
          op: 'lte',
          valuePct: -1,
        },
      },
      {
        id: 'exit-pnl-1',
        phase: 'exit',
        kind: 'position_pnl_pct',
        params: {
          timeframe: '15m',
          op: 'gte',
          valuePct: 2,
        },
      },
    ],
    actions: [
      { id: 'open-long', kind: 'OPEN_LONG', sizePct: 10 },
      { id: 'close-long', kind: 'CLOSE_LONG', sizePct: 100 },
    ],
    risk: [
      {
        id: 'risk-stop-loss-pct',
        kind: 'STOP_LOSS_PCT',
        valuePct: 5,
        effect: 'FORCE_EXIT',
      },
    ],
  }
}

interface PlannerStubConfig {
  message: string
  reply: Record<string, unknown>
}

describe('llm strategy codegen (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let aiService: AiService
  const originalFetch = globalThis.fetch
  const originalAiMockEnabled = process.env.QUANTIFY_AI_MOCK_ENABLED

  async function waitForSessionStatus(sessionId: string, token: string, expectedStatus: string): Promise<Record<string, unknown>> {
    const server = app.getHttpServer()
    let lastPayload: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const res = await supertestRequest(server)
        .get(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}`))
        .set('authorization', `Bearer ${token}`)
        .expect(200)
      const payload = (res.body.data ?? res.body) as Record<string, unknown>
      lastPayload = payload
      if (payload.status === expectedStatus) {
        return payload
      }
      if (payload.status === 'REJECTED') {
        throw new Error(`session ${sessionId} rejected: ${String(payload.rejectReason ?? '(unknown)')}`)
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`session ${sessionId} did not reach ${expectedStatus} in time, last status=${String(lastPayload?.status ?? '(missing)')}`)
  }

  beforeAll(async () => {
    process.env.QUANTIFY_AI_MOCK_ENABLED = 'true'
    globalThis.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = (() => {
        const headers = init?.headers
        if (!headers) return undefined
        if (headers instanceof Headers) return headers.get('authorization') ?? undefined
        if (Array.isArray(headers)) {
          const entry = headers.find(([key]) => key.toLowerCase() === 'authorization')
          return entry?.[1]
        }
        const record = headers as Record<string, string>
        return record.authorization ?? record.Authorization
      })()
      const userId = decodeBearerSub(extractBearerToken(authorization))
      return {
        ok: Boolean(userId),
        json: async () => ({ id: userId }),
      } as Response
    }) as unknown as typeof fetch

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
    await prisma.llmStrategyCodeVersion.deleteMany()
    await prisma.llmStrategyCodegenSession.deleteMany()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    globalThis.fetch = originalFetch
    if (originalAiMockEnabled === undefined) {
      delete process.env.QUANTIFY_AI_MOCK_ENABLED
    } else {
      process.env.QUANTIFY_AI_MOCK_ENABLED = originalAiMockEnabled
    }
    await app.close()
  })

  it('publishes compiled strategy snapshot when checks pass', async () => {
    const server = app.getHttpServer()
    const token = createBearerToken('u-e2e-1')
    const session = await prisma.llmStrategyCodegenSession.create({
      data: {
        userId: 'u-e2e-1',
        status: 'CHECKLIST_GATE',
        checklist: multiTimeframeFixture.planner.logic,
        constraintPack: {
          conversationHistory: [],
          guidePrompt: null,
          recommendationStyle: 'ma',
        },
        latestSpecDesc: {
          market: { symbols: ['BTCUSDT'], timeframes: ['3m', '15m'] },
        },
        graphSnapshot: createGraphSnapshot(),
        semanticGraph: createSemanticGraph(),
        validationReport: {
          ok: true,
          errors: [],
        },
      },
    })

    const continueRes = await supertestRequest(server)
      .post(buildApiUrl(`llm-strategy-codegen/sessions/${session.id}/messages`))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-1',
        message: '确认逻辑图，请生成脚本',
        confirmGenerate: true,
      })
      .expect(202)

    const continuePayload = continueRes.body.data ?? continueRes.body
    expect(continuePayload.status).toBe('GENERATING')

    const publishedPayload = await waitForSessionStatus(session.id, token, 'PUBLISHED')
    expect(publishedPayload.specDesc).toBeTruthy()
    expect(publishedPayload.publishedSnapshotId).toBeTruthy()

    const versions = await prisma.llmStrategyCodeVersion.findMany({ where: { sessionId: session.id } })
    expect(versions.length).toBe(1)
    expect(versions[0]?.staticPassed).toBe(true)
    expect(versions[0]?.runtimePassed).toBe(true)
    expect(versions[0]?.outputPassed).toBe(true)
  })

  it('persists graph snapshot when session enters checklist gate', async () => {
    const server = app.getHttpServer()
    const token = createBearerToken('u-e2e-2')

    jest.spyOn(aiService, 'chat')
      .mockResolvedValueOnce({ content: PLANNER_READY_JSON })

    const startRes = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-2',
        initialMessage: multiTimeframeFixture.prompt,
        ...multiTimeframeFixture.planner.logic,
      })
      .expect(201)

    const startPayload = startRes.body.data ?? startRes.body
    const sessionId = startPayload.id as string
    const session = await prisma.llmStrategyCodegenSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(session.status).toBe('CHECKLIST_GATE')
    expect(session.graphSnapshot).toMatchObject({
      status: 'confirmed',
      trigger: expect.arrayContaining([expect.objectContaining({ phase: 'entry' })]),
    })
  })

  it('supports ordinary quant strategies through the full compiled flow', async () => {
    const server = app.getHttpServer()
    const token = createBearerToken('u-e2e-ordinary')

    const chatSpy = jest.spyOn(aiService, 'chat').mockImplementation(async ({ messages }) => {
      const userPayload = (() => {
        const raw = messages?.find(item => item.role === 'user')?.content
        if (!raw) return null
        try {
          return JSON.parse(raw) as { message?: unknown }
        } catch {
          return null
        }
      })()
      const matched = ordinarySemanticGraphStrategyFixtures.find(
        fixture => fixture.prompt === userPayload?.message,
      )
      if (!matched) {
        throw new Error(`unexpected planner prompt: ${String(userPayload?.message ?? '(missing)')}`)
      }
      return {
        content: JSON.stringify(matched.planner),
      }
    })

    for (const fixture of ordinarySemanticGraphStrategyFixtures) {
      const startRes = await supertestRequest(server)
        .post(buildApiUrl('llm-strategy-codegen/sessions'))
        .set('authorization', `Bearer ${token}`)
        .send({
          userId: 'u-e2e-ordinary',
          initialMessage: fixture.prompt,
        })
        .expect(201)

      const startPayload = (startRes.body.data ?? startRes.body) as Record<string, unknown>
      expect(startPayload.status).toBe('CHECKLIST_GATE')
      expect(startPayload.validationReport).toEqual({
        ok: true,
        errors: [],
      })
      expect(startPayload.semanticGraph).toEqual(expect.objectContaining({
        market: expect.objectContaining({
          symbol: fixture.expected.symbol,
          primaryTimeframe: fixture.expected.primaryTimeframe,
        }),
      }))

      const sessionId = String(startPayload.id)
      const continueRes = await supertestRequest(server)
        .post(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}/messages`))
        .set('authorization', `Bearer ${token}`)
        .send({
          userId: 'u-e2e-ordinary',
          message: '确认并生成',
          confirmGenerate: true,
        })
        .expect(202)

      const continuePayload = continueRes.body.data ?? continueRes.body
      expect(continuePayload.status).toBe('GENERATING')

      const publishedPayload = await waitForSessionStatus(sessionId, token, 'PUBLISHED')
      expect(publishedPayload.publishedSnapshotId).toBeTruthy()
      expect(publishedPayload.semanticGraph).toEqual(expect.objectContaining({
        market: expect.objectContaining({
          symbol: fixture.expected.symbol,
          primaryTimeframe: fixture.expected.primaryTimeframe,
        }),
      }))
    }

    expect(chatSpy).toHaveBeenCalledTimes(ordinarySemanticGraphStrategyFixtures.length)
  })

  it('clarifies ambiguous price-change exit basis before showing logic graph', async () => {
    const server = app.getHttpServer()
    const token = createBearerToken('u-e2e-clarify-price')
    const plannerReplies: PlannerStubConfig[] = [
      {
        message: 'BTCUSDT 3分钟下跌1%买入，3分钟上涨1%卖出，仓位10%，止损5%',
        reply: {
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['3m'],
            entryRules: ['3分钟下跌1%买入'],
            exitRules: ['3分钟上涨1%卖出'],
            riskRules: {
              positionPct: 10,
              stopLossPct: 5,
            },
          },
        },
      },
      {
        message: '这里的上涨1%是相对开仓均价',
        reply: {
          related: true,
          logicReady: true,
          assistantPrompt: '已记录你的补充。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['3m'],
            entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓'],
            exitRules: ['当前K线收盘价相对于开仓均价上涨≥1%时卖出平仓'],
            riskRules: {
              positionPct: 10,
              stopLossPct: 5,
            },
          },
        },
      },
    ]
    jest.spyOn(aiService, 'chat').mockImplementation(async ({ messages }) => {
      const raw = messages?.find(item => item.role === 'user')?.content
      const payload = raw ? JSON.parse(raw) as { message?: unknown } : {}
      const matched = plannerReplies.find(item => item.message === payload.message)
      if (!matched) {
        throw new Error(`unexpected planner prompt: ${String(payload.message ?? '(missing)')}`)
      }
      return { content: JSON.stringify(matched.reply) }
    })

    const startRes = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-clarify-price',
        initialMessage: plannerReplies[0].message,
      })
      .expect(201)

    const startPayload = (startRes.body.data ?? startRes.body) as Record<string, unknown>
    expect(startPayload.status).toBe('DRAFTING')
    expect(startPayload.semanticGraph).toBeFalsy()
    expect(String(startPayload.assistantPrompt ?? '')).toContain('存在两种可编译解释')

    const continueRes = await supertestRequest(server)
      .post(buildApiUrl(`llm-strategy-codegen/sessions/${String(startPayload.id)}/messages`))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-clarify-price',
        message: plannerReplies[1].message,
      })
      .expect(202)

    const continuePayload = (continueRes.body.data ?? continueRes.body) as Record<string, unknown>
    expect(continuePayload.status).toBe('CHECKLIST_GATE')
    expect(continuePayload.semanticGraph).toBeTruthy()
  })

  it('clarifies grid spacing semantics before checklist gate', async () => {
    const server = app.getHttpServer()
    const token = createBearerToken('u-e2e-clarify-grid')
    const plannerReplies: PlannerStubConfig[] = [
      {
        message: 'BTCUSDT 60000-80000 按1%等距网格买入，触及上方网格卖出，仓位1%，单笔最大亏损2%',
        reply: {
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['15m'],
            entryRules: ['在60000-80000固定区间按1%等距划分网格线，价格触及或跌破网格线时买入'],
            exitRules: ['买入后价格上涨触及上方网格线时卖出'],
            riskRules: {
              positionPct: 1,
              maxSingleLossPct: 2,
            },
          },
        },
      },
      {
        message: '这里的1%等距网格是固定价差',
        reply: {
          related: true,
          logicReady: true,
          assistantPrompt: '已记录你的补充。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['15m'],
            entryRules: ['在60000-80000固定区间按步长1%，共21格执行区间网格买入'],
            exitRules: ['价格触达上方网格卖出'],
            riskRules: {
              positionPct: 1,
              maxSingleLossPct: 2,
            },
          },
        },
      },
    ]
    jest.spyOn(aiService, 'chat').mockImplementation(async ({ messages }) => {
      const raw = messages?.find(item => item.role === 'user')?.content
      const payload = raw ? JSON.parse(raw) as { message?: unknown } : {}
      const matched = plannerReplies.find(item => item.message === payload.message)
      if (!matched) {
        throw new Error(`unexpected planner prompt: ${String(payload.message ?? '(missing)')}`)
      }
      return { content: JSON.stringify(matched.reply) }
    })

    const startRes = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-clarify-grid',
        initialMessage: plannerReplies[0].message,
      })
      .expect(201)

    const startPayload = (startRes.body.data ?? startRes.body) as Record<string, unknown>
    expect(startPayload.status).toBe('DRAFTING')
    expect(String(startPayload.assistantPrompt ?? '')).toContain('网格间距')

    const continueRes = await supertestRequest(server)
      .post(buildApiUrl(`llm-strategy-codegen/sessions/${String(startPayload.id)}/messages`))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-clarify-grid',
        message: plannerReplies[1].message,
      })
      .expect(202)

    const continuePayload = (continueRes.body.data ?? continueRes.body) as Record<string, unknown>
    expect(continuePayload.status).toBe('CHECKLIST_GATE')
    expect(continuePayload.semanticGraph).toBeTruthy()
  })

  it('clarifies bollinger outside-band risk action before graph confirmation', async () => {
    const server = app.getHttpServer()
    const token = createBearerToken('u-e2e-clarify-boll')
    const plannerReplies: PlannerStubConfig[] = [
      {
        message: 'BTCUSDT 15分钟上突破上轨做空，下突破下轨做多，回到中轨平仓，亏损5%止损，连续3根K线在轨外时提前止损或减仓，仓位10%',
        reply: {
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['15m'],
            entryRules: ['突破布林带上轨做空', '突破布林带下轨做多'],
            exitRules: ['价格回到布林带中轨（MA20）平仓'],
            riskRules: {
              positionPct: 10,
              stopLossPct: 5,
              outsideBandRule: '价格连续3根K线在轨外时提前止损或减仓',
            },
          },
        },
      },
      {
        message: '这里的轨外处理是提前减仓',
        reply: {
          related: true,
          logicReady: true,
          assistantPrompt: '已记录你的补充。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['15m'],
            entryRules: ['突破布林带上轨做空', '突破布林带下轨做多'],
            exitRules: ['价格回到布林带中轨（MA20）平仓'],
            riskRules: {
              positionPct: 10,
              stopLossPct: 5,
              outsideBandRule: '价格连续3根K线在轨外时提前减仓',
            },
          },
        },
      },
    ]
    jest.spyOn(aiService, 'chat').mockImplementation(async ({ messages }) => {
      const raw = messages?.find(item => item.role === 'user')?.content
      const payload = raw ? JSON.parse(raw) as { message?: unknown } : {}
      const matched = plannerReplies.find(item => item.message === payload.message)
      if (!matched) {
        throw new Error(`unexpected planner prompt: ${String(payload.message ?? '(missing)')}`)
      }
      return { content: JSON.stringify(matched.reply) }
    })

    const startRes = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-clarify-boll',
        initialMessage: plannerReplies[0].message,
      })
      .expect(201)

    const startPayload = (startRes.body.data ?? startRes.body) as Record<string, unknown>
    expect(startPayload.status).toBe('DRAFTING')
    expect(String(startPayload.assistantPrompt ?? '')).toContain('轨外风控动作')

    const continueRes = await supertestRequest(server)
      .post(buildApiUrl(`llm-strategy-codegen/sessions/${String(startPayload.id)}/messages`))
      .set('authorization', `Bearer ${token}`)
      .send({
        userId: 'u-e2e-clarify-boll',
        message: plannerReplies[1].message,
      })
      .expect(202)

    const continuePayload = (continueRes.body.data ?? continueRes.body) as Record<string, unknown>
    expect(continuePayload.status).toBe('CHECKLIST_GATE')
    expect(continuePayload.semanticGraph).toBeTruthy()
  })

  it('rejects session start when authorization header is missing', async () => {
    const server = app.getHttpServer()
    await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .send({
        userId: 'u-e2e-3',
        initialMessage: '用 RSI 低于 30 做多，ATR 止损',
      })
      .expect(401)
  })

  it('tests engine endpoint with provider/model overrides', async () => {
    const chatSpy = jest.spyOn(aiService, 'chat')

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
    expect(typeof payload.runtimePassed).toBe('boolean')
    expect(typeof payload.outputPassed).toBe('boolean')
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
