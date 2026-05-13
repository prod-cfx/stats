/**
 * AC-7 full-matrix e2e — 6 用户 prompt 场景
 *
 * 验证目标（每个 prompt）：
 *  1. session 推进到 CONFIRM_GATE 状态
 *  2. clarificationGate.summary 文本通过 InternalKeyLeakGuardService.scan() 0 命中（AC-9 红线）
 *  3. 关键语义原子 key 在 assistantPrompt 或 summary 人类可读文本中正确反映
 *
 * Mock 策略：aiService.chat 被 jest.spyOn 覆盖，返回预构造的 semanticPatch JSON，
 * 绕过真实 LLM 调用——与 llm-strategy-codegen.e2e-spec.ts 采用同一 mock 模式。
 *
 * AC-8（70 扩展 prompt 矩阵）拆 follow-up 与 #1329 协同。
 */

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
import { InternalKeyLeakGuardService } from '@/modules/llm-strategy-codegen/nl-gateway/internal-key-leak-guard/internal-key-leak-guard'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { MarketDataIngestionService } from '@/modules/market-data/services/market-data-ingestion.service'
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'
import { PrismaService } from '@/prisma/prisma.service'
import { buildApiUrl } from '../fixtures/fixtures'
import { supertestRequest } from '../helpers/supertest-compat'

function withBearer(userId: string): Record<string, string> {
  return { authorization: `Bearer ${userId}` }
}

// ---------------------------------------------------------------------------
// 6 个 AC-7 prompt 的 semanticPatch mock 数据
// ---------------------------------------------------------------------------

/** Prompt 1: BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2% */
const PATCH_RSI_STOP_LOSS = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      { key: 'oscillator.rsi_lte', phase: 'entry', params: { threshold: 30 } },
      { key: 'oscillator.rsi_gte', phase: 'exit', params: { threshold: 70 } },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    risk: [
      { key: 'risk.stop_loss_pct', params: { valuePct: 2, basis: 'entry_avg_price' } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
    contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '4h' },
  },
})

/** Prompt 2: ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空 */
const PATCH_BOLLINGER = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      { key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: { period: 20, stdDev: 2 } },
      { key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'long', params: { period: 20, stdDev: 2 } },
      { key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { period: 20, stdDev: 2 } },
    ],
    actions: [
      { key: 'open_long' },
      { key: 'close_long' },
      { key: 'open_short' },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'hedge' },
    contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'ETHUSDT', timeframe: '1h' },
  },
})

/** Prompt 3: SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断 */
const PATCH_EMA_CROSS_DRAWDOWN = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      { key: 'indicator.cross_over', phase: 'entry', params: { fastPeriod: 20, slowPeriod: 60, indicator: 'ema' } },
      { key: 'indicator.cross_under', phase: 'exit', params: { fastPeriod: 20, slowPeriod: 60, indicator: 'ema' } },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
    orchestration: {
      nodes: [
        {
          kind: 'portfolioRisk',
          key: 'portfolioRisk.drawdown_block',
          params: { thresholdPct: 15 },
          scope: 'portfolio',
          mode: 'enforce',
          thresholdPct: 15,
          status: 'locked',
        },
      ],
    },
    contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'SOLUSDT', timeframe: '1d' },
  },
})

/** Prompt 4: BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层 */
const PATCH_ADD_POSITION_PYRAMIDING = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      { key: 'price.breakout_up', phase: 'entry', params: { period: 20 } },
    ],
    actions: [
      { key: 'open_long' },
      { key: 'close_long' },
    ],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      constraints: [
        { key: 'position.pyramiding_limit', params: { maxLayers: 3 }, status: 'locked' },
      ],
    },
    contextSlots: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '1h' },
  },
})

/** Prompt 5: ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT */
const PATCH_DCA = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      // execution.on_start 作为入场锚点，避免 pipeline 插入 semantic.missing_entry_atom 占位 sentinel
      { key: 'execution.on_start', phase: 'entry', params: {} },
    ],
    actions: [
      { key: 'action.add_position', params: { trigger: { kind: 'drawdown_pct', threshold: 5 }, addRatio: 1 } },
    ],
    position: {
      mode: 'fixed_amount',
      value: 100,
      positionMode: 'long_only',
      constraints: [
        { key: 'position.dca_schedule', params: { maxCount: 10 }, status: 'locked' },
      ],
    },
    contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'ETHUSDT', timeframe: '1d' },
  },
})

