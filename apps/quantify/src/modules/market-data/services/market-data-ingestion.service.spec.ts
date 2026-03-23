import { MarketDataIngestionService } from './market-data-ingestion.service'

describe('marketDataIngestionService', () => {
  function createServiceWithMissingSubscriptionTables() {
    const prisma = {
      userStrategySubscription: {
        findMany: jest.fn().mockRejectedValue({
          code: 'P2021',
          message: 'table does not exist',
        }),
      },
      userLlmStrategySubscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
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
        symbols: ['BTCUSDT'],
        timeframes: ['1m'],
        historicalLookbackMinutes: 60,
        restBatchSize: 50,
        streamPathTemplate: '',
        wsReconnectDelayMs: 1000,
      }),
    }

    const provider = {
      name: 'binance',
      syncSymbols: jest.fn().mockResolvedValue(undefined),
      syncHistoricalBars: jest.fn().mockResolvedValue(undefined),
      subscribeRealtime: jest.fn().mockResolvedValue(async () => undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    }

    const marketDataService = {
      upsertSymbols: jest.fn().mockResolvedValue(undefined),
      upsertBars: jest.fn().mockResolvedValue(undefined),
    }

    const streamService = {
      emitQuote: jest.fn().mockResolvedValue(undefined),
    }

    return new MarketDataIngestionService(
      configService as any,
      prisma as any,
      marketDataService as any,
      provider as any,
      streamService as any,
    )
  }

  it('returns empty dynamic symbols when subscription tables are missing (P2021)', async () => {
    const service = createServiceWithMissingSubscriptionTables()
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined)

    await expect((service as any).collectDynamicStrategySymbols()).resolves.toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })
})
