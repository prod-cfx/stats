import { BacktestSymbolSupportService } from './backtest-symbol-support.service'

describe('backtestSymbolSupportService', () => {
  it('routes symbol checks through the unified backtest symbol availability service', async () => {
    const symbolAvailability = {
      check: jest.fn().mockResolvedValue({ supported: true }),
    }
    const service = new BacktestSymbolSupportService(symbolAvailability as never)

    await expect(service.checkSupport({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDC',
      baseTimeframe: '1h',
    })).resolves.toEqual({
      status: 'supported',
    })
    expect(symbolAvailability.check).toHaveBeenCalledWith({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDC',
      baseTimeframe: '1h',
    })
  })

  it('maps unified availability failures to not_supported status for symbols/check', async () => {
    const symbolAvailability = {
      check: jest.fn().mockResolvedValue({
        supported: false,
        reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
        args: { symbol: 'ETHUSDC' },
      }),
    }
    const service = new BacktestSymbolSupportService(symbolAvailability as never)

    await expect(service.checkSupport({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETHUSDC',
      baseTimeframe: '1h',
    })).resolves.toEqual({
      status: 'not_supported',
      reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
      args: { symbol: 'ETHUSDC' },
    })
  })
})
