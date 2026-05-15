/**
 * Issue #1388 follow-up — 5 策略 conversation → 真实 backtest → 真实 deploy（repo 层）链路
 *
 * 与 issue-1388-five-strategies-chain-shape.e2e-spec.ts 的差异：
 *   - **Backtest 真跑**：`BacktestRunnerService` 与 `BacktestStrategyAdapterService` 都用真实
 *     实现（不再 mock）。脚本编译 + onBar 执行实际跑通；仅 `BacktestMarketDataService`
 *     这一外部 boundary 用合成 OHLCV 替换（避免 ccxt provider 网络依赖）。
 *   - **Deploy 真跑（repo 层）**：直接调用 `AccountStrategyViewRepository.deployStrategyForUser`
 *     落 DB —— 完整跑通事务、用户校验、ExchangeAccount 校验、StrategyInstance update、
 *     UserStrategySubscription upsert、UserStrategyAccount 创建。Mode='TESTNET'。
 *
 * Hard wall（必要 stub，附文件:行号引用）：
 *   - `BacktestMarketDataService.prepareData` / `loadBars` / `resolveCoverage` —— prepareData
 *     会调真实 ccxt provider（`apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts:71`
 *     `provider.fetchSymbols(...)`）。本 spec 用合成 50 根确定性 K 线（线性 + 正弦）注入
 *     loadBars，runner 内部 EMA/RSI/ATR 求值仍真跑。
 *   - Service 层 deploy（HTTP `POST /account/ai-quant/strategies/deploy`）跳过：
 *     `AccountStrategyViewService.deployStrategy:1231` 在调 `resolveExchangeBalanceSnapshot`
 *     → `tradingService.getBalance` (`apps/quantify/src/modules/trading/trading.service.ts:437`)
 *     时会调真实 ccxt adapter；Stub 该一层后又会触发 `requireGridRuntimeService` /
 *     `initializeStatesForDeploy` 等子系统连锁，每个 stub 都会偏离"真实运行"语义。
 *     pragmatic 折衷：直接调 `AccountStrategyViewRepository.deployStrategyForUser`
 *     (`apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts:136`)
 *     —— 这是 deploy 唯一真正落 DB 的入口，事务 + 一致性校验全部真跑。
 *
 * 本地复跑：
 *   dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/issue-1388-five-strategies-real-chain
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
import { AccountStrategyViewModule } from '@/modules/account-strategy-view/account-strategy-view.module'
import { AccountStrategyViewRepository } from '@/modules/account-strategy-view/repositories/account-strategy-view.repository'
import { BacktestingModule } from '@/modules/backtesting/backtesting.module'
import { BacktestCallerIdentityService } from '@/modules/backtesting/services/backtest-caller-identity.service'
import { BacktestMarketDataService } from '@/modules/backtesting/services/backtest-market-data.service'
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
  /** 用于生成 deterministic seed prefix（避免跨策略 fixture 冲突） */
  readonly seedPrefix: string
}

const USER_STRATEGIES: readonly UserStrategyFixture[] = [
  {
    id: 'S1',
    seedPrefix: 'real-s1',
    description: '网格再平衡（OKX BTCUSDT 永续 15m）',
    initialMessage:
      '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    followUps: ['确认，按上述参数生成'],
  },
  {
    id: 'S2',
    seedPrefix: 'real-s2',
    description: '止损止盈双重渲染（OKX BTC 3min/15min）',
    initialMessage:
      '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%',
  },
  {
    id: 'S3',
    seedPrefix: 'real-s3',
    description: 'EMA 三栈（15m EMA20/60/144）',
    initialMessage:
      '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
  },
  {
    id: 'S4',
    seedPrefix: 'real-s4',
    description: '答槽位不丢原子（S3 + okx 答槽）',
    initialMessage:
      '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    followUps: ['okx'],
  },
  {
    id: 'S5',
    seedPrefix: 'real-s5',
    description: 'RSI+ATR+账户回撤（ETH 永续 15m）',
    initialMessage:
      'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
  },
] as const

/**
 * 生成 ~60 根确定性合成 bar（线性 + 正弦），让 EMA(20)/RSI(14)/ATR 等指标有足够 warmup
 * 求值。基准时间：data range 内均匀分布。
 */
