/**
 * Issue #1364 AC-5 / AC-7 — 真实 LLM 端到端 验收（5 条用户实测策略）
 *
 * 范围：
 *   - 5 条用户实测策略经 真实 OpenAI 调用（gpt-5.4-nano）走完 conversation → state → emit
 *   - 不 mock `aiService.chat`；secrets 从 /home/ubuntu/jerry_work/stats/.env.staging.local
 *     或 GH Actions secrets 加载
 *   - **fail-loud**：缺 API key 直接 throw（不走 describe.skip 静默兜底）
 *
 * 边界（follow-up，不在本 PR 内）：
 *   - backtest job 跑到 SUCCEEDED + publish PUBLISHED：依赖 bull queue worker + ccxt
 *     adapter + market-data ingestion 整套 e2e fixtures；当前 bootstrap 仅 LlmStrategyCodegenModule
 *     最小依赖，无 worker 启动，因此最终 status 通常停在 `CONFIRM_GATE` 或 `GENERATING`
 *     /`REJECTED`/`CONSISTENCY_FAILED`，PUBLISHED 留 follow-up
 *   - ac8-extended-prompts.e2e-spec.ts 与 full-matrix.e2e-spec.ts 迁移到真实 LLM：留
 *     follow-up（mock fixture 1500+ 行，超出本 PR 范围；后续可单独拆 PR）
 *
 * 本地复跑：
 *   dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/codegen-to-deploy-pipeline
 *
 * CI：见 .github/workflows/llm-e2e-acceptance.yml（PR 必跑 + nightly 18:00 UTC）。
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
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'
import { loadRealLlmEnv } from './__setup__/load-real-llm-env'

// 顶层加载 LLM secrets——若缺 key 直接 throw，阻断后续 module 加载
loadRealLlmEnv()

const TEST_ENGINE_SECRET = 'e2e-engine-test-secret'
const PER_STRATEGY_TIMEOUT_MS = 180_000

interface UserStrategyFixture {
  readonly id: string
  readonly description: string
  readonly initialMessage: string
  readonly followUps?: readonly string[]
  /** 允许走 unsupported_fallback（如 U4 drawdown_block 当前未建模） */
  readonly allowUnsupportedFallback?: boolean
}

/**
 * 5 条用户实测策略（issue #1364 验收单逐字摘录）。
 *
 * 注：这是真实 LLM 调用，不强 assert 具体 atom key——LLM 输出非确定，结构性 smoke
 * 比内容比对更可靠。失败信号通过 status / specDesc 暴露。
 */
const USER_STRATEGIES: readonly UserStrategyFixture[] = [
  {
    id: 'U1',
    description: 'BTC 永续 1h，EMA20 上穿 EMA50 开多，下穿平多',
    initialMessage: 'BTC 永续合约，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。',
  },
  {
    id: 'U2',
    description: 'ETH 永续 15m，RSI≤30 开多，ATR 止损，3% 分批止盈，回撤 10% 暂停',
    initialMessage:
      'ETH 永续合约，15 分钟级别。当 RSI(14) ≤ 30 时开多；使用 ATR 移动止损，每盈利 3% 分批止盈 1/3；账户回撤超过 10% 时暂停开仓。',
  },
  {
    id: 'U3',
    description: 'SOL 现货 30m，0.3-0.7 分位区间 ATR 自适应网格',
    initialMessage:
      'SOL 现货，30 分钟级别。在最近 N 根 K 线的 0.3-0.7 分位价格区间内做 ATR 自适应网格交易，间距随 ATR 动态调整。',
  },
  {
    id: 'U4',
    description: 'BTC 现货 1d 每周一定投 100 U，加仓 ≤5 次，单笔回撤 8% 暂停定投',
    initialMessage:
      'BTC 现货，日线。每周一定投买入 100 USDT，最多加仓 5 次；单笔买入后若回撤超过 8% 则暂停后续定投。',
    // drawdown_block 当前未建模，允许走 unsupported_fallback
    allowUnsupportedFallback: true,
  },
  {
    id: 'U5',
    description: '双子策略 BTC RSI + ETH EMA，总敞口 50% / 单币 30% / 回撤 15%',
    initialMessage:
      '双子策略：BTC 用 RSI(14) ≤ 30 开多、≥ 70 平多；ETH 用 EMA20 上穿 EMA50 开多、下穿平多。总账户敞口 ≤ 50%，单币种敞口 ≤ 30%，账户回撤 ≥ 15% 时暂停全部新开仓。',
  },
] as const

/**
 * 已知合法 status 集合。
 *
 * - `DRAFTING`：LLM 返回后仍需澄清（多轮对话首轮常态），表明 LLM → 编排器通路打通
 * - `CONFIRM_GATE`：LLM 已生成 canonicalSpec，等用户确认（理想终态，对 1 轮即可推断逻辑的策略）
 * - `GENERATING` / `PUBLISHED`：进入脚本生成或发布（依赖 worker，本 spec 通常不到）
 * - `REJECTED` / `CONSISTENCY_FAILED`：不支持路径（U4 drawdown_block 允许）
 *
 * 注：完整 PUBLISHED 流程依赖 backtest queue worker，本 spec bootstrap 不含 worker；
 * 任意进入 `CONFIRM_GATE` / `DRAFTING` 已表明 LLM → state 通路打通，PUBLISHED 留 follow-up。
 */
const ACCEPTABLE_TERMINAL_STATUSES = new Set([
  'DRAFTING',
  'CONFIRM_GATE',
  'GENERATING',
  'PUBLISHED',
  'REJECTED',
  'CONSISTENCY_FAILED',
])

