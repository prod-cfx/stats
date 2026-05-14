/**
 * Issue #1345 follow-up — U1-U5 真实 LLM patch 批量端到端验证
 *
 * 把 PR1 真实 LLM 落盘到 /tmp/issue-1345-diag/Ux.json 的 5 条 patch 全部喂进：
 *   SemanticSeedStateBuilder.build → CanonicalSpecBuilder → IR → AST → script
 *
 * 逐阶段抓 pass/fail，给出五项的对比矩阵。
 * 不依赖真实 LLM、不依赖 NestJS DI、不依赖 DB。
 */

import * as fs from 'node:fs'

import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'

const DIAG_OUT_DIR = '/tmp/issue-1345-diag'

/**
 * 从 emit 出的脚本里抽 `const <NAME> = [...] as const` 的数组长度。
 * 若数组是 `[]`（空壳）返回 0；含 ≥ 1 个元素（无论 `[{...}]` 还是带空白
 * `[ { ... } ]`）返回 length。Emitter 改 prettier 配置不会让断言误失败。
 */
function extractConstArrayLength(script: string, name: string): number {
  const re = new RegExp(`const ${name}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*as\\s*const`, 'u')
  const match = script.match(re)
  if (!match) return -1
  try {
    const parsed = JSON.parse(match[1]!) as unknown[]
    return Array.isArray(parsed) ? parsed.length : -1
  } catch {
    return -1
  }
}

interface Fixture {
  id: string
  description: string
  message: string
  patch: Record<string, unknown>
  /**
   * #1354 回归门禁：true 表示该策略经 SemanticSeedStateBuilder.build →
   * canonical → IR → AST → emit 之后，脚本必须含非空 EXPR_POOL 与 DECISION_PROGRAMS。
   * U3 暂时为 false（action 走 program.* orchestration 路径是另一个独立缺口，挂 follow-up）。
   */
  expectExecutableScript: boolean
  /**
   * #1357 扩展：program.* orchestration 路径（如 adaptive_volatility_grid）
   * 不产出 DECISION_PROGRAMS，但必须产出非空 ORCHESTRATION_PROGRAMS。
   * 设为 true 时替换 DECISION_PROGRAMS 断言为 ORCHESTRATION_PROGRAMS 断言。
   */
  expectOrchestrationPrograms?: boolean
  /**
   * #1358: gate-only 子策略路径（U5）的脚本无 EXPR_POOL/DECISION_PROGRAMS（无 entry/exit 规则），
   * 改为断言这些 const 名非空。缺省时与 expectExecutableScript 使用 EXPR_POOL+DECISION_PROGRAMS。
   */
  expectNonEmptyConsts?: string[]
}

