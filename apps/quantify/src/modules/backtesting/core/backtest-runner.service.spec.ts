import type { StrategyDecisionV1 } from '@ai/shared'
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

  it('should accept llm signal payload and open long by positionSizeRatio', async () => {
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
      initialCash: 1000,
      leverage: 2,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's1',
        params: {},
        fn: () => ({
          direction: 'BUY',
          signalType: 'ENTRY',
          confidence: 80,
          entryPrice: 100,
          stopLoss: 95,
          takeProfit: 110,
          reasoning: 'test',
          positionSizeRatio: 0.2,
        }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(2)
  })

  it('should accept llm signal payload and close long position', async () => {
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
      initialCash: 1000,
      leverage: 2,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's1',
        params: {},
        fn: ({ ts }) => {
          if (ts === 1) {
            return {
              direction: 'BUY',
              signalType: 'ENTRY',
              confidence: 80,
              entryPrice: 100,
              stopLoss: 95,
              takeProfit: 110,
              reasoning: 'open',
              positionSizeQuote: 100,
            }
          }
          return {
            direction: 'CLOSE_LONG',
            signalType: 'EXIT',
            confidence: 90,
            entryPrice: 102,
            stopLoss: 95,
            takeProfit: 110,
            reasoning: 'close',
          }
        },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 102, close: 102 }),
      ],
    })

    expect((report.openPositions ?? []).length).toBe(0)
    expect(report.summary.totalTrades).toBe(1)
  })

  it('should accept strategy decision protocol and open long', async () => {
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
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's1',
        params: {},
        fn: (): StrategyDecisionV1 => ({
          action: 'OPEN_LONG',
          size: { mode: 'QTY', value: 1.5 },
          confidence: 90,
          reason: 'protocol v1',
        }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(1.5)
  })

  it('should support ADJUST_POSITION with TARGET mode', async () => {
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
      initialCash: 1000,
      leverage: 2,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's1',
        params: {},
        fn: ({ ts }): StrategyDecisionV1 => {
          if (ts === 1) {
            return { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open' }
          }
          return {
            action: 'ADJUST_POSITION',
            adjustMode: 'TARGET',
            size: { mode: 'QTY', value: 2.5 },
            confidence: 90,
            reason: 'target adjust',
          }
        },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(2.5)
  })

  it('should support ADJUST_POSITION with DELTA mode', async () => {
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
      initialCash: 1000,
      leverage: 2,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's1',
        params: {},
        fn: ({ ts }): StrategyDecisionV1 => {
          if (ts === 1) {
            return { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open' }
          }
          return {
            action: 'ADJUST_POSITION',
            adjustMode: 'DELTA',
            size: { mode: 'QTY', value: 0.5 },
            confidence: 90,
            reason: 'delta adjust',
          }
        },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(1.5)
  })

  it('should provide multi-leg runtime context helpers for protocol strategy scripts', async () => {
    const runner = new BacktestRunnerService(
      new TheoreticalExecutionModel(),
      new PortfolioLedgerServiceFactory(),
      new BacktestReporterService(),
      new StateEngineService(),
    )

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's1',
        params: { positionPct: 10 },
        fn: (ctx: any): StrategyDecisionV1 => {
          const primaryLeg = ctx.legs?.find((leg: any) => leg.role === 'primary')
          const timeframe = ctx.execution?.timeframe ?? '5m'
          const legId = primaryLeg?.id
          const tfData = legId ? ctx.data?.[legId]?.[timeframe] : undefined
          const closes = Array.isArray(tfData?.bars) ? tfData.bars.map((bar: any) => bar.close) : []
          if (closes.length < 3 || !ctx.helpers?.ta) return { action: 'NOOP' }

          const fast = ctx.helpers.ta.sma(closes, 2)
          const slow = ctx.helpers.ta.sma(closes, 3)
          if (fast === null || slow === null) return { action: 'NOOP' }
          if (fast > slow) return { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 } }
          if (fast < slow) return { action: 'CLOSE_LONG', size: { mode: 'QTY', value: 1 } }
          return { action: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 4 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 1 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 2 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 3 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, close: 0 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(1)
    expect(report.openPositions?.length ?? 0).toBe(0)
  })
})
