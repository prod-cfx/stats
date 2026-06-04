import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { SemanticState } from '../../types/semantic-state'
import type { StrategyClarificationState } from '../../types/strategy-clarification'
import type { Bar } from '@/modules/backtesting/types/backtesting.types'
import { BacktestRunnerService } from '@/modules/backtesting/core/backtest-runner.service'
import { PortfolioLedgerServiceFactory } from '@/modules/backtesting/portfolio/portfolio-ledger.service'
import { BacktestReporterService } from '@/modules/backtesting/report/backtest-reporter.service'
import { RiskEvaluatorService } from '@/modules/backtesting/risk/risk-evaluator.service'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { StateEngineService } from '@/modules/backtesting/state/state-engine.service'
import { TheoreticalExecutionModel } from '@/modules/backtesting/execution/theoretical-execution.model'
import { CURRENT_SEMANTIC_VERSION } from '../../nl-gateway/version-gate/version-gate'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'
import { CodegenGraphSnapshotService } from '../codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { RulesMainflowReaderService, type MainflowLeafRole, type RulesMainflowAtomFact } from '../rules-mainflow-reader.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../strategy-summary-observation.service'

type ConversationInternals = {
  normalizeSemanticContractReadiness: (
    state: SemanticState,
    strategyVersion: { deployedAtSemanticVersion: string | null },
  ) => SemanticState
  buildClarificationFromSemanticState: (state: SemanticState) => StrategyClarificationState & { summary?: string | null }
}

const noop = () => undefined
const stubObj = new Proxy({}, { get: () => noop }) as never
const rulesMainflowReader = new RulesMainflowReaderService()
const forbiddenUserVisibleFragments = [
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
  // Issue #1492：production 已不再用 dispatcher seed 语义；测试辅助场景显式直调。
  const patch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
  const state = new SemanticSeedStateBuilderService().build(patch, message)
  expect(state).not.toBeNull()
  return conversation.normalizeSemanticContractReadiness(
    state!,
    { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION },
  )
}

function factsByRole(state: SemanticState, role: MainflowLeafRole): RulesMainflowAtomFact[] {
  return [...rulesMainflowReader.readFactsByRole(state, role)]
}

function keysWithLegacyAliases(keys: readonly string[]): string[] {
  return [...new Set(keys.flatMap(key => key.startsWith('action.') ? [key, key.slice('action.'.length)] : [key]))]
}

function allSemanticKeys(state: SemanticState): string[] {
  return keysWithLegacyAliases(rulesMainflowReader.readFacts(state).map(item => item.key))
}

function findSemanticFact(state: SemanticState, key: string): RulesMainflowAtomFact | undefined {
  return rulesMainflowReader.readFacts(state).find(item => item.key === key)
}

async function runCompiledScriptOnBars(message: string, bars: Bar[]) {
  const state = buildStateFromUserMessage(message)
  const artifacts = await createPublicationStage().generate({ semanticState: state })
  const adapter = new BacktestStrategyAdapterService()
  const symbolRaw = state.contextSlots.symbol?.value
  const symbol = typeof symbolRaw === 'string' && symbolRaw.length > 0 ? symbolRaw : bars[0]?.symbol ?? 'BTCUSDT'
  const timeframeRaw = state.contextSlots.timeframe?.value
  const timeframe = (typeof timeframeRaw === 'string' && timeframeRaw.length > 0 ? timeframeRaw : bars[0]?.timeframe ?? '15m') as Bar['timeframe']
  const exchangeRaw = state.contextSlots.exchange?.value
  const marketTypeRaw = state.contextSlots.marketType?.value
  const built = await adapter.build({
    id: `runtime-regression-${symbol}-${timeframe}`,
    protocolVersion: 'v1',
    scriptCode: artifacts.compiledScript,
    params: {
      exchange: typeof exchangeRaw === 'string' ? exchangeRaw : 'okx',
      marketType: typeof marketTypeRaw === 'string' ? marketTypeRaw : 'perp',
      symbol,
      timeframe,
    },
  })
  const runner = new BacktestRunnerService(
    new TheoreticalExecutionModel(),
    new PortfolioLedgerServiceFactory(),
    new BacktestReporterService(),
    new StateEngineService(),
    new RiskEvaluatorService(),
  )
  const report = await runner.run({
    symbols: [symbol],
    baseTimeframe: timeframe,
    stateTimeframes: [],
    initialCash: 10000,
    leverage: 1,
    execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
    strategy: built,
    dataRange: { fromTs: bars[0]!.closeTime, toTs: bars.at(-1)!.closeTime },
    bars,
  })
  return { state, artifacts, report }
}

