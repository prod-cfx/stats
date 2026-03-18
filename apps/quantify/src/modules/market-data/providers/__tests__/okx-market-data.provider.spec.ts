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
})