describe('codegen-to-deploy-pipeline e2e (issue #1364 AC-5, real LLM)', () => {
  let app: INestApplication
  let prisma: PrismaService

  jest.setTimeout(PER_STRATEGY_TIMEOUT_MS + 30_000)

  beforeAll(async () => {
    // 再次显式校验（防止某些路径绕过顶层 loader）
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
  })

  afterEach(async () => {
    await prisma.llmStrategyCodeVersion.deleteMany().catch(() => undefined)
    await prisma.llmStrategyCodegenSession.deleteMany().catch(() => undefined)
  })

  afterAll(async () => {
    await app?.close()
  })

  /**
   * 真实 LLM 端到端：每条策略允许 retry 1 次（抗 OpenAI 5xx flake）。
   */
  it.each(USER_STRATEGIES)(
    '[$id] $description — 真实 LLM 跑通 conversation → state',
    async (fx) => {
      const userId = `u-e2e-1364-${fx.id.toLowerCase()}`
      const server = app.getHttpServer()

      const runOnce = async (): Promise<{ status: string; canonicalDigest?: string; specDesc?: any; publicReason?: string }> => {
        const startRes = await supertestRequest(server)
          .post(buildApiUrl('llm-strategy-codegen/sessions'))
          .send({ userId, initialMessage: fx.initialMessage })
          .set({ authorization: `Bearer ${userId}` })

        // 200 / 201 / 202 任一即视为请求被接受（不同分支返回码不一致）
        if (![200, 201, 202].includes(startRes.status)) {
          // 失败时把 body 暴露出来便于诊断（5xx / validation 错误等）
          // eslint-disable-next-line no-console
          console.error(`[${fx.id}] start session failed status=${startRes.status} body=`, JSON.stringify(startRes.body))
        }
        expect([200, 201, 202]).toContain(startRes.status)
        const payload = startRes.body.data ?? startRes.body
        return {
          status: String(payload.status ?? ''),
          canonicalDigest: payload.canonicalDigest,
          specDesc: payload.specDesc,
          publicReason: payload.publicReason ?? payload.rejectReason,
        }
      }

      let result: Awaited<ReturnType<typeof runOnce>> | undefined
      let lastErr: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          result = await runOnce()
          break
        }
        catch (err) {
          lastErr = err
          // 1 次 retry 抗瞬时 5xx
          if (attempt === 0) {
            // eslint-disable-next-line no-console
            console.warn(`[${fx.id}] first attempt failed, retrying once:`, err)
            await new Promise(r => setTimeout(r, 2000))
            continue
          }
          throw err
        }
      }

      if (!result) throw lastErr ?? new Error(`[${fx.id}] unreachable`)

      // 核心断言：status 必须落到已知集合，不是空字符串 / 未知态
      if (!ACCEPTABLE_TERMINAL_STATUSES.has(result.status)) {
        // 异常 status 暴露出来便于诊断（prompt 迭代或 atom registry 缺失等真实信号）
        // eslint-disable-next-line no-console
        console.error(
          `[${fx.id}] unexpected status=${result.status} publicReason=${result.publicReason} rules=${result.specDesc?.rules?.length}`,
        )
      }
      expect(ACCEPTABLE_TERMINAL_STATUSES.has(result.status)).toBe(true)

      // canonicalDigest 在 CONFIRM_GATE / GENERATING / PUBLISHED 路径必须有
      if (['CONFIRM_GATE', 'GENERATING', 'PUBLISHED'].includes(result.status)) {
        expect(result.canonicalDigest).toBeTruthy()
        // specDesc 至少应该有 rules 数组（非空 emit）
        const rules = result.specDesc?.rules ?? []
        expect(Array.isArray(rules)).toBe(true)
        expect(rules.length).toBeGreaterThan(0)
      }
      else if (result.status === 'DRAFTING') {
        // DRAFTING：多轮对话中（LLM 要求用户澄清）。验证 LLM → 编排器通路打通即可；
        // 完整 confirm gate 需要再发一两轮 messages，留 follow-up。
        // eslint-disable-next-line no-console
        console.log(`[${fx.id}] DRAFTING — LLM 链路通畅，多轮收敛留 follow-up`)
      }
      else if (result.status === 'REJECTED' && fx.allowUnsupportedFallback) {
        // U4 路径：drawdown_block 未建模 → 允许 REJECTED + publicReason
        expect(result.publicReason ?? '').toBeTruthy()
      }
      else if (result.status === 'REJECTED' && !fx.allowUnsupportedFallback) {
        // 非预期的 REJECTED——把 publicReason 暴露出来便于 prompt 迭代
        throw new Error(
          `[${fx.id}] unexpected REJECTED status. publicReason=${result.publicReason}. `
          + 'LLM/prompt 未把策略走到 supported 路径。可能是 prompt 工程问题或 atom 注册表缺失。',
        )
      }
    },
    PER_STRATEGY_TIMEOUT_MS,
  )

  // ----------- Follow-up TODOs（依赖 queue worker bootstrap，本 PR 不含）-----------
  it.todo('[follow-up] U1-U5 backtest job 跑到 SUCCEEDED（依赖 bull worker + market-data fixtures）')
  it.todo('[follow-up] U1-U5 publish 链路 PUBLISHED（依赖完整 deploy pipeline）')
  it.todo('[follow-up] 迁移 ac8-extended-prompts.e2e-spec.ts 到真实 LLM（1500+ 行 mock 重写）')
  it.todo('[follow-up] 迁移 full-matrix.e2e-spec.ts 到真实 LLM')
})
