import { BacktestMarketDataRepository } from '../repositories/backtest-market-data.repository'
import { BacktestMarketDataService } from './backtest-market-data.service'

function createRepositoryMock() {
  return {
    findBars: jest.fn(),
    aggregateCoverage: jest.fn(),
    findSymbolsByCodes: jest.fn(),
    findActiveSymbolByExchangeAndCodes: jest.fn(),
  }
}

function createService(repository = createRepositoryMock(), overrides: Partial<{
  marketDataService: {
    upsertSymbolsFromProvider: jest.Mock
    saveBarFromProvider: jest.Mock
  }
  binanceProvider: {
    name: string
    fetchSymbols: jest.Mock
    fetchHistoricalBars: jest.Mock
  }
  okxProvider: {
    name: string
    fetchSymbols: jest.Mock
    fetchHistoricalBars: jest.Mock
  }
  hyperliquidProvider: {
    name: string
    fetchSymbols: jest.Mock
    fetchHistoricalBars: jest.Mock
  }
}> = {}) {
  const marketDataService = overrides.marketDataService ?? {
    upsertSymbolsFromProvider: jest.fn(),
    saveBarFromProvider: jest.fn(),
  }
  const binanceProvider = overrides.binanceProvider ?? {
    name: 'BINANCE',
    fetchSymbols: jest.fn(),
    fetchHistoricalBars: jest.fn(),
  }
  const okxProvider = overrides.okxProvider ?? {
    name: 'OKX',
    fetchSymbols: jest.fn(),
    fetchHistoricalBars: jest.fn(),
  }
  const hyperliquidProvider = overrides.hyperliquidProvider ?? {
    name: 'HYPERLIQUID',
    fetchSymbols: jest.fn(),
    fetchHistoricalBars: jest.fn(),
  }

  return {
    service: new BacktestMarketDataService(
      repository as never,
      marketDataService as never,
      binanceProvider as never,
      okxProvider as never,
      hyperliquidProvider as never,
    ),
    marketDataService,
    binanceProvider,
    okxProvider,
    hyperliquidProvider,
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

    const { service } = createService(repository)
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

    const { service } = createService(repository)
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

    const { service } = createService(repository)
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

    const { service } = createService(repository)
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

    const { service } = createService(repository)
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

    const { service } = createService(repository)
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

    const { service } = createService(repository)
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

  it('prepares exchange-specific symbols and historical bars before backtest coverage lookup', async () => {
    const repository = createRepositoryMock()
    const { service, marketDataService, okxProvider } = createService(repository)
    okxProvider.fetchSymbols.mockResolvedValue([
      {
        symbol: 'ETHUSDC',
        exchange: 'OKX',
        baseAsset: 'ETH',
        quoteAsset: 'USDC',
        instrumentType: 'SPOT',
        status: 'ACTIVE',
        filters: [],
      },
    ])
    okxProvider.fetchHistoricalBars.mockResolvedValue([
      {
        symbol: 'ETHUSDC:SPOT',
        timeframe: '15m',
        open: '1',
        high: '2',
        low: '0.5',
        close: '1.5',
        volume: '10',
        timestamp: 1_800_000,
        source: 'OKX_REST',
        isFinal: true,
      },
    ])

    await service.prepareData({
      symbols: ['ETHUSDC'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      dataRange: { fromTs: 900_000, toTs: 2_700_000 },
      strategy: {
        id: 's-1',
        params: { exchange: 'okx' },
        fn: () => ({ type: 'NOOP' }),
      },
    })

    expect(okxProvider.fetchSymbols).toHaveBeenCalledWith(['ETHUSDC'])
    expect(marketDataService.upsertSymbolsFromProvider).toHaveBeenCalledWith(expect.any(Array), 'OKX')
    expect(okxProvider.fetchHistoricalBars).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'ETHUSDC:SPOT',
      timeframe: '15m',
      limit: 500,
    }))
    expect(marketDataService.saveBarFromProvider).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'ETHUSDC:SPOT',
      timeframe: '15m',
    }))
  })

  it('returns not_supported when the requested exchange symbol is absent upstream', async () => {
    const repository = createRepositoryMock()
    const { service, okxProvider, marketDataService } = createService(repository)
    okxProvider.fetchSymbols.mockResolvedValue([])

    await expect(service.ensureSymbolSupported('okx', 'UNKNOWNUSDT')).resolves.toBe('not_supported')

    expect(okxProvider.fetchSymbols).toHaveBeenCalledWith(['UNKNOWNUSDT'])
    expect(marketDataService.upsertSymbolsFromProvider).not.toHaveBeenCalled()
  })

  it('returns supported without hitting upstream when symbol already exists in the market table', async () => {
    const repository = createRepositoryMock()
    repository.findActiveSymbolByExchangeAndCodes.mockResolvedValue({ id: 'sym-1', code: 'BTCUSDT' })
    const { service, okxProvider, marketDataService } = createService(repository)

    await expect(service.ensureSymbolSupported('okx', 'BTCUSDT')).resolves.toBe('supported')

    expect(okxProvider.fetchSymbols).not.toHaveBeenCalled()
    expect(marketDataService.upsertSymbolsFromProvider).not.toHaveBeenCalled()
  })

  it('wraps upstream refresh failures as a controlled 503 instead of leaking 500s', async () => {
    const repository = createRepositoryMock()
    repository.findActiveSymbolByExchangeAndCodes.mockResolvedValue(null)
    const { service, okxProvider, marketDataService } = createService(repository)
    okxProvider.fetchSymbols.mockRejectedValue(new Error('okx upstream timeout'))

    await expect(service.ensureSymbolSupported('okx', 'ETHUSDC')).rejects.toMatchObject({
      message: 'backtesting.symbol_support_temporarily_unavailable',
      code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
      status: 503,
    })

    expect(marketDataService.upsertSymbolsFromProvider).not.toHaveBeenCalled()
  })
})
