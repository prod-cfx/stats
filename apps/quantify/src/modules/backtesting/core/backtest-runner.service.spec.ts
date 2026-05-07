import type { StrategyDecisionV1 } from '@ai/shared'
import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import type { BacktestRunInput, StrategyContext } from '../types/backtesting.types'
import { DomainException } from '@/common/exceptions/domain.exception'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { BacktestStrategyAdapterService } from '../services/backtest-strategy-adapter.service'
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

  it('initializes semantic runtime state keys from atomic runtime requirements without changing legacy scripts', async () => {
    const runner = createRunner()
    const semanticRuntimeStates: Array<StrategyContext['semanticRuntimeState']> = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'atomic-state',
        params: {},
        astSnapshot: {
          runtimeRequirements: {
            helpers: ['rollingHigh'],
            stateKeys: ['breakout'],
          },
        },
        fn: (ctx) => {
          semanticRuntimeStates.push(ctx.semanticRuntimeState)
          if (ctx.semanticRuntimeState) {
            ctx.semanticRuntimeState.breakout = {
              rememberedLevel: ctx.baseTimeframeBar.high,
            }
          }
          return { type: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, high: 101, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 2, high: 102, close: 101 }),
      ],
    })

    expect(semanticRuntimeStates).toHaveLength(2)
    expect(semanticRuntimeStates[0]).toEqual({ breakout: { rememberedLevel: 102 } })
    expect(semanticRuntimeStates[1]).toBe(semanticRuntimeStates[0])

    const legacyStates: Array<StrategyContext['semanticRuntimeState']> = []
    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'legacy-state',
        params: {},
        fn: (ctx) => {
          legacyStates.push(ctx.semanticRuntimeState)
          return { type: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, close: 100 }),
      ],
    })

    expect(legacyStates).toEqual([undefined])
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
    const scriptCode = createCompiledForceExitScriptFixture()
    const strategy = await new BacktestStrategyAdapterService().build({
      id: 's-compiled-force-exit',
      protocolVersion: 'v1',
      scriptCode,
      params: {},
    })

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: ['1h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy,
      dataRange: { fromTs: 1, toTs: 18 },
      bars: Array.from({ length: 18 }, (_unused, index) => createBar({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        closeTime: index + 1,
        open: index < 16 ? 100 : 20,
        high: index < 16 ? 105 : 25,
        low: index < 16 ? 95 : 10,
        close: index < 16 ? 100 : 20,
      })),
    })

    expect(report.openPositions).toEqual([])
    expect(report.summary.totalTrades).toBe(1)
    expect(report.trades[0]).toMatchObject({
      side: 'LONG',
      exitReason: 'compiled.force_exit',
      exitSource: 'strategy',
    })
  })

  it('should consume compiled OR exit decisions and preserve compiled exit reason from real artifact', async () => {
    const runner = createRunner()
    const { expectedExitReason, scriptCode } = createCompiledCombinationScriptFixture()
    const strategy = await new BacktestStrategyAdapterService().build({
      id: 's-compiled-or-exit',
      protocolVersion: 'v1',
      scriptCode,
      params: {},
    })

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: ['1h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy,
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 2, open: 101, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 3, open: 102, close: 102 }),
      ],
    })

    expect(report.openPositions).toEqual([])
    expect(report.summary.totalTrades).toBe(1)
    expect(report.trades[0]).toMatchObject({
      side: 'LONG',
      exitReason: expectedExitReason,
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

  it('fills compiled spot grid order-program limit orders when bar range touches a working level', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['ETHUSDT'],
      baseTimeframe: '1m',
      stateTimeframes: ['1m'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-grid-order-program',
        params: { marketType: 'spot' },
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'BAR_CLOSE',
          noNextBarHandling: 'KEEP_PENDING',
        },
        bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
        fn: (): StrategyDecisionV1 => ({
          action: 'NOOP',
          meta: {
            orderState: {
              workingOrders: [{
                id: 'order_01_grid',
                sourceRef: 'grid',
                levels: [99, 100, 101],
                payload: {
                  id: 'grid',
                  kind: 'LIMIT_LADDER',
                  sidePolicy: 'spot_grid',
                  priceSource: 'level_set',
                  quantity: { mode: 'fixed_quote', value: 99, asset: 'USDT' },
                  orderType: 'limit',
                  timeInForce: 'gtc',
                  recycleOnFill: true,
                  pairingPolicy: 'adjacent_level',
                },
              }],
              activeProgramIds: ['order_01_grid'],
              cancelledProgramIds: [],
            },
          },
        }),
      } as any,
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'ETHUSDT', timeframe: '1m', closeTime: 1, open: 100, high: 100.2, low: 100, close: 100 }),
        createBar({ symbol: 'ETHUSDT', timeframe: '1m', closeTime: 2, open: 100, high: 100.1, low: 98.9, close: 99.2 }),
      ],
    })

    expect(report.summary.totalOpenTrades).toBe(1)
    expect(report.openPositions?.[0]).toEqual(expect.objectContaining({
      symbol: 'ETHUSDT',
      qty: 1,
      avgEntryPrice: 99,
    }))
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

