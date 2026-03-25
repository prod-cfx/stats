import { BacktestMarketDataService } from './backtest-market-data.service'

function createPrismaMock() {
  return {
    symbol: {
      findMany: jest.fn(),
    },
    marketBar: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  }
}

describe('backtestMarketDataService', () => {
  it('loads and maps bars from prisma with range filter', async () => {
    const prisma = createPrismaMock()
    prisma.symbol.findMany.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    prisma.marketBar.findMany
      .mockResolvedValueOnce([
        {
          time: new Date(2_000),
          open: 11,
          high: 12,
          low: 10,
          close: 11.5,
          volume: 120,
        },
      ])
      .mockResolvedValueOnce([
        {
          time: new Date(2_000),
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 90,
        },
      ])

    const service = new BacktestMarketDataService(prisma as never)
    const bars = await service.loadBars({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 1_500, toTs: 2_500 },
    })

    expect(prisma.marketBar.findMany).toHaveBeenCalledTimes(2)
    expect(bars).toEqual([
      expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2_000, close: 11.5 }),
      expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 2_000, close: 10.5 }),
    ])
  })

  it('resolves full coverage when requested range is inside available range', async () => {
    const prisma = createPrismaMock()
    prisma.symbol.findMany.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    prisma.marketBar.aggregate
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(5_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(2_000) }, _max: { time: new Date(4_000) } })

    const service = new BacktestMarketDataService(prisma as never)
    const coverage = await service.resolveCoverage({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 2_100, toTs: 3_900 },
    })

    expect(coverage).toEqual({
      kind: 'full',
      availableRange: { fromTs: 2_000, toTs: 4_000 },
      appliedRange: { fromTs: 2_100, toTs: 3_900 },
    })
  })

  it('resolves partial coverage when requested range exceeds available range', async () => {
    const prisma = createPrismaMock()
    prisma.symbol.findMany.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    prisma.marketBar.aggregate
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(5_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(2_000) }, _max: { time: new Date(4_000) } })

    const service = new BacktestMarketDataService(prisma as never)
    const coverage = await service.resolveCoverage({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 1_500, toTs: 4_500 },
    })

    expect(coverage).toEqual({
      kind: 'partial',
      availableRange: { fromTs: 2_000, toTs: 4_000 },
      appliedRange: { fromTs: 2_000, toTs: 4_000 },
    })
  })

  it('resolves empty coverage when no overlap exists', async () => {
    const prisma = createPrismaMock()
    prisma.symbol.findMany.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    prisma.marketBar.aggregate
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(2_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(2_000) } })

    const service = new BacktestMarketDataService(prisma as never)
    const coverage = await service.resolveCoverage({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 3_000, toTs: 4_000 },
    })

    expect(coverage).toEqual({
      kind: 'empty',
      availableRange: { fromTs: 1_000, toTs: 2_000 },
    })
  })

  it('deduplicates normalized symbols when loading bars', async () => {
    const prisma = createPrismaMock()
    prisma.symbol.findMany.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    prisma.marketBar.findMany
      .mockResolvedValueOnce([
        {
          time: new Date(2_000),
          open: 11,
          high: 12,
          low: 10,
          close: 11.5,
          volume: 120,
        },
      ])
      .mockResolvedValueOnce([
        {
          time: new Date(2_000),
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 90,
        },
      ])

    const service = new BacktestMarketDataService(prisma as never)
    const bars = await service.loadBars({
      symbols: ['btcusdt', ' BTCUSDT '],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 1_500, toTs: 2_500 },
    })

    expect(prisma.marketBar.findMany).toHaveBeenCalledTimes(2)
    expect(bars).toHaveLength(2)
    expect(bars.every(bar => bar.symbol === 'BTCUSDT')).toBe(true)
  })

  it('does not mark duplicate normalized symbols as missing coverage', async () => {
    const prisma = createPrismaMock()
    prisma.symbol.findMany.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    prisma.marketBar.aggregate
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(5_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(2_000) }, _max: { time: new Date(4_000) } })

    const service = new BacktestMarketDataService(prisma as never)
    const coverage = await service.resolveCoverage({
      symbols: ['btcusdt', ' BTCUSDT '],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 2_100, toTs: 3_900 },
    })

    expect(prisma.marketBar.aggregate).toHaveBeenCalledTimes(2)
    expect(coverage).toEqual({
      kind: 'full',
      availableRange: { fromTs: 2_000, toTs: 4_000 },
      appliedRange: { fromTs: 2_100, toTs: 3_900 },
    })
  })
})
