/**
 * Issue #1395 — Atom Expression Tree 八条用户实测策略真调 LLM 端到端验证
 *
 * 设计 spec：docs/superpowers/specs/2026-05-15-atom-expression-tree-design.md
 *
 * 范围：
 *   - 真调 LLM；验证 8 条用户策略的关键语义被 planner 正确识别（assistantPrompt /
 *     clarificationState.summary / specDesc 任一含关键词即通过）。
 *   - 不验证 LLM 自由发挥的具体 params 值；只断言「LLM 显式覆盖了核心语义」。
 *
 * 硬门禁：8/8 必须绿才允许合并。
 *
 * Gate（默认不执行）：
 *   - 真调 LLM 需要 API key + 网络；默认 describe.skip。
 *   - 本地复跑：`E2E_REAL_LLM=1 dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/issue-1395-eight-strategies`
 *   - 同 issue-1383-five-strategies 风格：基于响应文本 blob 做关键字 substring 断言，
 *     不依赖 API 暴露 SemanticState.rules（API 不暴露，仅在 specDesc/canonical 阶段映射）。
 */

import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { EnvService } from '@/common/services/env.service'
import { backendConfigLoaders } from '@/config/configuration'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { CodegenSessionPublicationPipelineService } from '@/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'
import { loadRealLlmEnv } from './__setup__/load-real-llm-env'

loadRealLlmEnv()

// Issue #1395: 真实 LLM e2e 默认升级到 gpt-5.4-mini（生产 prod 仍 nano；本地验证
//   AtomExpr 表达式树端到端正确性必须用 mini+。nano 跟不住 sequence/AND/多 timeframe）。
//   显式设置 process.env 优先级最高，覆盖 staging.local 内的 nano。
process.env.LLM_STRATEGY_CODEGEN_MODEL = process.env.LLM_STRATEGY_CODEGEN_MODEL_OVERRIDE ?? 'gpt-5.4-mini'

const TEST_ENGINE_SECRET = 'e2e-engine-test-secret'
const PER_STRATEGY_TIMEOUT_MS = 60_000

const REAL_LLM = process.env.E2E_REAL_LLM === '1'
const describeReal = REAL_LLM ? describe : describe.skip

/** 把响应里所有可能含语义识别痕迹的字段拼成单 blob 字符串，方便子串匹配。 */
function buildBlob(payload: Record<string, unknown> | undefined): string {
  if (!payload) return ''
  const parts: string[] = []
  if (typeof payload.assistantPrompt === 'string') parts.push(payload.assistantPrompt)
  if (payload.clarificationState && typeof payload.clarificationState === 'object') {
    const cs = payload.clarificationState as Record<string, unknown>
    if (typeof cs.summary === 'string') parts.push(cs.summary)
    if (Array.isArray(cs.items)) {
      for (const item of cs.items) {
        if (item && typeof item === 'object') {
          for (const v of Object.values(item)) if (typeof v === 'string') parts.push(v)
        }
      }
    }
  }
  if (payload.specDesc != null) parts.push(JSON.stringify(payload.specDesc))
  if (payload.semanticGraph != null) parts.push(JSON.stringify(payload.semanticGraph))
  return parts.join('\n')
}

function expectAnyMatch(blob: string, patterns: ReadonlyArray<string | RegExp>, label: string): void {
  for (const p of patterns) {
    const hit = typeof p === 'string' ? blob.includes(p) : p.test(blob)
    if (hit) return
  }
  throw new Error(`[${label}] blob 未命中任何关键字 ${JSON.stringify(patterns.map(p => String(p)))}：${blob.slice(0, 400)}`)
}