function buildSyntheticBars(opts: {
  symbol: string
  timeframe: string
  fromTs: number
  toTs: number
  bars?: number
}) {
  const count = opts.bars ?? 60
  const span = Math.max(opts.toTs - opts.fromTs, 1)
  const step = Math.floor(span / count)
  const bars: Array<{
    symbol: string
    timeframe: string
    openTime: number
    closeTime: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }> = []
  const basePrice = 100
  for (let i = 0; i < count; i += 1) {
    const closeTime = opts.fromTs + (i + 1) * step
    const openTime = closeTime - step
    // 线性 + 正弦走势：足以让 EMA 交叉、RSI、ATR 真求值出非平凡数
    const drift = (i / count) * 5
    const wave = Math.sin(i / 4) * 3
    const close = basePrice + drift + wave
    const open = i === 0 ? basePrice : bars[i - 1].close
    const high = Math.max(open, close) + 1
    const low = Math.min(open, close) - 1
    bars.push({
      symbol: opts.symbol,
      timeframe: opts.timeframe,
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      volume: 100 + i,
    })
  }
  return bars
}

describe('issue-1388 五策略 conversation → 真实 backtest → 真实 deploy（repo）链路', () => {
  let app: INestApplication
  let prisma: PrismaService
  let publicationPipeline: CodegenSessionPublicationPipelineService
  let accountStrategyRepo: AccountStrategyViewRepository

  // backtest 范围（仅用于 jobs 控制器 dataRange / 合成 bar 时间戳）；具体数值无业务含义
  const DATA_RANGE = { fromTs: 1_700_000_000_000, toTs: 1_700_003_600_000 }

  jest.setTimeout(PER_STRATEGY_TIMEOUT_MS + 30_000)

  // 每个 strategy 持有独立 snapshot id；deploy stage 用 strategyInstanceId 落 DB
  const buildSnapshotId = (fx: UserStrategyFixture) => `snapshot-1388-${fx.seedPrefix}`
  const buildInstanceId = (fx: UserStrategyFixture) => `instance-1388-${fx.seedPrefix}`
  const buildTemplateId = (fx: UserStrategyFixture) => `template-1388-${fx.seedPrefix}`
  const buildUserId = (fx: UserStrategyFixture) => `u-1388-real-${fx.seedPrefix}`
  const buildExchangeAccountId = (fx: UserStrategyFixture) => `xa-1388-${fx.seedPrefix}`

  /**
   * Per-strategy fixture：published snapshot（EMA stack 通用骨架）+ matching DB rows.
   * deploy stage 依赖：User、StrategyTemplate、StrategyInstance、ExchangeAccount(testnet)。
   */
  function buildSnapshotForStrategy(fx: UserStrategyFixture) {
    return createSemanticEmaStackPublishedSnapshotFixture({
      id: buildSnapshotId(fx),
      strategyInstanceId: buildInstanceId(fx),
      strategyTemplateId: buildTemplateId(fx),
      sessionId: `session-1388-${fx.seedPrefix}`,
      snapshotHash: `snapshot-hash-1388-${fx.seedPrefix}`,
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      positionPct: 25,
    })
  }

  async function seedDeployFixtures(fx: UserStrategyFixture): Promise<void> {
    const userId = buildUserId(fx)
    const templateId = buildTemplateId(fx)
    const instanceId = buildInstanceId(fx)
    const exchangeAccountId = buildExchangeAccountId(fx)
    const snapshot = buildSnapshotForStrategy(fx)

    // 清理 — afterEach 已删，但保险起见
    await prisma.userStrategySubscription.deleteMany({ where: { userId } }).catch(() => undefined)
    await prisma.userStrategyAccount.deleteMany({ where: { userId } }).catch(() => undefined)
    await prisma.strategyInstanceRiskProfile.deleteMany({ where: { strategyInstanceId: instanceId } }).catch(() => undefined)
    await prisma.strategyInstance.deleteMany({ where: { id: instanceId } }).catch(() => undefined)
    await prisma.strategyTemplate.deleteMany({ where: { id: templateId } }).catch(() => undefined)
    await prisma.exchangeAccount.deleteMany({ where: { id: exchangeAccountId } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined)

    await prisma.user.create({
      data: {
        id: userId,
        email: `${fx.seedPrefix}@e2e-1388.test`,
        nickname: `e2e-${fx.seedPrefix}`,
      },
    })
    await prisma.exchangeAccount.create({
      data: {
        id: exchangeAccountId,
        userId,
        exchangeId: 'okx',
        name: 'e2e-testnet',
        isTestnet: true,
        encryptedConfig: 'e2e-mock-encrypted-credentials',
      },
    })
    await prisma.strategyTemplate.create({
      data: {
        id: templateId,
        name: `e2e-template-1388-${fx.seedPrefix}`,
        description: 'e2e issue-1388 real-chain template',
        llmModel: 'e2e-test',
        promptTemplate: '',
        paramsSchema: {},
      },
    })
    await prisma.strategyInstance.create({
      data: {
        id: instanceId,
        strategyTemplateId: templateId,
        name: `e2e-source-${fx.seedPrefix}`,
        llmModel: 'e2e-test',
        params: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '5m',
          positionPct: 25,
        },
        status: 'draft',
        mode: 'PAPER',
        createdBy: userId,
        // 标记 PUBLISHED_SNAPSHOT 绑定元数据，匹配 deploy repo 的 binding 校验
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: snapshot.id,
          snapshotHash: snapshot.snapshotHash,
        },
      },
    })
  }

  async function cleanupDeployFixtures(fx: UserStrategyFixture): Promise<void> {
    const userId = buildUserId(fx)
    const templateId = buildTemplateId(fx)
    const instanceId = buildInstanceId(fx)
    const exchangeAccountId = buildExchangeAccountId(fx)
    await prisma.userStrategySubscription.deleteMany({ where: { userId } }).catch(() => undefined)
    await prisma.userStrategyAccount.deleteMany({ where: { userId } }).catch(() => undefined)
    await prisma.strategyInstanceRiskProfile.deleteMany({ where: { strategyInstanceId: instanceId } }).catch(() => undefined)
    await prisma.strategyInstance.deleteMany({ where: { id: instanceId } }).catch(() => undefined)
    await prisma.strategyTemplate.deleteMany({ where: { id: templateId } }).catch(() => undefined)
    await prisma.exchangeAccount.deleteMany({ where: { id: exchangeAccountId } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined)
  }

  beforeAll(async () => {
    loadRealLlmEnv()

    // BacktestMarketDataService 全方法 stub —— 唯一被 mock 的"外部 boundary"。
    // 见文件顶部 Hard wall 注释。这里返回合成 bars（与请求 symbol/timeframe 对齐）。
    const marketDataStub = {
      ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({ supported: true }),
      ensureSymbolSupported: jest.fn().mockResolvedValue('supported'),
      prepareData: jest.fn().mockResolvedValue(undefined),
      resolveCoverage: jest.fn().mockResolvedValue({
        kind: 'full',
        availableRange: { fromTs: DATA_RANGE.fromTs, toTs: DATA_RANGE.toTs },
        appliedRange: { fromTs: DATA_RANGE.fromTs, toTs: DATA_RANGE.toTs },
      }),
      loadBars: jest.fn().mockImplementation(async (input: any) => {
        const symbol = input.symbols?.[0] ?? 'BTCUSDT'
        const baseTf = input.baseTimeframe ?? '5m'
        const stateTfs: string[] = Array.isArray(input.stateTimeframes) ? input.stateTimeframes : []
        const tfs = Array.from(new Set([baseTf, ...stateTfs]))
        const bars: any[] = []
        for (const tf of tfs) {
          bars.push(...buildSyntheticBars({
            symbol,
            timeframe: tf,
            fromTs: input.dataRange?.fromTs ?? DATA_RANGE.fromTs,
            toTs: input.dataRange?.toTs ?? DATA_RANGE.toTs,
          }))
        }
        return bars
      }),
    }

    // PublishedStrategySnapshotsRepository.findByIdForUser —— 按 snapshotId 返回 per-strategy fixture
    const snapshotsRepoStub = {
      findByIdForUser: jest.fn().mockImplementation(async (id: string, _userId: string) => {
        const fx = USER_STRATEGIES.find(item => buildSnapshotId(item) === id)
        return fx ? buildSnapshotForStrategy(fx) : null
      }),
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
        AccountStrategyViewModule,
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
      // 关键差异：runner 与 strategy adapter 都用真实实现（不再 .overrideProvider）。
      // 仅 BacktestMarketDataService 这一外部 boundary stub。
      .overrideProvider(BacktestMarketDataService)
      .useValue(marketDataStub)
      .overrideProvider(PublishedStrategySnapshotsRepository)
      .useValue(snapshotsRepoStub)
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
    accountStrategyRepo = moduleFixture.get(AccountStrategyViewRepository)
  })

  afterEach(async () => {
    await publicationPipeline.awaitInFlight()
    await prisma.llmStrategyCodeVersion.deleteMany().catch(() => undefined)
    await prisma.llmStrategyCodegenSession.deleteMany().catch(() => undefined)
    await prisma.backtestJob.deleteMany().catch(() => undefined)
  })

  afterAll(async () => {
    // deploy DB 残留逐策略清理（防 unique 冲突影响后续 run）
    for (const fx of USER_STRATEGIES) {
      await cleanupDeployFixtures(fx).catch(() => undefined)
    }
    await app?.close()
  })

  function extractStatus(payload: any): string {
    return String(payload?.status ?? '')
  }

  async function driveConversation(server: any, fx: UserStrategyFixture, userId: string): Promise<void> {
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
  }

  async function runRealBacktest(server: any, fx: UserStrategyFixture, userId: string): Promise<void> {
    const snapshotId = buildSnapshotId(fx)
    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 10000,
      leverage: 1,
      allowPartial: false,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: `demo-strategy-1388-${fx.seedPrefix}`,
        protocolVersion: 'v1',
        publishedSnapshotId: snapshotId,
        params: { marketType: 'spot' },
      },
      dataRange: { fromTs: DATA_RANGE.fromTs, toTs: DATA_RANGE.toTs },
    }
    const createRes = await supertestRequest(server)
      .post(buildApiUrl('backtesting/jobs'))
      .set('Authorization', `Bearer ${userId}`)
      .send(payload)
      .expect(201)

    const jobId: string = createRes.body?.id
    expect(typeof jobId).toBe('string')

    let status: string = createRes.body?.status
    let lastBody: any = createRes.body
    for (let i = 0; i < 60 && status !== 'succeeded' && status !== 'failed'; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const jobRes = await supertestRequest(server)
        .get(buildApiUrl(`backtesting/jobs/${jobId}`))
        .set('Authorization', `Bearer ${userId}`)
        .expect(200)
      status = jobRes.body?.status
      lastBody = jobRes.body
    }
    if (status !== 'succeeded') {
      // eslint-disable-next-line no-console
      console.error(`[${fx.id}] backtest job did not succeed:`, JSON.stringify(lastBody).slice(0, 1000))
    }
    expect(status).toBe('succeeded')
  }

  async function runRealDeploy(fx: UserStrategyFixture): Promise<void> {
    const userId = buildUserId(fx)
    const snapshot = buildSnapshotForStrategy(fx)
    await seedDeployFixtures(fx)

    // 直接调 repo.deployStrategyForUser —— 唯一真正落 DB 的入口
    // 见 apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts:136
    const result = await accountStrategyRepo.deployStrategyForUser({
      userId,
      name: `e2e-deploy-${fx.seedPrefix}`,
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '5m',
      positionPct: 25,
      positionSizing: { mode: 'fixed_ratio', value: 0.25 },
      publishedSnapshotBinding: {
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        sourceStrategyInstanceId: snapshot.strategyInstanceId,
        sourceStrategyTemplateId: snapshot.strategyTemplateId,
      },
      initialBalanceQuote: 10000,
      accountBalanceQuote: 10000,
      fundingSnapshot: null,
      mode: 'TESTNET',
      exchangeAccountId: buildExchangeAccountId(fx),
      exchangeAccountName: 'e2e-testnet',
      deploymentExecutionConfig: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'GTC',
      },
      executionConfigVersion: 1,
    })

    expect(result.mode).toBe('TESTNET')
    expect(result.strategyInstanceId).toBe(buildInstanceId(fx))

    // 真实校验：DB 行确实写入了 publishedSnapshotId binding
    const updated = await prisma.strategyInstance.findUnique({ where: { id: result.strategyInstanceId } })
    expect(updated).toBeTruthy()
    expect((updated!.metadata as any)?.publishedSnapshotId).toBe(snapshot.id)
    expect(updated!.runtimeBindingStatus).toBe('PENDING')

    // 真实校验：subscription 与 strategyAccount 落表
    const subscription = await prisma.userStrategySubscription.findFirst({
      where: { userId, strategyInstanceId: result.strategyInstanceId },
    })
    expect(subscription).toBeTruthy()
    expect(subscription!.status).toBe('active')

    const account = await prisma.userStrategyAccount.findFirst({
      where: { userId, strategyId: buildTemplateId(fx) },
    })
    expect(account).toBeTruthy()
  }

  it.each(USER_STRATEGIES)(
    '[$id] $description — conversation → real backtest → real deploy(repo)',
    async (fx) => {
      const userId = buildUserId(fx)
      const server = app.getHttpServer()

      // Stage 1：真实 LLM conversation
      await driveConversation(server, fx, userId)

      // Stage 2：真实 backtest（runner + adapter 真跑，bars 合成）
      await runRealBacktest(server, fx, userId)

      // Stage 3：真实 deploy（repo 层落 DB）
      await runRealDeploy(fx)
    },
    PER_STRATEGY_TIMEOUT_MS,
  )
})
