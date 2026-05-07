import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CompiledScriptExecutionEnvelope, CompiledScriptProjection } from '../../types/compiled-script-projection'
import type { StrategyContext } from '../../../backtesting/types/backtesting.types'
import {
  buildCompiledManifest,
  evaluateExprPool,
  evaluateGuards,
  evaluateRiskPredicates,
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

function createAtrRiskAst(): StrategyAstV1 {
  return {
    ...createAtomicParityAst(),
    runtimeRequirements: {
      helpers: ['atr'],
      stateKeys: [],
    },
    decisionPrograms: [],
    riskPredicates: [
      {
        id: 'risk_predicate_01_atr_stop',
        sourceRef: 'risk-atr-stop',
        payload: {
          id: 'risk-atr-stop',
          kind: 'atrMultipleStop',
          params: { multiple: 2 },
        },
      },
      {
        id: 'risk_predicate_02_atr_take_profit',
        sourceRef: 'risk-atr-take-profit',
        payload: {
          id: 'risk-atr-take-profit',
          kind: 'atrMultipleTakeProfit',
          params: { multiple: 3 },
        },
      },
    ],
    topology: {
      exprOrder: ['series.const.one', 'predicate.atomic.entry'],
      guardOrder: [],
      riskPredicateOrder: ['risk_predicate_01_atr_stop', 'risk_predicate_02_atr_take_profit'],
      decisionOrder: [],
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
  const baseGuardState = evaluateGuards(
    ctx,
    projection.guards as Parameters<typeof evaluateGuards>[1],
    exprValues,
    projection.topology.guardOrder,
  )
  const guardState = evaluateRiskPredicates(
    ctx,
    projection.riskPredicates as Parameters<typeof evaluateRiskPredicates>[1],
    baseGuardState,
    projection.topology.riskPredicateOrder,
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

  describe('phase-1 partial take profit parity', () => {
    interface PartialTakeProfitTier {
      threshold: number
      derivedRatioPct: number
    }
    interface PtpFixture {
      memoryKey: string
      tiers: PartialTakeProfitTier[]
      sideScope: 'long' | 'short' | 'both'
    }
    interface BarFixture {
      open: number
      high: number
      low: number
      close: number
      volume: number
      timestamp: number
    }
    interface PositionFixture {
      qty: number
      avgEntryPrice: number
    }

    function makePartialTakeProfitAst(fixture: PtpFixture): StrategyAstV1 {
      const exprPool: StrategyAstV1['exprPool'] = []
      const exprOrder: string[] = []

      const pnlSeriesId = 'series.position_pnl_pct'
      exprPool.push({
        id: pnlSeriesId,
        sourceRef: 'ptp.pnl',
        nodeType: 'series',
        payload: { id: pnlSeriesId, kind: 'POSITION_PNL_PCT' },
        deps: [],
      })
      exprOrder.push(pnlSeriesId)

      const decisionPrograms: StrategyAstV1['decisionPrograms'] = []
      const decisionOrder: string[] = []

      fixture.tiers.forEach((tier, index) => {
        const constId = `series.const.tier_${index}_threshold`
        exprPool.push({
          id: constId,
          sourceRef: `ptp.const.${index}`,
          nodeType: 'series',
          payload: { id: constId, kind: 'CONST', value: tier.threshold },
          deps: [],
        })
        exprOrder.push(constId)

        const predId = `predicate.ptp_tier_${index}`
        exprPool.push({
          id: predId,
          sourceRef: `ptp.predicate.${index}`,
          nodeType: 'predicate',
          payload: { id: predId, kind: 'GTE', args: [pnlSeriesId, constId] },
          deps: [pnlSeriesId, constId],
        })
        exprOrder.push(predId)

        const programId = `program_ptp_${fixture.memoryKey}_tier_${index}`
        const reduceActions: Array<{
          kind: 'REDUCE_LONG' | 'REDUCE_SHORT'
          quantity: { mode: 'position_pct'; value: number }
        }> = []
        if (fixture.sideScope === 'long' || fixture.sideScope === 'both') {
          reduceActions.push({
            kind: 'REDUCE_LONG',
            quantity: { mode: 'position_pct', value: tier.derivedRatioPct },
          })
        }
        if (fixture.sideScope === 'short' || fixture.sideScope === 'both') {
          reduceActions.push({
            kind: 'REDUCE_SHORT',
            quantity: { mode: 'position_pct', value: tier.derivedRatioPct },
          })
        }

        decisionPrograms.push({
          id: programId,
          sourceRef: `ptp.program.${index}`,
          phase: 'exit',
          priority: 100 + index,
          when: predId,
          actions: reduceActions as unknown as StrategyAstV1['decisionPrograms'][number]['actions'],
          metadata: {
            partialTakeProfit: {
              memoryKey: fixture.memoryKey,
              tierIndex: index,
              totalTiers: fixture.tiers.length,
            },
          },
        } as unknown as StrategyAstV1['decisionPrograms'][number])
        decisionOrder.push(programId)
      })

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
          warmupBars: 0,
          maxLookback: 0,
          requiredTimeframes: ['1h'],
        },
        runtimeRequirements: {
          helpers: ['position_pnl_pct'],
          stateKeys: [fixture.memoryKey],
        },
        exprPool,
        guards: [],
        decisionPrograms,
        orderPrograms: [],
        topology: {
          exprOrder,
          guardOrder: [],
          decisionOrder,
          orderProgramOrder: [],
        },
      }
    }

    function makeProjection(fixture: PtpFixture): CompiledScriptProjection {
      const ast = makePartialTakeProfitAst(fixture)
      const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope: createExecutionEnvelope() })
      return new CompiledScriptParserService().parse(script)
    }

    /**
     * Drives the projection across bars in two paths and returns both decision sequences.
     *
     * - "backtest" path: persistent ctx mutated in place across bars (matches
     *   BacktestRunnerService loop).
     * - "live signal" path: per-bar fresh ctx with state restored from a
     *   serialised store, mutated, then snapshotted back. Matches the live
     *   workflow where signals are stateless processes reading prior state
     *   from persistence.
     */
    function runDualPaths(
      projection: CompiledScriptProjection,
      bars: readonly BarFixture[],
      positionTrack: readonly PositionFixture[],
    ): { backtest: StrategyDecisionV1[], live: StrategyDecisionV1[] } {
      // Backtest path — single shared ctx, mutated in place
      const backtestCtx: Record<string, unknown> = {
        position: { ...positionTrack[0] },
        currentPrice: bars[0].close,
        baseTimeframeBar: { ...bars[0] },
        bars: [bars[0]],
        semanticRuntimeState: {
          [(projection.runtimeRequirements?.stateKeys?.[0]) ?? '__unused']: {},
        },
        __compiledDecisionState: {
          barIndex: 0,
          lastTriggeredByProgram: {},
          previousPositionQty: 0,
        },
      }
      const backtestDecisions: StrategyDecisionV1[] = []
      for (let i = 0; i < bars.length; i++) {
        const pos = positionTrack[i]
        backtestCtx.position = { ...pos }
        backtestCtx.currentPrice = bars[i].close
        backtestCtx.baseTimeframeBar = { ...bars[i] }
        backtestCtx.bars = bars.slice(0, i + 1)
        ;(backtestCtx.__compiledDecisionState as { barIndex: number }).barIndex = i
        backtestDecisions.push(executeProjection(projection, backtestCtx as unknown as StrategyExecutionContextV1))
      }

      // Live signal path — fresh ctx each bar, state restored from a store
      const liveDecisions: StrategyDecisionV1[] = []
      const semanticStore: Record<string, Record<string, unknown>> = {
        [(projection.runtimeRequirements?.stateKeys?.[0]) ?? '__unused']: {},
      }
      let compiledStore: { barIndex: number, lastTriggeredByProgram: Record<string, number>, previousPositionQty: number } = {
        barIndex: 0,
        lastTriggeredByProgram: {},
        previousPositionQty: 0,
      }
      for (let i = 0; i < bars.length; i++) {
        const pos = positionTrack[i]
        const semanticSnapshot: Record<string, Record<string, unknown>> = {}
        for (const key of Object.keys(semanticStore)) {
          semanticSnapshot[key] = { ...semanticStore[key] }
        }
        const liveCtx: Record<string, unknown> = {
          position: { ...pos },
          currentPrice: bars[i].close,
          baseTimeframeBar: { ...bars[i] },
          bars: bars.slice(0, i + 1),
          semanticRuntimeState: semanticSnapshot,
          __compiledDecisionState: {
            barIndex: i,
            lastTriggeredByProgram: { ...compiledStore.lastTriggeredByProgram },
            previousPositionQty: compiledStore.previousPositionQty,
          },
        }
        liveDecisions.push(executeProjection(projection, liveCtx as unknown as StrategyExecutionContextV1))
        // snapshot state back into store
        const writtenSemantic = liveCtx.semanticRuntimeState as Record<string, Record<string, unknown>>
        for (const key of Object.keys(writtenSemantic)) {
          semanticStore[key] = { ...writtenSemantic[key] }
        }
        const writtenCompiled = liveCtx.__compiledDecisionState as typeof compiledStore
        compiledStore = {
          barIndex: writtenCompiled.barIndex,
          lastTriggeredByProgram: { ...writtenCompiled.lastTriggeredByProgram },
          previousPositionQty: writtenCompiled.previousPositionQty,
        }
      }

      return { backtest: backtestDecisions, live: liveDecisions }
    }

    function staticPosition(qty: number, avgEntryPrice: number, count: number): PositionFixture[] {
      return Array.from({ length: count }, () => ({ qty, avgEntryPrice }))
    }

    function makeBars(closes: readonly number[]): BarFixture[] {
      return closes.map((close, idx) => ({
        open: idx === 0 ? close : closes[idx - 1],
        high: Math.max(close, idx === 0 ? close : closes[idx - 1]),
        low: Math.min(close, idx === 0 ? close : closes[idx - 1]),
        close,
        volume: 1,
        timestamp: idx * 60_000,
      }))
    }

    it('case 1: 单档 50% 在阈值 bar 触发后停止', () => {
      const projection = makeProjection({
        memoryKey: 'partial_tp_p1',
        tiers: [{ threshold: 5, derivedRatioPct: 50 }],
        sideScope: 'long',
      })
      const bars = makeBars([100, 103, 106, 108])
      const positions = staticPosition(1, 100, bars.length)
      const { backtest, live } = runDualPaths(projection, bars, positions)

      expect(backtest).toEqual(live)
      expect(backtest[0]).toMatchObject({ action: 'NOOP' })
      expect(backtest[1]).toMatchObject({ action: 'NOOP' })
      expect(backtest[2]).toMatchObject({ action: 'ADJUST_POSITION' })
      expect(backtest[3]).toMatchObject({ action: 'NOOP' })
    })

    it('case 2: 双档 50/50 在两 bar 跨阈值各 fire 一次', () => {
      // derivedRatio: tier0 = 0.5/1 = 0.5 → 50%, tier1 = 0.5/0.5 = 1.0 → 100%
      const projection = makeProjection({
        memoryKey: 'partial_tp_p2',
        tiers: [
          { threshold: 5, derivedRatioPct: 50 },
          { threshold: 10, derivedRatioPct: 100 },
        ],
        sideScope: 'long',
      })
      const bars = makeBars([100, 106, 108, 112])
      const positions = staticPosition(1, 100, bars.length)
      const { backtest, live } = runDualPaths(projection, bars, positions)

      expect(backtest).toEqual(live)
      expect(backtest[0]).toMatchObject({ action: 'NOOP' })
      expect(backtest[1]).toMatchObject({ action: 'ADJUST_POSITION' })
      expect(backtest[2]).toMatchObject({ action: 'NOOP' })
      expect(backtest[3]).toMatchObject({ action: 'ADJUST_POSITION' })
    })

    it('case 3: 双档 sum<1 [{0.3, 0.5}] 终态保留 20%', () => {
      // derivedRatio: tier0 = 0.3/1 = 0.3 → 30%, tier1 = 0.5/0.7 ≈ 71.4286%
      const tier1Ratio = (0.5 / 0.7) * 100
      const projection = makeProjection({
        memoryKey: 'partial_tp_p3',
        tiers: [
          { threshold: 5, derivedRatioPct: 30 },
          { threshold: 10, derivedRatioPct: tier1Ratio },
        ],
        sideScope: 'long',
      })
      const bars = makeBars([100, 106, 112])
      // Position track simulates the runner reducing qty after each fire.
      // After tier 0 fires at bar 1: qty 1 → 0.7 (reduced by 30%).
      // After tier 1 fires at bar 2: qty 0.7 → 0.7 × (1 - 5/7) = 0.2.
      const positions: PositionFixture[] = [
        { qty: 1, avgEntryPrice: 100 },
        { qty: 1, avgEntryPrice: 100 },
        { qty: 0.7, avgEntryPrice: 100 },
      ]
      const { backtest, live } = runDualPaths(projection, bars, positions)

      expect(backtest).toEqual(live)
      expect(backtest[0]).toMatchObject({ action: 'NOOP' })
      expect(backtest[1]).toMatchObject({ action: 'ADJUST_POSITION' })
      expect(backtest[2]).toMatchObject({ action: 'ADJUST_POSITION' })

      // Verify the cumulative reduction lands at ~20% kept.
      const tier0Delta = (backtest[1].size?.value ?? 0) // negative qty
      const tier1Delta = (backtest[2].size?.value ?? 0)
      // tier 0: -1 × 0.3 = -0.3 (reduces qty 1 → 0.7)
      // tier 1: -0.7 × (5/7) = -0.5 (reduces qty 0.7 → 0.2)
      expect(tier0Delta).toBeCloseTo(-0.3, 6)
      expect(tier1Delta).toBeCloseTo(-0.5, 6)
      expect(1 + tier0Delta + tier1Delta).toBeCloseTo(0.2, 6)
    })

    it('case 4: PnL 反复 5%→7%→4%→8% T1 仅 fire 一次', () => {
      const projection = makeProjection({
        memoryKey: 'partial_tp_p4',
        tiers: [{ threshold: 5, derivedRatioPct: 50 }],
        sideScope: 'long',
      })
      const bars = makeBars([105, 107, 104, 108])
      const positions = staticPosition(1, 100, bars.length)
      const { backtest, live } = runDualPaths(projection, bars, positions)

      expect(backtest).toEqual(live)
      expect(backtest[0]).toMatchObject({ action: 'ADJUST_POSITION' })
      expect(backtest[1]).toMatchObject({ action: 'NOOP' })
      expect(backtest[2]).toMatchObject({ action: 'NOOP' })
      expect(backtest[3]).toMatchObject({ action: 'NOOP' })
    })

    it('case 5: close + reopen 同 tier 重新可 fire', () => {
      const projection = makeProjection({
        memoryKey: 'partial_tp_p5',
        tiers: [{ threshold: 5, derivedRatioPct: 50 }],
        sideScope: 'long',
      })
      // Bars: open at 100, fire at 106 (PnL=6%), close (qty=0), reopen at 100, fire again at 106.
      const bars = makeBars([100, 106, 106, 100, 106])
      const positions: PositionFixture[] = [
        { qty: 1, avgEntryPrice: 100 }, // bar 0: open
        { qty: 1, avgEntryPrice: 100 }, // bar 1: T1 fires
        { qty: 0, avgEntryPrice: 0 }, // bar 2: position closed externally
        { qty: 1, avgEntryPrice: 100 }, // bar 3: re-opened (entry edge)
        { qty: 1, avgEntryPrice: 100 }, // bar 4: T1 fires again
      ]
      const { backtest, live } = runDualPaths(projection, bars, positions)

      expect(backtest).toEqual(live)
      expect(backtest[0]).toMatchObject({ action: 'NOOP' })
      expect(backtest[1]).toMatchObject({ action: 'ADJUST_POSITION' })
      expect(backtest[2]).toMatchObject({ action: 'NOOP' })
      expect(backtest[3]).toMatchObject({ action: 'NOOP' })
      // After entry edge reset, T1 must be eligible again.
      expect(backtest[4]).toMatchObject({ action: 'ADJUST_POSITION' })
    })

    it('case 6: sideScope=long short 持仓时不触发减仓', () => {
      const projection = makeProjection({
        memoryKey: 'partial_tp_p6',
        tiers: [{ threshold: 5, derivedRatioPct: 50 }],
        sideScope: 'long',
      })
      // Short: qty=-1, avgEntryPrice=100. Bar close 94 → short PnL = (100-94)/100 = 6% > 5%.
      // Predicate fires but action=REDUCE_LONG; runtime resolveReduceDeltaQty returns 0 for currentQty<0 → NOOP.
      const bars = makeBars([100, 96, 94, 92])
      const positions = staticPosition(-1, 100, bars.length)
      const { backtest, live } = runDualPaths(projection, bars, positions)

      expect(backtest).toEqual(live)
      expect(backtest.every(d => d.action === 'NOOP')).toBe(true)
    })
  })

  it('executes emitted ATR risk predicates before decision programs', () => {
    const ast = createAtrRiskAst()
    const emitter = new CompiledScriptEmitterService()
    const script = emitter.emit({ ast, executionEnvelope: createExecutionEnvelope() })
    const projection = new CompiledScriptParserService().parse(script)

    const decision = executeProjection(projection, {
      position: { qty: 1, avgEntryPrice: 100 },
      currentPrice: 75,
      bars: Array.from({ length: 16 }, (_, index) => ({
        open: 100,
        high: 105,
        low: 95,
        close: index === 15 ? 75 : 100,
        volume: 1,
        timestamp: index + 1,
      })),
      __compiledDecisionState: { barIndex: 16, lastTriggeredByProgram: {} },
    })

    expect(script).toContain('evaluateRiskPredicates')
    expect(decision).toEqual(expect.objectContaining({
      action: 'CLOSE_LONG',
      reason: 'compiled.force_exit',
      meta: expect.objectContaining({
        guardState: expect.objectContaining({
          forceExit: true,
          triggered: ['risk_predicate_01_atr_stop'],
        }),
      }),
    }))
  })
})
