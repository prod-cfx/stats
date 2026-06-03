import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'

type DispatchPatch = ReturnType<GenericSeedDispatcher['dispatch']>
type EffectRole = 'actions' | 'risks' | 'positions' | 'orchestration' | 'programs'

function collectEffectKeys(patch: DispatchPatch, role: EffectRole): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    if (!isRuleEffectsByRole(rule.effects)) return []
    return rule.effects[role].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
  })
}

function collectConditionKeys(patch: DispatchPatch): string[] {
  return (patch.rules ?? []).flatMap(rule => collectAtomLeaves(rule.condition).map(leaf => leaf.key))
}

function expectTypedRules(patch: DispatchPatch): void {
  expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
  for (const rule of patch.rules ?? []) expect(isRuleEffectsByRole(rule.effects)).toBe(true)
}

describe('Stage 4 PR5 orchestration and data-source dialogue entrance', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each([
    ['scope.timeframe', 'BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场。'],
    ['scope.symbol', 'BTCUSDT 和 ETHUSDT 都按 EMA20 上穿 EMA50 开多。'],
    ['portfolioRisk.drawdown_block', 'EMA20 上穿开多，组合最大回撤超过 8% 停止开仓。'],
    ['gate.regime', '价格高于 EMA50 才允许做多，EMA20 上穿开多。'],
  ])('attempt-1 routes %s into orchestration effects without action/program pollution', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expect(collectEffectKeys(patch, 'orchestration')).toContain(expectedKey)
    expect(collectEffectKeys(patch, 'actions')).not.toContain(expectedKey)
    expect(collectEffectKeys(patch, 'programs')).not.toContain(expectedKey)
  })

  it.each([
    ['orderbook.imbalance', 'orderbook imbalance 大于 60% 才开多。'],
    ['fundingRate.condition', '资金费率为正并且 EMA20 上穿才开多。'],
    ['openInterest.condition', '未平仓量增加时确认突破。'],
    ['liquidation.condition', '出现多头清算瀑布后只做空。'],
    ['external.signal', '收到 TradingView webhook buy 信号后开多。'],
  ])('routes market-data utterance %s to predicate or data-source binding without fake action/program role', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    const conditionKeys = collectConditionKeys(patch)
    const orchestrationKeys = collectEffectKeys(patch, 'orchestration')
    expect(conditionKeys.includes(expectedKey) || orchestrationKeys.includes('scope.dataSource')).toBe(true)
    expect(collectEffectKeys(patch, 'actions')).not.toContain(expectedKey)
    expect(collectEffectKeys(patch, 'programs')).not.toContain(expectedKey)
  })

  it('does not duplicate entry or exit rules for orchestration context', () => {
    const patch = dispatcher.dispatch('BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。')
    const phases = (patch.rules ?? []).map(rule => rule.phase)

    expect(phases.filter(phase => phase === 'entry')).toHaveLength(1)
    expect(phases.filter(phase => phase === 'exit')).toHaveLength(0)
  })

  it('keeps multi-timeframe gates out of regime orchestration fallback', () => {
    const patch = dispatcher.dispatch('BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。')
    const orchestrationKeys = collectEffectKeys(patch, 'orchestration')

    expect(orchestrationKeys).toContain('scope.timeframe')
    expect(orchestrationKeys).not.toContain('gate.regime')
  })

  it('does not treat execution timeframe as EMA cross period', () => {
    const patch = dispatcher.dispatch('BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。')
    const cross = (patch.rules ?? [])
      .flatMap(rule => collectAtomLeaves(rule.condition))
      .find(leaf => leaf.key === 'indicator.cross_over')

    expect(cross?.params).toMatchObject({ indicator: 'ema', fastPeriod: 20, slowPeriod: 50 })
    expect(cross?.params).not.toMatchObject({ fastPeriod: 15, slowPeriod: 20 })
  })

  it('keeps multi-symbol EMA20/EMA50 entry periods executable', () => {
    const patch = dispatcher.dispatch('OKX 永续 BTCUSDT 和 ETHUSDT 15m 都按 EMA20 上穿 EMA50 开多，单笔使用 10% 仓位，亏损 3% 止损。')
    const cross = (patch.rules ?? [])
      .flatMap(rule => collectAtomLeaves(rule.condition))
      .find(leaf => leaf.key === 'indicator.cross_over')

    expect(cross?.params).toMatchObject({ indicator: 'ema', fastPeriod: 20, slowPeriod: 50 })
    expect(cross?.params).not.toMatchObject({ fastPeriod: 15, slowPeriod: 20 })
  })
})
