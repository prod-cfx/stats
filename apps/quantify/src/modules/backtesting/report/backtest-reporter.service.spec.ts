import { BacktestReporter } from './backtest-reporter.service'

describe('backtestReporterService', () => {
  it('should emit entry and exit markers linked by tradeId', () => {
    const reporter = new BacktestReporter()
    reporter.onTradeOpen({ symbol: 'BTCUSDT', ts: 1, price: 100, side: 'LONG', qty: 1, fee: 0 })
    reporter.onTradeClose({ symbol: 'BTCUSDT', ts: 2, price: 110, side: 'LONG', qty: 1, fee: 1, pnl: 10 })

    const out = reporter.toReport(10000)
    expect(out.markers).toHaveLength(2)
    expect(out.trades[0].entryPrice).toBe(100)
    expect(out.trades[0].exitPrice).toBe(110)
  })
})
