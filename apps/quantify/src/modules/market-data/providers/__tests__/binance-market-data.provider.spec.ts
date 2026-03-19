import { of, throwError } from 'rxjs'
import { BinanceMarketDataProvider } from '../binance-market-data.provider'

describe('binanceMarketDataProvider', () => {
  const httpMock = {
    get: jest.fn(),
  }

  const configValues: Record<string, unknown> = {
    'marketData.restTimeoutMs': 1000,
    'marketData.wsReconnectDelayMs': 5,
  }

  const configServiceMock = {
    get: jest.fn((key: string, fallback?: unknown) => (key in configValues ? configValues[key] : fallback)),
  }

  let provider: BinanceMarketDataProvider

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new BinanceMarketDataProvider(httpMock as never, configServiceMock as never)
  })

  it('routes :PERP historical bars to fapi path and uses raw symbol', async () => {
    httpMock.get.mockReturnValue(of({ data: [[1710000000000, '1', '2', '0.5', '1.5', '10', 1710000059999, '15', 12, '0', '0', '0']] }))

    const bars = await provider.fetchHistoricalBars({ symbol: 'BTCUSDT:PERP', timeframe: '1m', limit: 10 })

    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/fapi/v1/klines'),
      expect.objectContaining({ params: expect.objectContaining({ symbol: 'BTCUSDT', interval: '1m' }) }),
    )
    expect(bars[0]?.symbol).toBe('BTCUSDT:PERP')
  })

  it('routes :SPOT historical bars to api v3 path', async () => {
    httpMock.get.mockReturnValue(of({ data: [[1710000000000, '1', '2', '0.5', '1.5', '10', 1710000059999, '15', 12, '0', '0', '0']] }))

    const bars = await provider.fetchHistoricalBars({ symbol: 'BTCUSDT:SPOT', timeframe: '1m', limit: 10 })

    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v3/klines'),
      expect.anything(),
    )
    expect(bars[0]?.symbol).toBe('BTCUSDT:SPOT')
  })

  it('maps futures exchangeInfo result to PERPETUAL instrument type', async () => {
    httpMock.get
      .mockReturnValueOnce(of({
        data: {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: 'TRADING',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              isMarginTradingAllowed: true,
              filters: [],
            },
          ],
        },
      }))
      .mockReturnValueOnce(of({
        data: {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: 'TRADING',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              contractType: 'PERPETUAL',
              filters: [],
            },
          ],
        },
      }))

    const symbols = await provider.fetchSymbols(['BTCUSDT:PERP'])

    expect(symbols.some(item => item.instrumentType === 'PERPETUAL')).toBe(true)
    expect(symbols.some(item => item.instrumentType === 'SPOT')).toBe(true)
  })

  it('dedupes raw symbols before requesting exchangeInfo', async () => {
    httpMock.get.mockImplementation((url: string) => {
      if (url.includes('/api/v3/exchangeInfo')) {
        return of({ data: { symbols: [] } })
      }
      return of({ data: { symbols: [] } })
    })

    await provider.fetchSymbols(['BTCUSDT:SPOT', 'BTCUSDT:PERP', 'BTCUSDT'])

    const [, spotConfig] = httpMock.get.mock.calls.find(([url]: [string]) => url.includes('/api/v3/exchangeInfo')) as [
      string,
      { params?: { symbols?: string } },
    ]
    expect(spotConfig.params?.symbols).toBe('["BTCUSDT"]')
  })

  it('falls back to full spot exchangeInfo when filtered request fails', async () => {
    httpMock.get.mockImplementation((url: string, config?: { params?: { symbols?: string } }) => {
      if (url.includes('/api/v3/exchangeInfo')) {
        if (config?.params?.symbols) {
          return throwError(() => new Error('400 bad request'))
        }
        return of({
          data: {
            symbols: [
              {
                symbol: 'SOLUSDT',
                status: 'TRADING',
                baseAsset: 'SOL',
                quoteAsset: 'USDT',
                isMarginTradingAllowed: true,
                filters: [],
              },
            ],
          },
        })
      }

      return of({
        data: {
          symbols: [
            {
              symbol: 'SOLUSDT',
              status: 'TRADING',
              baseAsset: 'SOL',
              quoteAsset: 'USDT',
              contractType: 'PERPETUAL',
              filters: [],
            },
          ],
        },
      })
    })

    const symbols = await provider.fetchSymbols(['SOLUSDT:SPOT', 'SOLUSDT:PERP'])
    expect(symbols.some(item => item.symbol === 'SOLUSDT' && item.instrumentType === 'SPOT')).toBe(true)
    expect(symbols.some(item => item.symbol === 'SOLUSDT' && item.instrumentType === 'PERPETUAL')).toBe(true)
  })

  it('maps ws kline payload to normalized symbol', () => {
    const payload = (provider as any).adaptWsKline(
      {
        e: 'kline',
        s: 'BTCUSDT',
        k: {
          t: 1710000000000,
          T: 1710000059999,
          s: 'BTCUSDT',
          i: '1m',
          o: '1',
          h: '2',
          l: '0.5',
          c: '1.5',
          v: '10',
          q: '15',
          n: 12,
          x: true,
        },
      },
      'PERP',
    )

    expect(payload.symbol).toBe('BTCUSDT:PERP')
    expect(payload.open).toBe('1')
    expect(payload.close).toBe('1.5')
  })
})
