import { MarketDataService } from '../market-data.service'

describe('marketDataService symbol code compatibility', () => {
  const prismaMock = {
    symbol: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    marketBar: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    marketQuote: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  }

  const indicatorEngineMock = {
    handleNewBar: jest.fn(),
  }

  let service: MarketDataService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MarketDataService(prismaMock as never, indicatorEngineMock as never)
  })

  it('falls back unsuffixed symbol to :SPOT', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'spot-id', code: 'BTCUSDT:SPOT' })
  })

  it('prefers exact suffixed symbol', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'perp-id', code: 'BTCUSDT:PERP' }])

    await expect(service.getSymbolOrThrow('BTCUSDT:PERP')).resolves.toEqual({ id: 'perp-id', code: 'BTCUSDT:PERP' })
  })

  it('falls back to legacy unsuffixed symbol when spot code is missing', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'legacy-id', code: 'BTCUSDT' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'legacy-id', code: 'BTCUSDT' })
  })

  it('falls back unsuffixed symbol to :PERP when :SPOT is missing', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'perp-id', code: 'BTCUSDT:PERP' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'perp-id', code: 'BTCUSDT:PERP' })
  })

  it('warns when both spot and perp exist for unsuffixed input', async () => {
    const warnSpy = jest.spyOn((service as any).logger, 'warn')
    prismaMock.symbol.findMany.mockResolvedValue([
      { id: 'spot-id', code: 'BTCUSDT:SPOT' },
      { id: 'perp-id', code: 'BTCUSDT:PERP' },
    ])

    await service.getSymbolOrThrow('BTCUSDT')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ambiguous symbol code'))
  })

  it('normalizes provider symbol code using instrumentType', async () => {
    await service.upsertSymbolsFromProvider(
      [
        {
          symbol: 'BTCUSDT',
          status: 'ACTIVE',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          instrumentType: 'PERPETUAL',
        },
      ],
      'BINANCE',
    )

    expect(prismaMock.symbol.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'BTCUSDT:PERP' },
        create: expect.objectContaining({ code: 'BTCUSDT:PERP', instrumentType: 'PERPETUAL' }),
        update: expect.objectContaining({ instrumentType: 'PERPETUAL' }),
      }),
    )
  })

  it('filters bars by provider prefix when provider query is provided', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])
    prismaMock.marketBar.findMany.mockResolvedValue([])

    await service.getBars({
      symbol: 'BTCUSDT:SPOT',
      timeframe: '1h',
      limit: 10,
      provider: 'OKX',
    } as any)

    expect(prismaMock.marketBar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          symbolId: 'spot-id',
          source: { startsWith: 'OKX' },
        }),
      }),
    )
  })

  it('keeps recent bar snapshot in ascending timestamp order when gapfill arrives after realtime bars', async () => {
    prismaMock.symbol.findMany.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])

    await service.saveBarFromProvider({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: 1_710_000_060_000,
      open: '101',
      high: '111',
      low: '91',
      close: '106',
      volume: '11',
      quoteVolume: '1100',
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
    })

    await service.saveBarFromProvider({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: 1_710_000_000_000,
      open: '100',
      high: '110',
      low: '90',
      close: '105',
      volume: '10',
      quoteVolume: '1000',
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
    })

    await service.saveBarFromProvider({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: 1_710_000_120_000,
      open: '102',
      high: '112',
      low: '92',
      close: '107',
      volume: '12',
      quoteVolume: '1200',
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
    })

    const recent = service.getRecentBarsSnapshot('BTCUSDT', '1m', 3)
    expect(recent.map(bar => bar.timestamp)).toEqual([
      1_710_000_000_000,
      1_710_000_060_000,
      1_710_000_120_000,
    ])
    expect(service.getLatestBarSnapshot('BTCUSDT', '1m')?.timestamp).toBe(1_710_000_120_000)
  })
})
