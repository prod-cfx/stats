import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { SemanticState } from '../../types/semantic-state'
import type { StrategyClarificationState } from '../../types/strategy-clarification'
import { CURRENT_SEMANTIC_VERSION } from '../../nl-gateway/version-gate/version-gate'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'

type ConversationInternals = {
  extractSemanticPatchFromMessage: (message?: string) => CodegenSemanticPatch | undefined
  normalizeSemanticContractReadiness: (
    state: SemanticState,
    strategyVersion: { deployedAtSemanticVersion: string | null },
  ) => SemanticState
  buildClarificationFromSemanticState: (state: SemanticState) => StrategyClarificationState & { summary?: string | null }
}

const noop = () => undefined
const stubObj = new Proxy({}, { get: () => noop }) as never
const FORBIDDEN_USER_VISIBLE_FRAGMENTS = [
  '请补充入场触发条件',
  '请补充该原子的执行合约',
]

function createConversationService(): ConversationInternals {
  return new CodegenConversationService(
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    stubObj,
    new StrategyClarificationQuestionService(),
    stubObj,
  ) as unknown as ConversationInternals
}

function assertNoForbiddenUserText(payload: unknown): void {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
  for (const fragment of FORBIDDEN_USER_VISIBLE_FRAGMENTS) {
    expect(text).not.toContain(fragment)
  }
}

function withLockedDefaultPosition(state: SemanticState): SemanticState {
  return {
    ...state,
    position: {
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
  }
}

function buildSeedStateFromUserMessage(message: string, options: { lockPosition: boolean }): {
  patch: CodegenSemanticPatch
  state: SemanticState
} {
  const conversation = createConversationService()
  const patch = conversation.extractSemanticPatchFromMessage(message) as CodegenSemanticPatch
  const seedBuilder = new SemanticSeedStateBuilderService()
  const state = seedBuilder.build(patch, message)
  expect(state).not.toBeNull()
  const stateForReadiness = options.lockPosition ? withLockedDefaultPosition(state!) : state!
  const normalized = conversation.normalizeSemanticContractReadiness(
    stateForReadiness,
    { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION },
  ) as SemanticState

  return { patch, state: normalized }
}

function compileScriptArtifact(state: SemanticState) {
  const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
  const compiled = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec,
    fallback: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '1h',
      positionPct: 10,
    },
  })
  const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
  const executionEnvelope = new CompiledScriptExecutionEnvelopeService().build(canonicalSpec)
  const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })
  const projection = new CompiledScriptParserService().parse(script)
  return { canonicalSpec, compiled, executionEnvelope, script, projection }
}

