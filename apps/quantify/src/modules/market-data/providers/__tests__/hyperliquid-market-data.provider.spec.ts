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

  it('emits quote ticks from allMids payload', async () => {
    const onTick = jest.fn()
    ;(provider as any).tickHandler = onTick
    ;(provider as any).subscriptions = [{
      market: 'PERP',
      raw: 'BTCUSDC',
      timeframe: '1m',
      coinKey: 'BTC',
      midKey: 'BTC',
    }]

    await (provider as any).handleWsPayload({
      channel: 'allMids',
      data: { mids: { BTC: '71000.5' } },
    })

    expect(onTick).toHaveBeenCalledTimes(1)
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'BTCUSDC:PERP',
      lastPrice: '71000.5',
      source: 'HYPERLIQUID_WS',
      eventTime: expect.any(Number),
    }))
  })

  it('keeps candle payload for kline only', async () => {
    const onTick = jest.fn()
    const onKline = jest.fn()
    ;(provider as any).tickHandler = onTick
    ;(provider as any).klineHandler = onKline
    ;(provider as any).subscriptions = [{
      market: 'PERP',
      raw: 'BTCUSDC',
      timeframe: '1m',
      coinKey: 'BTC',
      midKey: 'BTC',
    }]

    await (provider as any).handleWsPayload({
      channel: 'candle',
      data: {
        coin: 'BTC',
        interval: '1m',
        t: 1710000000000,
        o: '1',
        h: '2',
        l: '0.5',
        c: '1.5',
        v: '10',
      },
    })

    expect(onKline).toHaveBeenCalledTimes(1)
    expect(onTick).not.toHaveBeenCalled()
  })
})
