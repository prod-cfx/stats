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

  it('reuses prebuilt runtime bars when source bars are already point-in-time closed', () => {
    const bars = [
      { symbol: 'BTCUSDT', timeframe: '15m', openTime: 0, closeTime: 900_000, open: 100, high: 111, low: 99, close: 110, volume: 1 },
      { symbol: 'BTCUSDT', timeframe: '15m', openTime: 900_000, closeTime: 1_800_000, open: 110, high: 112, low: 101, close: 105, volume: 2 },
    ]
    const scriptBars = [
      { open: 100, high: 111, low: 99, close: 110, volume: 1, timestamp: 900_000 },
      { open: 110, high: 112, low: 101, close: 105, volume: 2, timestamp: 1_800_000 },
    ]

    const context = buildRuntimeMarketContext({
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      primaryCloseTs: 1_800_000,
      params: { marketType: 'perp' },
      barsByTimeframe: { '15m': bars },
      scriptBarsByTimeframe: { '15m': scriptBars },
    })

    expect(context.data.primary['15m'].bars).toBe(scriptBars)
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

  it('keeps only the latest visible orderbook state snapshot', () => {
    const context = buildRuntimeMarketContext({
      symbol: 'BTCUSDT',
      baseTimeframe: '1m',
      primaryCloseTs: 10_000,
      params: { marketType: 'perp' },
      barsByTimeframe: {
        '1m': [
          { symbol: 'BTCUSDT', timeframe: '1m', openTime: 9_000, closeTime: 10_000, open: 100, high: 111, low: 99, close: 110, volume: 1 },
        ],
      },
      eventStreams: {
        'orderbook.imbalance': [
          { id: 'old', ts: 1_000, payload: { bidDepth: 3, askDepth: 1 } },
          { id: 'latest', ts: 9_999, payload: { bidDepth: 1, askDepth: 3 } },
          { id: 'future', ts: 10_001, payload: { bidDepth: 10, askDepth: 1 } },
        ],
      },
    })

    expect(context.eventInbox).toEqual({
      'orderbook.imbalance': [
        { id: 'latest', ts: 9_999, payload: { bidDepth: 1, askDepth: 3 } },
      ],
    })
  })

  it('keeps only the last two visible open-interest state events', () => {
    const context = buildRuntimeMarketContext({
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      primaryCloseTs: 10_000,
      params: { marketType: 'perp' },
      barsByTimeframe: {
        '15m': [
          { symbol: 'BTCUSDT', timeframe: '15m', openTime: 9_000, closeTime: 10_000, open: 100, high: 111, low: 99, close: 110, volume: 1 },
        ],
      },
      eventStreams: {
        open_interest: [
          { id: 'first', ts: 1_000, payload: { openInterest: 100 } },
          { id: 'previous', ts: 9_000, payload: { openInterest: 110 } },
          { id: 'current', ts: 10_000, payload: { openInterest: 120 } },
          { id: 'future', ts: 11_000, payload: { openInterest: 130 } },
        ],
      },
    })

    expect(context.eventInbox).toEqual({
      open_interest: [
        { id: 'previous', ts: 9_000, payload: { openInterest: 110 } },
        { id: 'current', ts: 10_000, payload: { openInterest: 120 } },
      ],
    })
  })

  it('marks funding and liquidation event feeds as live data source feeds', () => {
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
        'funding.rate': [{ id: 'funding-1', ts: 5_399_000, payload: { fundingRate: 0.0001 } }],
        'liquidation.events': [{ id: 'liq-1', ts: 5_399_000, payload: { side: 'long', notionalUsd: 1_500_000 } }],
      },
    })

    expect(context.dataSourceFeeds).toEqual({
      'funding.rate': { schema: 'funding', permissionGranted: true, hasData: true },
      'liquidation.events': { schema: 'liquidation', permissionGranted: true, hasData: true },
    })
  })
})