describe('user reported five strategies: entry -> middle -> publication generation', () => {
  const plazaMaCrossTrendMessage = '基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 MA 6/48 均线交叉趋势跟随策略。入场规则：MA6 上穿 MA48 时做多开仓；出场规则：MA6 下穿 MA48 时平多；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.6%。'
  const plazaBollMeanReversionMessage = '基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建布林带均值回归策略。入场规则：价格触及布林带 30 周期 0.9 倍标准差下轨时做多开仓；出场规则：价格回归布林带中轨时平多；风控：仓位 35%，2 倍杠杆，止损 3%，止盈 0.5%。'
  const plazaRsiReversalMessage = '基于 OKX 模拟盘 ETH-USDT 现货 15m，创建 RSI 反转策略。入场规则：RSI14 从 38 下方向上穿回 38 时买入；出场规则：RSI14 高于 64 时卖出平仓；风控：仓位 25%，不使用杠杆，止损 5%，止盈 0.5%。'

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
      name: '策略10 现货网格中心偏移（S6 grid center-offset → centered_percent_range/deployment）',
      message: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行"立即停止并撤销所有未成交订单"',
      expectedAnyKeys: ['grid.range_rebalance'],
      publication: true,
    },
    {
      name: '策略11 OKX 永续 EMA7/21 上下穿 + 权益百分比仓位',
      message: '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。',
      expectedAnyKeys: ['indicator.cross_over', 'indicator.cross_under', 'open_long', 'close_long'],
      publication: true,
    },
  ]

  for (const strategy of strategies) {
    it(`${strategy.name}: 入口和中链路不回退 missing/unsupported`, () => {
      const state = buildStateFromUserMessage(strategy.message)
      const allKeys = allSemanticKeys(state)
      const conversation = createConversationService()
      const projection = new SemanticStateProjectionService().buildConversationView(state)
      const clarificationState = conversation.buildClarificationFromSemanticState(state)
      const prompt = new StrategyClarificationQuestionService().build(clarificationState)

      for (const key of strategy.expectedAnyKeys) {
        expect(allKeys).toContain(key)
      }
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

      // 双路径接受：常规策略走 rules，grid 程序走 orderPrograms（与 canonical spec 设计一致）
      const ruleCount = artifacts.canonicalSpec.rules.length
      const programCount = (artifacts.canonicalSpec as unknown as { orderPrograms?: unknown[] }).orderPrograms?.length ?? 0
      expect(ruleCount >= 2 || programCount >= 1).toBe(true)
      expect(artifacts.compiledScript).toContain('protocolVersion')
      expect(artifacts.compiledScript).toContain('onBar')
      expect(artifacts.validation.passed).toBe(true)
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      assertNoForbiddenUserText(artifacts.compiledScript)
    })

    it(`${strategy.name}: 回测装载——BacktestStrategyAdapter 可加载 compiled script`, async () => {
      const state = buildStateFromUserMessage(strategy.message)
      const artifacts = await createPublicationStage().generate({ semanticState: state })
      // BacktestStrategyAdapter 用 CompiledScriptParser 解析脚本并构造 onBar 回调，
      //   是 backtest runner 实际消费 compiledScript 的入口。能成功 build 即证明
      //   compiledScript 的 expr pool / guards / risk predicates / decision programs /
      //   orderPrograms 拓扑都能被运行时正确装载。
      const adapter = new BacktestStrategyAdapterService()
      const built = await adapter.build({
        id: `e2e-${strategy.name}`,
        protocolVersion: 'v1',
        scriptCode: artifacts.compiledScript,
        params: {
          exchange: 'binance',
          marketType: 'perp',
          symbol: 'BTCUSDT',
          timeframe: '15m',
        },
      })
      expect(built).toBeTruthy()
      expect(typeof built.fn).toBe('function')
    })

    it(`${strategy.name}: 真实回测——BacktestRunnerService 跑通 mock OHLCV 不抛错`, async () => {
      const state = buildStateFromUserMessage(strategy.message)
      const artifacts = await createPublicationStage().generate({ semanticState: state })
      const adapter = new BacktestStrategyAdapterService()
      const symbolRaw = state.contextSlots.symbol?.value
      const symbol = typeof symbolRaw === 'string' && symbolRaw.length > 0 ? symbolRaw : 'BTCUSDT'
      const timeframeRaw = state.contextSlots.timeframe?.value
      const timeframe = (typeof timeframeRaw === 'string' && timeframeRaw.length > 0
        ? timeframeRaw
        : artifacts.canonicalSpec.market.defaultTimeframe ?? '15m') as Bar['timeframe']
      const exchangeRaw = state.contextSlots.exchange?.value
      const marketTypeRaw = state.contextSlots.marketType?.value
      const built = await adapter.build({
        id: `runtime-${strategy.name}`,
        protocolVersion: 'v1',
        scriptCode: artifacts.compiledScript,
        params: {
          exchange: typeof exchangeRaw === 'string' ? exchangeRaw : 'binance',
          marketType: typeof marketTypeRaw === 'string' ? marketTypeRaw : 'perp',
          symbol,
          timeframe,
        },
      })
      // 50 根 mock OHLCV 走小幅度震荡，覆盖触发 / 不触发两侧
      const bars: Bar[] = []
      const intervalMs = 15 * 60 * 1000
      let price = 100
      for (let i = 0; i < 50; i += 1) {
        const closeTime = (i + 1) * intervalMs
        const drift = Math.sin(i / 5) * 1.5
        const open = price
        const close = +(price + drift).toFixed(4)
        const high = +(Math.max(open, close) + 0.5).toFixed(4)
        const low = +(Math.min(open, close) - 0.5).toFixed(4)
        bars.push({ symbol, timeframe, openTime: closeTime - intervalMs, closeTime, open, high, low, close, volume: 100 + i })
        price = close
      }
      const runner = new BacktestRunnerService(
        new TheoreticalExecutionModel(),
        new PortfolioLedgerServiceFactory(),
        new BacktestReporterService(),
        new StateEngineService(),
        new RiskEvaluatorService(),
      )
      const report = await runner.run({
        symbols: [symbol],
        baseTimeframe: timeframe,
        stateTimeframes: [],
        initialCash: 10000,
        leverage: 1,
        execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
        strategy: {
          id: built.id,
          params: built.params,
          fn: built.fn,
        },
        dataRange: { fromTs: bars[0]!.closeTime, toTs: bars.at(-1)!.closeTime },
        bars,
      })
      // 回测引擎跑通 = 报告对象返回；trades 数量 / 终值不强断言（depends on price path）
      expect(report).toBeTruthy()
      expect(report.equityCurve).toBeDefined()
      expect(report.equityCurve.length).toBeGreaterThanOrEqual(1)
    })
  }

  it('策略1: 网格每格间距已给出时不再追问密度', () => {
    const state = buildStateFromUserMessage('在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈')
    const grid = findSemanticFact(state, 'grid.range_rebalance')
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)

    expect(grid?.params.stepPct).toBe(0.5)
    expect(grid?.openSlots.map(slot => slot.slotKey)).not.toContain('contract.shape.price.level_set.density')
    expect(prompt).not.toContain('网格数量或每格间距')
  })

  it('策略2: 普通止盈不误归类为分批止盈', () => {
    const state = buildStateFromUserMessage('在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%')
    const riskKeys = factsByRole(state, 'risk').map(item => item.key)
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
    const allKeys = allSemanticKeys(state)
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)

    expect(allKeys).toContain('oscillator.rsi_lte')
    expect(allKeys).toContain('risk.partial_take_profit')
    expect(allKeys).toContain('portfolioRisk.drawdown_block')
    expect(prompt).not.toContain('请补充入场触发条件')
  })

  it('策略广场 MA 趋势跟随：上穿做多开仓保持 entry/open_long，下穿平多保持 exit/close_long', () => {
    const state = buildStateFromUserMessage(plazaMaCrossTrendMessage)
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const prompt = new StrategyClarificationQuestionService().build(clarificationState)
    const entryFacts = factsByRole(state, 'condition').filter(fact => fact.phase === 'entry')
    const exitFacts = factsByRole(state, 'condition').filter(fact => fact.phase === 'exit')
    const actionFacts = factsByRole(state, 'action')

    expect(entryFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_over' }),
    ]))
    expect(exitFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_under' }),
    ]))
    expect(actionFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_long', phase: 'entry' }),
      expect.objectContaining({ key: 'action.close_long', phase: 'exit' }),
    ]))
    expect(prompt).not.toContain('请补充入场条件')
    expect(prompt).not.toContain('请补充入场触发条件')
  })

  it('策略广场 MA 趋势跟随：planner 错把上穿归为 exit 时，主数据流 clarification 文案使用修正后的 entry', () => {
    const conversation = createConversationService()
    const plannerPatch = {
      contextSlots: {
        venue: 'okx',
        symbol: 'BTCUSDT',
        instrumentType: 'perpetual',
        timeframe: '15m',
      },
      rules: [{
        id: 'planner-wrong-exit-cross-over',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 2 } }, { kind: 'atom', key: 'risk.take_profit_pct', params: { valuePct: 0.6 } }],
          positions: [{ kind: 'atom', key: 'position.sizing', params: { mode: 'pct_equity', value: 35 } }, { kind: 'atom', key: 'position.leverage', params: { value: 2 } }],
          orchestration: [],
          programs: [],
        },
      }, {
        id: 'planner-exit-cross-under',
        phase: 'exit',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 } },
        effects: { actions: [{ kind: 'atom', key: 'action.close_long', params: {} }], risks: [], positions: [], orchestration: [], programs: [] },
      }],
    } as CodegenSemanticPatch
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(plazaMaCrossTrendMessage) as CodegenSemanticPatch
    const mergedPatch = new PlannerDispatcherMergeService().mergeDeterministicExecutionSlots(
      plannerPatch,
      dispatcherPatch,
      plazaMaCrossTrendMessage,
    ) as CodegenSemanticPatch
    const state = new SemanticSeedStateBuilderService().build(mergedPatch, plazaMaCrossTrendMessage)
    expect(state).not.toBeNull()
    const normalized = conversation.normalizeSemanticContractReadiness(state!, { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION })
    const clarificationState = conversation.buildClarificationFromSemanticState(normalized)
    const summary = clarificationState.summary ?? ''

    expect(summary).toContain('入场：MA6 上穿 MA48')
    expect(summary).not.toContain('出场：MA6 上穿 MA48')
    expect(clarificationState.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'missing_entry_rules' }),
    ]))
  })

  it('策略广场 BOLL 均值回归：下轨做多保持 entry，中轨平多保持 exit', () => {
    const state = buildStateFromUserMessage(plazaBollMeanReversionMessage)
    const conversation = createConversationService()
    const clarificationState = conversation.buildClarificationFromSemanticState(state)
    const summary = clarificationState.summary ?? ''
    const entryFacts = factsByRole(state, 'condition').filter(fact => fact.phase === 'entry')
    const exitFacts = factsByRole(state, 'condition').filter(fact => fact.phase === 'exit')
    const actionFacts = factsByRole(state, 'action')

    expect(entryFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'bollinger.touch_lower' }),
    ]))
    expect(exitFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'bollinger.touch_middle' }),
    ]))
    expect(actionFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_long', phase: 'entry' }),
      expect.objectContaining({ key: 'action.close_long', phase: 'exit' }),
    ]))
    expect(summary).toContain('入场：')
    expect(summary).toContain('BOLL（30, 0.9）下轨触及')
    expect(summary).toContain('出场：')
    expect(summary).toContain('BOLL（30, 0.9）中轨触及')
    expect(summary).not.toContain('入场：BOLL（30, 0.9）中轨触及')
  })

  it('策略广场 RSI 反转：publication 脚本入场只编译 rsi_reclaim，不保留 impossible threshold 噪声', async () => {
    const state = buildStateFromUserMessage(plazaRsiReversalMessage)
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const entryDecision = artifacts.ast.decisionPrograms.find(program => program.phase === 'entry')
    const entryExpr = artifacts.ast.exprPool.find(expr => expr.id === entryDecision?.when)
    const serializedEntry = JSON.stringify(entryExpr)
    const serializedScript = artifacts.compiledScript
    expect(entryExpr).toEqual(expect.objectContaining({
      nodeType: 'predicate',
      payload: expect.objectContaining({
        kind: 'cross',
        params: expect.objectContaining({ sequenceKind: 'rsi_reclaim', threshold: 38 }),
      }),
    }))
    expect(serializedEntry).not.toContain('threshold_gte')
    expect(serializedEntry).not.toContain('const_70')
    expect(serializedScript).not.toContain('const_70')
    expect(serializedScript).not.toContain('semantic_entry_dispatcher_typed_rule_1_2_rsi_threshold_gte')
  })

  it('用户复杂策略：多头清算阈值开空编译为 liquidation feed predicate', async () => {
    const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，出现多头清算超过 100 万 USDT 后开空，单笔 10% 仓位。价格重新站上 EMA20 时平空。')
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const liquidationExpr = artifacts.ast.exprPool.find(expr => expr.payload.kind === 'liquidationCondition')

    expect(liquidationExpr?.payload.params).toEqual(expect.objectContaining({
      schemaRef: 'liquidation',
      sourceFeedId: 'liquidation.events',
      operator: 'GT',
      side: 'long',
      value: 1_000_000,
    }))
    expect(artifacts.compiledScript).toContain('liquidationCondition')
    expect(artifacts.compiledScript).toContain('liquidation.events')
  })

  it('用户复杂策略：资金费率为正 + 价格上穿 EMA20 不退化为 EMA7/EMA21', async () => {
    const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m。资金费率为正并且价格上穿 EMA20 时开多，单笔 10% 仓位。跌破 EMA20 时平多。')
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const fundingExpr = artifacts.ast.exprPool.find(expr => expr.payload.kind === 'fundingRateCondition')
    const crossExprs = artifacts.ast.exprPool.filter(expr => expr.payload.kind === 'CROSS_OVER' || expr.payload.kind === 'CROSS_UNDER')
    const serialized = JSON.stringify(crossExprs)

    expect(fundingExpr?.payload.params).toEqual(expect.objectContaining({
      schemaRef: 'funding',
      sourceFeedId: 'funding.rate',
      operator: 'GT',
      value: 0,
    }))
    expect(serialized).toContain('close_15m')
    expect(serialized).toContain('ema_20_15m')
    expect(serialized).not.toContain('ema_7_15m')
    expect(serialized).not.toContain('ema_21_15m')
  })

  it('用户复杂策略：orderbook 条件回测缺事件流时给出 event-stream 诊断', async () => {
    const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m。价格上穿 EMA20 开多，但需要 OKX orderbook imbalance 大于 60% 确认，单笔 10% 仓位。跌破 EMA20 时平多。')
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const adapter = new BacktestStrategyAdapterService()
    const built = await adapter.build({
      id: 'orderbook-missing-stream',
      protocolVersion: 'v1',
      scriptCode: artifacts.compiledScript,
      params: { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '15m' },
    })
    const intervalMs = 15 * 60 * 1000
    const bars: Bar[] = Array.from({ length: 25 }, (_, index) => {
      const closeTime = (index + 1) * intervalMs
      const close = index < 20 ? 100 : 110
      return { symbol: 'BTCUSDT', timeframe: '15m', openTime: closeTime - intervalMs, closeTime, open: close, high: close + 1, low: close - 1, close, volume: 100 }
    })
    const runner = new BacktestRunnerService(
      new TheoreticalExecutionModel(),
      new PortfolioLedgerServiceFactory(),
      new BacktestReporterService(),
      new StateEngineService(),
      new RiskEvaluatorService(),
    )
    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: built,
      dataRange: { fromTs: bars[0]!.closeTime, toTs: bars.at(-1)!.closeTime },
      bars,
    })

    expect(report.diagnostics.eventStreamMissingCount).toBe(1)
    expect(report.summary.diagnosticReason).toBe('BACKTEST_EVENT_STREAM_UNAVAILABLE')
  })

  describe('用户反馈 7 条策略：rules 主数据流通用修复', () => {
    it('range inside + break lower: 编译为可执行区间谓词并在 mock 行情产生成交', async () => {
      const intervalMs = 15 * 60 * 1000
      const closes = Array.from({ length: 58 }, (_, index) => [100, 101, 99][index % 3]!).concat([100, 98, 99, 100])
      const bars: Bar[] = closes.map((close, index) => ({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        openTime: index * intervalMs,
        closeTime: (index + 1) * intervalMs,
        open: index === 0 ? close : closes[index - 1]!,
        high: close + 1,
        low: close - 1,
        close,
        volume: 100 + index,
      }))

      const { artifacts, report } = await runCompiledScriptOnBars('OKX 合约 BTCUSDT 15m，价格维持在震荡区间内时开多，单笔 10% 仓位。跌破震荡区间下沿时平多。', bars)
      const serializedExprs = JSON.stringify(artifacts.ast.exprPool)

      expect(serializedExprs).toContain('RANGE_POSITION_PCT')
      expect(artifacts.ast.exprPool).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ kind: 'compare', args: [] }),
        }),
      ]))
      expect(report.summary.totalTrades + (report.summary.totalOpenTrades ?? 0)).toBeGreaterThan(0)
    })

    it('indicator lower boundary + ATR stop: 保留 ATR 出场，只追问指标类型而不是出场', () => {
      const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，价格触及指标下边界时开多，每次固定 100 USDT，使用 5 倍杠杆，并用 ATR14 的 2 倍止损。')
      const conversation = createConversationService()
      const clarificationState = conversation.buildClarificationFromSemanticState(state)
      const prompt = new StrategyClarificationQuestionService().build(clarificationState)
      const keys = allSemanticKeys(state)

      expect(keys).toContain('risk.atr_stop')
      expect(prompt).not.toContain('请补充出场')
      expect(prompt).not.toContain('退出条件')
      expect(prompt).not.toContain('出场/风控')
    })

    it('martingale program: 有出场后不能发布只有 CLOSE、没有 OPEN/ADD 的无交易脚本', async () => {
      const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，开启马丁程序，亏损后按 2 倍补单，最多补 3 次。跌破ema20平仓')
      const artifacts = await createPublicationStage().generate({ semanticState: state })
      const actionKinds = artifacts.ast.decisionPrograms.flatMap(program => program.actions.map(action => action.kind))

      expect(actionKinds.some(kind => kind === 'OPEN_LONG' || kind === 'ADD_LONG')).toBe(true)
      expect(artifacts.compiledScript).toContain('martingale')
    })

    it.each([
      ['open-interest-breakout', 'BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。', ['openInterest.condition', 'price.breakout_up', 'action.open_long']],
      ['indicator-lower-atr-stop', 'OKX 合约 BTCUSDT 15m，价格触及指标下边界时开多，每次固定 100 USDT，使用 5 倍杠杆，并用 ATR14 的 2 倍止损。', ['price.detect.indicator_boundary', 'action.open_long', 'risk.atr_stop', 'position.fixed_notional', 'position.leverage']],
      ['twap-entry-program', 'OKX 合约 BTCUSDT 15m，EMA20 上穿 EMA50 后用 TWAP 分 10 次均匀买入，总仓位 1000 USDT。', ['indicator.cross_over', 'program.twap', 'action.open_long']],
      ['dca-program', 'OKX 合约 BTCUSDT 1h，启用 DCA 程序，每回撤 3% 买入一次，最多执行 5 次。', ['program.dca']],
    ])('%s: 入口到发布不抛 INTERNAL_SERVER_ERROR', async (_name, message, expectedKeys) => {
      const state = buildStateFromUserMessage(message)
      const keys = allSemanticKeys(state)
      for (const key of expectedKeys) expect(keys).toContain(key)

      const artifacts = await createPublicationStage().generate({ semanticState: state })
      expect(artifacts.validation.passed).toBe(true)
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      expect(artifacts.compiledScript).toContain('protocolVersion')
    })

    it('open-interest breakout: 20 根高点只生成 channel breakout，不生成价格 20 突破', async () => {
      const state = buildStateFromUserMessage('BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。')
      const artifacts = await createPublicationStage().generate({ semanticState: state })
      const serialized = JSON.stringify({ spec: artifacts.spec, ast: artifacts.ast })

      expect(serialized).toContain('breakout_channel_high_break')
      expect(serialized).not.toContain('price.level_breakout_up')
      expect(serialized).not.toContain('const_20')
    })

    it('limit reduce + conditional entry: RSI 减仓保留 exit，不被误识别成开多入场', async () => {
      const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，RSI14 高于 70 时用限价单减仓 50%，突破 70000 后下条件单开多。相对入场价下跌5%平仓')
      const exitActionFacts = factsByRole(state, 'action').filter(fact => fact.phase === 'exit')
      const entryFacts = factsByRole(state, 'condition').filter(fact => fact.phase === 'entry')
      const artifacts = await createPublicationStage().generate({ semanticState: state })

      expect(exitActionFacts).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'action.reduce_position' })]))
      expect(entryFacts).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'price.breakout_up' })]))
      expect(entryFacts).not.toEqual(expect.arrayContaining([expect.objectContaining({ key: 'oscillator.rsi_gte' })]))
      expect(artifacts.compiledScript).not.toContain('"1b"')
      expect(artifacts.compiledScript).not.toContain('timeframe":"1b')
      expect(artifacts.compiledScript).not.toContain('market.timeframe_unsupported')
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    })

    it('martingale program: 补退出后不再 position sizing drift', async () => {
      const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，开启马丁程序，亏损后按 2 倍补单，最多补 3 次。相对入场价下跌5%平仓')
      const keys = allSemanticKeys(state)
      const artifacts = await createPublicationStage().generate({ semanticState: state })

      expect(keys).toContain('program.martingale')
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      expect(artifacts.compiledScript).toContain('martingale')
    })

    it('spot equal-weight rebalance: 等权组合映射为 rebalance program，不要求单笔仓位', async () => {
      const state = buildStateFromUserMessage('OKX 现货 BTC 和 ETH 做 50% 50% 等权组合，每天执行 rebalance 再平衡。')
      const keys = allSemanticKeys(state)
      const conversation = createConversationService()
      const clarificationState = conversation.buildClarificationFromSemanticState(state)
      const artifacts = await createPublicationStage().generate({ semanticState: state })
      const serialized = JSON.stringify({ state, ast: artifacts.ast, script: artifacts.compiledScript })

      expect(keys).toContain('program.rebalance')
      expect(clarificationState.items.map(item => item.reason)).not.toContain('missing_position_sizing')
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      expect(artifacts.compiledScript).toContain('rebalance')
      expect(serialized).not.toContain('REBALANCEUSDT')
    })
  })

  describe('用户反馈 5 条策略：rules 主数据流通用修复', () => {
    it.each([
      ['iceberg-price-level', 'OKX 合约 BTCUSDT 15m，突破 70000 后用 iceberg 冰山单买入 1000 USDT，拆成每次 100 USDT。相对入场价下跌5%平仓', ['price.breakout_up', 'program.iceberg']],
      ['pair-spread-legs', 'OKX 合约 BTCUSDT 和 ETHUSDT 做多空双腿价差，BTC 腿做多、ETH 腿做空，价差扩大时开仓。', ['scope.leg', 'orderbook.spread_condition']],
      ['orderbook-post-only', 'OKX BTCUSDT 永续 1m，盘口价差小于 0.03% 且买一卖一深度比超过 2 倍时，只用 post-only 限价单开多，亏损 1% 止损。', ['orderbook.spread_condition', 'orderbook.depth_ratio', 'execution.post_only', 'action.open_long', 'risk.stop_loss_pct']],
      ['portfolio-risk-multi-symbol', 'OKX 合约 BTC 和 ETH 15m，EMA20 上穿 EMA50 开多。账户当天亏损超过 5% 后停止新开仓，最多同时持有 3 个仓位。单笔仓位 1%。', ['indicator.cross_over', 'risk.daily_loss_limit', 'risk.kill_switch', 'position.max_concurrent_positions', 'scope.symbol']],
      ['reduce-only-limit-chase', 'BTCUSDT 5m，RSI14 高于 70 时 reduce-only 限价平多，如果 3 根 K 线没成交就追价一次。', ['oscillator.rsi_gte', 'action.close_long', 'execution.reduce_only', 'action.limit_order', 'execution.limit_chase']],
    ])('%s: 入口到发布不抛 INTERNAL_SERVER_ERROR / gate blocked', async (_name, message, expectedKeys) => {
      const state = buildStateFromUserMessage(message)
      const keys = allSemanticKeys(state)
      for (const key of expectedKeys) expect(keys).toContain(key)

      const artifacts = await createPublicationStage().generate({ semanticState: state })
      const serialized = JSON.stringify({ state, ast: artifacts.ast, script: artifacts.compiledScript })
      expect(artifacts.validation.passed).toBe(true)
      expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
      expect(artifacts.compiledScript).toContain('protocolVersion')
      expect(serialized).not.toContain('BTCUSDTUSDT')
      expect(serialized).not.toContain('ICEBERGUSDT')
      expect(serialized).not.toContain('REBALANCEUSDT')
    })
  })

  it('用户复杂策略：固定网格只生成 orchestration program，不重复生成 legacy order programs', async () => {
    const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，在 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用，单笔 10% 仓位。')
    const artifacts = await createPublicationStage().generate({ semanticState: state })

    expect(artifacts.ast.orchestrationPrograms).toHaveLength(1)
    expect(artifacts.ast.orchestrationPrograms[0]).toEqual(expect.objectContaining({
      programKind: 'fixed_grid_gated',
      onDeactivate: 'cancel',
    }))
    expect(JSON.stringify(artifacts.ast.orchestrationPrograms[0])).toContain('50000')
    expect(JSON.stringify(artifacts.ast.orchestrationPrograms[0])).toContain('60000')
    expect(artifacts.ast.orderPrograms).toHaveLength(0)
    expect(artifacts.compiledScript).toContain('fixed_grid_gated')
  })

  it('用户复杂策略：固定网格缺仓位时不默认每格 10%，补仓位后才可发布', async () => {
    const conversation = createConversationService()
    const patch = new GenericSeedDispatcher().dispatch('OKX 合约 BTCUSDT 15m，在 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。') as CodegenSemanticPatch
    const seedState = new SemanticSeedStateBuilderService().build(patch, 'OKX 合约 BTCUSDT 15m，在 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。')
    expect(seedState).not.toBeNull()

    const state = conversation.normalizeSemanticContractReadiness(
      seedState!,
      { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION },
    )
    const program = state.orchestration?.find(node => node.kind === 'program' && node.key === 'program.fixed_grid_gated')

    expect(state.position?.openSlots).toContainEqual(expect.objectContaining({ slotKey: 'position.sizing' }))
    expect(program?.sizing).toBeUndefined()
    const unsizedArtifacts = await createPublicationStage().generate({ semanticState: state })
    expect(unsizedArtifacts.ast.orchestrationPrograms ?? []).toEqual([])
    expect(unsizedArtifacts.compiledScript).not.toContain('fixed_grid_gated')

    const sizedState = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，在 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用，单笔 10% 仓位。')
    const sizedProgramLeaf = factsByRole(sizedState, 'program').find(leaf => leaf.key === 'program.fixed_grid_gated')
    expect(sizedProgramLeaf?.params.sizing).toEqual({ mode: 'fixed_pct', value: 10 })
    const sizedArtifacts = await createPublicationStage().generate({ semanticState: sizedState })

    expect(sizedArtifacts.ast.orchestrationPrograms[0]).toEqual(expect.objectContaining({
      sizing: { mode: 'fixed_pct', value: 10 },
    }))
  })

  it('用户复杂策略：反手做空保留 reversePosition metadata', async () => {
    const state = buildStateFromUserMessage('OKX 永续 BTCUSDT 15m。EMA20 下穿 EMA50 时从多头反手做空，单笔 10% 仓位。')
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const reverseDecision = artifacts.ast.decisionPrograms.find(program => program.actions.some(action => action.kind === 'OPEN_SHORT'))
    const script = artifacts.compiledScript

    expect(reverseDecision?.actions.map(action => action.kind)).toEqual(['CLOSE_LONG', 'OPEN_SHORT'])
    expect(reverseDecision?.metadata).toEqual(expect.objectContaining({
      reversePosition: expect.objectContaining({ fromSide: 'long', toSide: 'short' }),
    }))
    expect(script).toContain('ema_20_15m')
    expect(script).toContain('ema_50_15m')
    expect(script).not.toContain('CROSS_UNDER","args":["close_15m","ema_20_15m"]')
  })

  it('用户复杂策略：TradingView webhook buy 不生成 REQUIRED_SIGNAL_ID 占位和重复开仓', async () => {
    const state = buildStateFromUserMessage('OKX 合约 BTCUSDT 15m，收到 TradingView webhook buy 信号后开多，单笔 10% 仓位。跌破 EMA20 时平多。')
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const openLongDecisions = artifacts.ast.decisionPrograms.filter(program => program.actions.some(action => action.kind === 'OPEN_LONG'))
    const script = artifacts.compiledScript

    expect(openLongDecisions).toHaveLength(1)
    expect(script).toContain('externalSignal')
    expect(script).toContain('TradingView webhook buy')
    expect(script).not.toContain('REQUIRED_SIGNAL_ID')
    expect(script).not.toContain('openSlots')
    expect(script).not.toContain('IN_TIME_WINDOW')
  })

  it('用户复杂策略：top-level 仓位回填到网格 program rules 主数据流', () => {
    const conversation = createConversationService()
    const state = conversation.normalizeSemanticContractReadiness({
      version: 1,
      families: ['grid.range_rebalance'],
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
      orchestrationContracts: [],
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', status: 'locked', priority: 'context', value: 'okx', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', status: 'locked', priority: 'context', value: 'BTCUSDT', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', status: 'locked', priority: 'context', value: 'perp', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', status: 'locked', priority: 'context', value: '15m', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-06-02T00:00:00.000Z',
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
        source: 'user_explicit',
        status: 'locked',
        openSlots: [],
        positionMode: 'long_only',
      },
      rules: [{
        id: 'program-grid',
        phase: 'program',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'grid.range_rebalance', params: { rangeLower: 50000, rangeUpper: 60000, levels: 10, stepPct: 5, perGridSizing: 0 } },
        effects: {
          actions: [],
          risks: [],
          positions: [{ kind: 'atom', key: 'grid.range_rebalance', params: { sideMode: 'both' } }],
          orchestration: [],
          programs: [{ kind: 'atom', key: 'program.fixed_grid_gated', params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5 } }],
        },
      }, {
        id: 'pos-sizing-10pct',
        phase: 'program',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'grid.range_rebalance', params: { sideMode: 'both' } },
        effects: {
          actions: [],
          risks: [],
          positions: [{ kind: 'atom', key: 'position.sizing', params: { mode: 'fixed_pct', value: 0.1 } }],
          orchestration: [],
          programs: [],
        },
      }],
    } as SemanticState, { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION })

    const sizingLeaves = factsByRole(state, 'position').filter(leaf => leaf.key === 'position.sizing')

    expect(sizingLeaves).toHaveLength(1)
    expect(state.rules?.map(rule => rule.id)).not.toContain('pos-sizing-10pct')
    expect(sizingLeaves[0]?.params).toEqual(expect.objectContaining({
      sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
    }))
  })
})
