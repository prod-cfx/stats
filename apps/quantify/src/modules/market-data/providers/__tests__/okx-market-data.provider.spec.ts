import { of } from 'rxjs'
import { OkxMarketDataProvider } from '../okx-market-data.provider'

describe('okx market data provider', () => {
  const httpMock = {
    get: jest.fn(),
  }

  const configServiceMock = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  }

  let provider: OkxMarketDataProvider

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new OkxMarketDataProvider(httpMock as never, configServiceMock as never)
  })

  it('routes perp kline to swap instrument id', async () => {
    httpMock.get.mockReturnValue(of({
      data: {
        code: '0',
        msg: '',
        data: [['1710000000000', '1', '2', '0.5', '1.5', '10', '', '20', '1']],
      },
    }))

    const bars = await provider.fetchHistoricalBars({ symbol: 'BTCUSDT:PERP', timeframe: '1m', limit: 10 })

    const [, requestConfig] = httpMock.get.mock.calls[0] as [string, { params: { instId: string; bar: string } }]
    expect(requestConfig.params.instId).toBe('BTC-USDT-SWAP')
    expect(requestConfig.params.bar).toBe('1m')
    expect(bars[0]?.symbol).toBe('BTCUSDT:PERP')
  })

  it('uses before for forward gapfill start cursor on OKX history candles', async () => {
    httpMock.get.mockReturnValue(of({
      data: {
        code: '0',
        msg: '',
        data: [['1710000000000', '1', '2', '0.5', '1.5', '10', '', '20', '1']],
      },
    }))

    await provider.fetchHistoricalBars({
      symbol: 'BTCUSDT:SPOT',
      timeframe: '1m',
      start: new Date('2026-04-01T04:45:00.000Z'),
      limit: 10,
    })

    const [, requestConfig] = httpMock.get.mock.calls[0] as [string, { params: Record<string, string> }]
    expect(requestConfig.params.before).toBe(String(Date.parse('2026-04-01T04:45:00.000Z')))
    expect(requestConfig.params.after).toBeUndefined()
  })

  it('dedupes requested symbols when filtering instruments', async () => {
    httpMock.get.mockReturnValue(of({
      data: {
        code: '0',
        msg: '',
        data: [
          { instId: 'BTC-USDT', baseCcy: 'BTC', quoteCcy: 'USDT', state: 'live' },
          { instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT', state: 'live' },
        ],
      },
    }))

    const symbols = await provider.fetchSymbols(['BTCUSDT:SPOT', 'BTCUSDT:PERP', 'BTCUSDT'])
    const btcRows = symbols.filter(item => item.symbol === 'BTCUSDT')
    const ethRows = symbols.filter(item => item.symbol === 'ETHUSDT')

    expect(btcRows).toHaveLength(2)
    expect(ethRows).toHaveLength(0)
  })
})
