import { listRuleEffects } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

function findDcaParams(text: string): Record<string, unknown> | undefined {
  const dispatcher = new GenericSeedDispatcher().dispatch(text)
  const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcher, text)
  const effects = (fallback?.rules ?? []).flatMap(rule => listRuleEffects(rule.effects))
  const dca = effects.find(effect => effect.kind === 'atom' && effect.key === 'position.dca_schedule')
  return dca?.kind === 'atom' ? dca.params : undefined
}

describe('GenericSeedDispatcher DCA sizing regressions', () => {
  it('keeps explicit quote amount separate from drawdown trigger percent', () => {
    const params = findDcaParams('OKX 合约 BTCUSDT 1h，价格每回撤 3% 补仓，最多 3 次，每次 100 USDT，总预算最多 1000 USDT。')

    expect(params).toEqual(expect.objectContaining({
      triggerMode: 'price_interval',
      priceIntervalPct: expect.any(Number),
      maxCount: 3,
      perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
      capitalCap: { kind: 'quote', value: 1000, asset: 'USDT' },
    }))
    expect(JSON.stringify(params)).not.toContain('"value":3,"asset":"USDT"')
  })

  it('keeps explicit ratio sizing separate from price interval percent', () => {
    const params = findDcaParams('OKX 合约 BTCUSDT 1h，价格每跌 5% 补仓一次，最多补三次，每次使用 10% 仓位。')

    expect(params).toEqual(expect.objectContaining({
      triggerMode: 'price_interval',
      priceIntervalPct: expect.any(Number),
      maxCount: 3,
      perOrderSizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
    }))
    expect(JSON.stringify(params)).not.toContain('"value":5,"asset":"USDT"')
  })
})
