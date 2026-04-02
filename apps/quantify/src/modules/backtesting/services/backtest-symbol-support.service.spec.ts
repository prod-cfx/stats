import { BacktestSymbolSupportService } from './backtest-symbol-support.service'

describe('backtestSymbolSupportService', () => {
  it('delegates exchange symbol availability checks to backtest market data warmup service', async () => {
    const backtestMarketDataService = {
      ensureSymbolSupported: jest.fn().mockResolvedValue('refreshed_then_supported'),
    }
    const service = new BacktestSymbolSupportService(backtestMarketDataService as never)

    await expect(service.checkSupport('okx', 'ETHUSDC')).resolves.toEqual({
      status: 'refreshed_then_supported',
    })
    expect(backtestMarketDataService.ensureSymbolSupported).toHaveBeenCalledWith('okx', 'ETHUSDC')
  })
})