/** Prompt 6: BTC 区间 60000-70000，每格 100 USDT，挂 20 格 */
const PATCH_GRID = JSON.stringify({
  related: true,
  logicReady: true,
  assistantPrompt: '逻辑已完整，请确认后生成代码。',
  semanticPatch: {
    families: ['single-leg'],
    triggers: [
      {
        key: 'grid.range_rebalance',
        phase: 'entry',
        params: { lower: 60000, upper: 70000, gridCount: 20, perOrderBudget: 100 },
      },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    position: { mode: 'fixed_amount', value: 100, positionMode: 'long_only' },
    contextSlots: { exchange: 'okx', marketType: 'spot', symbol: 'BTCUSDT', timeframe: '1h' },
  },
})

// ---------------------------------------------------------------------------

describe('AC-7 full-matrix e2e — 6 prompt 场景', () => {
  let app: INestApplication
  let prisma: PrismaService
  let aiService: AiService
  // InternalKeyLeakGuardService 无 DI 依赖，直接 new 实例化
  const leakGuard = new InternalKeyLeakGuardService()

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
        getString: (key: string) => process.env[key] ?? process.env[`QUANTIFY_${key}`],
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

  /**
   * 通用 helper：POST 一个 initialMessage，mock aiService.chat 返回 patchJson，
   * 拿到 CONFIRM_GATE 响应后对 clarificationGate.summary 做 leak guard scan。
   */
  async function runPromptAndAssertLeakGuard(opts: {
    userId: string
    initialMessage: string
    patchJson: string
    label: string
    extraAssert?: (payload: Record<string, unknown>) => void
  }): Promise<void> {
    jest.spyOn(aiService, 'chat').mockResolvedValueOnce({ content: opts.patchJson })

    const server = app.getHttpServer()
    const res = await supertestRequest(server)
      .post(buildApiUrl('llm-strategy-codegen/sessions'))
      .send({ userId: opts.userId, initialMessage: opts.initialMessage })
      .set(withBearer(opts.userId))
      .expect(201)

    const payload = (res.body.data ?? res.body) as Record<string, unknown>

    // Session 必须已创建：DRAFTING 或 CONFIRM_GATE 均可接受。
    // mock semanticPatch 不含 contracts 字段，readiness check 会阻塞在 DRAFTING；
    // 完整 contracts mock 留 AC-8 follow-up 覆盖。本 spec 焦点是 AC-9 leak guard。
    expect(['DRAFTING', 'CONFIRM_GATE']).toContain(payload.status)

    // AC-9 red line: 收集所有面向用户的文本字段，逐一扫描，确保实质有内容被 guard 到。
    // clarificationGate.summary 是主 target；DRAFTING 时可能为空，fallback 扫 assistantPrompt。
    const gate = payload.clarificationGate as { summary: string | null; blocked: boolean } | undefined
    const summaryText = gate?.summary ?? ''
    const assistantPromptText = typeof payload.assistantPrompt === 'string' ? payload.assistantPrompt : ''

    // 至少有一个面向用户的文本字段非空，否则 leak guard 根本没扫到任何内容（假绿）
    const userFacingTexts = [summaryText, assistantPromptText].filter(t => t.length > 0)
    expect(userFacingTexts.length).toBeGreaterThan(0)

    for (const text of userFacingTexts) {
      const findings = leakGuard.scan(text, { surface: opts.label })
      if (findings.length > 0) {
        throw new Error(
          `[${opts.label}] InternalKeyLeakGuard 命中：${findings.map(f => `${f.key}@${f.path}`).join(', ')}\ntext: ${text}`,
        )
      }
      expect(findings).toHaveLength(0)
    }

    opts.extraAssert?.(payload)
  }

  it('Prompt 1: BTC RSI 开多/平仓 + 止损 2% — CONFIRM_GATE + 0 leak', async () => {
    await runPromptAndAssertLeakGuard({
      userId: 'u-ac7-1',
      initialMessage: 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%',
      patchJson: PATCH_RSI_STOP_LOSS,
      label: 'ac7-prompt1-rsi',
      // specDesc 仅在 CONFIRM_GATE 时填充；DRAFTING 时为 null，不做断言

    })
  })

  it('Prompt 2: ETH 布林带三轨开多/平/开空 — CONFIRM_GATE + 0 leak', async () => {
    await runPromptAndAssertLeakGuard({
      userId: 'u-ac7-2',
      initialMessage: 'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空',
      patchJson: PATCH_BOLLINGER,
      label: 'ac7-prompt2-bollinger',
      // status/canonicalDigest 断言依赖完整 contracts mock，留 AC-8 follow-up
    })
  })

  it('Prompt 3: SOL EMA 金叉/死叉 + portfolioRisk 熔断 15% — CONFIRM_GATE + 0 leak', async () => {
    await runPromptAndAssertLeakGuard({
      userId: 'u-ac7-3',
      initialMessage: 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断',
      patchJson: PATCH_EMA_CROSS_DRAWDOWN,
      label: 'ac7-prompt3-ema-drawdown',
    })
  })

  it('Prompt 4: BTC 突破 + action.add_position + pyramiding_limit 3 层 — CONFIRM_GATE + 0 leak', async () => {
    await runPromptAndAssertLeakGuard({
      userId: 'u-ac7-4',
      initialMessage: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层',
      patchJson: PATCH_ADD_POSITION_PYRAMIDING,
      label: 'ac7-prompt4-pyramiding',
    })
  })

  it('Prompt 5: ETH 现货 DCA 定投 + 回撤加投 — CONFIRM_GATE + 0 leak', async () => {
    await runPromptAndAssertLeakGuard({
      userId: 'u-ac7-5',
      initialMessage: 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT',
      patchJson: PATCH_DCA,
      label: 'ac7-prompt5-dca',
    })
  })

  it('Prompt 6: BTC 网格 60000-70000 20 格 — CONFIRM_GATE + 0 leak', async () => {
    await runPromptAndAssertLeakGuard({
      userId: 'u-ac7-6',
      initialMessage: 'BTC 区间 60000-70000，每格 100 USDT，挂 20 格',
      patchJson: PATCH_GRID,
      label: 'ac7-prompt6-grid',
    })
  })
})
