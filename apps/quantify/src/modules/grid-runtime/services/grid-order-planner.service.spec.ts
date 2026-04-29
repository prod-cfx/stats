import { GridOrderPlannerService } from './grid-order-planner.service'

const baseConfig = {
  lowerPrice: '90',
  upperPrice: '110',
  gridCount: 5,
  perOrderQuote: '100',
  quoteAsset: 'USDT',
  baseAsset: 'BTC',
  orderType: 'limit',
  timeInForce: 'gtc',
} as const

describe('GridOrderPlannerService', () => {
  const service = new GridOrderPlannerService()

  it('plans spot initial buy orders below current price', () => {
    const plan = service.planInitialOrders({
      config: { ...baseConfig, mode: 'spot' },
      currentPrice: '100',
    })

    expect(plan.levels.map(level => level.price)).toEqual(['90', '95', '100', '105', '110'])
    expect(plan.orders).toEqual([
      expect.objectContaining({ levelIndex: 0, side: 'buy', role: 'spot_buy', orderType: 'limit', timeInForce: 'gtc', price: '90' }),
      expect.objectContaining({ levelIndex: 1, side: 'buy', role: 'spot_buy', orderType: 'limit', timeInForce: 'gtc', price: '95' }),
    ])
  })

  it('plans perp long buys below current price and sells above current price', () => {
    const plan = service.planInitialOrders({
      config: { ...baseConfig, mode: 'perp_long' },
      currentPrice: '100',
    })

    expect(plan.orders).toEqual([
      expect.objectContaining({ levelIndex: 0, side: 'buy', role: 'open_long', price: '90' }),
      expect.objectContaining({ levelIndex: 1, side: 'buy', role: 'open_long', price: '95' }),
      expect.objectContaining({ levelIndex: 3, side: 'sell', role: 'close_long', price: '105' }),
      expect.objectContaining({ levelIndex: 4, side: 'sell', role: 'close_long', price: '110' }),
    ])
  })

  it('plans perp short sells above current price and buys below current price', () => {
    const plan = service.planInitialOrders({
      config: { ...baseConfig, mode: 'perp_short' },
      currentPrice: '100',
    })

    expect(plan.orders).toEqual([
      expect.objectContaining({ levelIndex: 0, side: 'buy', role: 'close_short', price: '90' }),
      expect.objectContaining({ levelIndex: 1, side: 'buy', role: 'close_short', price: '95' }),
      expect.objectContaining({ levelIndex: 3, side: 'sell', role: 'open_short', price: '105' }),
      expect.objectContaining({ levelIndex: 4, side: 'sell', role: 'open_short', price: '110' }),
    ])
  })

  it('plans neutral dual ladders on both sides of current price', () => {
    const plan = service.planInitialOrders({
      config: { ...baseConfig, mode: 'perp_neutral' },
      currentPrice: '100',
    })

    expect(plan.orders).toEqual([
      expect.objectContaining({ levelIndex: 0, side: 'buy', role: 'open_long', price: '90' }),
      expect.objectContaining({ levelIndex: 0, side: 'buy', role: 'close_short', price: '90' }),
      expect.objectContaining({ levelIndex: 1, side: 'buy', role: 'open_long', price: '95' }),
      expect.objectContaining({ levelIndex: 1, side: 'buy', role: 'close_short', price: '95' }),
      expect.objectContaining({ levelIndex: 3, side: 'sell', role: 'close_long', price: '105' }),
      expect.objectContaining({ levelIndex: 3, side: 'sell', role: 'open_short', price: '105' }),
      expect.objectContaining({ levelIndex: 4, side: 'sell', role: 'close_long', price: '110' }),
      expect.objectContaining({ levelIndex: 4, side: 'sell', role: 'open_short', price: '110' }),
    ])
  })

  it('derives each price from lower plus step times index without floating accumulation', () => {
    const plan = service.planInitialOrders({
      config: {
        ...baseConfig,
        mode: 'spot',
        lowerPrice: '0.1',
        upperPrice: '0.3',
        gridCount: 3,
        perOrderQuote: '1',
      },
      currentPrice: '0.25',
    })

    expect(plan.levels.map(level => level.price)).toEqual(['0.1', '0.2', '0.3'])
    expect(plan.orders.map(order => order.quantity)).toEqual(['10', '5'])
  })

  it('rejects invalid price bounds and grid counts', () => {
    expect(() => service.planInitialOrders({
      config: { ...baseConfig, mode: 'spot', upperPrice: '90' },
      currentPrice: '100',
    })).toThrow('grid_runtime_invalid_price_bounds')

    expect(() => service.planInitialOrders({
      config: { ...baseConfig, mode: 'spot', gridCount: 1 },
      currentPrice: '100',
    })).toThrow('grid_runtime_invalid_grid_count')
  })
})
