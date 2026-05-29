import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'

function collectConditionKeys(patch: ReturnType<GenericSeedDispatcher['dispatch']>): string[] {
  return (patch.rules ?? []).flatMap(rule => collectAtomLeaves(rule.condition).map(leaf => leaf.key))
}

describe('Stage 4 PR2 predicate dialogue entrance', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each([
    ['indicator.slope', 'EMA20 斜率向上时开多，单笔 10%。'],
    ['pattern.pullback', '突破后回踩不破再买，单笔 10%。'],
    ['pattern.range', '价格维持在震荡区间内时开多，单笔 10%。'],
    ['volume.confirmation', '突破后成交量确认再买入，单笔 10%。'],
    ['time.cooldown_window', '止损后冷却 30 分钟再允许开多，单笔 10%。'],
    ['external.signal', '收到 webhook 外部信号时开多，单笔 10%。'],
  ])('attempt-1 routes %s utterance into semanticPatch.rules[].condition', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expect(collectConditionKeys(patch)).toContain(expectedKey)
    expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
    if (expectedKey !== 'time.cooldown_window' && expectedKey !== 'external.signal') {
      expect(collectConditionKeys(patch).filter(key => key === expectedKey)).toHaveLength(1)
    }
  })

  it.each([
    ['orderbook.imbalance', '盘口买卖失衡偏多时开多，单笔 10%。'],
    ['fundingRate.condition', 'funding rate positive 时开多，单笔 10%。'],
    ['openInterest.condition', '持仓量连续上升时开多，单笔 10%。'],
    ['liquidation.condition', '出现多头清算瀑布后开空，单笔 10%。'],
  ])('attempt-1 keeps market-data shell %s in semanticPatch.rules[].condition', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expect(collectConditionKeys(patch)).toContain(expectedKey)
    expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
  })
})
