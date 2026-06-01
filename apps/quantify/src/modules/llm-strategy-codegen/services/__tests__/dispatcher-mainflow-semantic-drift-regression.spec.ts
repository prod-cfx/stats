import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

function baseState(overrides: Partial<SemanticState>): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-31T00:00:00.000Z',
    ...overrides,
  }
}

function allRuleLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
  return (patch.rules ?? []).flatMap(rule => [
    ...collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, ruleId: rule.id, rulePhase: rule.phase })),
    ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect).map(leaf => ({ ...leaf, ruleId: rule.id, rulePhase: rule.phase }))),
  ])
}

function effectLeaves(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]) {
  return listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
}

describe('GenericSeedDispatcher mainflow semantic drift regressions', () => {
  const dispatcher = new GenericSeedDispatcher()
  const projection = new SemanticStateProjectionService()

  it('does not add EMA20 below when user only asked price below EMA50 plus EMA20 crossunder EMA50', () => {
    const patch = dispatcher.dispatch('OKX 合约 ETHUSDT 15m，价格低于 EMA50 且 EMA20 下穿 EMA50 时开空，单笔 10%，亏损 3% 止损。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const conditionLeaves = entryRule ? collectAtomLeaves(entryRule.condition) : []
    const belowPeriods = conditionLeaves
      .filter(leaf => leaf.key === 'indicator.below')
      .map(leaf => leaf.params?.['reference.period'])

    expect(conditionLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_under', params: expect.objectContaining({ fastPeriod: 20, slowPeriod: 50 }) }),
      expect.objectContaining({ key: 'indicator.below', params: expect.objectContaining({ 'reference.period': 50 }) }),
    ]))
    expect(belowPeriods).toEqual([50])
  })

  it('keeps portfolio risk gates out of entry effects and dedupes drawdown gate', () => {
    const patch = dispatcher.dispatch('OKX 合约 BTCUSDT 15m，EMA20 上穿 EMA50 开多，最大回撤超过 8% 停止开仓，最大敞口不超过账户 30%。')
    const leaves = allRuleLeaves(patch)
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const gateRules = patch.rules?.filter(rule => rule.phase === 'gate') ?? []

    expect(entryRule).toBeDefined()
    expect(effectLeaves(entryRule!).map(leaf => leaf.key)).not.toContain('risk.max_drawdown_pct')
    expect(effectLeaves(entryRule!).filter(leaf => leaf.key === 'position.max_exposure_pct')).toHaveLength(1)

    expect(gateRules).toHaveLength(1)
    expect(gateRules.flatMap(rule => effectLeaves(rule)).filter(leaf => leaf.key === 'portfolioRisk.drawdown_block')).toHaveLength(1)
    expect(gateRules.flatMap(rule => effectLeaves(rule)).filter(leaf => leaf.key === 'portfolioRisk.symbol_exposure_cap')).toHaveLength(1)
    expect(gateRules.map(rule => collectAtomLeaves(rule.condition).map(leaf => leaf.key))).not.toContainEqual(['indicator.cross_over'])
  })

  it('renders portfolio risk bundle without duplicate entry/gate semantics', () => {
    const patch = dispatcher.dispatch('OKX 合约 BTCUSDT 15m，EMA20 上穿 EMA50 开多，最大回撤超过 8% 停止开仓，最大敞口不超过账户 30%。')
    const view = projection.buildConversationView(baseState({ rules: patch.rules ?? [] }))

    expect(view.summary).toContain('入场：EMA20 上穿 EMA50')
    expect(view.summary).toContain('前置：账户最大回撤超过 8% 时阻止开新仓')
    expect(view.summary).toContain('单标的敞口超过 30% 时阻止开新仓')
    expect(view.summary).not.toContain('入场：EMA20 上穿 EMA50 → 开多，最大敞口不超过 30%')
    expect(view.summary).not.toContain('最大回撤超过 8% 时限制交易')
    expect((view.summary.match(/账户最大回撤超过 8% 时阻止开新仓/gu) ?? [])).toHaveLength(1)
    expect((view.summary.match(/敞口/gu) ?? [])).toHaveLength(1)
  })

  it('keeps buy-before-sell percent-change strategy as entry then exit', () => {
    const patch = dispatcher.dispatch('在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%')
    const view = projection.buildConversationView(baseState({ rules: patch.rules ?? [] }))

    expect(view.summary).toContain('入场：价格百分比变化（下跌，1%，3m） → 开多')
    expect(view.summary).toContain('出场：价格百分比变化（上涨，2%，15m） → 平多')
    expect(view.summary).not.toContain('出场：价格百分比变化（下跌，1%，3m） → 平多')
    expect(view.summary).not.toContain('价格百分比变化（上涨，2%，15m） 同时 止损')
  })

  it('keeps MA20 breakout buy as entry when ATR stop and take-profit appear later', () => {
    const patch = dispatcher.dispatch('ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。')
    const view = projection.buildConversationView(baseState({ rules: patch.rules ?? [] }))

    expect(view.summary).toContain('入场：价格在 MA20 上方 → 开多')
    expect(view.summary).not.toContain('出场：价格在 MA20 上方 → 平多')
    expect(view.summary).toContain('2 倍 ATR 止损')
    expect(view.summary).toContain('3 倍 ATR 止盈')
  })

  it('keeps bollinger lower long, middle exit, and upper short as separate rules', () => {
    const patch = dispatcher.dispatch('ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空')
    const view = projection.buildConversationView(baseState({ rules: patch.rules ?? [] }))

    expect(view.summary).toContain('入场：BOLL（20, 2）下轨触及 → 开多')
    expect(view.summary).toContain('出场：BOLL（20, 2）中轨触及 → 平多')
    expect(view.summary).toContain('入场：BOLL（20, 2）上轨触及 → 开空')
    expect(view.summary).not.toContain('下轨触及 同时 BOLL（20, 2）上轨触及')
    expect(view.summary).not.toContain('开多，开空')
    expect(view.summary).not.toContain('止损：价格相对持仓收益率下跌0%')
  })

  it('keeps short pyramiding profit trigger out of initial entry condition', () => {
    const patch = dispatcher.dispatch('OKX 合约 ETHUSDT 15m，EMA20 下穿 EMA50 开空，盈利 2% 后加仓 10%，最多加仓 2 次，单笔使用 10% 仓位。价格重新站上 EMA20 时平空。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(entryRule).toBeDefined()
    expect(exitRule).toBeDefined()

    const entryConditionKeys = collectAtomLeaves(entryRule!.condition).map(leaf => leaf.key)
    const entryEffectLeaves = effectLeaves(entryRule!)
    const addPosition = entryEffectLeaves.find(leaf => leaf.key === 'action.add_position')
    const pyramidingLimit = entryEffectLeaves.find(leaf => leaf.key === 'position.pyramiding_limit')

    expect(entryConditionKeys).toEqual(['indicator.cross_under'])
    expect(entryEffectLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_short', sideScope: 'short' }),
      expect.objectContaining({ key: 'action.add_position', sideScope: 'short' }),
      expect.objectContaining({ key: 'position.pyramiding_limit' }),
    ]))
    expect(addPosition?.params).toEqual(expect.objectContaining({
      addMode: 'profit_pct',
      profitThreshold: 2,
      sizing: expect.objectContaining({ kind: 'ratio', value: 0.1 }),
    }))
    expect(pyramidingLimit?.params).toEqual(expect.objectContaining({
      maxLayers: 2,
      profitThreshold: 2,
      layerSizing: 10,
    }))
    expect(effectLeaves(exitRule!).map(leaf => leaf.key)).toContain('action.close_short')
  })
})