describe('codegen entry link regression: user message → seed → projection → artifact', () => {
  const entryCorpus = [
    {
      name: '网格',
      message: 'BTCUSDT okx 永续 1h 网格区间 60000-70000 每格 100U 双向循环',
      expectedPatch: { atoms: ['grid.range_rebalance'] },
    },
    {
      name: '无标点百分跌涨',
      message: 'BTCUSDT okx 永续 1h 价格下跌3%开多 价格上涨5%平多',
      expectedPatch: {
        triggers: ['price.percent_change:entry', 'price.percent_change:exit'],
        actions: ['action.open_long', 'action.close_long'],
      },
    },
    {
      name: 'RSI 开多',
      message: 'BTCUSDT okx 永续 1h RSI小于30开多 RSI大于70平多',
      expectedPatch: {
        triggers: ['oscillator.rsi_lte:entry', 'oscillator.rsi_gte:exit'],
        actions: ['action.open_long', 'action.close_long'],
      },
    },
    {
      name: 'EMA above/below',
      message: 'BTCUSDT okx 永续 1h EMA20上方开多 EMA20下方平多',
      expectedPatch: {
        triggers: ['indicator.above:entry', 'indicator.below:exit'],
        actions: ['action.open_long', 'action.close_long'],
      },
    },
  ]

  for (const item of entryCorpus) {
    it(`入口 dispatcher patch 覆盖语料：${item.name}`, () => {
      const conversation = createConversationService()
      const patch = conversation.extractSemanticPatchFromMessage(item.message) as CodegenSemanticPatch
      const triggerKeys = patch.triggers?.map(trigger => `${trigger.key}:${trigger.phase}`) ?? []
      const actionKeys = patch.actions?.map(action => action.key) ?? []
      const atomKeys = patch.atoms?.map(atom => atom.key) ?? []

      for (const expected of item.expectedPatch.triggers ?? []) {
        expect(triggerKeys).toContain(expected)
      }
      for (const expected of item.expectedPatch.actions ?? []) {
        expect(actionKeys).toContain(expected)
      }
      for (const expected of item.expectedPatch.atoms ?? []) {
        expect(atomKeys).toContain(expected)
      }
    })
  }

  const executableCorpus = entryCorpus.filter(item => item.name !== '网格')

  for (const item of executableCorpus) {
    it(`中链路不泄漏内部占位/合约提示：${item.name}`, () => {
      const { state } = buildSeedStateFromUserMessage(item.message, { lockPosition: false })
      const projection = new SemanticStateProjectionService().buildConversationView(state)
      const conversation = createConversationService()
      const clarificationState = conversation.buildClarificationFromSemanticState(state)
      const prompt = new StrategyClarificationQuestionService().build(clarificationState)

      expect(projection.summary).not.toBe('已识别部分条件，但仍未完整。')
      expect(clarificationState.status).toBe('NEEDS_CLARIFICATION')
      expect(clarificationState.items.map(item => item.reason)).toContain('missing_semantic_position_sizing')
      expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_semantic_contract_requirement')
      assertNoForbiddenUserText([projection, clarificationState, prompt])
    })
  }

  for (const item of executableCorpus) {
    it(`后链路 SemanticState → CanonicalSpec/IR → compiled script envelope：${item.name}`, () => {
      const { state } = buildSeedStateFromUserMessage(item.message, { lockPosition: true })
      const artifact = compileScriptArtifact(state)

      expect(artifact.canonicalSpec.rules.length).toBeGreaterThanOrEqual(2)
      expect(artifact.canonicalSpec.rules.some(rule => rule.phase === 'entry')).toBe(true)
      expect(artifact.canonicalSpec.rules.some(rule => rule.phase === 'exit')).toBe(true)
      expect(artifact.projection.exprPool.length).toBeGreaterThan(0)
      expect(artifact.projection.decisionPrograms.length).toBeGreaterThan(0)
      expect(artifact.projection.compiledManifest.irHash).toMatch(/^sha256:/u)
      expect(artifact.projection.compiledManifest.specHash).toMatch(/^sha256:/u)
      expect(artifact.projection.executionModel.positionMode).toBe('long_only')
      expect(artifact.executionEnvelope.positionMode).toBe('long_only')
      expect(artifact.script).toContain('protocolVersion')
      expect(artifact.script).toContain('onBar')
      assertNoForbiddenUserText(artifact.script)
    })
  }

  it('单笔百分资金锁定 position.sizing，不被止损止盈百分污染', () => {
    const message = '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%'
    const { state } = buildSeedStateFromUserMessage(message, { lockPosition: false })
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)

    expect(state.position?.sizing).toEqual({ kind: 'ratio', value: 0.1, unit: 'ratio' })
    expect(state.position?.status).toBe('locked')
    expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_semantic_position_sizing')
  })

  it('order_program 网格满足执行语义，不回退追问传统 entry/exit trigger', () => {
    const message = '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈'
    const { state } = buildSeedStateFromUserMessage(message, { lockPosition: false })
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const projection = new SemanticStateProjectionService().buildConversationView(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)

    expect(state.position?.constraints?.[0]?.key).toBe('grid.range_rebalance')
    expect(state.position?.constraints?.[0]?.contracts?.flatMap(contract => contract.capabilities)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'order_program',
        verb: 'maintain',
        object: 'limit_ladder',
      }),
    ]))
    expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_entry_rules')
    expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_exit_rules')
    assertNoForbiddenUserText([projection, clarificationState, prompt])
  })

  it('每格 quote 资金进入 per_order_budget，不被当成权益比例', () => {
    const { state } = buildSeedStateFromUserMessage('BTCUSDT okx 永续 1h 网格 价格区间 60000-80000 每格 100U 双向循环', { lockPosition: false })
    const budgetCapability = state.position?.constraints?.[0]?.contracts
      ?.flatMap(contract => contract.capabilities)
      .find(capability =>
        capability.domain === 'capital'
        && capability.verb === 'allocate'
        && capability.object === 'per_order_budget',
      )

    expect(budgetCapability?.shape).toEqual(expect.objectContaining({
      kind: 'quote',
      value: 100,
      asset: 'USDT',
    }))
    expect(budgetCapability?.shape).not.toEqual(expect.objectContaining({
      kind: 'ratio',
      unit: 'ratio',
    }))
  })

  it('裸 100usdt sizing 回答可锁定 position.sizing', () => {
    const { state } = buildSeedStateFromUserMessage('100usdt', { lockPosition: false })
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)

    expect(state.position?.sizing).toEqual({ kind: 'quote', value: 100, asset: 'USDT' })
    expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_semantic_position_sizing')
  })

  it('仓位的 ATR 止损比例不误识别为仓位大小', () => {
    const { state } = buildSeedStateFromUserMessage('BTCUSDT okx 永续 1h 价格下跌3%开多 价格上涨5%平多 仓位的 2% ATR 作为止损', { lockPosition: false })

    expect(state.position?.sizing).toBeNull()
    expect(state.position?.openSlots.map(slot => slot.slotKey)).toContain('position.sizing')
  })

  it('记录 backtest/deploy artifact 接入点，避免入口回归测试误判为已覆盖发布链路', () => {
    const publicationArtifactPaths = [
      'apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-session-publication-pipeline.spec.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts',
    ]

    expect(publicationArtifactPaths).toEqual(expect.arrayContaining([
      expect.stringContaining('codegen-session-publication-pipeline.spec.ts'),
      expect.stringContaining('codegen-publication-generation.stage.spec.ts'),
      expect.stringContaining('compiled-publication-gate.service.spec.ts'),
    ]))
  })
})
