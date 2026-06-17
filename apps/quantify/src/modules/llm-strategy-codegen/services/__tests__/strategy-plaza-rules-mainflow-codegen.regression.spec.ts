import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'
import { SemanticAtomInvariantService } from '../semantic-atom-invariant.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { collectAtomLeaves } from '../../types/atom-expr'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '@/modules/strategy-plaza/constants/official-strategy-plaza-templates'

type BuiltSemanticState = ReturnType<SemanticSeedStateBuilderService['build']>

function buildSemanticStateFromPrompt(text: string): BuiltSemanticState {
  const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
  const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
  return new SemanticSeedStateBuilderService().build(fallback, text)
}

function buildCompiledIrFromPrompt(text: string): ReturnType<CanonicalSpecV2IrCompilerService['compile']> {
  const state = buildSemanticStateFromPrompt(text)
  const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
  const baseTimeframe = canonicalSpec.market.defaultTimeframe
    ?? canonicalSpec.market.timeframe
    ?? canonicalSpec.dataRequirements.requiredTimeframes[0]
    ?? '15m'
  const positionPct = canonicalSpec.sizing?.mode === 'RATIO'
    ? Number((canonicalSpec.sizing.value * 100).toFixed(4))
    : 10

  return new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec,
    fallback: {
      exchange: canonicalSpec.market.exchange,
      symbol: canonicalSpec.market.symbol ?? 'ETHUSDT',
      baseTimeframe,
      positionPct,
    },
  })
}

function buildInvariantFailuresFromPrompt(text: string) {
  const state = buildSemanticStateFromPrompt(text)
  const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
  const compiled = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec,
    fallback: {
      exchange: canonicalSpec.market.exchange,
      symbol: canonicalSpec.market.symbol ?? 'BTCUSDT',
      baseTimeframe: canonicalSpec.market.defaultTimeframe ?? canonicalSpec.market.timeframe ?? '15m',
      positionPct: canonicalSpec.sizing?.mode === 'RATIO' ? Number((canonicalSpec.sizing.value * 100).toFixed(4)) : 10,
    },
  })
  const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
  return new SemanticAtomInvariantService().validate({ semanticState: state, canonicalSpec, ir: compiled.ir, ast })
    .filter(check => check.level === 'critical' && check.status === 'failed')
}

function semanticAtomKeys(state: BuiltSemanticState): Set<string> {
  return new Set(state.rules.flatMap(rule => [
    ...collectAtomLeaves(rule.condition),
    ...Object.values(rule.effects).flatMap(effects => effects.flatMap(effect => collectAtomLeaves(effect))),
  ]).map(leaf => leaf.key))
}

