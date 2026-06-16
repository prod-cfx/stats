import { makeCompletedTradeFillId, makeCompletedTradeKey } from './completed-trade-key'

describe('makeCompletedTradeKey', () => {
  it('uses trade id as fill identity instead of transaction hash and time', () => {
    expect(makeCompletedTradeFillId({ hash: '0xabc', tid: 101, time: 1765800000000 })).toBe('101')
    expect(makeCompletedTradeFillId({ hash: '0xabc', tid: 101, time: 1765800000000 })).not.toBe(
      makeCompletedTradeFillId({ hash: '0xabc', tid: 102, time: 1765800000000 }),
    )
  })

  it('uses stable trade fields instead of row position', () => {
    const trade = {
      asset: 'BTC',
      exitPrice: '$ 102000.0000',
      fee: '0.0100 USDC',
      fillId: 'fill-a:1765800000000',
      fillTime: 1765800000000,
      side: 'Long',
      size: '0.2500 BTC',
    }

    expect(makeCompletedTradeKey(trade)).toBe(
      'fill-a:1765800000000:1765800000000:BTC:Long:0.2500 BTC:$ 102000.0000:0.0100 USDC',
    )
    expect(makeCompletedTradeKey(trade)).toBe(makeCompletedTradeKey({ ...trade }))
  })

  it('keeps same-time opposite-side fills distinct', () => {
    const base = {
      asset: 'ETH',
      exitPrice: '$ 3500.0000',
      fee: '0.0020 USDC',
      fillId: 'fill-a:1765800000000',
      fillTime: 1765800000000,
      size: '1.0000 ETH',
    }

    expect(makeCompletedTradeKey({ ...base, side: 'Long' })).not.toBe(
      makeCompletedTradeKey({ ...base, side: 'Short' }),
    )
  })

  it('keeps same-time fills with identical display values distinct', () => {
    const base = {
      asset: 'BTC',
      exitPrice: '$ 102000.0000',
      fee: '0.0100 USDC',
      fillTime: 1765800000000,
      side: 'Long',
      size: '0.2500 BTC',
    }

    expect(makeCompletedTradeKey({ ...base, fillId: 'fill-a:1765800000000' })).not.toBe(
      makeCompletedTradeKey({ ...base, fillId: 'fill-b:1765800000000' }),
    )
  })
})
