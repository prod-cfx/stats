import { TheoreticalExecutionModel } from './theoretical-execution.model'

describe('theoreticalExecutionModel', () => {
  it('should apply upward slippage for BUY', () => {
    const model = new TheoreticalExecutionModel()
    const fill = model.fill({ symbol: 'BTCUSDT', timeframe: '5m', openTime: 1, closeTime: 2, open: 100, high: 110, low: 90, close: 110, volume: 1 }, 'BUY', 1, { slippageBps: 10, feeBps: 5, priceSource: 'mid' })
    expect(fill.price).toBeCloseTo(105 * 1.001)
  })

  it('should calculate fee from notional', () => {
    const model = new TheoreticalExecutionModel()
    const fill = model.fill({ symbol: 'BTCUSDT', timeframe: '5m', openTime: 1, closeTime: 2, open: 100, high: 100, low: 100, close: 100, volume: 1 }, 'SELL', 2, { slippageBps: 0, feeBps: 10, priceSource: 'mid' })
    expect(fill.fee).toBeCloseTo(200 * 0.001)
  })

  it('should support priceSource=open', () => {
    const model = new TheoreticalExecutionModel()
    const fill = model.fill(
      { symbol: 'BTCUSDT', timeframe: '5m', openTime: 1, closeTime: 2, open: 120, high: 130, low: 90, close: 100, volume: 1 },
      'BUY',
      1,
      { slippageBps: 0, feeBps: 0, priceSource: 'open' },
    )
    expect(fill.price).toBeCloseTo(120)
  })

  it('should support priceSource=close', () => {
    const model = new TheoreticalExecutionModel()
    const fill = model.fill(
      { symbol: 'BTCUSDT', timeframe: '5m', openTime: 1, closeTime: 2, open: 120, high: 130, low: 90, close: 100, volume: 1 },
      'SELL',
      1,
      { slippageBps: 0, feeBps: 0, priceSource: 'close' },
    )
    expect(fill.price).toBeCloseTo(100)
  })
})
