import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

describe('GenericSeedDispatcher context timeframe extraction', () => {
  const dispatcher = new GenericSeedDispatcher()

  it('extracts compact Chinese hour timeframe from strategy text', () => {
    const patch = dispatcher.dispatch('BTC 1小时 MA50 在 MA200 上方时买入')

    expect(patch.contextSlots?.timeframe).toBe('1h')
  })
})
