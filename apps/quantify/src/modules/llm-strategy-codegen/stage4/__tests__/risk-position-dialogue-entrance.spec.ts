import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'

type DispatchPatch = ReturnType<GenericSeedDispatcher['dispatch']>

function collectEffectKeys(patch: DispatchPatch, role: 'risks' | 'positions'): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    if (!isRuleEffectsByRole(rule.effects)) return []
    return rule.effects[role].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
  })
}

function countRulesWithEffect(patch: DispatchPatch, key: string): number {
  return (patch.rules ?? []).filter((rule) => {
    if (!isRuleEffectsByRole(rule.effects)) return false
    return [...rule.effects.risks, ...rule.effects.positions]
      .some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === key))
  }).length
}

describe('Stage 4 PR3 risk and position dialogue entrance', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each([
    ['risk.stop_loss_pct', 'EMA20 上穿 EMA50 开多，亏损 3% 止损，单笔 10% 仓位。'],
    ['risk.trailing_stop_pct', 'EMA20 上穿 EMA50 开多后用 3% 移动止损，单笔 10% 仓位。'],
    ['risk.partial_take_profit', 'RSI 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。'],
    ['risk.max_drawdown_pct', 'EMA20 上穿开多，最大回撤超过 8% 停止开仓，单笔 10% 仓位。'],
    ['risk.cooldown', 'EMA20 上穿开多，止损后冷却 5 根 K 线再开仓，单笔 10% 仓位。'],
    ['risk.max_loss_per_trade', 'EMA20 上穿开多，单笔最多亏 2%，仓位 10%。'],
  ])('attempt-1 routes %s utterance into rules[].effects.risks', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expect(collectEffectKeys(patch, 'risks')).toContain(expectedKey)
    expect(countRulesWithEffect(patch, expectedKey)).toBe(1)
  })

  it.each([
    ['position.sizing', 'EMA20 上穿 EMA50 开多，单笔使用 10% 仓位。'],
    ['position.pyramiding_limit', 'EMA20 上穿开多，盈利后最多加仓 2 次。'],
    ['position.dca_schedule', 'BTC 回撤 3% 补仓，最多 3 次，每次 100 USDT。'],
    ['position.budget_cap', 'BTC 回撤 3% 补仓，总预算最多 1000 USDT。'],
    ['position.leverage', 'EMA20 上穿开多，使用 2 倍杠杆。'],
    ['position.max_exposure_pct', 'EMA20 上穿开多，最大敞口不超过账户 30%。'],
  ])('attempt-1 routes %s utterance into rules[].effects.positions', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expect(collectEffectKeys(patch, 'positions')).toContain(expectedKey)
    expect(countRulesWithEffect(patch, expectedKey)).toBe(1)
  })

  it('does not create duplicate risk or position rules when entry, risk, and sizing appear together', () => {
    const patch = dispatcher.dispatch('EMA20 上穿 EMA50 开多，亏损 3% 止损，单笔 10% 仓位。')

    expect(collectEffectKeys(patch, 'risks').filter(key => key === 'risk.stop_loss_pct')).toHaveLength(1)
    expect(collectEffectKeys(patch, 'positions').filter(key => key === 'position.sizing')).toHaveLength(1)
    expect((patch.rules ?? []).filter(rule => rule.phase === 'entry')).toHaveLength(1)
  })
})
