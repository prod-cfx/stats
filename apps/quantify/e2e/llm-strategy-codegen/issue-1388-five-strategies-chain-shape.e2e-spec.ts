/**
 * Issue #1388 follow-up to #1383：5 策略 conversation → backtest 链路 shape 验证
 *
 * 范围（非严格策略正确性，只校验链路 wire-up）：
 *   - 复用 #1383 5 条用户实测 prompts 走真实 LLM conversation，直到 ACCEPTABLE 终态。
 *   - 对每条策略调 `POST /api/v1/backtesting/jobs`（mock 掉 BacktestRunnerService、
 *     BacktestMarketDataService、PublishedStrategySnapshotsRepository），轮询
 *     `GET /api/v1/backtesting/jobs/{id}` 直到 status === 'succeeded'。
 *   - Deploy 阶段：**跳过**，原因见下文 pre-existing infra gap。
 *
 * Pre-existing infrastructure gaps（不是本 PR 引入的回归）：
 *   1. `BacktestRunnerService` / `BacktestMarketDataService` 无 real-market E2E
 *      （仓库现有 `backtesting.e2e-spec.ts` 也是 mock），需要 ingestion + real kline
 *      数据 fixture，本次不修。
 *   2. `AccountStrategyViewService.deployStrategy` 依赖 `TradingService`、
 *      `GridRuntimeService`、`PositionsService`、`PositionSyncService`、
 *      `StrategyInstancesService`、`ExchangeAccount` 表 fixture 等一整套交易侧
 *      基础设施；当前 quantify e2e bootstrap 无对应 fixtures（仅 unit-level mock
 *      在 `account-strategy-view-deploy*.spec.ts`），本 spec 用 `it.skip` 标注，
 *      不在本 PR 范围。
 *   3. `void publicationPipeline.run(...)` 在 conversation `PUBLISHED` 后产出
 *      `PublishedStrategySnapshot` 行；由于 publication 涉及编译器 + market-data
 *      catalog，更稳定的做法是 **mock snapshot repository** 让 backtest 用固定
 *      snapshot id（已在 #1383 PR body 中记录为 follow-up）。
 *
 * 本地复跑：
 *   dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/issue-1388-five-strategies-chain-shape
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
import { BacktestingModule } from '@/modules/backtesting/backtesting.module'
import { BacktestRunnerService } from '@/modules/backtesting/core/backtest-runner.service'
import { BacktestCallerIdentityService } from '@/modules/backtesting/services/backtest-caller-identity.service'
import { BacktestMarketDataService } from '@/modules/backtesting/services/backtest-market-data.service'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { LlmStrategyCodegenModule } from '@/modules/llm-strategy-codegen/llm-strategy-codegen.module'
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { CodegenSessionPublicationPipelineService } from '@/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'
import { PrismaService } from '@/prisma/prisma.service'
import {
  buildApiUrl,
  createSemanticEmaStackPublishedSnapshotFixture,
} from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'
import { loadRealLlmEnv } from './__setup__/load-real-llm-env'

loadRealLlmEnv()

const TEST_ENGINE_SECRET = 'e2e-engine-test-secret'
const PER_STRATEGY_TIMEOUT_MS = 240_000
const SNAPSHOT_ID = 'snapshot-1388-shape'

const ACCEPTABLE_TERMINAL_STATUSES = new Set([
  'DRAFTING',
  'CONFIRM_GATE',
  'GENERATING',
  'PUBLISHED',
])

interface UserStrategyFixture {
  readonly id: string
  readonly description: string
  readonly initialMessage: string
  readonly followUps?: readonly string[]
}

// 与 #1383 spec 同源 5 条 prompts（逐字摘录）
const USER_STRATEGIES: readonly UserStrategyFixture[] = [
  {
    id: 'S1',
    description: '网格再平衡（OKX BTCUSDT 永续 15m）',
    initialMessage:
      '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    followUps: ['确认，按上述参数生成'],
  },
  {
    id: 'S2',
    description: '止损止盈双重渲染（OKX BTC 3min/15min）',
    initialMessage:
      '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%',
  },
  {
    id: 'S3',
    description: 'EMA 三栈（15m EMA20/60/144）',
    initialMessage:
      '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
  },
  {
    id: 'S4',
    description: '答槽位不丢原子（S3 + okx 答槽）',
    initialMessage:
      '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    followUps: ['okx'],
  },
  {
    id: 'S5',
    description: 'RSI+ATR+账户回撤（ETH 永续 15m）',
    initialMessage:
      'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
  },
] as const

describe('issue-1388 五策略 conversation → backtest 链路 shape', () => {
  let app: INestApplication
  let prisma: PrismaService
  let publicationPipeline: CodegenSessionPublicationPipelineService
  let runnerMock: { run: jest.Mock }

  jest.setTimeout(PER_STRATEGY_TIMEOUT_MS + 30_000)

  beforeAll(async () => {
    loadRealLlmEnv()

    // 标准的 EMA stack snapshot fixture —— 与 backtesting.e2e-spec.ts 同源；
    // 让 runner 与 strategyAdapter 接到一个合法 published snapshot 即可，
    // 实际策略语义由前置 LLM conversation 验证。
    const publishedSnapshot = createSemanticEmaStackPublishedSnapshotFixture({
      id: SNAPSHOT_ID,
      strategyInstanceId: 'instance-1388',
      strategyTemplateId: 'template-1388',
      sessionId: 'session-1388',
      snapshotHash: 'snapshot-hash-1388',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      positionPct: 25,
    })

    const cannedReport = {
      summary: {
        netProfit: 10,
        netProfitPct: 0.001,
        maxDrawdownPct: 0,
        winRate: 1,
        profitFactor: 10,
        totalTrades: 1,
      },
      equityCurve: [{ ts: 1, equity: 10010 }],
      trades: [{
        id: 't1', symbol: 'BTCUSDT', side: 'LONG',
        entryTs: 1, entryPrice: 100, exitTs: 2, exitPrice: 110,
        qty: 1, fee: 0, pnl: 10, returnPct: 0.1,
      }],
      markers: [
        { symbol: 'BTCUSDT', ts: 1, price: 100, kind: 'entry_long', tradeId: 't1' },
        { symbol: 'BTCUSDT', ts: 2, price: 110, kind: 'exit_long', tradeId: 't1' },
      ],
      bySymbol: [{ symbol: 'BTCUSDT', pnl: 10, trades: 1, winRate: 1 }],
      openPositions: [],
    }

    runnerMock = { run: jest.fn().mockResolvedValue(cannedReport) }

    const marketDataMock = {
      ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({ supported: true }),
      prepareData: jest.fn().mockResolvedValue(undefined),
      resolveCoverage: jest.fn().mockResolvedValue({
        kind: 'full',
        availableRange: { fromTs: 1, toTs: 2 },
        appliedRange: { fromTs: 1, toTs: 2 },
      }),
      loadBars: jest.fn().mockResolvedValue([{
        symbol: 'BTCUSDT', timeframe: '5m',
        openTime: 1, closeTime: 2,
        open: 100, high: 110, low: 90, close: 105, volume: 100,
      }]),
    }

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
        BacktestingModule,
      ],
    })
      .overrideProvider(MarketDataIngestionService)
      .useValue({
        onModuleInit: () => {},
        onModuleDestroy: () => {},
        handleGapFill: () => {},
        handleDynamicSymbolRefresh: () => {},
        ensureSymbolsSubscribed: async () => {},
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
          if (!token) throw new Error('missing bearer token')
          return token
        },
      })
      .overrideProvider(BacktestCallerIdentityService)
      .useValue({
        async resolveCallerUserIdFromAuthorization(authorization?: string) {
          const token = authorization?.replace(/^Bearer\s+/i, '').trim()
          if (!token) throw new Error('missing bearer token')
          return token
        },
      })
      .overrideProvider(BacktestRunnerService)
      .useValue(runnerMock)
      .overrideProvider(BacktestMarketDataService)
      .useValue(marketDataMock)
      .overrideProvider(BacktestStrategyAdapterService)
      .useValue({
        build: jest.fn().mockResolvedValue({
          id: 'demo-strategy-1388',
          params: {},
          fn: () => ({ type: 'NOOP' }),
        }),
      })
      // 把 published snapshot lookup mock 成总是返回 EMA stack fixture，
      // 绕过 publication-pipeline 真正落库（避开 #1383 P2025 后台竞争）。
      .overrideProvider(PublishedStrategySnapshotsRepository)
      .useValue({
        findByIdForUser: jest.fn().mockResolvedValue(publishedSnapshot),
        // 其它方法在本 spec 范围内不会被 backtest 流程触达，留空即可。
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
    await prisma.backtestJob.deleteMany().catch(() => undefined)
  })

  afterAll(async () => {
    await app?.close()
  })

  function extractStatus(payload: any): string {
    return String(payload?.status ?? '')
  }

  async function driveConversation(server: any, fx: UserStrategyFixture, userId: string): Promise<string> {
    const startRes = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .send({ userId, initialMessage: fx.initialMessage })
      .set({ authorization: `Bearer ${userId}` })
    expect([200, 201, 202]).toContain(startRes.status)
    const startPayload = startRes.body.data ?? startRes.body
    const sessionId: string = startPayload.id
    let lastStatus = extractStatus(startPayload)

    for (const followUp of fx.followUps ?? []) {
      const res = await supertestRequest(server)
        .post(buildApiUrl(`llm-strategy-codegen/sessions/${sessionId}/messages`))
        .send({ userId, message: followUp })
        .set({ authorization: `Bearer ${userId}` })
      expect([200, 201, 202]).toContain(res.status)
      const payload = res.body.data ?? res.body
      lastStatus = extractStatus(payload)
    }

    if (!ACCEPTABLE_TERMINAL_STATUSES.has(lastStatus)) {
      throw new Error(`[${fx.id}] conversation 未到达 ACCEPTABLE 终态：${lastStatus}`)
    }
    return sessionId
  }

  it.each(USER_STRATEGIES)(
    '[$id] $description — conversation + backtest 链路 succeeded',
    async (fx) => {
      const userId = `u-e2e-1388-${fx.id.toLowerCase()}`
      const server = app.getHttpServer()

      // Stage 1：LLM conversation 走到 ACCEPTABLE 终态
      await driveConversation(server, fx, userId)

      // Stage 2：backtest job 用 fixture snapshot 触发链路
      const payload = {
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h'],
        initialCash: 10000,
        leverage: 2,
        allowPartial: false,
        execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
        strategy: {
          id: 'demo-strategy-1388',
          protocolVersion: 'v1',
          publishedSnapshotId: SNAPSHOT_ID,
          params: { fast: 9, slow: 21, marketType: 'spot' },
        },
        dataRange: { fromTs: 1, toTs: 2 },
      }
      const createRes = await supertestRequest(server)
        .post(buildApiUrl('backtesting/jobs'))
        .set('Authorization', `Bearer ${userId}`)
        .send(payload)
        .expect(201)

      const jobId: string = createRes.body?.id
      expect(typeof jobId).toBe('string')
      expect(jobId.length).toBeGreaterThan(0)

      let status: string = createRes.body?.status
      for (let i = 0; i < 20 && status !== 'succeeded' && status !== 'failed'; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
        const jobRes = await supertestRequest(server)
          .get(buildApiUrl(`backtesting/jobs/${jobId}`))
          .set('Authorization', `Bearer ${userId}`)
          .expect(200)
        status = jobRes.body?.status
      }
      expect(status).toBe('succeeded')
      expect(runnerMock.run).toHaveBeenCalled()
    },
    PER_STRATEGY_TIMEOUT_MS,
  )

  // Pre-existing infra gap：deploy 链路涉及 AccountStrategyViewModule + TradingService
  //   + GridRuntime + PositionSync + ExchangeAccount 表 fixture。当前 quantify e2e
  //   bootstrap 不含这些 fixture（unit spec 在 account-strategy-view-deploy*.spec.ts
  //   走 mock，不是 e2e）。完整 deploy E2E 留 follow-up。
  // eslint-disable-next-line no-console
  console.warn('[issue-1388] deploy 阶段跳过：缺 AccountStrategyView + TradingService + ExchangeAccount 表 fixture（pre-existing infra gap，非本 PR 引入）')
  it.skip('[follow-up] 5 策略 deploy 阶段（需 AccountStrategyView module + ExchangeAccount fixture）', () => {})
})
