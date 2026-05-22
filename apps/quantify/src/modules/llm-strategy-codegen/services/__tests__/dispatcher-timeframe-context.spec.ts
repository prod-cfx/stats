import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

function collectRuleLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
  return (patch.rules ?? []).flatMap(rule =>
    collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, phase: rule.phase })),
  )
}

describe('GenericSeedDispatcher context timeframe extraction', () => {
  const dispatcher = new GenericSeedDispatcher()

  it('extracts compact Chinese hour timeframe from strategy text', () => {
    const patch = dispatcher.dispatch('BTC 1小时 MA50 在 MA200 上方时买入')

    expect(patch.contextSlots?.timeframe).toBe('1h')
  })

  it('fans out multiple clause timeframes onto groupable indicator compare atoms', () => {
    const patch = dispatcher.dispatch('15min 1h 4h的价格都在ema20的上方买入')
    const timeframes = collectRuleLeaves(patch)
      .filter(trigger => trigger.key === 'indicator.above')
      .map(trigger => trigger.params?.timeframe)
      .sort()

    expect(patch.contextSlots?.timeframe).toBe('15m')
    expect(timeframes).toEqual(['15m', '1h', '4h'])
  })
})
