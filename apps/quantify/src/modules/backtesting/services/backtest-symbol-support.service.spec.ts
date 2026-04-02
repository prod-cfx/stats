import { BacktestSymbolSupportService } from './backtest-symbol-support.service'

describe('backtestSymbolSupportService', () => {
  it('delegates exchange symbol availability checks to market symbol catalog service', async () => {
    const marketSymbolCatalogService = {
      ensureExchangeSymbolAvailable: jest.fn().mockResolvedValue('refreshed_then_supported'),
    }
    const service = new BacktestSymbolSupportService(marketSymbolCatalogService as never)

    await expect(service.checkSupport('okx', 'ETHUSDC')).resolves.toEqual({
      status: 'refreshed_then_supported',
    })
    expect(marketSymbolCatalogService.ensureExchangeSymbolAvailable).toHaveBeenCalledWith('okx', 'ETHUSDC')
  })
})
