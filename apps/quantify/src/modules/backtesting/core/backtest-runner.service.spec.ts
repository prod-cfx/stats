import type { StrategyDecisionV1 } from '@ai/shared'
import type { BacktestRunInput } from '../types/backtesting.types'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'
import { DomainException } from '@/common/exceptions/domain.exception'
import { TheoreticalExecutionModel } from '../execution/theoretical-execution.model'
import { PortfolioLedgerServiceFactory } from '../portfolio/portfolio-ledger.service'
import { BacktestReporterService } from '../report/backtest-reporter.service'
import { RiskEvaluatorService } from '../risk/risk-evaluator.service'
import { StateEngineService } from '../state/state-engine.service'
import { BacktestRunnerService, createBar } from './backtest-runner.service'

function createRunner(riskEvaluator: RiskEvaluatorService = new RiskEvaluatorService()) {
  return new BacktestRunnerService(
    new TheoreticalExecutionModel(),
    new PortfolioLedgerServiceFactory(),
    new BacktestReporterService(),
    new StateEngineService(),
    riskEvaluator,
  )
}

describe('backtestRunnerService', () => {
  it('should run low-tf loop and return report skeleton', async () => {
    const runner = createRunner()

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

  it('should run perp bars when request symbols are raw spot-style codes but strategy marketType is perp', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '3m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-perp',
        params: { marketType: 'perp' },
        fn: () => ({ type: 'NOOP' }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT:PERP', timeframe: '3m', closeTime: 1, close: 100 }),
      ],
    })

    expect(report.equityCurve).toEqual([{ ts: 1, equity: 1000 }])
  })

  it('should not match raw spot-style bars when the request symbol is explicitly perp', async () => {
    const runner = createRunner()
    const symbolsSeen: string[] = []

    await runner.run({
      symbols: ['BTCUSDT:PERP'],
      baseTimeframe: '3m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-perp-exact',
        params: { marketType: 'perp' },
        fn: (ctx) => {
          symbolsSeen.push(ctx.symbol)
          return { type: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '3m', closeTime: 1, close: 99 }),
        createBar({ symbol: 'BTCUSDT:PERP', timeframe: '3m', closeTime: 2, close: 100 }),
      ],
    })

    expect(symbolsSeen).toEqual(['BTCUSDT:PERP'])
  })

  it('should only run base bars for requested symbols', async () => {
    const runner = createRunner()
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
    const runner = createRunner()
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
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(1)
  })

  it('should accept llm signal payload and open long by positionSizeRatio', async () => {
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(2)
  })

  it('should accept llm signal payload and close long position', async () => {
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 102, close: 102 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 101, close: 101 }),
      ],
    })

    expect((report.openPositions ?? []).length).toBe(0)
    expect(report.summary.totalTrades).toBe(1)
    expect(report.trades[0]?.exitReason).toBe('close')
    expect(report.trades[0]?.exitSource).toBe('strategy')
  })

  it('should accept strategy decision protocol and open long', async () => {
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(1.5)
  })

  it('should consume compiled force-exit decisions and close the active position', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-compiled-force-exit',
        params: {},
        fn: (ctx): StrategyDecisionV1 => {
          if (ctx.ts === 1) {
            return {
              action: 'OPEN_LONG',
              size: { mode: 'QTY', value: 1 },
              reason: 'open',
            }
          }

          if (ctx.ts === 2) {
            return runDecisionPrograms(
              ctx,
              [],
              {},
              {
                blockNewEntry: false,
                forceExit: true,
                strategyHalt: false,
                cancelOrderPrograms: false,
                triggered: ['guard-stop-loss'],
              },
              [],
            )
          }

          return { action: 'NOOP', reason: 'idle' }
        },
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 99, close: 99 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 95, close: 95 }),
      ],
    })

    expect(report.openPositions).toEqual([])
    expect(report.summary.totalTrades).toBe(1)
    expect(report.trades[0]).toMatchObject({
      side: 'LONG',
      exitReason: 'compiled.force_exit',
      exitSource: 'strategy',
    })
  })

  it('should reject invalid strategy adapter decisions instead of silently no-oping', async () => {
    const runner = createRunner()

    const input: BacktestRunInput = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-invalid-ratio',
        params: {},
        fn: (): StrategyDecisionV1 => ({
          action: 'OPEN_LONG',
          size: { mode: 'RATIO', value: 100 },
          confidence: 80,
          reason: 'bad ratio',
        }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    }

    await expect(runner.run(input)).rejects.toThrow(DomainException)

    await runner.run(input).catch((error: unknown) => {
      expect(error).toBeInstanceOf(DomainException)
      expect((error as DomainException).getResponse()).toMatchObject({
        message: 'backtest.strategy_decision_invalid',
        args: { error: expect.stringContaining('RATIO') },
      })
    })
  })

  it('should support ADJUST_POSITION with TARGET mode', async () => {
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 101, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 102, close: 102 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(2.5)
  })

  it('should support ADJUST_POSITION with DELTA mode', async () => {
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 101, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 102, close: 102 }),
      ],
    })

    expect(report.openPositions?.[0]?.qty).toBeCloseTo(1.5)
  })

  it('should provide multi-leg runtime context helpers for protocol strategy scripts', async () => {
    const runner = createRunner()

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
      dataRange: { fromTs: 1, toTs: 5 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 1 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 2 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 3 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, close: 0 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 5, close: 0 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(1)
    expect(report.openPositions?.length ?? 0).toBe(0)
  })

  it('defaults to signal-at-close and fill-at-next-bar-open', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-next-open',
        params: {},
        fn: ({ ts }): StrategyDecisionV1 => ts === 1
          ? { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open on next' }
          : { action: 'NOOP' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 105 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 110, close: 111 }),
      ],
    })

    expect(report.openPositions?.[0]?.avgEntryPrice).toBeCloseTo(110)
  })

  it('injects backtest position runtime state for held bars and trailing anchors', async () => {
    const runner = createRunner()
    const seen: Array<{ ts: number; barsHeld?: number; highest?: number; lowest?: number }> = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-runtime-state',
        params: {},
        fn: (ctx): StrategyDecisionV1 => {
          if (ctx.ts === 1) {
            return { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open' }
          }
          seen.push({
            ts: ctx.ts,
            barsHeld: ctx.position?.barsHeld,
            highest: ctx.position?.highestPriceSinceEntry,
            lowest: ctx.position?.lowestPriceSinceEntry,
          })
          return { action: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 4 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, high: 101, low: 99, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 100, high: 110, low: 98, close: 109 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 109, high: 112, low: 97, close: 108 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, open: 108, high: 111, low: 96, close: 107 }),
      ],
    })

    expect(seen).toEqual([
      { ts: 2, barsHeld: 1, highest: 110, lowest: 98 },
      { ts: 3, barsHeld: 2, highest: 112, lowest: 97 },
      { ts: 4, barsHeld: 3, highest: 112, lowest: 96 },
    ])
  })

  it('injects compiled decision runtime state for cooldown bookkeeping', async () => {
    const runner = createRunner()
    const seen: Array<{ ts: number; barIndex?: number }> = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-compiled-state',
        params: {},
        fn: (ctx: any): StrategyDecisionV1 => {
          seen.push({
            ts: ctx.ts,
            barIndex: ctx.__compiledDecisionState?.barIndex,
          })
          return { action: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 102 }),
      ],
    })

    expect(seen).toEqual([
      { ts: 1, barIndex: 1 },
      { ts: 2, barIndex: 2 },
      { ts: 3, barIndex: 3 },
    ])
  })

  it('fails fast when strict snapshot strategy is missing execution policy', async () => {
    const runner = createRunner()

    await expect(runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-strict-missing-policy',
        params: {},
        bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
        fn: (): StrategyDecisionV1 => ({ action: 'NOOP' }),
      } as any,
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })).rejects.toMatchObject({
      message: 'backtest.execution_policy_required',
    })
  })

  it('fails fast when strict snapshot LLM entry signal misses size', async () => {
    const runner = createRunner()

    await expect(runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-strict-missing-size',
        params: {},
        bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
          noNextBarHandling: 'KEEP_PENDING',
        },
        fn: () => ({
          direction: 'BUY',
          signalType: 'ENTRY',
          confidence: 90,
          entryPrice: 100,
          stopLoss: 95,
          takeProfit: 110,
          reasoning: 'missing size',
        }),
      } as any,
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })).rejects.toMatchObject({
      message: 'backtest.llm_signal_size_required',
    })
  })

  it('preserves a final pending signal when there is no next bar under NEXT_BAR_OPEN policy', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-pending-last-bar',
        params: {},
        fn: (): StrategyDecisionV1 => ({ action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90 }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(0)
    expect(report.openPositions ?? []).toHaveLength(0)
    expect(report.pendingSignals).toEqual([
      expect.objectContaining({
        symbol: 'BTCUSDT',
        deltaQty: 1,
        reasonSource: 'strategy',
      }),
    ])
  })

  it('drops the final pending signal when noNextBarHandling is DROP_SIGNAL', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-pending-drop',
        params: {},
        executionPolicy: { fillTiming: 'NEXT_BAR_OPEN', noNextBarHandling: 'DROP_SIGNAL' },
        fn: (): StrategyDecisionV1 => ({ action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90 }),
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
      ],
    })

    expect(report.pendingSignals).toBeUndefined()
  })

  it('applies max floating loss stop and writes risk exit reason/source', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-risk-stop',
        params: {},
        riskRules: { maxFloatingLossPct: 5 },
        fn: ({ ts }): StrategyDecisionV1 => ts === 1
          ? { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open' }
          : { action: 'NOOP' },
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 100, close: 94 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 93, close: 93 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(1)
    expect(report.openPositions ?? []).toHaveLength(0)
    expect(report.trades[0]?.exitReason).toBe('risk.max_floating_loss')
    expect(report.trades[0]?.exitSource).toBe('risk')
  })

  it('triggers risk close after 3 consecutive adverse outside-band bars', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-risk-band',
        params: {},
        riskRules: {
          outsideBand: {
            lowerBound: 95,
            upperBound: 105,
            consecutiveBars: 3,
            action: 'CLOSE',
          },
        },
        fn: ({ ts }): StrategyDecisionV1 => ts === 1
          ? { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open' }
          : { action: 'NOOP' },
      },
      dataRange: { fromTs: 1, toTs: 5 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 94, close: 94 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 93, close: 93 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, open: 92, close: 92 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 5, open: 91, close: 91 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(1)
    expect(report.openPositions ?? []).toHaveLength(0)
    expect(report.trades[0]?.exitReason).toBe('risk.consecutive_outside_band')
    expect(report.trades[0]?.exitSource).toBe('risk')
  })

  it('does not trigger outside-band risk close for favorable long breakout bars', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-risk-band-favorable',
        params: {},
        riskRules: {
          outsideBand: {
            lowerBound: 95,
            upperBound: 105,
            consecutiveBars: 3,
            action: 'CLOSE',
          },
        },
        fn: ({ ts }): StrategyDecisionV1 => ts === 1
          ? { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'open' }
          : { action: 'NOOP' },
      },
      dataRange: { fromTs: 1, toTs: 5 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 106, close: 106 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 107, close: 107 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, open: 108, close: 108 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 5, open: 109, close: 109 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(0)
    expect(report.openPositions ?? []).toHaveLength(1)
  })

  it('calls risk evaluator on every base bar', async () => {
    const riskEvaluator = {
      evaluate: jest.fn().mockReturnValue(undefined),
      reset: jest.fn(),
    } as unknown as RiskEvaluatorService
    const runner = createRunner(riskEvaluator)

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['5m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-risk-hook',
        params: {},
        fn: (): StrategyDecisionV1 => ({ action: 'NOOP' }),
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 102 }),
      ],
    })

    expect((riskEvaluator.evaluate as jest.Mock).mock.calls.length).toBe(3)
  })
})
