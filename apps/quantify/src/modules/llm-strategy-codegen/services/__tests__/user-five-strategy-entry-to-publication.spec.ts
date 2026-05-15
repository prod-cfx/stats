import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { SemanticState } from '../../types/semantic-state'
import type { StrategyClarificationState } from '../../types/strategy-clarification'
import { CURRENT_SEMANTIC_VERSION } from '../../nl-gateway/version-gate/version-gate'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { CodegenGraphSnapshotService } from '../codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../strategy-summary-observation.service'

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
const forbiddenUserVisibleFragments = [
  'semantic.missing_entry_atom',
  'semantic.missing_exit_atom',
  '请补充入场触发条件',
  '请补充该原子的执行合约',
  '指标静态高于条件当前公测暂未支持生成和回测',
  '指标静态低于条件当前公测暂未支持生成和回测',
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

function createPublicationStage(): CodegenPublicationGenerationStage {
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    new CompiledScriptParserService(),
    new StrategySummaryObservationService(),
    undefined,
    new CodegenGraphSnapshotService(),
  )
}

function assertNoForbiddenUserText(payload: unknown): void {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
  for (const fragment of forbiddenUserVisibleFragments) {
    expect(text).not.toContain(fragment)
  }
}

function buildStateFromUserMessage(message: string): SemanticState {
  const conversation = createConversationService()
  const patch = conversation.extractSemanticPatchFromMessage(message) as CodegenSemanticPatch
  const state = new SemanticSeedStateBuilderService().build(patch, message)
  expect(state).not.toBeNull()
  return conversation.normalizeSemanticContractReadiness(
    state!,
    { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION },
  )
}

describe('user reported five strategies: entry -> middle -> publication generation', () => {
  const strategies = [
    {
      name: '策略1 网格 order_program',
      message: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
      expectedAnyKeys: ['grid.range_rebalance'],
      publication: false,
    },
    {
      name: '策略2 跌买涨卖百分资金',
      message: '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%',
      expectedAnyKeys: ['price.percent_change', 'open_long', 'close_long'],
      publication: true,
    },
    {
      name: '策略3 EMA above/below',
      message: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
      expectedAnyKeys: ['indicator.above', 'indicator.below', 'open_long', 'close_long'],
      publication: false,
    },
    {
      name: '策略4 EMA above/below duplicate',
      message: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
      expectedAnyKeys: ['indicator.above', 'indicator.below', 'open_long', 'close_long'],
      publication: false,
    },
    {
      name: '策略5 RSI + ATR stop + partial TP + drawdown block',
      message: 'ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。',
      expectedAnyKeys: ['oscillator.rsi_lte', 'open_long', 'risk.partial_take_profit', 'portfolioRisk.drawdown_block'],
      publication: false,
    },
  ]

  for (const strategy of strategies) {
    it(`${strategy.name}: 入口和中链路不回退 missing/unsupported`, () => {
      const state = buildStateFromUserMessage(strategy.message)
      const allKeys = [
        ...state.trigger.map(item => item.key),
        ...state.action.map(item => item.key),
        ...state.risk.map(item => item.key),
        ...state.positionConstraint.map(item => item.key),
        ...(state.position?.constraints ?? []).map(item => item.key),
        ...state.orchestration.map(item => item.key),
      ]
      const conversation = createConversationService()
      const projection = new SemanticStateProjectionService().buildConversationView(state)
      const clarificationState = conversation.buildClarificationFromSemanticState(state)
      const prompt = new StrategyClarificationQuestionService().build(clarificationState)

      for (const key of strategy.expectedAnyKeys) {
        expect(allKeys).toContain(key)
      }
      expect(allKeys).not.toContain('semantic.missing_entry_atom')
      expect(allKeys).not.toContain('semantic.missing_exit_atom')
      expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_semantic_contract_requirement')
      assertNoForbiddenUserText([projection, clarificationState, prompt])
    })
  }

  for (const strategy of strategies.filter(item => item.publication)) {
    it(`${strategy.name}: 结束链路生成 compiled script artifacts`, async () => {
      const state = buildStateFromUserMessage(strategy.message)
      const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
      expect(state.contextSlots.symbol?.value ?? canonicalSpec.market.symbol).toBeTruthy()
      expect(canonicalSpec.dataRequirements.requiredTimeframes[0] ?? canonicalSpec.market.defaultTimeframe).toBeTruthy()
      const artifacts = await createPublicationStage().generate({ semanticState: state })

      expect(artifacts.canonicalSpec.rules.length).toBeGreaterThanOrEqual(2)
      expect(artifacts.compiledScript).toContain('protocolVersion')
      expect(artifacts.compiledScript).toContain('onBar')
      expect(artifacts.validation.passed).toBe(true)
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      assertNoForbiddenUserText(artifacts.compiledScript)
    })
  }
})
