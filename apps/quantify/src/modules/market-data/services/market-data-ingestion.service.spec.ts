import { MarketDataIngestionService } from './market-data-ingestion.service'

describe('marketDataIngestionService', () => {
  function createServiceWithMissingSubscriptionTables() {
    const marketDataRepository = {
      findActiveStrategySubscriptionsForSymbols: jest.fn().mockRejectedValue({
        code: 'P2021',
        message: 'table does not exist',
      }),
      findActiveLlmSubscriptionsForSymbols: jest.fn().mockResolvedValue([]),
    }

    const configService = {
      get: jest.fn().mockReturnValue({
        provider: 'binance',
        restBaseUrl: '',
        wsBaseUrl: '',
        spotRestBaseUrl: 'https://api.binance.com',
        perpRestBaseUrl: 'https://fapi.binance.com',
        spotWsBaseUrl: 'wss://stream.binance.com:9443',
        perpWsBaseUrl: 'wss://fstream.binance.com',
        symbols: ['BTCUSDT:SPOT'],
        timeframes: ['1m'],
        historicalLookbackMinutes: 60,
        restBatchSize: 50,
        streamPathTemplate: '',
        wsReconnectDelayMs: 1000,
      }),
    }

    const provider = {
      name: 'binance',
      fetchSymbols: jest.fn().mockResolvedValue([]),
      fetchHistoricalBars: jest.fn().mockResolvedValue([]),
      subscribe: jest.fn().mockResolvedValue(async () => undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    }

    const marketDataService = {
      upsertSymbolsFromProvider: jest.fn().mockResolvedValue(undefined),
      saveBarFromProvider: jest.fn().mockResolvedValue(undefined),
      saveQuoteFromProvider: jest.fn().mockResolvedValue(undefined),
    }

    const streamService = {
      emitQuote: jest.fn(),
    }

    return new MarketDataIngestionService(
      configService as never,
      marketDataService as never,
      provider as never,
      streamService as never,
      marketDataRepository as never,
    )
  }

  it('returns empty dynamic symbols when subscription tables are missing (P2021)', async () => {
    const service = createServiceWithMissingSubscriptionTables()
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined)

    await expect((service as any).collectDynamicStrategySymbols()).resolves.toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('skips empty symbol values during ingestion normalization', () => {
    const service = createServiceWithMissingSubscriptionTables()

    expect((service as any).normalizeIngestionSymbols([
      'SOLUSDT',
      undefined,
      null,
      '',
      '  ',
    ])).toEqual(['SOLUSDT:SPOT', 'SOLUSDT:PERP'])
  })
})
