import type { MarketDataProvider } from '../../interfaces/market-data-provider.interface'
import type { MarketDataStreamService } from '../market-data-stream.service'
import type { MarketDataService } from '../market-data.service'
import type { PrismaService } from '@/prisma/prisma.service'
import { getMarketTimeframeMs } from '../../utils/market-timeframe.util'
import { MarketDataIngestionService } from '../market-data-ingestion.service'

describe('market data ingestion service', () => {
  const configServiceMock = {
    get: jest.fn(),
  }

  const providerMock = {
    name: 'BINANCE',
    fetchSymbols: jest.fn(),
    fetchHistoricalBars: jest.fn(),
    subscribe: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as jest.Mocked<MarketDataProvider>

  const marketDataServiceMock = {
    upsertSymbolsFromProvider: jest.fn(),
    saveBarFromProvider: jest.fn(),
    saveQuoteFromProvider: jest.fn(),
  } as unknown as jest.Mocked<MarketDataService>

  const streamServiceMock = {
    emitQuote: jest.fn(),
  } as unknown as jest.Mocked<MarketDataStreamService>

  const userStrategySubscriptionFindMany = jest.fn()
  const userLlmStrategySubscriptionFindMany = jest.fn()

  const prismaMock = {
    userStrategySubscription: {
      findMany: userStrategySubscriptionFindMany,
    },
    userLlmStrategySubscription: {
      findMany: userLlmStrategySubscriptionFindMany,
    },
  } as unknown as PrismaService

  let service: MarketDataIngestionService

  beforeEach(() => {
    jest.clearAllMocks()
    ;(providerMock as { name: string }).name = 'BINANCE'

    configServiceMock.get.mockImplementation((key: string) => {
      if (key !== 'marketData') return undefined
      return {
        provider: 'binance',
        restBaseUrl: 'https://api.binance.com',
        wsBaseUrl: 'wss://stream.binance.com:9443',
        spotRestBaseUrl: 'https://api.binance.com',
        perpRestBaseUrl: 'https://fapi.binance.com',
        spotWsBaseUrl: 'wss://stream.binance.com:9443',
        perpWsBaseUrl: 'wss://fstream.binance.com',
        symbols: ['BTCUSDT'],
        timeframes: ['1m'],
        historicalLookbackMinutes: 1,
        restBatchSize: 500,
        streamPathTemplate: 'stream?streams=',
        wsReconnectDelayMs: 5_000,
      }
    })

    providerMock.fetchSymbols.mockResolvedValue([])
    providerMock.fetchHistoricalBars.mockResolvedValue([])
    providerMock.subscribe.mockResolvedValue(async () => {})
    providerMock.disconnect.mockResolvedValue()
    marketDataServiceMock.upsertSymbolsFromProvider.mockResolvedValue(undefined)
    marketDataServiceMock.saveBarFromProvider.mockResolvedValue(undefined)
    marketDataServiceMock.saveQuoteFromProvider.mockResolvedValue(undefined)
    userStrategySubscriptionFindMany.mockResolvedValue([])
    userLlmStrategySubscriptionFindMany.mockResolvedValue([])

    service = new MarketDataIngestionService(
      configServiceMock as never,
      prismaMock,
      marketDataServiceMock,
      providerMock,
      streamServiceMock,
    )
  })

  it('expands suffix-less symbols to both SPOT and PERP for historical sync and realtime subscription', async () => {
    await service.onModuleInit()

    const symbolsFromHistory = providerMock.fetchHistoricalBars.mock.calls.map(call => call[0]?.symbol)
    expect(symbolsFromHistory).toContain('BTCUSDT:SPOT')
    expect(symbolsFromHistory).toContain('BTCUSDT:PERP')

    expect(providerMock.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['BTCUSDT:SPOT', 'BTCUSDT:PERP'],
      }),
    )
  })

  it('uses provider name as symbol exchange fallback', async () => {
    ;(providerMock as any).name = 'OKX'

    await service.onModuleInit()

    expect(marketDataServiceMock.upsertSymbolsFromProvider).toHaveBeenCalledWith([], 'OKX')
  })

  it('maps USDT symbols to USDC when provider is hyperliquid', async () => {
    ;(providerMock as any).name = 'HYPERLIQUID'

    await service.onModuleInit()

    const symbolsFromHistory = providerMock.fetchHistoricalBars.mock.calls.map(call => call[0]?.symbol)
    expect(symbolsFromHistory).toContain('BTCUSDC:SPOT')
    expect(symbolsFromHistory).toContain('BTCUSDC:PERP')
    expect(providerMock.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['BTCUSDC:SPOT', 'BTCUSDC:PERP'],
      }),
    )
  })

  it('throws for unsupported timeframe instead of silently falling back to 1m', () => {
    expect(() => getMarketTimeframeMs('2m')).toThrow('Unsupported market timeframe: 2m')
  })

  it('merges dynamic symbols from active strategy subscriptions', async () => {
    userStrategySubscriptionFindMany.mockResolvedValue([
      {
        strategyInstance: {
          strategyTemplate: {
            legs: [{ id: 'main', symbol: 'SOLUSDT', role: 'primary' }],
          },
        },
      },
    ])

    await service.onModuleInit()

    expect(providerMock.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['BTCUSDT:SPOT', 'BTCUSDT:PERP', 'SOLUSDT:SPOT', 'SOLUSDT:PERP'],
      }),
    )
  })

  it('refreshes realtime subscription when dynamic symbols change', async () => {
    const firstUnsubscribe = jest.fn().mockResolvedValue(undefined)
    const secondUnsubscribe = jest.fn().mockResolvedValue(undefined)
    providerMock.subscribe
      .mockResolvedValueOnce(firstUnsubscribe)
      .mockResolvedValueOnce(secondUnsubscribe)
    userStrategySubscriptionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          strategyInstance: {
            strategyTemplate: {
              legs: [{ id: 'main', symbol: 'XRPUSDT', role: 'primary' }],
            },
          },
        },
      ])

    await service.onModuleInit()
    await service.handleDynamicSymbolRefresh()

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1)
    expect(providerMock.subscribe).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbols: ['BTCUSDT:SPOT', 'BTCUSDT:PERP', 'XRPUSDT:SPOT', 'XRPUSDT:PERP'],
      }),
    )
  })
})
