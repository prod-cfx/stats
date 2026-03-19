import { AuthError, ExchangeError } from '../core/errors'
import { BinanceClient } from './binance-client'

class TestableBinanceClient extends BinanceClient {
  mapErrorForTest(status: number, data: unknown): ExchangeError {
    return this.mapError(status, data)
  }
}

class StubBinanceClient extends BinanceClient {
  constructor(
    marketType: 'spot' | 'perp',
    private readonly response: unknown,
  ) {
    super(marketType, {
      apiKey: 'test-key',
      secret: 'test-secret',
      isTestnet: true,
    })
  }

  protected override async request<TResponse>(): Promise<TResponse> {
    return this.response as TResponse
  }
}

describe('binanceClient mapError', () => {
  const client = new TestableBinanceClient('spot', {
    apiKey: 'test-key',
    secret: 'test-secret',
  })

  it('maps -2011 unknown order to a generic exchange error instead of auth error', () => {
    const error = client.mapErrorForTest(400, {
      code: -2011,
      msg: 'Unknown order sent.',
    })

    expect(error).toBeInstanceOf(ExchangeError)
    expect(error).not.toBeInstanceOf(AuthError)
    expect(error.code).toBe('-2011')
    expect(error.message).toBe('Unknown order sent.')
  })

  it('maps disabled API key messages to auth error', () => {
    const error = client.mapErrorForTest(400, {
      code: -1099,
      msg: 'API key is disabled',
    })

    expect(error).toBeInstanceOf(AuthError)
  })
})

describe('binanceClient createOrder', () => {
  it('derives market order price from cummulativeQuoteQty for spot responses with zero price', async () => {
    const client = new StubBinanceClient('spot', {
      orderId: 1,
      clientOrderId: 'spot-market',
      status: 'FILLED',
      executedQty: '0.004',
      origQty: '0.004',
      price: '0',
      side: 'BUY',
      type: 'MARKET',
      symbol: 'BTCUSDT',
      cummulativeQuoteQty: '12',
      transactTime: 1710000000000,
    })

    const order = await client.createOrder({
      symbol: 'BTC/USDT',
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      amount: 0.004,
    })

    expect(order.price).toBeCloseTo(3000, 8)
    expect(order.filled).toBeCloseTo(0.004, 8)
  })

  it('prefers avgPrice for perp responses with zero price', async () => {
    const client = new StubBinanceClient('perp', {
      orderId: 2,
      clientOrderId: 'perp-market',
      status: 'FILLED',
      executedQty: '0.005',
      origQty: '0.005',
      price: '0',
      avgPrice: '2450.5',
      side: 'BUY',
      type: 'MARKET',
      symbol: 'ETHUSDT',
      updateTime: 1710000000001,
    })

    const order = await client.createOrder({
      symbol: 'ETH/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'market',
      amount: 0.005,
    })

    expect(order.price).toBeCloseTo(2450.5, 8)
    expect(order.filled).toBeCloseTo(0.005, 8)
  })
})
