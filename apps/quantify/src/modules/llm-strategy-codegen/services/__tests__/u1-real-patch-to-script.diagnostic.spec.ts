/**
 * Issue #1354 — U1 实验组：真实 LLM patch → SemanticSeedStateBuilder.build → codegen
 *
 * 与 `u1-codegen-pipeline.diagnostic.spec.ts`（控制组）的关系见对方文件头。
 *
 * 本 spec：直接把 PR1 真实 LLM 输出的 U1 patch 喂进 SemanticSeedStateBuilder.build()，
 * 看 reducer 产出的 SemanticState 是否能驱动 canonical → IR → AST → emit 输出含逻辑
 * 的脚本。控制组 emit 正确 + 本 spec 失败 = SemanticSeedStateBuilder 输出走样
 * （#1354 的 fix 目标）；两者都失败 = pipeline 本身坏。
 *
 * `u-all-patch-to-script` 把 U1-U5 5 条策略批量跑同一对照，本 spec 是 U1 的精确版本。
 */

import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'

// 来自 /tmp/issue-1345-diag/U1.json 的 LLM patch（PR1 真实 OpenAI 输出）
const U1_PATCH = {
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
}
const U1_MESSAGE = 'BTC 永续，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。'

describe('U1 real LLM patch → SemanticSeedStateBuilder.build → codegen (issue #1345 follow-up)', () => {
  it('build returns non-null SemanticState; pipeline emits script', () => {
    const builder = new SemanticSeedStateBuilderService()
    const state = builder.build(U1_PATCH, U1_MESSAGE)

    console.log(`\n═══ U1 SemanticState (after SemanticSeedStateBuilder.build) ═══`)
    console.log(JSON.stringify(state, null, 2).slice(0, 4000))
    console.log(state && JSON.stringify(state).length > 4000 ? '\n...(truncated)' : '')

    expect(state).not.toBeNull()
    expect(state!.trigger).toBeDefined()

    const entryTriggers = state!.trigger.filter(t => t.phase === 'entry')
    const exitTriggers = state!.trigger.filter(t => t.phase === 'exit')
    const lockedEntries = entryTriggers.filter(t => t.status === 'locked')
    const lockedExits = exitTriggers.filter(t => t.status === 'locked')

    console.log(`\ntriggers: total=${state!.trigger.length}, entry=${entryTriggers.length} (locked=${lockedEntries.length}), exit=${exitTriggers.length} (locked=${lockedExits.length})`)
    console.log(`action: ${JSON.stringify(state!.action)}`)

    // 关键断言：必须有 locked entry / exit trigger，否则 ensureExecutableAtomSlots 会注入 missing_*_atom
    expect(lockedEntries.length).toBeGreaterThan(0)
    expect(lockedExits.length).toBeGreaterThan(0)

    // 试图过 canonical pipeline
    try {
      const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(state!)
      const compiled = new CanonicalSpecV2IrCompilerService().compile({
        canonicalSpec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
      })
      const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
      const envelope = new CompiledScriptExecutionEnvelopeService().build(canonicalSpec)
      const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope: envelope })

      console.log(`\n═══ U1 compiled strategy script (${script.length} chars) ═══`)
      console.log(script.slice(0, 1500))
      expect(typeof script).toBe('string')
      expect(script.length).toBeGreaterThan(200)
    } catch (e) {
      console.log(`\n═══ pipeline 抛错 ═══\n${(e as Error).stack || e}`)
      throw e
    }
  })
})