const FIXTURES: readonly Fixture[] = [
  {
    id: 'U1',
    description: 'EMA 上下穿',
    expectExecutableScript: true,
    message: 'BTC 永续，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。',
    patch: {
      contextSlots: {
        symbol: { value: 'BTCUSDT', source: 'user_explicit' },
        timeframe: { value: '1h', source: 'user_explicit' },
        exchange: { value: 'OKX', source: 'inferred' },
        marketType: { value: 'perpetual', source: 'user_explicit' },
      },
      triggers: [
        { key: 'indicator.cross_over', phase: 'entry', params: { indicator: 'ema', semantic: 'cross_up', fastPeriod: 20, slowPeriod: 50 } },
        { key: 'indicator.cross_under', phase: 'exit', params: { indicator: 'ema', semantic: 'cross_down', fastPeriod: 20, slowPeriod: 50 } },
      ],
      actions: [
        { key: 'action.open_long', phase: 'entry', params: { orderType: 'market' } },
        { key: 'action.close_long', phase: 'exit', params: { orderType: 'market' } },
      ],
    },
  },
  {
    id: 'U2',
    description: 'RSI≤30 + 分批止盈 + 回撤熔断',
    expectExecutableScript: true,
    message: 'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
    patch: {
      contextSlots: {
        symbol: { value: 'ETHUSDT', source: 'user_explicit' },
        timeframe: { value: '15m', source: 'user_explicit' },
        marketType: { value: 'perpetual', source: 'user_explicit' },
      },
      triggers: [
        { key: 'oscillator.rsi_lte', phase: 'entry', params: { period: 14, value: 30, thresholdRole: 'lower_threshold' } },
      ],
      actions: [
        { key: 'action.open_long', phase: 'entry', params: {} },
      ],
      risk: [
        { key: 'risk.partial_take_profit', phase: 'exit', params: { profitPct: 3, ratio: 0.5 } },
        { key: 'portfolioRisk.drawdown_block', phase: 'gate', params: { thresholdPct: 10 } },
      ],
    },
  },
  {
    id: 'U3',
    description: '区间分位自适应网格',
    expectExecutableScript: true, // #1357 fixed: program.* action 提升到 orchestration gate+program 对
    expectOrchestrationPrograms: true, // grid 路径：检查 ORCHESTRATION_PROGRAMS 而非 DECISION_PROGRAMS
    message: 'SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3–0.7 分位之间运行时，启用自适应波动率网格。',
    patch: {
      contextSlots: {
        symbol: { value: 'SOLUSDT', source: 'user_explicit' },
        timeframe: { value: '30m', source: 'user_explicit' },
        marketType: { value: 'spot', source: 'user_explicit' },
      },
      triggers: [
        { key: 'price.range_position_gte', phase: 'entry', params: { lookbackBars: 24, thresholdPct: 0.3 } },
        { key: 'price.range_position_lte', phase: 'entry', params: { lookbackBars: 24, thresholdPct: 0.7 } },
      ],
      actions: [
        { key: 'program.adaptive_volatility_grid', phase: 'entry', params: { atrPeriod: 14, atrMultiplier: 1.5, rangeMultiplier: 3, minStepPct: 0.1, maxStepPct: 1, levelCount: 6, onDeactivate: 'close' } },
      ],
    },
  },
  {
    id: 'U4',
    description: 'BTC 现货 DCA + 加仓限制',
    expectExecutableScript: true,
    message: 'BTC 现货，1 天级别。从今天起每周一定投 100 U；同方向加仓不超过 5 次。',
    patch: {
      contextSlots: {
        symbol: { value: 'BTCUSDT', source: 'user_explicit' },
        timeframe: { value: '1d', source: 'user_explicit' },
        marketType: { value: 'spot', source: 'user_explicit' },
      },
      triggers: [
        { key: 'execution.on_start', phase: 'entry', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' } },
      ],
      actions: [
        { key: 'action.add_position', phase: 'entry', params: { sideScope: 'long', addMode: 'signal_confirm' } },
      ],
      position: {
        constraints: [
          { key: 'position.pyramiding_limit', params: { maxLayers: 5 } },
        ],
      },
    },
  },
  {
    id: 'U5',
    description: '双子策略 + 敞口/回撤限额',
    expectExecutableScript: true, // #1358 — 全 phase='gate' 子策略路径
    expectNonEmptyConsts: ['ORCHESTRATION_SCOPES'], // gate-only: 无 entry/exit 规则，ORCHESTRATION_SCOPES 非空
    message: '同一账户跑两条子策略：A：BTC 永续做 RSI 反转多头；B：ETH 永续做 EMA 趋势跟随。账户总敞口不超过 50%，单币种敞口不超过 30%，账户回撤 15% 全停。',
    patch: {
      contextSlots: {
        exchange: { value: 'OKX', source: 'inferred' },
        marketType: { value: 'perpetual', source: 'inferred' },
      },
      triggers: [
        { key: 'portfolioRisk.drawdown_block', phase: 'gate', params: { thresholdPct: 15 } },
        { key: 'portfolioRisk.symbol_exposure_cap', phase: 'gate', params: { notionalCapPct: 30, mode: 'enforce', effectWhenTriggered: 'block_new_entries' } },
        { key: 'portfolioRisk.substrategy_exposure_cap', phase: 'gate', params: { notionalCapPct: 50, mode: 'enforce', effectWhenTriggered: 'block_new_entries' } },
        { key: 'scope.symbol', phase: 'gate', params: { symbols: ['BTCUSDT', 'ETHUSDT'], primarySymbol: 'BTCUSDT' } },
        { key: 'scope.subStrategy', phase: 'gate', params: { subStrategyId: 'A_RSI_reversal_long_BTC', positionHandlingOnDeactivate: 'close' } },
        { key: 'scope.subStrategy', phase: 'gate', params: { subStrategyId: 'B_EMA_trend_follow_ETH', positionHandlingOnDeactivate: 'close' } },
      ],
    },
  },
]

interface StageResult { ok: boolean, err?: string, data?: unknown }

function runStage<T>(fn: () => T): StageResult {
  try {
    const data = fn()
    return { ok: true, data }
  } catch (e) {
    return { ok: false, err: (e as Error).message }
  }
}

describe('U1-U5 batch real-patch → codegen pipeline diagnostic (issue #1345)', () => {
  const builder = new SemanticSeedStateBuilderService()
  const canonicalBuilder = new CanonicalSpecBuilderService()

  const results: Array<{
    id: string
    description: string
    buildOk: boolean
    triggers: number
    lockedEntries: number
    lockedExits: number
    actions: number
    lockedActions: number
    risks: number
    canonical: StageResult
    ir: StageResult
    ast: StageResult
    script: StageResult
    scriptLen?: number
  }> = []

  it.each(FIXTURES)('[$id] $description', (fx) => {
    const state = builder.build(fx.patch, fx.message)
    const buildOk = state !== null
    const triggers = state?.triggers ?? []
    const actions = state?.actions ?? []
    const risks = state?.risk ?? []

    let canonical: StageResult = { ok: false, err: 'state null' }
    let ir: StageResult = { ok: false, err: 'skipped' }
    let ast: StageResult = { ok: false, err: 'skipped' }
    let script: StageResult = { ok: false, err: 'skipped' }
    let scriptLen: number | undefined

    if (state) {
      canonical = runStage(() => canonicalBuilder.buildFromSemanticState(state))
      if (canonical.ok) {
        ir = runStage(() => new CanonicalSpecV2IrCompilerService().compile({
          canonicalSpec: canonical.data as never,
          fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
        }))
        if (ir.ok) {
          ast = runStage(() => new CanonicalStrategyAstCompilerService().compile((ir.data as { ir: unknown }).ir as never))
          if (ast.ok) {
            script = runStage(() => {
              const envelope = new CompiledScriptExecutionEnvelopeService().build(canonical.data as never)
              return new CompiledScriptEmitterService().emit({ ast: ast.data as never, executionEnvelope: envelope })
            })
            if (script.ok) {
              scriptLen = (script.data as string).length
              // review m1：fs side-effect 包 try + ensure dir，CI /tmp 不可写时不假阳性失败
              try {
                fs.mkdirSync(DIAG_OUT_DIR, { recursive: true })
                fs.writeFileSync(`${DIAG_OUT_DIR}/${fx.id}.script.ts`, script.data as string)
              } catch {
                // 落盘失败不阻断诊断；下游 console.log 仍可读
              }
            }
          }
        }
      }
    }

    results.push({
      id: fx.id,
      description: fx.description,
      buildOk,
      triggers: triggers.length,
      lockedEntries: triggers.filter(t => t.phase === 'entry' && t.status === 'locked').length,
      lockedExits: triggers.filter(t => t.phase === 'exit' && t.status === 'locked').length,
      actions: actions.length,
      lockedActions: actions.filter(a => a.status === 'locked').length,
      risks: risks.length,
      canonical, ir, ast, script, scriptLen,
    })

    // 软断言：build 必须非 null（patch 都已确认 schema 合规）
    expect(buildOk).toBe(true)

    // #1354 回归断言：标记 expectExecutableScript 的 fixture 必须输出非空 EXPR_POOL
    // 与 DECISION_PROGRAMS，否则 toActionState 前缀剥离回退或 canonical pipeline
    // 又把 trigger-based atom 丢成空壳。
    // review m3：除 regex 形态检查外，抽 JSON 数组长度 ≥ 1 防"`[{}]` 空对象退化"
    // #1357 扩展：program.* grid 路径不产出 DECISION_PROGRAMS，改查 ORCHESTRATION_PROGRAMS
    // #1358: gate-only fixture（U5）使用 expectNonEmptyConsts 覆盖默认检查
    if (fx.expectExecutableScript) {
      expect(script.ok).toBe(true)
      const scriptText = script.data as string
      if (fx.expectNonEmptyConsts) {
        // gate-only path（U5）：自定义 const 列表，无需 EXPR_POOL
        for (const constName of fx.expectNonEmptyConsts) {
          const len = extractConstArrayLength(scriptText, constName)
          expect(len).toBeGreaterThan(0)
        }
      } else {
        const exprPoolLen = extractConstArrayLength(scriptText, 'EXPR_POOL')
        expect(exprPoolLen).toBeGreaterThan(0)
        if (fx.expectOrchestrationPrograms) {
          const orchLen = extractConstArrayLength(scriptText, 'ORCHESTRATION_PROGRAMS')
          expect(orchLen).toBeGreaterThan(0)
        } else {
          const decisionLen = extractConstArrayLength(scriptText, 'DECISION_PROGRAMS')
          expect(decisionLen).toBeGreaterThan(0)
        }
      }
    } else {
      // review m7：U3 已知缺口暂走 false 占位；若未来 canonical pipeline 升级把
      // program.* 路径接通，本断言会"意外通过"——console.log 提示翻 true。
      if (script.ok) {
        const scriptText = script.data as string
        const exprPoolLen = extractConstArrayLength(scriptText, 'EXPR_POOL')
        if (exprPoolLen > 0) {
          console.warn(`[#1354 m7] fixture ${fx.id} 现在 emit 非空 EXPR_POOL(len=${exprPoolLen})；请把 expectExecutableScript 翻成 true 并关联 follow-up issue`)
        }
      }
    }
  })

  afterAll(() => {
    console.log('\n\n══════════════ U1-U5 batch report ══════════════')
    console.log('id  build trig(L/L)  act(L) risk  canonical  ir         ast        script(len)')
    for (const r of results) {
      const tEntries = `${r.lockedEntries}E`
      const tExits = `${r.lockedExits}X`
      const stageMark = (s: StageResult) => s.ok ? '✓' : '✗'
      const scriptCell = r.script.ok ? `✓(${r.scriptLen})` : '✗'
      console.log(
        `${r.id.padEnd(3)} ${(r.buildOk ? '✓' : '✗').padEnd(5)} `
        + `${r.triggers}(${tEntries}/${tExits})`.padEnd(13)
        + `${r.actions}(${r.lockedActions}L)`.padEnd(7)
        + `${r.risks}`.padEnd(6)
        + `${stageMark(r.canonical)}`.padEnd(11)
        + `${stageMark(r.ir)}`.padEnd(11)
        + `${stageMark(r.ast)}`.padEnd(11)
        + scriptCell,
      )
    }
    // 失败明细
    for (const r of results) {
      const failed = ([['canonical', r.canonical], ['ir', r.ir], ['ast', r.ast], ['script', r.script]] as const)
        .filter(([, s]) => !s.ok && s.err !== 'skipped')
      if (failed.length > 0) {
        console.log(`\n[${r.id}] 失败明细:`)
        for (const [stage, s] of failed) console.log(`  ${stage}: ${s.err?.slice(0, 200)}`)
      }
    }
  })
})
