import { of } from 'rxjs'
import { HyperliquidMarketDataProvider } from '../hyperliquid-market-data.provider'

describe('hyperliquid market data provider', () => {
  const httpMock = {
    post: jest.fn(),
  }

  const configServiceMock = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  }

  let provider: HyperliquidMarketDataProvider

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new HyperliquidMarketDataProvider(httpMock as never, configServiceMock as never)
  })

  it('maps candle snapshot to normalized symbol', async () => {
    httpMock.post.mockReturnValue(of({
      data: [
        { t: 1710000000000, o: '1', h: '2', l: '0.5', c: '1.5', v: '10' },
      ],
    }))

    const bars = await provider.fetchHistoricalBars({
      symbol: 'BTCUSDC:PERP',
      timeframe: '1m',
      limit: 10,
    })

    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/info'),
      expect.objectContaining({
        type: 'candleSnapshot',
        req: expect.objectContaining({ coin: 'BTC', interval: '1m' }),
      }),
      expect.anything(),
    )
    expect(bars[0]?.symbol).toBe('BTCUSDC:PERP')
  })

  it('accepts USDT requested symbols by mapping to USDC universe symbols', async () => {
    httpMock.post.mockReturnValue(of({
      data: {
        universe: [{ name: 'BTC' }, { name: 'ETH' }],
      },
    }))

    const symbols = await provider.fetchSymbols(['BTCUSDT:SPOT'])

    expect(symbols).toHaveLength(2)
    expect(symbols.map(item => item.symbol)).toEqual(['BTCUSDC', 'BTCUSDC'])
    expect(symbols.map(item => item.instrumentType)).toEqual(['SPOT', 'PERPETUAL'])
  })
})
