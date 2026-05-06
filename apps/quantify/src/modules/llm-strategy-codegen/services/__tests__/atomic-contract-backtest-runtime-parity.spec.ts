import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CompiledScriptExecutionEnvelope, CompiledScriptProjection } from '../../types/compiled-script-projection'
import type { StrategyContext } from '../../../backtesting/types/backtesting.types'
import {
  buildCompiledManifest,
  evaluateExprPool,
  evaluateGuards,
  runDecisionPrograms,
  runOrderPrograms,
} from '@ai/shared/script-engine/compiled-runtime'
import { resolveStrategyOutput } from '@/modules/strategy-runtime/strategy-protocol.util'
import { BacktestReporterService } from '../../../backtesting/report/backtest-reporter.service'
import { TheoreticalExecutionModel } from '../../../backtesting/execution/theoretical-execution.model'
import { PortfolioLedgerServiceFactory } from '../../../backtesting/portfolio/portfolio-ledger.service'
import { RiskEvaluatorService } from '../../../backtesting/risk/risk-evaluator.service'
import { StateEngineService } from '../../../backtesting/state/state-engine.service'
import { BacktestRunnerService, createBar } from '../../../backtesting/core/backtest-runner.service'
import { SignalGenerationDecisionStage } from '../../../strategy-signals/services/signal-generation-decision.stage'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

function createAtomicParityAst(): StrategyAstV1 {
  return {
    astVersion: 'csa.v1',
    manifest: {
      irVersion: 'csi.v1',
      irHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      specHash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      compileVersion: 'compiler.v1',
      structuralDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    },
    executionModel: {
      venue: 'okx',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      primaryTimeframe: '1h',
      timeframeAlignment: 'strict',
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      defaultOrderType: 'market',
      allowPartialFill: false,
    },
    dataRequirements: {
      warmupBars: 2,
      maxLookback: 2,
      requiredTimeframes: ['1h'],
    },
    runtimeRequirements: {
      helpers: ['rollingHigh'],
      stateKeys: ['breakout'],
    },
    exprPool: [
      {
        id: 'series.const.one',
        sourceRef: 'atomic.fixture.const.one',
        nodeType: 'series',
        payload: { id: 'series.const.one', kind: 'CONST', value: 1 },
        deps: [],
      },
      {
        id: 'predicate.atomic.entry',
        sourceRef: 'atomic.fixture.breakout',
        nodeType: 'predicate',
        payload: { id: 'predicate.atomic.entry', kind: 'EQ', args: ['series.const.one', 'series.const.one'] },
        deps: ['series.const.one', 'series.const.one'],
      },
    ],
    guards: [],
    decisionPrograms: [
      {
        id: 'entry-primary',
        sourceRef: 'atomic.fixture.entry',
        phase: 'entry',
        priority: 100,
        when: 'predicate.atomic.entry',
        actions: [
          {
            kind: 'OPEN_LONG',
            quantity: { mode: 'pct_equity', value: 10 },
          },
        ],
      },
    ],
    orderPrograms: [],
    topology: {
      exprOrder: ['series.const.one', 'predicate.atomic.entry'],
      guardOrder: [],
      decisionOrder: ['entry-primary'],
      orderProgramOrder: [],
    },
  }
}

function createExecutionEnvelope(): CompiledScriptExecutionEnvelope {
  return {
    positionMode: 'long_only',
    marginMode: 'cash',
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict',
  }
}

function executeProjection(
  projection: CompiledScriptProjection,
  ctx: StrategyExecutionContextV1,
): StrategyDecisionV1 {
  const exprValues = evaluateExprPool(
    ctx,
    projection.exprPool as Parameters<typeof evaluateExprPool>[1],
    projection.topology.exprOrder,
    projection.executionModel as unknown as Parameters<typeof evaluateExprPool>[3],
  )
  const guardState = evaluateGuards(
    ctx,
    projection.guards as Parameters<typeof evaluateGuards>[1],
    exprValues,
    projection.topology.guardOrder,
  )
  const decision = runDecisionPrograms(
    ctx,
    projection.decisionPrograms as Parameters<typeof runDecisionPrograms>[1],
    exprValues,
    guardState,
    projection.topology.decisionOrder,
  )
  const orderState = runOrderPrograms(
    ctx,
    projection.orderPrograms as Parameters<typeof runOrderPrograms>[1],
    exprValues,
    guardState,
    projection.topology.orderProgramOrder,
    projection.executionModel as unknown as Parameters<typeof runOrderPrograms>[5],
  )

  return buildCompiledManifest(decision, orderState, guardState, projection.compiledManifest)
}

