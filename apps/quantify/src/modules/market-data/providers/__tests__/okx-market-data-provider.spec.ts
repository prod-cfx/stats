import { of, throwError } from 'rxjs'
import { OkxMarketDataProvider } from '../okx-market-data.provider'

describe('okx market data provider', () => {
  const httpMock = {
    get: jest.fn(),
  }

  const configServiceMock = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'marketData.okxRestMinIntervalMs') return 0
      if (key === 'marketData.okxRestRetryDelayMs') return 0
      return fallback
    }),
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
    expect(bars[0]?.timestamp).toBe(1710000060000)
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

  it('retries rate-limited history candle requests before returning bars', async () => {
    const rateLimitError = Object.assign(new Error('Request failed with status code 429'), {
      response: {
        status: 429,
        headers: {
          'retry-after': '0',
        },
      },
    })
    httpMock.get
      .mockReturnValueOnce(throwError(() => rateLimitError))
      .mockReturnValueOnce(of({
        data: {
          code: '0',
          msg: '',
          data: [['1710000000000', '1', '2', '0.5', '1.5', '10', '', '20', '1']],
        },
      }))

    const bars = await provider.fetchHistoricalBars({ symbol: 'BTCUSDT:PERP', timeframe: '1m', limit: 10 })

    expect(httpMock.get).toHaveBeenCalledTimes(2)
    expect(bars).toHaveLength(1)
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

  it('fetches orderbook imbalance events from OKX books depth', async () => {
    httpMock.get.mockReturnValue(of({
      data: {
        code: '0',
        msg: '',
        data: [{
          ts: '1710000000000',
          bids: [['100', '2'], ['99', '1']],
          asks: [['101', '1'], ['102', '1']],
        }],
      },
    }))

    const events = await provider.fetchOrderbookImbalanceEvents({
      symbol: 'BTCUSDT:PERP',
      startMs: 1709999999000,
      endMs: 1710000001000,
      depth: 2,
    })

    const [url, requestConfig] = httpMock.get.mock.calls[0] as [string, { params: Record<string, string> }]
    expect(url).toContain('/api/v5/market/books')
    expect(requestConfig.params).toEqual({ instId: 'BTC-USDT-SWAP', sz: '2' })
    expect(events).toEqual([{
      id: 'okx-orderbook:BTC-USDT-SWAP:1710000000000',
      ts: 1710000000000,
      payload: {
        instId: 'BTC-USDT-SWAP',
        bidDepth: 3,
        askDepth: 2,
        imbalanceRatio: 1.5,
        bestBid: 100,
        bestAsk: 101,
        spreadPct: 0.9950248756218906,
      },
    }])
  })

  it('fetches open interest events from OKX rubik history', async () => {
    httpMock.get.mockReturnValue(of({
      data: {
        code: '0',
        msg: '',
        data: [['1710000000000', '123', '12.3', '123000']],
      },
    }))

    const events = await provider.fetchOpenInterestEvents({
      symbol: 'BTCUSDT:PERP',
      startMs: 1709999999000,
      endMs: 1710000001000,
    })

    const [url, requestConfig] = httpMock.get.mock.calls[0] as [string, { params: Record<string, string> }]
    expect(url).toContain('/api/v5/rubik/stat/contracts/open-interest-history')
    expect(requestConfig.params).toEqual({
      instType: 'SWAP',
      instId: 'BTC-USDT-SWAP',
      period: '15m',
      begin: '1709999999000',
      end: '1710000001000',
    })
    expect(events).toEqual([{
      id: 'okx-open-interest-history:BTC-USDT-SWAP:1710000000000',
      ts: 1710000000000,
      payload: {
        instId: 'BTC-USDT-SWAP',
        openInterest: 123,
        oi: 123,
        openInterestCcy: 12.3,
        openInterestUsd: 123000,
      },
    }])
  })

  it('fetches historical open interest events from OKX rubik history', async () => {
    httpMock.get.mockReturnValue(of({
      data: {
        code: '0',
        msg: '',
        data: [
          ['1780499700000', '3725744.33', '37257.4433', '2478022359.83'],
          ['1780498800000', '3740539.28', '37405.3928', '2500943265.30'],
        ],
      },
    }))

    const events = await provider.fetchOpenInterestEvents({
      symbol: 'BTCUSDT:PERP',
      startMs: 1780498000000,
      endMs: 1780500000000,
    })

    const [url, requestConfig] = httpMock.get.mock.calls[0] as [string, { params: Record<string, string> }]
    expect(url).toContain('/api/v5/rubik/stat/contracts/open-interest-history')
    expect(requestConfig.params).toEqual({
      instType: 'SWAP',
      instId: 'BTC-USDT-SWAP',
      period: '15m',
      begin: '1780498000000',
      end: '1780500000000',
    })
    expect(events).toEqual([
      {
        id: 'okx-open-interest-history:BTC-USDT-SWAP:1780498800000',
        ts: 1780498800000,
        payload: {
          instId: 'BTC-USDT-SWAP',
          openInterest: 3740539.28,
          oi: 3740539.28,
          openInterestCcy: 37405.3928,
          openInterestUsd: 2500943265.30,
        },
      },
      {
        id: 'okx-open-interest-history:BTC-USDT-SWAP:1780499700000',
        ts: 1780499700000,
        payload: {
          instId: 'BTC-USDT-SWAP',
          openInterest: 3725744.33,
          oi: 3725744.33,
          openInterestCcy: 37257.4433,
          openInterestUsd: 2478022359.83,
        },
      },
    ])
  })

  it('paginates historical open interest until the requested start', async () => {
    httpMock.get
      .mockReturnValueOnce(of({
        data: {
          code: '0',
          msg: '',
          data: Array.from({ length: 100 }, (_, index) => [String(2_000 - index * 10), String(100 + index), '', '']),
        },
      }))
      .mockReturnValueOnce(of({
        data: {
          code: '0',
          msg: '',
          data: [['1000', '300', '', '']],
        },
      }))

    const events = await provider.fetchOpenInterestEvents({
      symbol: 'BTCUSDT:PERP',
      startMs: 1_000,
      endMs: 2_000,
    })

    expect(httpMock.get).toHaveBeenCalledTimes(2)
    const [, secondRequestConfig] = httpMock.get.mock.calls[1] as [string, { params: Record<string, string> }]
    expect(secondRequestConfig.params.end).toBe('1009')
    expect(events.at(0)?.ts).toBe(1_000)
    expect(events.at(-1)?.ts).toBe(2_000)
  })

  it('maps OKX ticker bid and ask sizes into quote depth fields', async () => {
    const onTick = jest.fn()
    ;(provider as unknown as { tickHandler: typeof onTick }).tickHandler = onTick

    await (provider as unknown as {
      handleWsPayload: (market: 'PERP', payload: { arg: { channel: string; instId: string }; data: Array<Record<string, string>> }) => Promise<void>
    }).handleWsPayload('PERP', {
      arg: { channel: 'tickers', instId: 'BTC-USDT-SWAP' },
      data: [{ last: '100', bidPx: '99', bidSz: '3', askPx: '101', askSz: '2', ts: '1710000000000' }],
    })

    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'BTCUSDT:PERP',
      bidPrice: '99',
      bidQty: '3',
      askPrice: '101',
      askQty: '2',
    }))
  })
})
