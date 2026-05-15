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
  // Issue #1383 后续：dispatcher 抽出的原子被下游正确渲染时，不应再退到这些 atom-key 兜底文案
  '已识别风控，参数待补充',
  '指标高于阈值时做多开仓',
  '指标低于阈值时平多',
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
    // Issue #1383 后续：用户实际反馈的 6 条策略，全部按"原子语义五桶真相源"通用解
    //   走通入口（dispatcher）→ 中间（state/projection）→ 不再退到 atom-key 兜底文案
    //
    //   publication=true 的策略额外校验生成 canonical-spec + compiled script artifact，
    //   走完入口→中间→canonical-spec-builder→IR compiler→AST compiler→compiled script
    //   全链路，确保用户输入能"开出可回测的策略代码"。
    //
    //   策略6 / 7 / 10 publication=false 是因为：策略6/7 上下文（exchange/timeframe/sizing）
    //   完整需澄清，publication 路径 fail-closed；策略10 是 grid 中心偏移，runtime 端
    //   "用部署时当前价做中心" 的执行层支持是分离 workstream，本 PR 未覆盖。
    {
      name: '策略6 EMA 多均线上方 + BOLL 下/上轨双向开（S2 elision）',
      message: '15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损',
      expectedAnyKeys: ['indicator.above', 'bollinger.touch_lower', 'bollinger.touch_upper', 'open_long', 'open_short'],
      publication: false,
    },
    {
      name: '策略7 BOLL 上下轨入场 + 中轨平仓（S3 自镜像）',
      message: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
      expectedAnyKeys: ['bollinger.touch_upper', 'bollinger.touch_lower', 'bollinger.touch_middle', 'open_short', 'open_long'],
      publication: true,
    },
    {
      name: '策略8 阳线开多/阴线平多（S4 candle pattern）',
      message: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。',
      expectedAnyKeys: ['price.candle_pattern', 'open_long', 'close_long'],
      publication: false,
    },
    {
      name: '策略8a 阳线开多/阴线平多 + 完整上下文（S4 publishable）',
      message: 'binance 永续 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。单笔仓位 10%。',
      expectedAnyKeys: ['price.candle_pattern', 'open_long', 'close_long'],
      publication: true,
    },
    {
      name: '策略9 EMA7 上穿 EMA21 + 下穿平多（S5 cross-clause inheritance）',
      message: 'EMA7 上穿 EMA21 时开多；下穿 时平多。',
      expectedAnyKeys: ['indicator.cross_over', 'indicator.cross_under', 'open_long', 'close_long'],
      publication: false,
    },
    {
      name: '策略9a EMA7 上穿 EMA21 + 完整上下文（S5 publishable）',
      message: 'binance 永续 BTCUSDT 15m。EMA7 上穿 EMA21 时开多；下穿 时平多。单笔仓位 10%。',
      expectedAnyKeys: ['indicator.cross_over', 'indicator.cross_under', 'open_long', 'close_long'],
      publication: true,
    },
    {
      name: '策略10 现货网格中心偏移（S6 grid center-offset）',
      message: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行"立即停止并撤销所有未成交订单"',
      expectedAnyKeys: ['grid.range_rebalance'],
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

  it('策略1: 网格每格间距已给出时不再追问密度', () => {
    const state = buildStateFromUserMessage('在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈')
    const grid = state.trigger.find(item => item.key === 'grid.range_rebalance')
      ?? state.positionConstraint.find(item => item.key === 'grid.range_rebalance')
      ?? state.position?.constraints?.find(item => item.key === 'grid.range_rebalance')
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)

    expect(grid?.params.stepPct).toBe(0.5)
    expect(grid?.openSlots.map(slot => slot.slotKey)).not.toContain('contract.shape.price.level_set.density')
    expect(prompt).not.toContain('网格数量或每格间距')
  })

  it('策略2: 普通止盈不误归类为分批止盈', () => {
    const state = buildStateFromUserMessage('在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%')
    const riskKeys = state.risk.map(item => item.key)
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)

    expect(riskKeys).toContain('risk.take_profit_pct')
    expect(riskKeys).not.toContain('risk.partial_take_profit')
    expect(prompt).not.toContain('分批止盈')
  })

  it('策略3: EMA 多均线 summary 保留具体指标周期', () => {
    const state = buildStateFromUserMessage('入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt')
    const projection = new SemanticStateProjectionService().buildConversationView(state)

    expect(projection.summary).toContain('EMA20')
    expect(projection.summary).toContain('EMA60')
    expect(projection.summary).toContain('EMA144')
    expect(projection.summary).not.toContain('指标高于阈值，且指标高于阈值')
  })

  it('策略4: RSI/ATR/分批止盈/回撤护栏不回退入场追问', () => {
    const state = buildStateFromUserMessage('ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损，达到 3% 利润分批止盈一半；任何时刻账户回撤超过 10% 暂停开新仓。')
    const allKeys = [
      ...state.trigger.map(item => item.key),
      ...state.action.map(item => item.key),
      ...state.risk.map(item => item.key),
      ...state.orchestration.map(item => item.key),
    ]
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)

    expect(allKeys).toContain('oscillator.rsi_lte')
    expect(allKeys).toContain('risk.partial_take_profit')
    expect(allKeys).toContain('portfolioRisk.drawdown_block')
    expect(allKeys).not.toContain('semantic.missing_entry_atom')
    expect(prompt).not.toContain('请补充入场触发条件')
  })
})