describe('Strategy Plaza rules-mainflow codegen regressions', () => {
  it('compiles the 8 reported official Strategy Plaza templates without missing expected atoms', () => {
    const targetIds = [
      'open-interest-breakout',
      'ema-slope-trend',
      'funding-rate-mean-reversion',
      'orderbook-imbalance-long',
      'liquidation-cascade-short',
      'breakout-pullback-hold',
      'breakout-follow',
      'breakout-volume-confirm',
    ]
    const templates = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.filter(template => targetIds.includes(template.id))

    expect(OFFICIAL_STRATEGY_PLAZA_TEMPLATES).toHaveLength(32)
    expect(templates.map(template => template.id).sort()).toEqual([...targetIds].sort())
    for (const template of templates) {
      const state = buildSemanticStateFromPrompt(template.editSeed.initialMessage)
      const keys = semanticAtomKeys(state)
      const missing = template.expectedAtomKeys.filter(key => !keys.has(key))

      expect(missing).toEqual([])
      expect(() => buildCompiledIrFromPrompt(template.editSeed.initialMessage)).not.toThrow()
    }
  })

  it('compiles drawdown DCA plaza edit seed from rules mainflow without invalid position effect', () => {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === 'drawdown-dca-budget')

    expect(template).toBeDefined()
    expect(() => buildCompiledIrFromPrompt(template!.editSeed.initialMessage)).not.toThrow()
  })

  it('compiles EMA20 slope plus volume confirmation after semantic confirmation', () => {
    const compiled = buildCompiledIrFromPrompt('基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 EMA 斜率趋势策略。规则：EMA20 斜率连续 3 根向上且成交量确认放大后开多；价格跌破 EMA20 平多；风控：仓位 20%，2 倍杠杆，亏损 2% 止损。')
    const predicateKinds = compiled.ir.signalCatalog.predicates.map(predicate => predicate.kind)

    expect(predicateKinds).toEqual(expect.arrayContaining(['GT', 'compare', 'LTE']))
    expect(compiled.ir.ruleBlocks.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps stop loss percent separate from position percent in breakout pullback prompt', () => {
    const state = buildSemanticStateFromPrompt('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建突破回踩策略。规则：价格突破 20 根高点后不立刻买，等回踩不破突破位再开多；跌破突破位下方止损；风控：仓位 20%，亏损 2% 止损。')
    const leaves = state.rules
      .flatMap(rule => Object.values(rule.effects).flatMap(effects => effects.flatMap(effect => collectAtomLeaves(effect))))
    const stopLosses = leaves.filter(leaf => leaf.key === 'risk.stop_loss_pct')
    const stopLossValues = [...new Set(stopLosses.map(leaf => leaf.params?.valuePct))]

    expect(stopLossValues).toEqual([2])
  })

  it('compiles open-interest breakout into executable price breakout and price-below-EMA exit predicates', () => {
    const compiled = buildCompiledIrFromPrompt('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建持仓量突破确认策略。规则：未平仓量 1 小时增加超过 5% 且价格突破过去 20 根 K 线高点时开多；跌破 EMA20 时平多；风控：仓位 10%，亏损 2% 止损。')
    const predicates = compiled.ir.signalCatalog.predicates
    const entryAnd = predicates.find(predicate => predicate.id === 'semantic_entry_dispatcher_typed_rule_1_and')

    expect(predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'semantic_exit_dispatcher_typed_rule_2_indicator_below_15m',
        kind: 'LTE',
        args: ['close_15m', 'ema_20_15m'],
      }),
      expect.objectContaining({
        kind: 'openInterestCondition',
        params: expect.objectContaining({ window: '1h', value: 5 }),
      }),
    ]))
    expect(entryAnd?.args.filter(arg => /breakout|rolling_extrema/.test(arg))).toHaveLength(1)
  })

  it('does not reject EMA trend continuation with price-below-EMA exit as semantic expression drift', () => {
    const failures = buildInvariantFailuresFromPrompt('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 EMA 趋势延续策略。规则：价格高于 EMA50 且 EMA20 上穿 EMA50 时开多；价格跌破 EMA20 时平多；风控：仓位 25%，2 倍杠杆，亏损 2% 止损。')

    expect(failures.map(check => check.message)).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/semantic expression drift/),
    ]))
  })

  it('does not reject indicator-vs-indicator EMA expression as semantic expression drift', () => {
    const failures = buildInvariantFailuresFromPrompt('OKX 合约 BTCUSDT 15m，价格高于 EMA50 且 EMA20 高于 EMA50 时，按每 4 根 15m K线的节奏开多，单笔 1%。出场：止盈 0.12%、止损 1.5%、持仓满 4 根 K线、或价格跌破 EMA20，任一触发即平多。')

    expect(failures.map(check => check.message)).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/semantic expression drift/),
    ]))
  })

  it('keeps price above EMA and EMA-vs-EMA trend filters as separate entry conditions', () => {
    const state = buildSemanticStateFromPrompt('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 EMA 趋势延续策略。规则：价格高于 EMA50 且 EMA20 高于 EMA50 时，按每 4 根 15m K线的节奏开多。出场：止盈 0.12%、止损 1.5%、持仓满 4 根 K线、或价格跌破 EMA20，任一触发即平多。风控：仓位 25%，2 倍杠杆。')
    const entryLeaves = state.rules
      .filter(rule => rule.phase === 'entry')
      .flatMap(rule => collectAtomLeaves(rule.condition))
    const indicatorLeaves = entryLeaves.filter(leaf => leaf.key === 'indicator.above')
    const expressionLeaves = entryLeaves.filter(leaf => leaf.key === 'condition.expression')

    expect(indicatorLeaves.filter(leaf => leaf.params?.period === 50 && leaf.params?.['reference.period'] === 50)).toHaveLength(1)
    expect(expressionLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.objectContaining({
          expression: expect.objectContaining({
            kind: 'predicate',
            op: 'GT',
            left: expect.objectContaining({ kind: 'indicator', name: 'ema', params: expect.objectContaining({ period: 20 }) }),
            right: expect.objectContaining({ kind: 'indicator', name: 'ema', params: expect.objectContaining({ period: 50 }) }),
          }),
        }),
      }),
    ]))
  })

  it('compiles funding-rate percent thresholds into runtime ratio values', () => {
    const compiled = buildCompiledIrFromPrompt('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建资金费率反转策略。规则：资金费率大于 0.01% 且 RSI14 高于 70 时开空；RSI14 低于 40 时平空；风控：仓位 10%，2 倍杠杆，亏损 1.5% 止损。')
    const fundingPredicate = compiled.ir.signalCatalog.predicates.find(predicate => predicate.kind === 'fundingRateCondition')

    expect(fundingPredicate?.params).toEqual(expect.objectContaining({ value: 0.0001 }))
  })

  it('keeps trend-filtered grid as normal entry/exit rules without implicit grid program', () => {
    const state = buildSemanticStateFromPrompt('基于 OKX 模拟盘 ETH-USDT 现货 15m，创建趋势过滤网格策略。规则：价格在震荡区间内且 1h 价格高于 MA50 时才买入；每 6 根 K 线最多开仓一次；持仓 4 根 K 线后平多；价格回到区间上沿卖出；风控：单次仓位 70%，亏损 1.5% 止损，止盈 0.12%。')
    const keys = semanticAtomKeys(state)

    expect([...keys]).toEqual(expect.arrayContaining([
      'pattern.range',
      'indicator.above',
      'action.open_long',
      'action.close_long',
      'risk.cooldown',
      'risk.time_stop_bars',
    ]))
    expect(keys.has('program.dynamic_grid')).toBe(false)
    expect(keys.has('grid.range_rebalance')).toBe(false)
  })
})
