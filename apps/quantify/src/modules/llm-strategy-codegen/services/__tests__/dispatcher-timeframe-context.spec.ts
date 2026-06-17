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

  it.each([
    ['binance', '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约'],
    ['okx', '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再okx交易所 btcusdt永续合约'],
  ])('keeps multi-timeframe EMA entry in complete %s strategy text', (_, text) => {
    const patch = dispatcher.dispatch(text)
    const entryTimeframes = collectRuleLeaves(patch)
      .filter(trigger => trigger.phase === 'entry' && trigger.key === 'indicator.above')
      .map(trigger => trigger.params?.timeframe)
      .sort()
    const exitTimeframes = collectRuleLeaves(patch)
      .filter(trigger => trigger.phase === 'exit' && trigger.key === 'indicator.below')
      .map(trigger => trigger.params?.timeframe)
      .sort()

    expect(entryTimeframes).toEqual(['15m', '1h', '4h'])
    expect(exitTimeframes).toEqual(['15m'])
  })
})
