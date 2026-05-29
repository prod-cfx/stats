import { getClosedBarsAsOf } from './runtime-data-portal'
import { buildRuntimeMarketContext } from './runtime-context-assembler'

describe('getClosedBarsAsOf', () => {
  const bars = [
    { symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, open: 100, high: 110, low: 90, close: 105, volume: 10 },
    { symbol: 'BTCUSDT', timeframe: '1h', openTime: 3_600_000, closeTime: 7_200_000, open: 105, high: 115, low: 95, close: 108, volume: 12 },
  ]

  it('does not expose an unfinished higher-timeframe bar before close', () => {
    expect(getClosedBarsAsOf(bars, 5_400_000).map(bar => bar.closeTime)).toEqual([3_600_000])
  })

  it('exposes the higher-timeframe bar once close time is reached', () => {
    expect(getClosedBarsAsOf(bars, 7_200_000).map(bar => bar.closeTime)).toEqual([3_600_000, 7_200_000])
  })

  it('reuses the source series when every bar is closed', () => {
    expect(getClosedBarsAsOf(bars, 7_200_000)).toBe(bars)
  })
})

describe('buildRuntimeMarketContext', () => {
  it('assembles primary and secondary series by primary close timestamp', () => {
    const context = buildRuntimeMarketContext({
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      primaryCloseTs: 5_400_000,
      params: { marketType: 'perp' },
      barsByTimeframe: {
        '15m': [
          { symbol: 'BTCUSDT', timeframe: '15m', openTime: 4_500_000, closeTime: 5_400_000, open: 100, high: 111, low: 99, close: 110, volume: 1 },
        ],
        '1h': [
          { symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, open: 100, high: 110, low: 90, close: 105, volume: 10 },
          { symbol: 'BTCUSDT', timeframe: '1h', openTime: 3_600_000, closeTime: 7_200_000, open: 105, high: 115, low: 95, close: 108, volume: 12 },
        ],
      },
    })

    expect(context.data.primary['15m'].bars.map(bar => bar.timestamp)).toEqual([5_400_000])
    expect(context.data.primary['1h'].bars.map(bar => bar.timestamp)).toEqual([3_600_000])
    expect(context.execution.timeframe).toBe('15m')
  })

  it('injects only point-in-time event stream entries into eventInbox', () => {
    const context = buildRuntimeMarketContext({
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      primaryCloseTs: 5_400_000,
      params: { marketType: 'perp' },
      barsByTimeframe: {
        '15m': [
          { symbol: 'BTCUSDT', timeframe: '15m', openTime: 4_500_000, closeTime: 5_400_000, open: 100, high: 111, low: 99, close: 110, volume: 1 },
        ],
      },
      eventStreams: {
        'webhook.whale_buy': [
          { id: 'past', ts: 5_399_000, payload: { signalId: 'whale_buy' } },
          { id: 'future', ts: 5_401_000, payload: { signalId: 'whale_buy' } },
        ],
      },
    })

    expect(context.eventInbox).toEqual({
      'webhook.whale_buy': [
        { id: 'past', ts: 5_399_000, payload: { signalId: 'whale_buy' } },
      ],
    })
  })
})
