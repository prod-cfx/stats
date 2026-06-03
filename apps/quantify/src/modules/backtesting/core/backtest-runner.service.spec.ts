import type { StrategyDecisionV1 } from '@ai/shared'
import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import type { BacktestRunInput, StrategyContext } from '../types/backtesting.types'
import { evaluateExprPool } from '@ai/shared/script-engine/compiled-runtime'
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

  it('uses 15m primary clock and exposes only closed 1h and 4h series for strategy 24', async () => {
    const runner = createRunner()
    const seen: Array<{
      ts: number
      timeframes: string[]
      oneHourLastTs?: number
      fourHourLastTs?: number
    }> = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['1h', '4h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'strategy-24-acceptance',
        params: { marketType: 'perp' },
        fn: (ctx) => {
          const data = (ctx as {
            data?: Record<string, Record<string, { bars: Array<{ timestamp: number }> }>>
          }).data?.primary ?? {}
          seen.push({
            ts: ctx.ts,
            timeframes: Object.keys(data).sort(),
            oneHourLastTs: data['1h']?.bars.at(-1)?.timestamp,
            fourHourLastTs: data['4h']?.bars.at(-1)?.timestamp,
          })
          return { type: 'NOOP', reason: 'strategy24.acceptance' }
        },
      },
      dataRange: { fromTs: 5_400_000, toTs: 15_300_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, close: 105 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '4h', openTime: 0, closeTime: 14_400_000, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 4_500_000, closeTime: 5_400_000, close: 110 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 14_400_000, closeTime: 15_300_000, close: 120 }),
      ],
    })

    expect(seen).toEqual([
      {
        ts: 5_400_000,
        timeframes: ['15m', '1h'],
        oneHourLastTs: 3_600_000,
        fourHourLastTs: undefined,
      },
      {
        ts: 15_300_000,
        timeframes: ['15m', '1h', '4h'],
        oneHourLastTs: 3_600_000,
        fourHourLastTs: 14_400_000,
      },
    ])
  })

  it('derives runner runtime timeframes from strategy dataRequirements when stateTimeframes is empty', async () => {
    const runner = createRunner()
    const seen: Array<{
      timeframes: string[]
      oneHourLastTs?: number
      fourHourLastTs?: number
    }> = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'strategy-24-snapshot-derived-requirements',
        params: { marketType: 'perp' },
        dataRequirements: { primary: ['15m', '1h', '4h'] },
        fn: (ctx) => {
          const data = (ctx as {
            data?: Record<string, Record<string, { bars: Array<{ timestamp: number }> }>>
          }).data?.primary ?? {}
          seen.push({
            timeframes: Object.keys(data).sort(),
            oneHourLastTs: data['1h']?.bars.at(-1)?.timestamp,
            fourHourLastTs: data['4h']?.bars.at(-1)?.timestamp,
          })
          return { type: 'NOOP', reason: 'strategy24.acceptance' }
        },
      },
      dataRange: { fromTs: 15_300_000, toTs: 15_300_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, close: 105 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '4h', openTime: 0, closeTime: 14_400_000, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 14_400_000, closeTime: 15_300_000, close: 120 }),
      ],
    })

    expect(seen).toEqual([
      {
        timeframes: ['15m', '1h', '4h'],
        oneHourLastTs: 3_600_000,
        fourHourLastTs: 14_400_000,
      },
    ])
  })

  it('reports data requirement unavailable when strategy 24 secondary timeframe never has closed data', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['1h', '4h'],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'strategy-24-missing-4h',
        params: { marketType: 'perp' },
        specSnapshot: { rules: [{ id: 'r1' }] },
        fn: () => ({ type: 'NOOP', reason: 'strategy24.acceptance' }),
      },
      dataRange: { fromTs: 5_400_000, toTs: 15_300_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, close: 105 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 4_500_000, closeTime: 5_400_000, close: 110 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 14_400_000, closeTime: 15_300_000, close: 120 }),
      ],
    })

    expect(report.diagnostics.dataRequirementMissingCount).toBe(1)
    expect(report.summary.diagnosticReason).toBe('BACKTEST_DATA_REQUIREMENT_UNAVAILABLE')
  })

  it('runs compiled timeframe-scoped expressions against snapshot-derived secondary bars', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'strategy-24-compiled-runtime-entry',
        params: { marketType: 'perp' },
        dataRequirements: { primary: ['15m', '1h'] },
        specSnapshot: { rules: [{ id: 'entry-1h-above-ema' }] },
        fn: (ctx) => {
          if (ctx.position?.qty && ctx.position.qty > 0) {
            return { action: 'CLOSE_LONG', size: { mode: 'QTY', value: 1 } } satisfies StrategyDecisionV1
          }

          const values = evaluateExprPool(
            ctx,
            [
              {
                id: 'close_1h',
                nodeType: 'series',
                sourceRef: 'close_1h',
                payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
                deps: [],
              },
              {
                id: 'ema_2_1h',
                nodeType: 'series',
                sourceRef: 'ema_2_1h',
                payload: { kind: 'EMA', params: { period: 2 }, timeframe: '1h' },
                deps: ['close_1h'],
              },
              {
                id: 'entry_1h',
                nodeType: 'predicate',
                sourceRef: 'indicator.above.1h',
                payload: { kind: 'GT' },
                deps: ['close_1h', 'ema_2_1h'],
              },
            ],
            ['close_1h', 'ema_2_1h', 'entry_1h'],
          )

          return values.entry_1h === true
            ? { action: 'OPEN_LONG', size: { mode: 'QUOTE', value: 100 } } satisfies StrategyDecisionV1
            : { action: 'NOOP' } satisfies StrategyDecisionV1
        },
      },
      dataRange: { fromTs: 4_000, toTs: 6_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1_000, close: 10 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 2_000, close: 20 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 3_000, close: 30 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 4_000, open: 1, close: 1 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 5_000, open: 1, close: 1 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 6_000, open: 1, close: 1 }),
      ],
    })

    expect(report.diagnostics.signalTriggerCount).toBeGreaterThan(0)
    expect(report.summary.totalTrades).toBe(1)
    expect(report.summary.diagnosticReason).toBeUndefined()
  })

  it('reports event stream unavailable when an externalSignal strategy has no supplied event stream', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'webhook-missing-stream',
        params: { marketType: 'perp' },
        specSnapshot: { rules: [{ id: 'r1' }] },
        astSnapshot: {
          exprPool: [
            {
              id: 'expr_webhook_whale_buy',
              nodeType: 'predicate',
              payload: {
                kind: 'externalSignal',
                params: {
                  provider: 'webhook',
                  signalId: 'whale_buy',
                  sourceFeedId: 'webhook.whale_buy',
                  ttlMs: 60_000,
                },
              },
            },
          ],
        },
        fn: () => ({ type: 'NOOP', reason: 'webhook.no_event' }),
      },
      dataRange: { fromTs: 900_000, toTs: 900_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 0, closeTime: 900_000, close: 100 }),
      ],
    })

    expect(report.diagnostics.eventStreamMissingCount).toBe(1)
    expect(report.summary.diagnosticReason).toBe('BACKTEST_EVENT_STREAM_UNAVAILABLE')
  })

  it('does not classify orchestration-only grid programs as no compiled rules', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'fixed-grid-orchestration-only',
        params: { marketType: 'perp' },
        specSnapshot: {
          rules: [],
          orchestration: {
            programs: [
              {
                id: 'grid-1',
                programKind: 'fixed_grid_gated',
                gridParams: { lowerBound: 69800, upperBound: 82648, levelCount: 10, stepPct: 5 },
              },
            ],
          },
        },
        fn: () => ({ type: 'NOOP', reason: 'grid.no_runtime_order_program' }),
      },
      dataRange: { fromTs: 900_000, toTs: 900_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 0, closeTime: 900_000, close: 76000 }),
      ],
    })

    expect(report.diagnostics.compiledRulesCount).toBe(1)
    expect(report.summary.diagnosticReason).toBe('BACKTEST_NO_SIGNAL_FIRED_IN_RANGE')
  })

  it('fills legacy fixed-grid orchestration working orders that expose sizing instead of quantity', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'legacy-fixed-grid-order-state',
        params: { marketType: 'perp' },
        specSnapshot: { orchestration: { programs: [{ id: 'grid-1' }] } },
        fn: () => ({
          action: 'NOOP',
          reason: 'grid.active',
          meta: {
            orderState: {
              workingOrders: [{
                id: 'grid-1',
                sourceRef: 'orchestration:program.fixed_grid_gated',
                levels: [95],
                payload: { sizing: { mode: 'fixed_pct', value: 10 } },
              }],
              activeProgramIds: ['grid-1'],
              cancelledProgramIds: [],
              closeProgramIds: [],
            },
          },
        }),
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 1, open: 100, high: 101, low: 99, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 2, open: 100, high: 100, low: 94, close: 96 }),
      ],
    })

    expect(report.summary.totalOpenTrades).toBe(1)
    expect(report.openPositions?.[0]?.qty).toBeGreaterThan(0)
  })

  it('opens a short when compiled EMA20 crosses under EMA50 in the backtest loop', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'ema-cross-under-short',
        params: { marketType: 'perp' },
        specSnapshot: { rules: [{ id: 'entry-short' }] },
        fn: (ctx) => {
          const values = evaluateExprPool(
            ctx as never,
            [
              { id: 'close_15m', nodeType: 'series', payload: { kind: 'PRICE', field: 'close', timeframe: '15m' } },
              { id: 'ema_20_15m', nodeType: 'series', deps: ['close_15m'], payload: { kind: 'EMA', inputs: ['close_15m'], params: { period: 20 } } },
              { id: 'ema_50_15m', nodeType: 'series', deps: ['close_15m'], payload: { kind: 'EMA', inputs: ['close_15m'], params: { period: 50 } } },
              { id: 'cross_under', nodeType: 'predicate', deps: ['ema_20_15m', 'ema_50_15m'], payload: { kind: 'CROSS_UNDER' } },
            ],
            ['close_15m', 'ema_20_15m', 'ema_50_15m', 'cross_under'],
          )

          return values.cross_under === true
            ? { action: 'OPEN_SHORT', size: { mode: 'QUOTE', value: 1000 }, reason: 'ema.cross_under' } satisfies StrategyDecisionV1
            : { action: 'NOOP', reason: 'ema.no_cross' } satisfies StrategyDecisionV1
        },
      },
      dataRange: { fromTs: 1, toTs: 120 },
      bars: Array.from({ length: 120 }, (_, index) => {
        const close = index < 55 ? 100 + index : Math.max(50, 155 - ((index - 54) * 3))
        return createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: index + 1, close })
      }),
    })

    expect(report.diagnostics.signalTriggerCount).toBeGreaterThan(0)
    expect(report.summary.totalOpenTrades).toBe(1)
    expect(report.openPositions?.[0]?.qty).toBeLessThan(0)
    expect(report.summary.diagnosticReason).toBeUndefined()
  })

  it('injects matching webhook events into strategy context point-in-time', async () => {
    const runner = createRunner()
    const inboxes: unknown[] = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      eventStreams: {
        'webhook.whale_buy': [
          { id: 'evt-past', ts: 899_000, payload: { signalId: 'whale_buy' } },
          { id: 'evt-future', ts: 901_000, payload: { signalId: 'whale_buy' } },
        ],
      },
      strategy: {
        id: 'webhook-with-stream',
        params: { marketType: 'perp' },
        specSnapshot: { rules: [{ id: 'r1' }] },
        astSnapshot: {
          exprPool: [
            {
              id: 'expr_webhook_whale_buy',
              nodeType: 'predicate',
              payload: {
                kind: 'externalSignal',
                params: { provider: 'webhook', signalId: 'whale_buy', sourceFeedId: 'webhook.whale_buy' },
              },
            },
          ],
        },
        fn: (ctx) => {
          inboxes.push((ctx as { eventInbox?: unknown }).eventInbox)
          return { type: 'NOOP', reason: 'webhook.observed' }
        },
      },
      dataRange: { fromTs: 900_000, toTs: 900_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 0, closeTime: 900_000, close: 100 }),
      ],
    })

    expect(inboxes).toEqual([
      {
        'webhook.whale_buy': [
          { id: 'evt-past', ts: 899_000, payload: { signalId: 'whale_buy' } },
        ],
      },
    ])
  })

  it('exposes external feed readiness metadata to compiled strategy context', async () => {
    const runner = createRunner()
    const feeds: unknown[] = []

    await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      eventStreams: {
        'funding.rate': [
          { id: 'funding-1', ts: 899_000, payload: { fundingRate: 0.0001 } },
        ],
      },
      strategy: {
        id: 'funding-feed-readiness',
        params: { marketType: 'perp' },
        specSnapshot: { rules: [{ id: 'r1' }] },
        astSnapshot: {
          exprPool: [
            {
              id: 'expr_funding_positive',
              nodeType: 'predicate',
              payload: {
                kind: 'fundingRateCondition',
                params: { schemaRef: 'funding', sourceFeedId: 'funding.rate', operator: 'GT', value: 0 },
              },
            },
          ],
        },
        fn: (ctx) => {
          feeds.push((ctx as { dataSourceFeeds?: unknown }).dataSourceFeeds)
          return { type: 'NOOP', reason: 'funding.observed' }
        },
      },
      dataRange: { fromTs: 900_000, toTs: 900_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 0, closeTime: 900_000, close: 100 }),
      ],
    })

    expect(feeds).toEqual([
      {
        'funding.rate': { schema: 'funding', permissionGranted: true, hasData: true },
      },
    ])
  })

  it('opens from webhook event fixture and exits on stop loss', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      eventStreams: {
        'webhook.whale_buy': [
          { id: 'evt-entry', ts: 899_000, payload: { signalId: 'whale_buy' } },
        ],
      },
      strategy: {
        id: 'webhook-entry-stop-loss',
        params: { marketType: 'perp' },
        riskRules: { maxFloatingLossPct: 5 },
        specSnapshot: { rules: [{ id: 'entry' }, { id: 'stop-loss' }] },
        astSnapshot: {
          exprPool: [
            {
              id: 'expr_webhook_whale_buy',
              nodeType: 'predicate',
              payload: {
                kind: 'externalSignal',
                params: {
                  provider: 'webhook',
                  signalId: 'whale_buy',
                  sourceFeedId: 'webhook.whale_buy',
                  ttlMs: 60_000,
                },
              },
            },
          ],
        },
        fn: (ctx): StrategyDecisionV1 => {
          const events = (ctx as { eventInbox?: Record<string, Array<{ payload?: Record<string, unknown> }>> })
            .eventInbox?.['webhook.whale_buy'] ?? []
          return ctx.ts === 900_000 && events.some(event => event.payload?.signalId === 'whale_buy')
            ? { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 }, confidence: 90, reason: 'webhook.whale_buy' }
            : { action: 'NOOP' }
        },
      },
      dataRange: { fromTs: 900_000, toTs: 1_020_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 0, closeTime: 900_000, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 900_000, closeTime: 960_000, open: 100, close: 94 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 960_000, closeTime: 1_020_000, open: 94, close: 94 }),
      ],
    })

    expect(report.summary.totalTrades).toBe(1)
    expect(report.openPositions ?? []).toHaveLength(0)
    expect(report.trades[0]).toMatchObject({
      symbol: 'BTCUSDT',
      side: 'LONG',
      exitReason: 'risk.max_floating_loss',
      exitSource: 'risk',
    })
  })

  it('counts missing data requirements per symbol instead of globally', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT', 'ETHUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'multi-symbol-requirements',
        params: {},
        specSnapshot: { rules: [{ id: 'r1' }] },
        dataRequirements: { primary: ['15m', '4h'] },
        fn: () => ({ type: 'NOOP', reason: 'test' }),
      },
      dataRange: { fromTs: 15_300_000, toTs: 15_300_000 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '4h', openTime: 0, closeTime: 14_400_000, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', openTime: 14_400_000, closeTime: 15_300_000, close: 120 }),
        createBar({ symbol: 'ETHUSDT', timeframe: '15m', openTime: 14_400_000, closeTime: 15_300_000, close: 220 }),
      ],
    })

    expect(report.diagnostics.dataRequirementMissingCount).toBe(1)
    expect(report.summary.diagnosticReason).toBe('BACKTEST_DATA_REQUIREMENT_UNAVAILABLE')
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

  it('persists entryTimeframe on open position and trade record from base timeframe (#1022)', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-entry-tf',
        params: {},
        fn: ({ ts }) => (ts === 1
          ? { type: 'OPEN_LONG', qty: 1 }
          : { type: 'NOOP' }),
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 2, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '15m', closeTime: 3, open: 100, close: 100 }),
      ],
    })

    expect(report.openPositions?.[0]).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      entryTimeframe: '15m',
    }))
  })

  it('records entryTimeframe on closed trade record (#1022)', async () => {
    const runner = createRunner()

    const report = await runner.run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 's-entry-tf-close',
        params: {},
        fn: ({ ts }) => {
          if (ts === 1) return { type: 'OPEN_LONG', qty: 1 }
          if (ts === 2) return { type: 'CLOSE' }
          return { type: 'NOOP' }
        },
      },
      dataRange: { fromTs: 1, toTs: 3 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 110, close: 110 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 120, close: 120 }),
      ],
    })

    expect(report.trades[0]).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      side: 'LONG',
      entryTimeframe: '5m',
    }))
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
    const seen: Array<{ ts: number; barsHeld?: number; entryTimeframe?: string; highest?: number; lowest?: number }> = []

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
            entryTimeframe: ctx.position?.entryTimeframe,
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
      { ts: 2, barsHeld: 1, entryTimeframe: '5m', highest: 110, lowest: 98 },
      { ts: 3, barsHeld: 2, entryTimeframe: '5m', highest: 112, lowest: 97 },
      { ts: 4, barsHeld: 3, entryTimeframe: '5m', highest: 112, lowest: 96 },
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

  describe('htf alignment guard (#1016)', () => {
    it('evaluates entry when all required HTFs are aligned', async () => {
      const runner = createRunner()
      const tsSeen: number[] = []

      await runner.run({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h'],
        initialCash: 1000,
        leverage: 1,
        execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
        strategy: {
          id: 's-htf-aligned',
          params: {},
          dataRequirements: { requiredTimeframes: ['1h'] },
          fn: (ctx) => {
            tsSeen.push(ctx.ts)
            return { type: 'NOOP' }
          },
        },
        dataRange: { fromTs: 1, toTs: 2 },
        bars: [
          // 1h state bar at ts=1 → upsert before base bar evaluation
          createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 2, close: 102 }),
        ],
      })

      // 第一根 base bar (ts=1) 1h snapshot 已对齐；第二根 base bar (ts=2) 1h snapshot 也对齐
      expect(tsSeen).toEqual([1, 2])
    })

    it('skips entry strategy.fn when one required HTF has no snapshot yet', async () => {
      const runner = createRunner()
      const tsSeen: number[] = []

      const report = await runner.run({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h'],
        initialCash: 1000,
        leverage: 1,
        execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
        strategy: {
          id: 's-htf-missing',
          params: {},
          dataRequirements: { requiredTimeframes: ['1h'] },
          fn: (ctx) => {
            tsSeen.push(ctx.ts)
            return { type: 'OPEN_LONG', qty: 1 }
          },
        },
        dataRange: { fromTs: 1, toTs: 2 },
        bars: [
          // 没有 1h state bar → 进入 ts=1 时 1h snapshot 缺失
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
          // ts=2 之前 1h snapshot 仍未对齐，依然跳过
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
        ],
      })

      expect(tsSeen).toEqual([])
      expect(report.summary.totalTrades).toBe(0)
      expect(report.openPositions ?? []).toHaveLength(0)
    })

    it('skips entry when one of multiple required HTFs is unaligned', async () => {
      const runner = createRunner()
      const tsSeen: number[] = []

      await runner.run({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h', '4h'],
        initialCash: 1000,
        leverage: 1,
        execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
        strategy: {
          id: 's-htf-partial',
          params: {},
          dataRequirements: { requiredTimeframes: ['1h', '4h'] },
          fn: (ctx) => {
            tsSeen.push(ctx.ts)
            return { type: 'OPEN_LONG', qty: 1 }
          },
        },
        dataRange: { fromTs: 1, toTs: 2 },
        bars: [
          // 仅有 1h snapshot，4h 始终缺失 → 跳过 entry
          createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
        ],
      })

      expect(tsSeen).toEqual([])
    })

    it('does not engage the guard when no HTF requirements declared (single-tf strategy)', async () => {
      const runner = createRunner()
      const tsSeen: number[] = []

      // 不声明 dataRequirements.requiredTimeframes → 守卫不启用，沿用旧行为
      await runner.run({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: [],
        initialCash: 1000,
        leverage: 1,
        execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
        strategy: {
          id: 's-htf-empty',
          params: {},
          fn: (ctx) => {
            tsSeen.push(ctx.ts)
            return { type: 'NOOP' }
          },
        },
        dataRange: { fromTs: 1, toTs: 2 },
        bars: [
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 101 }),
        ],
      })

      expect(tsSeen).toEqual([1, 2])
    })

    it('keeps exit and risk flow active for held positions even when HTF unaligned', async () => {
      const evaluateSpy = jest.fn().mockReturnValue(undefined)
      const riskEvaluator = {
        evaluate: evaluateSpy,
        reset: jest.fn(),
      } as unknown as RiskEvaluatorService
      const runnerWithRisk = new BacktestRunnerService(
        new TheoreticalExecutionModel(),
        new PortfolioLedgerServiceFactory(),
        new BacktestReporterService(),
        new StateEngineService(),
        riskEvaluator,
      )

      const tsSeen: number[] = []

      const report = await runnerWithRisk.run({
        symbols: ['BTCUSDT'],
        baseTimeframe: '5m',
        stateTimeframes: ['1h'],
        initialCash: 1000,
        leverage: 1,
        // BAR_CLOSE 立即成交，方便观察持仓后 exit 流程
        execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
        strategy: {
          id: 's-htf-exit-flow',
          params: {},
          dataRequirements: { requiredTimeframes: ['1h'] },
          executionPolicy: {
            signalTiming: 'BAR_CLOSE',
            fillTiming: 'BAR_CLOSE',
            noNextBarHandling: 'KEEP_PENDING',
          },
          // ts=1 1h 已对齐，开仓；ts=2 持仓在身允许进入 strategy.fn 处理 exit
          fn: (ctx) => {
            tsSeen.push(ctx.ts)
            if (ctx.position && ctx.position.qty !== 0) {
              return { type: 'CLOSE' }
            }
            return { type: 'OPEN_LONG', qty: 1 }
          },
        },
        dataRange: { fromTs: 1, toTs: 3 },
        bars: [
          createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, open: 100, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, open: 100, close: 100 }),
          createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, open: 100, close: 100 }),
        ],
      })

      // strategy.fn 应每根 base bar 都被调用（ts=1 entry 已对齐，ts>=2 持仓允许 exit 直通）
      expect(tsSeen).toEqual([1, 2, 3])
      // risk evaluator 每根 base bar 都被调用，与 entry guard 无关
      expect(evaluateSpy.mock.calls.length).toBe(3)
      expect(report.summary.totalTrades).toBe(1)
    })
  })

  // Issue #1699 P2a：诊断 metadata 让「未产生有效成交」可定位到 rules / 信号 / 撮合三层
  describe('Issue #1699: backtest diagnostics', () => {
    const baseBars = [
      createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
      createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 110 }),
      createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 120 }),
    ]
    const baseInput: Omit<BacktestRunInput, 'strategy'> = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      dataRange: { fromTs: 0, toTs: 10 },
      bars: baseBars,
    }

    it('compiledRulesCount=0 时反映规则编译为空 → NO_RULES_COMPILED 错误码可派发', async () => {
      const runner = createRunner()
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'no-rules', params: {}, fn: () => ({ type: 'NOOP' }),
          specSnapshot: { rules: [] },
        },
      })
      expect(report.diagnostics).toEqual({
        compiledRulesCount: 0,
        signalTriggerCount: 0,
        fillCount: 0,
        dataRequirementMissingCount: 0,
        eventStreamMissingCount: 0,
      })
    })

    it('规则已编译但 fn 全程 NOOP → signalTriggerCount=0 反映 NO_SIGNAL_FIRED_IN_RANGE', async () => {
      const runner = createRunner()
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'rules-no-signal', params: {}, fn: () => ({ type: 'NOOP' }),
          specSnapshot: { rules: [{ id: 'r1' }, { id: 'r2' }] },
        },
      })
      expect(report.diagnostics.compiledRulesCount).toBe(2)
      expect(report.diagnostics.signalTriggerCount).toBe(0)
      expect(report.diagnostics.fillCount).toBe(0)
    })

    it('信号触发 + 完整 OPEN→CLOSE 撮合 → fillCount > 0 反映已完结成交', async () => {
      const runner = createRunner()
      let opened = false
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'signal-and-fill', params: {},
          fn: (ctx: StrategyContext) => {
            if (ctx.position.qty === 0 && !opened) {
              opened = true
              return { type: 'OPEN_LONG', qty: 1 }
            }
            if (ctx.position.qty > 0) {
              return { type: 'CLOSE' }
            }
            return { type: 'NOOP' }
          },
          specSnapshot: { rules: [{ id: 'r1' }] },
        },
      })
      expect(report.diagnostics.compiledRulesCount).toBe(1)
      expect(report.diagnostics.signalTriggerCount).toBeGreaterThan(0)
      // fillCount 只数已完结撮合（report.trades.length），开仓未平不算
      expect(report.diagnostics.fillCount).toBeGreaterThan(0)
    })

    it('信号触发但仅 OPEN 未 CLOSE → open trade counts as effective fill for deployment gate', async () => {
      const runner = createRunner()
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'signal-no-close', params: {},
          fn: (ctx: StrategyContext) => ctx.position.qty === 0
            ? { type: 'OPEN_LONG', qty: 1 }
            : { type: 'NOOP' },
          specSnapshot: { rules: [{ id: 'r1' }] },
        },
      })
      expect(report.diagnostics.compiledRulesCount).toBe(1)
      expect(report.diagnostics.signalTriggerCount).toBeGreaterThan(0)
      expect(report.diagnostics.fillCount).toBe(1)
      expect(report.summary.totalOpenTrades).toBe(1)
      expect(report.summary.diagnosticReason).toBeUndefined()
    })

    // Issue #1708：V1 StrategyDecision { action: 'NOOP' } 不能被 signalTriggerCount 错算成 trigger，
    //   否则 diagnosticReason 会被错派为 SIGNAL_FIRED_BUT_NO_FILL（实证 staging session
    //   cmppkswpt0iytbbqsb3z8eyv2：7 天 673 bars 全 V1 NOOP，应归 NO_SIGNAL_FIRED_IN_RANGE）
    it('V1 StrategyDecision action=NOOP 不计入 signalTriggerCount（Issue #1708 回归）', async () => {
      const runner = createRunner()
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'v1-noop-only', params: {},
          fn: () => ({ action: 'NOOP', reason: 'compiled.noop' } as never),
          specSnapshot: { rules: [{ id: 'r1' }] },
        },
      })
      expect(report.diagnostics.compiledRulesCount).toBe(1)
      expect(report.diagnostics.signalTriggerCount).toBe(0)
      expect(report.diagnostics.fillCount).toBe(0)
    })

    it('V1 StrategyDecision action=NOOP 但 order program 激活时计入 signalTriggerCount', async () => {
      const runner = createRunner()
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'v1-order-program-active', params: {},
          fn: () => ({
            action: 'NOOP',
            reason: 'compiled.order_program_active',
            meta: {
              orderState: {
                activeProgramIds: ['grid-1'],
                cancelledProgramIds: [],
                closeProgramIds: [],
                workingOrders: [{
                  id: 'grid-1',
                  sourceRef: 'rules[0].effects.programs[0]',
                  payload: {},
                  levels: [99],
                }],
                programLifecycleStateNext: {},
              },
            },
          } as never),
          specSnapshot: { rules: [{ id: 'r1' }] },
        },
      })
      expect(report.diagnostics.compiledRulesCount).toBe(1)
      expect(report.diagnostics.signalTriggerCount).toBeGreaterThan(0)
    })

    it('V1 StrategyDecision action=OPEN_LONG 正确计入 signalTriggerCount', async () => {
      const runner = createRunner()
      const report = await runner.run({
        ...baseInput,
        strategy: {
          id: 'v1-open-long', params: {},
          fn: () => ({
            action: 'OPEN_LONG',
            size: { mode: 'QUOTE', value: 10 },
            reason: 'compiled.open',
          } as never),
          specSnapshot: { rules: [{ id: 'r1' }] },
        },
      })
      expect(report.diagnostics.compiledRulesCount).toBe(1)
      expect(report.diagnostics.signalTriggerCount).toBeGreaterThan(0)
    })
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
