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
const TERMINAL_STATUSES = new Set(['PUBLISHED', 'CONSISTENCY_FAILED'])
const LEGACY_CHECKLIST_FIELD_NAMES = [
  'checklist',
  'entryRules',
  'exitRules',
  'riskRules',
  'ruleDrafts',
  'logicSnapshot',
]

function withBearer(userId: string): Record<string, string> {
  return { authorization: `Bearer ${userId}` }
}

function expectNoLegacyChecklistFields(payload: unknown): void {
  const seen = new Set<unknown>()
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) {
      return
    }
    seen.add(value)
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    const record = value as Record<string, unknown>
    for (const fieldName of LEGACY_CHECKLIST_FIELD_NAMES) {
      expect(record).not.toHaveProperty(fieldName)
    }
    Object.values(record).forEach(visit)
  }

  visit(payload)
}

function collectAiChatText(aiService: AiService): string {
  const mock = aiService.chat as jest.Mock
  return mock.mock.calls
    .flatMap(([input]) => (input?.messages ?? []) as Array<{ content?: string }>)
    .map(message => message.content ?? '')
    .join('\n')
}

async function waitForPublicationTerminalSession(
  server: ReturnType<INestApplication['getHttpServer']>,
  sessionId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  let lastPayload: Record<string, unknown> | undefined
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const res = await supertestRequest(server)
      .get(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}`))
      .set(withBearer(userId))
      .expect(200)
    const payload = (res.body.data ?? res.body) as Record<string, unknown>
    lastPayload = payload
    if (TERMINAL_STATUSES.has(String(payload.status))) {
      return payload
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(
    `session ${sessionId} did not reach publication terminal status in time; `
    + `lastStatus=${String(lastPayload?.status)} rejectReason=${String(lastPayload?.rejectReason ?? '')}`,
  )
}

const ORIGINAL_STRATEGY_CASES = [
  {
    id: 'ema-stack',
    userId: 'u-e2e-original-ema-stack',
    originalText: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    plannerContent: {
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已完整，请确认后生成代码。',
      semanticPatch: {
        families: ['single-leg'],
        contextSlots: {
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
        triggers: [
          {
            key: 'indicator.above',
            phase: 'entry',
            sideScope: 'long',
            params: {
              indicator: 'ema',
              referenceRole: 'long_term',
              'reference.period': 20,
              reference: { indicator: 'ema', period: 20 },
              timeframe: '15m',
            },
          },
          {
            key: 'indicator.above',
            phase: 'entry',
            sideScope: 'long',
            params: {
              indicator: 'ema',
              referenceRole: 'long_term',
              'reference.period': 60,
              reference: { indicator: 'ema', period: 60 },
              timeframe: '15m',
            },
          },
          {
            key: 'indicator.above',
            phase: 'entry',
            sideScope: 'long',
            params: {
              indicator: 'ema',
              referenceRole: 'long_term',
              'reference.period': 144,
              reference: { indicator: 'ema', period: 144 },
              timeframe: '15m',
            },
          },
          {
            key: 'indicator.below',
            phase: 'exit',
            sideScope: 'long',
            params: {
              indicator: 'ema',
              referenceRole: 'long_term',
              'reference.period': 20,
              reference: { indicator: 'ema', period: 20 },
              timeframe: '15m',
            },
          },
        ],
        actions: [{ key: 'open_long' }, { key: 'close_long' }],
        risk: [{ key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
        position: { mode: 'fixed_quote', value: 10, asset: 'USDT', positionMode: 'long_only' },
      },
    },
  },
  {
    id: 'okx-percent-window',
    userId: 'u-e2e-original-okx-percent-window',
    originalText: '策略一：在okx交易所 我想买btc  3分钟之内跌百分1买入  15分钟之内涨百分2卖出  单笔用百分10资金 止损5% 止盈10%',
    plannerContent: {
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已完整，请确认后生成代码。',
      semanticPatch: {
        families: ['single-leg'],
        contextSlots: {
          exchange: 'okx',
          marketType: 'spot',
          symbol: 'BTCUSDT',
          timeframe: '3m',
        },
        triggers: [
          {
            key: 'price.percent_change',
            phase: 'entry',
            sideScope: 'long',
            params: { valuePct: -1, window: '3m', basis: 'prev_close' },
          },
          {
            key: 'price.percent_change',
            phase: 'exit',
            sideScope: 'long',
            params: { valuePct: 2, window: '15m', direction: 'up' },
          },
        ],
        actions: [{ key: 'open_long' }, { key: 'close_long' }],
        risk: [
          { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
          { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
        ],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      },
    },
  },
  {
    id: 'bollinger-dual-side',
    userId: 'u-e2e-original-bollinger-dual-side',
    originalText: '策略二：OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    plannerContent: {
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已完整，请确认后生成代码。',
      semanticPatch: {
        families: ['single-leg'],
        contextSlots: {
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
        triggers: [
          {
            key: 'price.detect.indicator_boundary',
            phase: 'entry',
            sideScope: 'short',
            params: {
              boundaryRole: 'upper',
              confirmationMode: 'touch',
              indicator: { name: 'bollinger', period: 20, stdDev: 2 },
            },
          },
          {
            key: 'price.detect.indicator_boundary',
            phase: 'entry',
            sideScope: 'long',
            params: {
              boundaryRole: 'lower',
              confirmationMode: 'touch',
              indicator: { name: 'bollinger', period: 20, stdDev: 2 },
            },
          },
          {
            key: 'price.detect.indicator_boundary',
            phase: 'exit',
            sideScope: 'both',
            params: {
              boundaryRole: 'middle',
              confirmationMode: 'touch',
              indicator: { name: 'bollinger', period: 20, stdDev: 2 },
            },
          },
        ],
        actions: [{ key: 'open_short' }, { key: 'open_long' }, { key: 'close_short' }, { key: 'close_long' }],
        risk: [{ key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
      },
    },
  },
] as const

describe('llm strategy codegen original strategy flow (E2E)', () => {
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

  it.each(ORIGINAL_STRATEGY_CASES)(
    'runs original text $id from start through publication terminal with semanticPatch only',
    async ({ userId, originalText, plannerContent }) => {
      expect(plannerContent).toHaveProperty('semanticPatch')
      expectNoLegacyChecklistFields(plannerContent)
      jest.spyOn(aiService, 'chat')
        .mockResolvedValueOnce({ content: JSON.stringify(plannerContent) })

      const server = app.getHttpServer()
      const startRes = await supertestRequest(server)
        .post(buildApiUrl('llm-strategy-codegen/sessions'))
        .send({
          userId,
          initialMessage: originalText,
        })
        .set(withBearer(userId))
        .expect(201)

      const startPayload = (startRes.body.data ?? startRes.body) as Record<string, unknown>
      expectNoLegacyChecklistFields(startPayload)
      expect(startPayload.status).toBe('CONFIRM_GATE')
      expect(startPayload.canonicalDigest).toBeTruthy()
      expect(collectAiChatText(aiService)).toContain(originalText)

      const continueRes = await supertestRequest(server)
        .post(buildApiUrl(`llm-strategy-codegen/sessions/${String(startPayload.id)}/messages`))
        .send({
          userId,
          message: '确认逻辑图，请生成脚本',
          confirmGenerate: true,
          confirmedCanonicalDigest: startPayload.canonicalDigest,
        })
        .set(withBearer(userId))
        .expect(202)

      const continuePayload = (continueRes.body.data ?? continueRes.body) as Record<string, unknown>
      expectNoLegacyChecklistFields(continuePayload)
      expect(continuePayload.status).toBe('GENERATING')

      const finalPayload = await waitForPublicationTerminalSession(server, String(startPayload.id), userId)
      expectNoLegacyChecklistFields(finalPayload)
      expect(TERMINAL_STATUSES.has(String(finalPayload.status))).toBe(true)
    },
  )
})
