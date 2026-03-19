import type { MarketDataRepository } from '../market-data.repository'
import type { MarketBar } from '@/prisma/prisma.types'
import { MarketDataHealthService } from '../market-data-health.service'

describe('market data health service', () => {
  const mockRepository = {
    findLatestBar: jest.fn(),
  } as unknown as jest.Mocked<MarketDataRepository>

  let service: MarketDataHealthService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MarketDataHealthService(mockRepository)
  })

  it('marks symbol stale when latest bar age exceeds threshold', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z').getTime()
    mockRepository.findLatestBar.mockResolvedValue({
      id: 'bar-1',
      symbolId: 'symbol-1',
      timeframe: 'h1',
      time: new Date('2026-03-17T09:00:00.000Z'),
      open: '100',
      high: '110',
      low: '90',
      close: '105',
      volume: '10',
      quoteVolume: '1000',
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
      createdAt: new Date('2026-03-17T09:00:00.000Z'),
      updatedAt: new Date('2026-03-17T09:00:00.000Z'),
    } as unknown as MarketBar)

    const result = await service.evaluateFreshness('BTCUSDT', '1h', now)
    expect(result.status).toBe('STALE')
  })

  it('marks symbol fresh when latest bar is within threshold', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z').getTime()
    mockRepository.findLatestBar.mockResolvedValue({
      id: 'bar-2',
      symbolId: 'symbol-1',
      timeframe: 'h1',
      time: new Date('2026-03-17T11:20:00.000Z'),
      open: '100',
      high: '110',
      low: '90',
      close: '105',
      volume: '10',
      quoteVolume: '1000',
      trades: 1,
      source: 'BINANCE_WS',
      isFinal: true,
      createdAt: new Date('2026-03-17T11:20:00.000Z'),
      updatedAt: new Date('2026-03-17T11:20:00.000Z'),
    } as unknown as MarketBar)

    const result = await service.evaluateFreshness('BTCUSDT', '1h', now)
    expect(result.status).toBe('FRESH')
  })
})
