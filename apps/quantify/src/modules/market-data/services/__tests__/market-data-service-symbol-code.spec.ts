import { MarketDataService } from '../market-data.service'

describe('marketDataService symbol code compatibility', () => {
  const repoMock = {
    findSymbolsByCodeIn: jest.fn(),
    upsertSymbol: jest.fn(),
    findBars: jest.fn(),
    upsertBar: jest.fn(),
    findLatestQuoteBySymbolId: jest.fn(),
    createQuote: jest.fn(),
  }

  const indicatorEngineMock = {
    handleNewBar: jest.fn(),
  }

  let service: MarketDataService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MarketDataService(repoMock as never, indicatorEngineMock as never)
  })

  it('falls back unsuffixed symbol to :SPOT', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'spot-id', code: 'BTCUSDT:SPOT' })
  })

  it('prefers exact suffixed symbol', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'perp-id', code: 'BTCUSDT:PERP' }])

    await expect(service.getSymbolOrThrow('BTCUSDT:PERP')).resolves.toEqual({ id: 'perp-id', code: 'BTCUSDT:PERP' })
  })

  it('resolves OKX native swap symbols to canonical PERP symbols', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'perp-id', code: 'BTCUSDT:PERP' }])

    await expect(service.getSymbolOrThrow('BTC-USDT-SWAP')).resolves.toEqual({ id: 'perp-id', code: 'BTCUSDT:PERP' })
    expect(repoMock.findSymbolsByCodeIn).toHaveBeenCalledWith(expect.arrayContaining(['BTCUSDT:PERP']))
  })

  it('rejects OKX native swap symbols with explicit SPOT suffix', async () => {
    await expect(service.getSymbolOrThrow('BTC-USDT-SWAP:SPOT')).rejects.toThrow('market.symbol_unknown_suffix')
    expect(repoMock.findSymbolsByCodeIn).not.toHaveBeenCalled()
  })

  it('falls back to legacy unsuffixed symbol when spot code is missing', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'legacy-id', code: 'BTCUSDT' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'legacy-id', code: 'BTCUSDT' })
  })

  it('falls back unsuffixed symbol to :PERP when :SPOT is missing', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'perp-id', code: 'BTCUSDT:PERP' }])

    await expect(service.getSymbolOrThrow('BTCUSDT')).resolves.toEqual({ id: 'perp-id', code: 'BTCUSDT:PERP' })
  })

  it('warns when both spot and perp exist for unsuffixed input', async () => {
    const warnSpy = jest.spyOn((service as any).logger, 'warn')
    repoMock.findSymbolsByCodeIn.mockResolvedValue([
      { id: 'spot-id', code: 'BTCUSDT:SPOT' },
      { id: 'perp-id', code: 'BTCUSDT:PERP' },
    ])

    await service.getSymbolOrThrow('BTCUSDT')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ambiguous symbol code'))
  })

  it('normalizes provider symbol code using instrumentType', async () => {
    repoMock.upsertSymbol.mockResolvedValue(undefined)

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

    expect(repoMock.upsertSymbol).toHaveBeenCalledWith(
      'BTCUSDT:PERP',
      expect.objectContaining({ code: 'BTCUSDT:PERP', instrumentType: 'PERPETUAL' }),
      expect.objectContaining({ instrumentType: 'PERPETUAL' }),
    )
  })

  it('filters bars by provider prefix when provider query is provided', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])
    repoMock.findBars.mockResolvedValue([])

    await service.getBars({
      symbol: 'BTCUSDT:SPOT',
      timeframe: '1h',
      limit: 10,
      provider: 'OKX',
    } as any)

    expect(repoMock.findBars).toHaveBeenCalledWith(
      expect.objectContaining({
        symbolId: 'spot-id',
        source: { startsWith: 'OKX' },
      }),
      expect.anything(),
      expect.anything(),
    )
  })

  it('keeps recent bar snapshot in ascending timestamp order when gapfill arrives after realtime bars', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])
    repoMock.upsertBar.mockResolvedValue(undefined)

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

  it('treats duplicate market bar upsert as idempotent and still updates snapshots', async () => {
    repoMock.findSymbolsByCodeIn.mockResolvedValue([{ id: 'spot-id', code: 'BTCUSDT:SPOT' }])
    repoMock.upsertBar.mockRejectedValue({ code: 'P2002' })

    await expect(service.saveBarFromProvider({
      symbol: 'BTCUSDT',
      timeframe: '1m',
      timestamp: 1_710_000_180_000,
      open: '103',
      high: '113',
      low: '93',
      close: '108',
      volume: '13',
      quoteVolume: '1300',
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
    })).resolves.toBeUndefined()

    expect(indicatorEngineMock.handleNewBar).toHaveBeenCalledWith({
      symbolId: 'spot-id',
      symbolCode: 'BTCUSDT:SPOT',
      timeframe: '1m',
    })
    expect(service.getLatestBarSnapshot('BTCUSDT', '1m')?.timestamp).toBe(1_710_000_180_000)
  })
})
