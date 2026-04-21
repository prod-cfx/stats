import { BacktestSymbolAvailabilityService } from '../backtest-symbol-availability.service'

describe('backtestSymbolAvailabilityService', () => {
  it('treats snapshot symbol as supported when provider can resolve it dynamically', async () => {
    const marketData = {
      ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({ supported: true }),
    }
    const service = new BacktestSymbolAvailabilityService(marketData as never)

    await expect(service.check({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })).resolves.toEqual({ supported: true })
    expect(marketData.ensureBacktestSymbolAvailable).toHaveBeenCalledWith({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })
  })

  it('returns a structured reason when symbol is unavailable', async () => {
    const marketData = {
      ensureBacktestSymbolAvailable: jest.fn().mockResolvedValue({
        supported: false,
        reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
        args: { symbol: 'ORDIUSDT' },
      }),
    }
    const service = new BacktestSymbolAvailabilityService(marketData as never)

    await expect(service.check({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })).resolves.toEqual({
      supported: false,
      reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
      args: { symbol: 'ORDIUSDT' },
    })
  })
})
