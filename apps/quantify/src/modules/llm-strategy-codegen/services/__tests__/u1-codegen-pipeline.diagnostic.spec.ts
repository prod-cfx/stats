/**
 * Issue #1354 — U1 控制组：手工 locked SemanticState → codegen 脚本
 *
 * 与 `u1-real-patch-to-script.diagnostic.spec.ts`（实验组）的关系：
 *   - **本 spec（控制组）**：手工构造 SemanticState（含 sideScope: 'long'、
 *     unprefixed action key），验证 canonical → IR → AST → emit pipeline 本身
 *     不坏；目的：把"pipeline 损坏"与"SemanticSeedStateBuilder 输出走样"
 *     两类故障隔离开。
 *   - **u1-real-patch-to-script（实验组）**：U1 真实 LLM patch 走
 *     SemanticSeedStateBuilder.build → 同一 pipeline，看 reducer 是否产出
 *     与控制组等价的 SemanticState。
 *
 * 两份不合并：合并后回归定位会失去"哪一段坏了"的隔离能力。
 */

import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'

/**
 * U1 LLM patch（从 /tmp/issue-1345-diag/U1.json 抽取）经 reducer 加上 id / status:'locked' /
 * source:'user_explicit' / openSlots:[] 后的形态。
 *
 * LLM 实际 params 含 value=0 / period=0 / signalPeriod=0 等"占位 0"——这是 LLM 把 paramSlots 全
 * 填导致的副作用。下面剔掉这些占位字段，保留 indicator/semantic/fastPeriod/slowPeriod 即可识别。
 */
function buildU1LockedSemanticState(): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    trigger: [
      {
        id: 'entry-ema-cross-over',
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ema', semantic: 'cross_up', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-ema-cross-under',
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: { indicator: 'ema', semantic: 'cross_down', fastPeriod: 20, slowPeriod: 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    action: [
      { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
    ],
    risk: [],
    position: {
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
      timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
    },
    normalizationNotes: [],
    updatedAt: '2026-05-14T00:00:00.000Z',
  }
}

describe('U1 EMA cross codegen pipeline diagnostic (issue #1345 follow-up)', () => {
  it('hand-built locked SemanticState → canonical → IR → AST → script', () => {
    const state = buildU1LockedSemanticState()

    // 1. SemanticState → CanonicalStrategySpecV2
    const builder = new CanonicalSpecBuilderService()
    const canonicalSpec = builder.buildFromSemanticState(state)
    expect(canonicalSpec).toBeDefined()
    expect(canonicalSpec.market.symbol).toBe('BTCUSDT')

    // 2. CanonicalSpec → IR
    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    })
    expect(compiled.ir).toBeDefined()

    // 3. IR → AST
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    expect(ast).toBeDefined()

    // 4. AST → script
    const envelope = new CompiledScriptExecutionEnvelopeService().build(canonicalSpec)
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope: envelope })
    expect(typeof script).toBe('string')
    expect(script.length).toBeGreaterThan(200)

    // 关键 token —— 真实 strategy 脚本必含
    expect(script).toContain('protocolVersion')
    expect(script).toContain('onBar')
    expect(script).toContain('evaluateExprPool')
    expect(script).toContain('runOrderPrograms')

    console.log(`\n═══ U1 compiled strategy script (${script.length} chars) ═══\n${script.slice(0, 2000)}${script.length > 2000 ? '\n...(truncated)' : ''}\n`)
  })
})
