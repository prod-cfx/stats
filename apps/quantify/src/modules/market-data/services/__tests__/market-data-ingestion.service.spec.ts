import type { MarketDataProvider } from '../../interfaces/market-data-provider.interface'
import type { MarketDataStreamService } from '../market-data-stream.service'
import type { MarketDataService } from '../market-data.service'
import { MarketDataIngestionService } from '../market-data-ingestion.service'

describe('market data ingestion service', () => {
  const configServiceMock = {
    get: jest.fn(),
  }

  const providerMock = {
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

  let service: MarketDataIngestionService

  beforeEach(() => {
    jest.clearAllMocks()

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

    service = new MarketDataIngestionService(
      configServiceMock as never,
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
})
