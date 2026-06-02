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

function expectOnlyRole(patch: DispatchPatch, key: string, role: EffectRole): void {
  expect(collectEffectKeys(patch, role)).toContain(key)
  expect(collectConditionKeys(patch)).not.toContain(key)
  for (const candidate of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const) {
    if (candidate === role) continue
    expect(collectEffectKeys(patch, candidate)).not.toContain(key)
  }
}

function expectNoRolePollution(patch: DispatchPatch, key: string): void {
  expect(collectConditionKeys(patch)).not.toContain(key)
  for (const candidate of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const) {
    expect(collectEffectKeys(patch, candidate)).not.toContain(key)
  }
}

function expectTypedRules(patch: DispatchPatch): void {
  expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
  for (const rule of patch.rules ?? []) {
    expect(isRuleEffectsByRole(rule.effects)).toBe(true)
  }
}

describe('Stage 4 PR4 action and program dialogue entrance', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each([
    ['action.open_long', 'EMA20 上穿 EMA50 开多，单笔 10% 仓位。'],
    ['action.open_short', 'EMA20 下穿 EMA50 开空，单笔 10% 仓位。'],
    ['action.close_long', 'RSI 高于 70 平多。'],
    ['action.close_short', 'RSI 低于 30 平空。'],
    ['action.add_position', 'EMA20 上穿开多，盈利 2% 后加仓 10%。'],
    ['action.reverse_position', 'EMA20 下穿 EMA50 时从多头反手做空。'],
  ])('attempt-1 routes %s utterance into rules[].effects.actions only', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expectOnlyRole(patch, expectedKey, 'actions')
  })

  it.each([
    ['program.fixed_grid_gated', 'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。'],
  ])('attempt-1 routes %s utterance into rules[].effects.programs only when recognized', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expectOnlyRole(patch, expectedKey, 'programs')
  })

  it.each([
    ['program.twap', '把 1000 USDT 分 10 次在 1 小时内 TWAP 买入 BTC。'],
    ['program.dca', 'BTC 每下跌 3% 做一次 DCA program，最多 3 次。'],
    ['program.martingale', '亏损后按 2 倍 martingale 加码，最多 3 层。'],
    ['program.rebalance', 'BTC 和 ETH 每天再平衡到 50% 50%。'],
    ['program.iceberg', '用 iceberg 订单把 10 BTC 拆成每次 0.5 BTC 卖出。'],
  ])('attempt-1 routes %s utterance into rules[].effects.programs only', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expectOnlyRole(patch, expectedKey, 'programs')
  })

  it('does not duplicate entry or exit rules when action and position appear together', () => {
    const patch = dispatcher.dispatch('EMA20 上穿 EMA50 开多，盈利 2% 后加仓 10%，单笔 10% 仓位。')

    expectTypedRules(patch)
    expect((patch.rules ?? []).filter(rule => rule.phase === 'entry')).toHaveLength(1)
    expect(collectEffectKeys(patch, 'actions').filter(key => key === 'action.open_long')).toHaveLength(1)
    expect(collectEffectKeys(patch, 'actions').filter(key => key === 'action.add_position')).toHaveLength(1)
  })
})
