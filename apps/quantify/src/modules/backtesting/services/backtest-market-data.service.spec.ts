import { BacktestMarketDataRepository } from '../repositories/backtest-market-data.repository'
import { BacktestMarketDataService } from './backtest-market-data.service'

function createRepositoryMock() {
  return {
    findBars: jest.fn(),
    aggregateCoverage: jest.fn(),
    findSymbolsByCodes: jest.fn(),
  }
}

describe('backtestMarketDataService', () => {
  it('loads and maps bars from repository with range filter', async () => {
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    repository.findBars
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

    const service = new BacktestMarketDataService(repository as never)
    const bars = await service.loadBars({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 1_500, toTs: 2_500 },
    })

    expect(repository.findBars).toHaveBeenCalledTimes(2)
    expect(bars).toEqual([
      expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2_000, close: 11.5 }),
      expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 2_000, close: 10.5 }),
    ])
  })

  it('resolves full coverage when requested range is inside available range', async () => {
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    repository.aggregateCoverage
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(5_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(2_000) }, _max: { time: new Date(4_000) } })

    const service = new BacktestMarketDataService(repository as never)
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
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    repository.aggregateCoverage
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(5_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(2_000) }, _max: { time: new Date(4_000) } })

    const service = new BacktestMarketDataService(repository as never)
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
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    repository.aggregateCoverage
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(2_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(2_000) } })

    const service = new BacktestMarketDataService(repository as never)
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
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    repository.findBars
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

    const service = new BacktestMarketDataService(repository as never)
    const bars = await service.loadBars({
      symbols: ['btcusdt', ' BTCUSDT '],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 1_500, toTs: 2_500 },
    })

    expect(repository.findBars).toHaveBeenCalledTimes(2)
    expect(bars).toHaveLength(2)
    expect(bars.every(bar => bar.symbol === 'BTCUSDT')).toBe(true)
  })

  it('does not mark duplicate normalized symbols as missing coverage', async () => {
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 's1', code: 'BTCUSDT' }])
    repository.aggregateCoverage
      .mockResolvedValueOnce({ _min: { time: new Date(1_000) }, _max: { time: new Date(5_000) } })
      .mockResolvedValueOnce({ _min: { time: new Date(2_000) }, _max: { time: new Date(4_000) } })

    const service = new BacktestMarketDataService(repository as never)
    const coverage = await service.resolveCoverage({
      symbols: ['btcusdt', ' BTCUSDT '],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      dataRange: { fromTs: 2_100, toTs: 3_900 },
    })

    expect(repository.aggregateCoverage).toHaveBeenCalledTimes(2)
    expect(coverage).toEqual({
      kind: 'full',
      availableRange: { fromTs: 2_000, toTs: 4_000 },
      appliedRange: { fromTs: 2_100, toTs: 3_900 },
    })
  })

  it('falls back unsuffixed symbol to canonical spot code when loading bars', async () => {
    const repository = createRepositoryMock()
    repository.findSymbolsByCodes.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])
    repository.findBars.mockResolvedValue([
      {
        time: new Date(2_000),
        open: 11,
        high: 12,
        low: 10,
        close: 11.5,
        volume: 120,
      },
    ])

    const service = new BacktestMarketDataService(repository as never)
    const bars = await service.loadBars({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: [],
      dataRange: { fromTs: 1_500, toTs: 2_500 },
    })

    expect(repository.findSymbolsByCodes).toHaveBeenCalledWith(['BTCUSDT', 'BTCUSDT:PERP', 'BTCUSDT:SPOT'])
    expect(bars).toEqual([
      expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2_000, close: 11.5 }),
    ])
  })
})