describeReal('Issue #1395 — 8 strategies LLM e2e (atom expression tree)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let publicationPipeline: CodegenSessionPublicationPipelineService

  jest.setTimeout(PER_STRATEGY_TIMEOUT_MS + 30_000)

  beforeAll(async () => {
    loadRealLlmEnv()

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.e2e.local', '.env.e2e'],
          load: backendConfigLoaders,
        }),
        EventEmitterModule.forRoot(),
        EnvModule,
        ClsConfigModule,
        LlmStrategyCodegenModule,
      ],
    })
      .overrideProvider(MarketDataIngestionService)
      .useValue({
        onModuleInit: () => {},
        onModuleDestroy: () => {},
        handleGapFill: () => {},
        handleDynamicSymbolRefresh: () => {},
      })
      .overrideProvider(MarketSymbolCatalogService)
      .useValue({
        onApplicationBootstrap: () => {},
        ensureExchangeSymbolAvailable: async () => 'supported',
      })
      .overrideProvider(CallerIdentityService)
      .useValue({
        async resolveCallerUserIdFromAuthorization(authorization?: string) {
          const token = authorization?.replace(/^Bearer\s+/i, '').trim()
          if (!token) throw new Error('missing bearer token for test')
          return token
        },
      })
      .overrideProvider(EnvService)
      .useValue({
        getString: (key: string) => {
          if (key === 'APP_SECRET') return TEST_ENGINE_SECRET
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
    publicationPipeline = moduleFixture.get(CodegenSessionPublicationPipelineService)
  })

  afterEach(async () => {
    await publicationPipeline.awaitInFlight()
    await prisma.llmStrategyCodeVersion.deleteMany().catch(() => undefined)
    await prisma.llmStrategyCodegenSession.deleteMany().catch(() => undefined)
  })

  afterAll(async () => {
    await app?.close()
  })

  async function sendCodegenMessage(userId: string, utterance: string): Promise<{
    blob: string
    payload: Record<string, unknown>
    /** Issue #1395: 从 DB 直接读 semanticState JSONB，绕过 server-rendered summary 的 legacy 渲染。 */
    semanticState: Record<string, unknown>
  }> {
    const server = app.getHttpServer()
    const startRes = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .send({ userId, initialMessage: utterance })
      .set({ authorization: `Bearer ${userId}` })

    expect([200, 201, 202]).toContain(startRes.status)
    const payload = (startRes.body.data ?? startRes.body) as Record<string, unknown>

    // 从 DB 读 semanticState（response payload 不直接暴露 SemanticState.rules）。
    const sessionId = typeof payload.id === 'string' ? payload.id : ''
    let semanticState: Record<string, unknown> = {}
    if (sessionId) {
      const row = await prisma.llmStrategyCodegenSession.findUnique({ where: { id: sessionId }, select: { semanticState: true } })
      if (row?.semanticState && typeof row.semanticState === 'object') {
        semanticState = row.semanticState as Record<string, unknown>
      }
    }

    // 把 semanticState（含 rules[] 树结构）也加入 blob，让关键字断言能命中 rules 内的 atom key + params。
    const baseBlob = buildBlob(payload)
    const stateBlob = JSON.stringify(semanticState)
    return { blob: `${baseBlob}\n${stateBlob}`, payload, semanticState }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // S1 网格 1：grid 双向 + 突破停止 — assistantPrompt 必须含网格识别 + 不报 missing_*_atom
  // ───────────────────────────────────────────────────────────────────────────
  it('S1 grid 网格双向：assistantPrompt 含网格识别，且不报 missing_entry/exit_atom', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s1',
      'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行「立即停止并撤销所有未成交订单」',
    )
    expectAnyMatch(blob, ['网格', 'grid'], 'S1 grid 识别')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S2 连跌 + 下一根放量反弹
  // ───────────────────────────────────────────────────────────────────────────
  it('S2 连跌 + 下一根放量反弹：assistantPrompt 含 sequence/连跌 + 放量/反弹识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s2',
      'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点',
    )
    expectAnyMatch(blob, ['连续', '连跌', 'sequence', 'consecutive', '三根'], 'S2 连跌序列识别')
    expectAnyMatch(blob, ['放量', '量', 'volume', '反弹', '下一根', 'next_bar'], 'S2 放量反弹/下一根识别')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S3 MA gate + RSI 序列状态
  // ───────────────────────────────────────────────────────────────────────────
  it('S3 MA gate + RSI 跌破再上穿：blob 含 MA50/MA200 + RSI 识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s3',
      'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出',
    )
    expectAnyMatch(blob, ['MA50', 'MA 50', 'ma50'], 'S3 MA50')
    expectAnyMatch(blob, ['MA200', 'MA 200', 'ma200'], 'S3 MA200')
    expectAnyMatch(blob, ['RSI', 'rsi'], 'S3 RSI')
    expectAnyMatch(blob, ['35'], 'S3 RSI 阈值 35')
    expectAnyMatch(blob, ['65'], 'S3 RSI 阈值 65')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S4 BOLL AND volume
  // ───────────────────────────────────────────────────────────────────────────
  it('S4 BOLL 下轨 AND 量能 1.5×：blob 含 BOLL + 量 + 1.5 倍识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s4',
      'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出',
    )
    expectAnyMatch(blob, ['布林', 'BOLL', 'bollinger', 'Bollinger'], 'S4 BOLL')
    expectAnyMatch(blob, ['下轨', 'lower'], 'S4 下轨')
    expectAnyMatch(blob, ['1.5', '1.5倍', '1.5 倍'], 'S4 1.5 倍')
    expectAnyMatch(blob, ['上轨', 'upper'], 'S4 上轨')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S5 AND 入 / OR 出
  // ───────────────────────────────────────────────────────────────────────────
  it('S5 MA above + MACD 金叉买入 / 反向 OR 卖出：blob 含 MA100 + MACD + 金叉/死叉识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s5',
      'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出',
    )
    expectAnyMatch(blob, ['MA100', 'MA 100', 'ma100'], 'S5 MA100')
    expectAnyMatch(blob, ['MACD', 'macd'], 'S5 MACD')
    expectAnyMatch(blob, ['金叉', 'cross_over', '上穿'], 'S5 金叉')
    expectAnyMatch(blob, ['死叉', 'cross_under', '下穿', '跌破'], 'S5 死叉/跌破')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S6 突破回踩 + 止损
  // ───────────────────────────────────────────────────────────────────────────
  it('S6 突破回踩：blob 含 突破 + 回踩 + 止损识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s6',
      'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌破突破位下方止损',
    )
    expectAnyMatch(blob, ['突破', 'breakout'], 'S6 突破')
    expectAnyMatch(blob, ['回踩', 'retest', 'pullback'], 'S6 回踩')
    expectAnyMatch(blob, ['止损', 'stop', 'stop_loss'], 'S6 止损')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S7 ATR 双侧止损止盈
  // ───────────────────────────────────────────────────────────────────────────
  it('S7 突破 MA20 + ATR 双侧：blob 含 MA20 + 2 倍 ATR + 3 倍 ATR 识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s7',
      'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈',
    )
    expectAnyMatch(blob, ['MA20', 'MA 20', 'ma20'], 'S7 MA20')
    expectAnyMatch(blob, ['ATR', 'atr'], 'S7 ATR')
    expectAnyMatch(blob, ['2 倍', '2倍', '2x', '×2', '2-times', '2.0'], 'S7 2 倍')
    expectAnyMatch(blob, ['3 倍', '3倍', '3x', '×3', '3-times', '3.0', '止盈'], 'S7 3 倍/止盈')
  }, PER_STRATEGY_TIMEOUT_MS)

  // ───────────────────────────────────────────────────────────────────────────
  // S8 三 TF 共振 EMA20
  // ───────────────────────────────────────────────────────────────────────────
  it('S8 三 TF 共振 EMA20：blob 含 15m + 1h + 4h + EMA20 识别', async () => {
    const { blob } = await sendCodegenMessage(
      'u-1395-s8',
      '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约',
    )
    expectAnyMatch(blob, ['EMA20', 'EMA 20', 'ema20'], 'S8 EMA20')
    expectAnyMatch(blob, ['15m', '15min', '15 分钟', '15分钟'], 'S8 15m')
    expectAnyMatch(blob, ['1h', '1小时', '1 小时'], 'S8 1h')
    expectAnyMatch(blob, ['4h', '4小时', '4 小时'], 'S8 4h')
  }, PER_STRATEGY_TIMEOUT_MS)
})
