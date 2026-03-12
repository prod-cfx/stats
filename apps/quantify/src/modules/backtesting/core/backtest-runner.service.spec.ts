import { TheoreticalExecutionModel } from '../execution/theoretical-execution.model'
import { PortfolioLedgerServiceFactory } from '../portfolio/portfolio-ledger.service'
import { BacktestReporterService } from '../report/backtest-reporter.service'
import { StateEngineService } from '../state/state-engine.service'
import { BacktestRunnerService, createBar } from './backtest-runner.service'

describe('backtestRunnerService', () => {
  it('should run low-tf loop and return report skeleton', async () => {
    const runner = new BacktestRunnerService(
      new TheoreticalExecutionModel(),
      new PortfolioLedgerServiceFactory(),
      new BacktestReporterService(),
      new StateEngineService(),
    )

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 's1',
        params: {},
        fn: () => ({ type: 'NOOP' }),
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
      ],
    })

    expect(report.summary).toBeDefined()
    expect(Array.isArray(report.equityCurve)).toBe(true)
  })
})