function createRunner() {
  return new BacktestRunnerService(
    new TheoreticalExecutionModel(),
    new PortfolioLedgerServiceFactory(),
    new BacktestReporterService(),
    new StateEngineService(),
    new RiskEvaluatorService(),
  )
}

describe('atomic contract backtest/runtime parity', () => {
  it('uses one emitted script projection and semantic runtime state key in backtest and runtime signal execution', async () => {
    const ast = createAtomicParityAst()
    const emitter = new CompiledScriptEmitterService()
    const script = emitter.emit({ ast, executionEnvelope: createExecutionEnvelope() })
    const projection = new CompiledScriptParserService().parse(script)
    const decisionStage = new SignalGenerationDecisionStage({} as never, { debug: jest.fn(), error: jest.fn(), warn: jest.fn() } as never)
    const backtestContexts: StrategyContext[] = []
    const backtestDecisions: StrategyDecisionV1[] = []
    const strategyFn = (ctx: StrategyContext) => {
      backtestContexts.push(ctx)
      const decision = executeProjection(projection, ctx as unknown as StrategyExecutionContextV1)
      backtestDecisions.push(decision)
      return decision
    }

    const backtestReport = await createRunner().run({
      symbols: ['BTCUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: [],
      initialCash: 1000,
      leverage: 1,
      execution: { slippageBps: 0, feeBps: 0, priceSource: 'close' },
      strategy: {
        id: 'atomic-parity',
        params: {},
        bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'BAR_CLOSE',
          noNextBarHandling: 'DROP_SIGNAL',
        },
        astSnapshot: ast as unknown as Record<string, unknown>,
        fn: strategyFn,
      },
      dataRange: { fromTs: 1, toTs: 1 },
      bars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '1h', closeTime: 1, close: 100 }),
      ],
    })

    const runtimeContext = decisionStage.buildPublishedStrategyContext({
      bars: [{ open: 100, high: 101, low: 99, close: 100, volume: 10, timestamp: 1 }],
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: {},
      currentPrice: 100,
      timestamp: 1,
      params: {},
      compiledDecisionState: { barIndex: 1, lastTriggeredByProgram: {} },
      semanticRuntimeState: decisionStage.buildSemanticRuntimeState(['breakout']),
    })
    const resolved = await resolveStrategyOutput(
      executeProjection(projection, runtimeContext) as unknown as Record<string, unknown>,
      runtimeContext as unknown as Record<string, unknown>,
    )
    expect(resolved.decision).toBeDefined()

    const runtimeOutcome = decisionStage.buildPublishedRuntimeSignalOutcomeFromDecision(
      resolved.decision!,
      {
        exchange: 'okx',
        marketType: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        referencePrice: 100,
      },
      { ai: { maxRawResponseLength: 4000 } } as never,
    )

    expect(projection.runtimeRequirements?.stateKeys).toEqual(['breakout'])
    expect(backtestContexts[0]?.semanticRuntimeState).toEqual({ breakout: {} })
    expect(runtimeContext.semanticRuntimeState).toEqual({ breakout: {} })
    expect(backtestDecisions[0]).toEqual(expect.objectContaining({
      action: 'OPEN_LONG',
      reason: 'compiled.entry-primary',
    }))
    expect(backtestReport.openPositions?.[0]).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      qty: 1,
    }))
    expect(runtimeOutcome).toEqual(expect.objectContaining({
      kind: 'signal',
      payload: expect.objectContaining({
        direction: 'BUY',
        signalType: 'ENTRY',
        reasoning: 'compiled.entry-primary',
      }),
    }))
  })
})
