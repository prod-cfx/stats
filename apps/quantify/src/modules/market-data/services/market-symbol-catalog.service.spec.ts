import { DomainException } from '@/common/exceptions/domain.exception'
import { MarketSymbolCatalogService } from './market-symbol-catalog.service'

describe('marketSymbolCatalogService', () => {
  function createService() {
    const repository = {
      findActiveSymbolByExchangeAndCodes: jest.fn(),
    }
    const marketDataService = {
      upsertSymbolsFromProvider: jest.fn(),
    }
    const binanceProvider = {
      name: 'BINANCE',
      fetchSymbols: jest.fn(),
    }
    const okxProvider = {
      name: 'OKX',
      fetchSymbols: jest.fn(),
    }
    const hyperliquidProvider = {
      name: 'HYPERLIQUID',
      fetchSymbols: jest.fn(),
    }

    const service = new MarketSymbolCatalogService(
      repository as never,
      marketDataService as never,
      binanceProvider as never,
      okxProvider as never,
      hyperliquidProvider as never,
    )

    return {
      service,
      repository,
      marketDataService,
      binanceProvider,
      okxProvider,
      hyperliquidProvider,
    }
  }

  it('returns supported when symbol already exists in market table', async () => {
    const { service, repository, okxProvider, marketDataService } = createService()
    repository.findActiveSymbolByExchangeAndCodes.mockResolvedValue({ id: 'sym-1' })

    await expect(service.ensureExchangeSymbolAvailable('okx', 'ETHUSDC')).resolves.toBe('supported')

    expect(okxProvider.fetchSymbols).not.toHaveBeenCalled()
    expect(marketDataService.upsertSymbolsFromProvider).not.toHaveBeenCalled()
  })

  it('returns refreshed_then_supported when refresh backfills symbol', async () => {
    const { service, repository, okxProvider, marketDataService } = createService()
    repository.findActiveSymbolByExchangeAndCodes
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sym-1' })
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

    await expect(service.ensureExchangeSymbolAvailable('okx', 'ETHUSDC')).resolves.toBe('refreshed_then_supported')

    expect(okxProvider.fetchSymbols).toHaveBeenCalledWith(['ETHUSDC'])
    expect(marketDataService.upsertSymbolsFromProvider).toHaveBeenCalledWith(expect.any(Array), 'OKX')
  })

  it('returns not_supported when symbol is still missing after refresh', async () => {
    const { service, repository, okxProvider, marketDataService } = createService()
    repository.findActiveSymbolByExchangeAndCodes
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    okxProvider.fetchSymbols.mockResolvedValue([])

    await expect(service.ensureExchangeSymbolAvailable('okx', 'UNKNOWNUSDT')).resolves.toBe('not_supported')

    expect(okxProvider.fetchSymbols).toHaveBeenCalledWith(['UNKNOWNUSDT'])
    expect(marketDataService.upsertSymbolsFromProvider).not.toHaveBeenCalled()
  })

  it('surfaces refresh failures as a controlled domain exception instead of leaking 500s', async () => {
    const { service, repository, okxProvider, marketDataService } = createService()
    repository.findActiveSymbolByExchangeAndCodes.mockResolvedValueOnce(null)
    okxProvider.fetchSymbols.mockRejectedValue(new Error('okx upstream timeout'))

    await expect(service.ensureExchangeSymbolAvailable('okx', 'ETHUSDC')).rejects.toMatchObject({
      message: 'backtesting.symbol_support_temporarily_unavailable',
      code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
      status: 503,
    })

    expect(marketDataService.upsertSymbolsFromProvider).not.toHaveBeenCalled()
  })

  it('rejects unsupported exchange with domain exception', async () => {
    const { service } = createService()

    await expect(service.ensureExchangeSymbolAvailable('bybit', 'BTCUSDT')).rejects.toBeInstanceOf(DomainException)
  })

  it('syncs all supported exchanges during scheduled refresh', async () => {
    const { service, marketDataService, binanceProvider, okxProvider, hyperliquidProvider } = createService()
    binanceProvider.fetchSymbols.mockResolvedValue([{ symbol: 'BTCUSDT', exchange: 'BINANCE' }])
    okxProvider.fetchSymbols.mockResolvedValue([{ symbol: 'ETHUSDC', exchange: 'OKX' }])
    hyperliquidProvider.fetchSymbols.mockResolvedValue([])

    await service.syncAllExchangeSymbols()

    expect(binanceProvider.fetchSymbols).toHaveBeenCalledWith(undefined)
    expect(okxProvider.fetchSymbols).toHaveBeenCalledWith(undefined)
    expect(hyperliquidProvider.fetchSymbols).toHaveBeenCalledWith(undefined)
    expect(marketDataService.upsertSymbolsFromProvider).toHaveBeenNthCalledWith(1, expect.any(Array), 'BINANCE')
    expect(marketDataService.upsertSymbolsFromProvider).toHaveBeenNthCalledWith(2, expect.any(Array), 'OKX')
    expect(marketDataService.upsertSymbolsFromProvider).toHaveBeenCalledTimes(2)
  })

  it('triggers an initial background sync on application bootstrap', async () => {
    const { service } = createService()
    const syncSpy = jest.spyOn(service, 'syncAllExchangeSymbols').mockResolvedValue()

    service.onApplicationBootstrap()
    await Promise.resolve()

    expect(syncSpy).toHaveBeenCalledTimes(1)
  })
})
