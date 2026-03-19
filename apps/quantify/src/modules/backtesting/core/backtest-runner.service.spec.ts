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

  it('should only run base bars for requested symbols', async () => {
    const runner = new BacktestRunnerService(
      new TheoreticalExecutionModel(),
      new PortfolioLedgerServiceFactory(),
      new BacktestReporterService(),
      new StateEngineService(),
    )
    const symbolsSeen: string[] = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 's1',
        params: {},
        fn: (ctx) => {
          symbolsSeen.push(ctx.symbol)
          return { type: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'ETHUSDT', timeframe: '5m', closeTime: 2, close: 200 }),
      ],
    })

    expect(symbolsSeen).toEqual(['BTCUSDT'])
  })

  it('should only run base bars inside dataRange', async () => {
    const runner = new BacktestRunnerService(
      new TheoreticalExecutionModel(),
      new PortfolioLedgerServiceFactory(),
      new BacktestReporterService(),
      new StateEngineService(),
    )
    const tsSeen: number[] = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 's1',
        params: {},
        fn: (ctx) => {
          tsSeen.push(ctx.ts)
          return { type: 'NOOP' }
        },
      },
      dataRange: { fromTs: 2, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 102 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, close: 103 }),
      ],
    })

    expect(tsSeen).toEqual([2, 3])
  })

  it('should respect leverage cap when opening position', async () => {
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
      initialCash: 100,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'mid' },
      strategy: {
        id: 's1',
        params: {},
        fn: () => ({ type: 'TARGET_POSITION', targetQty: 10 }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(1)
  })
})
