import type { MarketDataRepository } from '../market-data.repository'
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

  let gateway: MarketDataReadGateway

  beforeEach(() => {
    jest.clearAllMocks()
    gateway = new MarketDataReadGateway(mockRepository)
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
})