function createCompiledCombinationScriptFixture(): {
  expectedExitReason: string
  scriptCode: string
} {
  const ast = new CanonicalStrategyAstCompilerService().compile(createCompiledCombinationIrFixture())
  const emitter = new CompiledScriptEmitterService()
  const script = emitter.emit({
    ast,
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    },
  })
  const projection = new CompiledScriptParserService().parse(script)
  const exitProgram = projection.decisionPrograms.find(program => program.phase === 'exit')

  if (!exitProgram) {
    throw new Error('compiled combination fixture missing exit decision program')
  }
  return {
    expectedExitReason: `compiled.${exitProgram.id}`,
    scriptCode: script,
  }
}

function createCompiledForceExitScriptFixture(): string {
  const ast = new CanonicalStrategyAstCompilerService().compile(createCompiledForceExitIrFixture())
  const emitter = new CompiledScriptEmitterService()

  return emitter.emit({
    ast,
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    },
  })
}

function createCompiledForceExitIrFixture(): CanonicalStrategyIrV1 {
  return {
    ...createCompiledCombinationIrFixture(),
    signalCatalog: {
      series: [
        { id: 'bar_index', kind: 'BAR_INDEX' },
        { id: 'bar_1', kind: 'CONST', value: 1 },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_on_first_bar', kind: 'EQ', args: ['bar_index', 'bar_1'] },
        { id: 'entry_gate_true', kind: 'EQ', args: ['bar_1', 'bar_1'] },
        { id: 'entry_and', kind: 'AND', args: ['entry_on_first_bar', 'entry_gate_true'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_and',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
    ],
  }
}

function createCompiledCombinationIrFixture(): CanonicalStrategyIrV1 {
  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'b'.repeat(64)}`,
      specHash: `sha256:${'c'.repeat(64)}`,
    },
    market: {
      venue: 'okx',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['1h'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 25 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 15,
      maxLookback: 15,
      requiredTimeframes: ['1h'],
    },
    signalCatalog: {
      series: [
        { id: 'bar_index', kind: 'BAR_INDEX' },
        { id: 'bar_1', kind: 'CONST', value: 1 },
        { id: 'bar_2', kind: 'CONST', value: 2 },
        { id: 'zero', kind: 'CONST', value: 0 },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_on_first_bar', kind: 'EQ', args: ['bar_index', 'bar_1'] },
        { id: 'entry_gate_true', kind: 'EQ', args: ['bar_1', 'bar_1'] },
        { id: 'entry_and', kind: 'AND', args: ['entry_on_first_bar', 'entry_gate_true'] },
        { id: 'exit_on_second_bar', kind: 'EQ', args: ['bar_index', 'bar_2'] },
        { id: 'exit_never', kind: 'EQ', args: ['bar_index', 'zero'] },
        { id: 'exit_or', kind: 'OR', args: ['exit_never', 'exit_on_second_bar'] },
      ],
    },
    runtimeRequirements: {
      helpers: ['atr'],
      stateKeys: [],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_and',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
      {
        id: 'exit_long',
        phase: 'exit',
        when: 'exit_or',
        priority: 100,
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [],
      riskPredicates: [
        { id: 'risk-atr-stop', kind: 'atrMultipleStop', params: { multiple: 2 } },
      ],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }
}
