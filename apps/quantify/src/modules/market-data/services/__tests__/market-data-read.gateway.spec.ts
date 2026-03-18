import type { MarketDataRepository } from '../market-data.repository'
import type { MarketDataService } from '../market-data.service'
import type { MarketBar } from '@/prisma/prisma.types'
import { DomainException } from '@/common/exceptions/domain.exception'
import { MarketDataReadGateway } from '../market-data-read.gateway'

describe('market data read gateway', () => {
  const mockRepository = {
    findRecentBars: jest.fn(),
    findRecentBarsBySymbolId: jest.fn(),
    findLatestBar: jest.fn(),
    findLatestBarBySymbolId: jest.fn(),
    findLatestQuote: jest.fn(),
    findLatestIndicatorValues: jest.fn(),
  } as unknown as jest.Mocked<MarketDataRepository>

  const mockMarketDataService = {
    getRecentBarsSnapshot: jest.fn(),
    getRecentBarsSnapshotBySymbolId: jest.fn(),
    getLatestBarSnapshot: jest.fn(),
    getLatestBarSnapshotBySymbolId: jest.fn(),
    getLatestQuoteSnapshot: jest.fn(),
  } as unknown as jest.Mocked<MarketDataService>

  let gateway: MarketDataReadGateway

  beforeEach(() => {
    jest.clearAllMocks()
    mockMarketDataService.getRecentBarsSnapshot.mockReturnValue([])
    mockMarketDataService.getRecentBarsSnapshotBySymbolId.mockReturnValue([])
    mockMarketDataService.getLatestBarSnapshot.mockReturnValue(null)
    mockMarketDataService.getLatestBarSnapshotBySymbolId.mockReturnValue(null)
    mockMarketDataService.getLatestQuoteSnapshot.mockReturnValue(null)
    gateway = new MarketDataReadGateway(mockRepository, mockMarketDataService)
  })

  it('returns bars in ascending time order', async () => {
    const older = new Date('2026-03-17T10:00:00.000Z')
    const newer = new Date('2026-03-17T10:01:00.000Z')

    mockRepository.findRecentBars.mockResolvedValue([
      {
        id: 'bar-1',
        symbolId: 'symbol-1',
        timeframe: 'h1',
        time: older,
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '10',
        quoteVolume: '1000',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
        createdAt: older,
        updatedAt: older,
      } as unknown as MarketBar,
      {
        id: 'bar-2',
        symbolId: 'symbol-1',
        timeframe: 'h1',
        time: newer,
        open: '105',
        high: '112',
        low: '103',
        close: '111',
        volume: '8',
        quoteVolume: '888',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
        createdAt: newer,
        updatedAt: newer,
      } as unknown as MarketBar,
    ])

    const bars = await gateway.getRecentBars('BTCUSDT', '1h', 2)
    expect(bars.map(bar => bar.timestamp)).toEqual([older.getTime(), newer.getTime()])
  })

  it('preserves null volume semantics', async () => {
    const ts = new Date('2026-03-17T10:00:00.000Z')
    mockRepository.findLatestBar.mockResolvedValue({
      id: 'bar-1',
      symbolId: 'symbol-1',
      timeframe: 'h1',
      time: ts,
      open: '100',
      high: '110',
      low: '90',
      close: '105',
      volume: null,
      quoteVolume: null,
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
      createdAt: ts,
      updatedAt: ts,
    } as unknown as MarketBar)

    const bar = await gateway.getLatestBar('BTCUSDT', '1h')
    expect(bar?.volume).toBeNull()
    expect(bar?.quoteVolume).toBeNull()
  })

  it('throws DomainException when quote missing', async () => {
    mockRepository.findLatestQuote.mockResolvedValue(null)
    await expect(gateway.getLatestQuote('BTCUSDT')).rejects.toBeInstanceOf(DomainException)
  })

  it('prefers in-memory bar snapshot before repository', async () => {
    mockMarketDataService.getRecentBarsSnapshot.mockReturnValue([
      {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: 1710000000000,
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '10',
        quoteVolume: '1000',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
      },
    ])

    const bars = await gateway.getRecentBars('BTCUSDT', '1h', 1)

    expect(bars).toHaveLength(1)
    expect(bars[0]?.close).toBe(105)
    expect(mockRepository.findRecentBars).not.toHaveBeenCalled()
  })

  it('falls back to repository when snapshot bars are fewer than requested limit', async () => {
    mockMarketDataService.getRecentBarsSnapshot.mockReturnValue([
      {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: 1710000060000,
        open: '101',
        high: '111',
        low: '91',
        close: '106',
        volume: '11',
        quoteVolume: '1100',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
      },
    ])

    mockRepository.findRecentBars.mockResolvedValue([
      {
        id: 'bar-1',
        symbolId: 'symbol-1',
        timeframe: 'h1',
        time: new Date(1710000000000),
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '10',
        quoteVolume: '1000',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
        createdAt: new Date(1710000000000),
        updatedAt: new Date(1710000000000),
      } as unknown as MarketBar,
      {
        id: 'bar-2',
        symbolId: 'symbol-1',
        timeframe: 'h1',
        time: new Date(1710000060000),
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '10',
        quoteVolume: '1000',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
        createdAt: new Date(1710000060000),
        updatedAt: new Date(1710000060000),
      } as unknown as MarketBar,
    ])

    const bars = await gateway.getRecentBars('BTCUSDT', '1h', 2)

    expect(mockRepository.findRecentBars).toHaveBeenCalledWith('BTCUSDT', '1h', 2)
    expect(bars).toHaveLength(2)
    expect(bars.map(bar => bar.timestamp)).toEqual([1710000000000, 1710000060000])
    expect(bars[1]?.close).toBe(106)
  })

  it('falls back to repository by symbolId when snapshot bars are fewer than requested limit', async () => {
    mockMarketDataService.getRecentBarsSnapshotBySymbolId.mockReturnValue([
      {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: 1710000060000,
        open: '101',
        high: '111',
        low: '91',
        close: '106',
        volume: '11',
        quoteVolume: '1100',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
      },
    ])

    mockRepository.findRecentBarsBySymbolId.mockResolvedValue([
      {
        id: 'bar-1',
        symbolId: 'symbol-1',
        timeframe: 'h1',
        time: new Date(1710000000000),
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '10',
        quoteVolume: '1000',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
        createdAt: new Date(1710000000000),
        updatedAt: new Date(1710000000000),
      } as unknown as MarketBar,
      {
        id: 'bar-2',
        symbolId: 'symbol-1',
        timeframe: 'h1',
        time: new Date(1710000060000),
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '10',
        quoteVolume: '1000',
        trades: 1,
        source: 'BINANCE_WS',
        isFinal: true,
        createdAt: new Date(1710000060000),
        updatedAt: new Date(1710000060000),
      } as unknown as MarketBar,
    ])

    const bars = await gateway.getRecentBarsBySymbolId('symbol-1', '1h', 2)

    expect(mockRepository.findRecentBarsBySymbolId).toHaveBeenCalledWith('symbol-1', '1h', 2)
    expect(bars).toHaveLength(2)
    expect(bars.map(bar => bar.timestamp)).toEqual([1710000000000, 1710000060000])
    expect(bars[1]?.close).toBe(106)
  })

  it('prefers in-memory quote snapshot before repository', async () => {
    mockMarketDataService.getLatestQuoteSnapshot.mockReturnValue({
      symbol: 'BTCUSDT',
      lastPrice: '12345.67',
      eventTime: Date.now(),
      source: 'BINANCE_WS',
    })

    const quote = await gateway.getLatestQuote('BTCUSDT')

    expect(Number(quote.lastPrice)).toBe(12345.67)
    expect(mockRepository.findLatestQuote).not.toHaveBeenCalled()
  })

  it('preserves high precision quote value from snapshot without Number round-trip', async () => {
    const precise = '12345.123456789123456789'
    mockMarketDataService.getLatestQuoteSnapshot.mockReturnValue({
      symbol: 'BTCUSDT',
      lastPrice: precise,
      eventTime: Date.now(),
      source: 'BINANCE_WS',
    })

    const quote = await gateway.getLatestQuote('BTCUSDT')

    expect(quote.lastPrice).toBe(precise)
  })
})
