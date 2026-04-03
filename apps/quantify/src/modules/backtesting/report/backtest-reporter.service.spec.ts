import { BacktestReporter } from './backtest-reporter.service'

describe('backtestReporterService', () => {
  it('should emit entry and exit markers linked by tradeId', () => {
    const reporter = new BacktestReporter()
    reporter.onTradeOpen({ symbol: 'BTCUSDT', ts: 1, price: 100, side: 'LONG', qty: 1, fee: 0, reason: 'open', reasonSource: 'strategy' })
    reporter.onTradeClose({ symbol: 'BTCUSDT', ts: 2, price: 110, side: 'LONG', qty: 1, fee: 1, pnl: 10, reason: 'risk.max_floating_loss', reasonSource: 'risk' })

    const out = reporter.toReport(10000)
    expect(out.markers).toHaveLength(2)
    expect(out.trades[0].entryPrice).toBe(100)
    expect(out.trades[0].exitPrice).toBe(110)
    expect(out.trades[0].exitReason).toBe('risk.max_floating_loss')
    expect(out.trades[0].exitSource).toBe('risk')
  })

  it('should compute short trade returnPct as positive when price falls', () => {
    const reporter = new BacktestReporter()
    reporter.onTradeOpen({ symbol: 'BTCUSDT', ts: 1, price: 100, side: 'SHORT', qty: 1, fee: 0 })
    reporter.onTradeClose({ symbol: 'BTCUSDT', ts: 2, price: 90, side: 'SHORT', qty: 1, fee: 0, pnl: 10 })

    const out = reporter.toReport(1000)
    expect(out.trades[0].returnPct).toBeCloseTo(10)
  })

  it('should return percent-unit metrics for netProfitPct and maxDrawdownPct', () => {
    const reporter = new BacktestReporter()
    reporter.pushEquity(1, 100)
    reporter.pushEquity(2, 80)
    reporter.pushEquity(3, 120)
    reporter.onTradeOpen({ symbol: 'BTCUSDT', ts: 1, price: 100, side: 'LONG', qty: 1, fee: 0 })
    reporter.onTradeClose({ symbol: 'BTCUSDT', ts: 2, price: 110, side: 'LONG', qty: 1, fee: 0, pnl: 10 })

    const out = reporter.toReport(100)
    expect(out.summary.netProfitPct).toBeCloseTo(10)
    expect(out.summary.maxDrawdownPct).toBeCloseTo(20)
  })
})
