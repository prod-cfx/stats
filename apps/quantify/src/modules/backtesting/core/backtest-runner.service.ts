import type { MultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import type {
  BacktestExecutionPolicy,
  BacktestReasonSource,
  BacktestReport,
  BacktestRunInput,
  Bar,
  Fill,
  SignalIntent,
  StrategyContext,
  Timeframe,
} from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { buildMultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable, HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { normalizeExactCode, toSymbolCode } from '@/modules/market-data/utils/market-symbol-code.util'
import {
  buildSemanticRuntimeState,
  ensureSemanticRuntimeStateKeys,
  readAtomicRuntimeRequirementsFromSnapshot,
} from '@/modules/strategy-runtime/semantic-runtime-state.util'
import { buildRuntimeMarketContext } from '@/modules/strategy-runtime/runtime-context-assembler'
import { readEventStreamsFromExprPool } from '@/modules/strategy-runtime/runtime-data-plan.resolver'
import { strategyDecisionToDeltaQty, validateStrategyDecision } from '@/modules/strategy-runtime/strategy-protocol.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TheoreticalExecutionModel } from '../execution/theoretical-execution.model'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PortfolioLedgerServiceFactory } from '../portfolio/portfolio-ledger.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestReporterService } from '../report/backtest-reporter.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { RiskEvaluatorService } from '../risk/risk-evaluator.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StateEngineService } from '../state/state-engine.service'

interface ScriptRuntimeBar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

interface HistorySeries {
  rawBars: Bar[]
  scriptBars: ScriptRuntimeBar[]
}

interface PendingOrder {
  deltaQty: number
  reason?: string
  reasonSource: BacktestReasonSource
}

interface CompiledDecisionRuntimeState {
  barIndex: number
  lastTriggeredByProgram: Record<string, number>
}

interface PositionRuntimeState {
  side: 'LONG' | 'SHORT'
  entryTimeframe: Timeframe
  barsHeld: number
  highestPriceSinceEntry: number
  lowestPriceSinceEntry: number
}

interface CompiledWorkingOrderProgram {
  id: string
  sourceRef: string
  payload?: Record<string, unknown>
  levels?: readonly number[]
}

interface CompiledOrderProgramRuntimeOrder {
  levelIndex: number
  price: number
  side: 'BUY' | 'SELL'
  qty: number
  role: 'spot_buy' | 'spot_sell' | 'perp_buy' | 'perp_sell'
}

interface CompiledOrderProgramRuntimeState {
  signature: string
  levels: readonly number[]
  recycleOnFill: boolean
  orders: CompiledOrderProgramRuntimeOrder[]
}

interface RebalanceRuntimeState {
  lastRebalancedDayBySymbol: Map<string, string>
}

interface AccountRiskRuntimeState {
  peakEquity: number
  dayKey: string | null
  dayStartEquity: number
}

interface AccountRiskMetrics {
  accountDrawdownPct: number
  accountDailyLossPct: number
}

function readRequiredTimeframesFromUnknown(source: unknown): string[] | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null
  const record = source as Record<string, unknown>
  // 直接命中 dataRequirements.requiredTimeframes 或对象本身就是 dataRequirements
  if (Array.isArray(record.requiredTimeframes)) {
    return record.requiredTimeframes.filter((tf): tf is string => typeof tf === 'string' && tf.length > 0)
  }
  const dataReq = record.dataRequirements
  if (dataReq && typeof dataReq === 'object' && !Array.isArray(dataReq)) {
    const nested = (dataReq as Record<string, unknown>).requiredTimeframes
    if (Array.isArray(nested)) {
      return nested.filter((tf): tf is string => typeof tf === 'string' && tf.length > 0)
    }
  }
  return null
}

function readTimeframesFromDataRequirements(source: unknown): Timeframe[] {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return []
  const record = source as Record<string, unknown>
  const requiredTimeframes = readRequiredTimeframesFromUnknown(record)
  const values = Object.entries(record)
    .filter(([key]) => key !== 'requiredTimeframes')
    .flatMap(([, value]) => Array.isArray(value) ? value : [])
  return [...(requiredTimeframes ?? []), ...values]
    .filter((timeframe): timeframe is Timeframe => typeof timeframe === 'string' && timeframe.length > 0)
}

function buildRuntimeSymbolSet(input: BacktestRunInput): Set<string> {
  const marketType = typeof input.strategy?.params?.marketType === 'string'
    ? input.strategy.params.marketType.trim().toLowerCase()
    : ''

  return new Set(
    input.symbols.flatMap((symbol) => {
      const exact = normalizeExactCode(symbol)
      const raw = exact.split(':')[0] ?? exact
      const variants = new Set<string>([exact])

      if (exact.includes(':')) {
        if (exact.endsWith(':SPOT')) {
          variants.add(raw)
        }
      }
      else {
        variants.add(raw)
        if (marketType === 'perp' || marketType === 'perpetual' || marketType === 'future') {
          variants.add(toSymbolCode(raw, 'PERP'))
        }
        else if (marketType === 'spot') {
          variants.add(toSymbolCode(raw, 'SPOT'))
        }
      }

      return [...variants]
    }),
  )
}

@Injectable()
export class BacktestRunnerService {
  constructor(
    private readonly executionModel: TheoreticalExecutionModel,
    private readonly ledgerFactory: PortfolioLedgerServiceFactory,
    private readonly reporterService: BacktestReporterService,
    private readonly stateEngine: StateEngineService,
    private readonly riskEvaluator: RiskEvaluatorService,
  ) {}

  async run(input: BacktestRunInput): Promise<BacktestReport> {
    const ledger = this.ledgerFactory.create(input.initialCash)
    const reporter = this.reporterService.create()
    const symbolSet = buildRuntimeSymbolSet(input)
    const diagnostics = {
      compiledRulesCount: this.countCompiledRules(input.strategy.specSnapshot),
      signalTriggerCount: 0,
      fillCount: 0,
      dataRequirementMissingCount: 0,
      eventStreamMissingCount: 0,
    }
    diagnostics.eventStreamMissingCount = this.resolveMissingEventStreamCount(input)
    if (diagnostics.eventStreamMissingCount > 0) {
      const report = reporter.toReport(input.initialCash)
      return {
        ...report,
        summary: {
          ...report.summary,
          totalOpenTrades: 0,
          openPnl: 0,
          diagnosticReason: 'BACKTEST_EVENT_STREAM_UNAVAILABLE',
        },
        diagnostics,
        openPositions: [],
        pendingSignals: [],
      }
    }
    const requestedRuntimeTimeframes = this.resolveRequestedRuntimeTimeframes(input)
    const availableRuntimeKeys = new Set<string>()

    const baseBars = input.bars
      .filter(bar =>
        bar.timeframe === input.baseTimeframe
        && (symbolSet.size === 0 || symbolSet.has(bar.symbol))
        && bar.closeTime >= input.dataRange.fromTs
        && bar.closeTime <= input.dataRange.toTs,
      )
      .sort((a, b) => a.closeTime - b.closeTime)

    const stateBars = input.bars
      .filter(bar =>
        requestedRuntimeTimeframes.includes(bar.timeframe)
        && (symbolSet.size === 0 || symbolSet.has(bar.symbol))
        && bar.closeTime <= input.dataRange.toTs,
      )
      .sort((a, b) => a.closeTime - b.closeTime)

    let stateCursor = 0
    const historyBarsBySymbolTimeframe = new Map<string, HistorySeries>()
    const pendingOrdersBySymbol = new Map<string, PendingOrder>()
    const compiledDecisionStateBySymbol = new Map<string, CompiledDecisionRuntimeState>()
    const semanticRuntimeStateBySymbol = new Map<string, StrategyContext['semanticRuntimeState']>()
    const runtimeRequirements = readAtomicRuntimeRequirementsFromSnapshot(input.strategy)
    const positionRuntimeStateBySymbol = new Map<string, PositionRuntimeState>()
    const orderProgramStatesBySymbol = new Map<string, Map<string, CompiledOrderProgramRuntimeState>>()
    const rebalanceRuntimeState: RebalanceRuntimeState = { lastRebalancedDayBySymbol: new Map() }
    const accountRiskRuntimeState: AccountRiskRuntimeState = {
      peakEquity: input.initialCash,
      dayKey: null,
      dayStartEquity: input.initialCash,
    }
    const strictSnapshotPath = this.isStrictSnapshotPath(input.strategy)
    const executionPolicy = this.resolveExecutionPolicy(input.strategy.executionPolicy, strictSnapshotPath)
    const requiredHtfTimeframes = this.resolveRequiredHtfTimeframes(input)
    const runtimeHistoryLimit = this.resolveRuntimeHistoryLimit(input.strategy)

    for (const bar of baseBars) {
      while (stateCursor < stateBars.length && stateBars[stateCursor].closeTime <= bar.closeTime) {
        const sBar = stateBars[stateCursor]
        this.appendHistoryBar(historyBarsBySymbolTimeframe, sBar)
        this.stateEngine.upsert({
          symbol: sBar.symbol,
          timeframe: sBar.timeframe,
          ts: sBar.closeTime,
          values: {
            close: sBar.close,
            open: sBar.open,
            high: sBar.high,
            low: sBar.low,
            volume: sBar.volume,
          },
        })
        stateCursor += 1
      }
      if (!requestedRuntimeTimeframes.includes(input.baseTimeframe)) {
        this.appendHistoryBar(historyBarsBySymbolTimeframe, bar)
      }

      const pending = pendingOrdersBySymbol.get(bar.symbol)
      if (pending && pending.deltaQty !== 0) {
        pendingOrdersBySymbol.delete(bar.symbol)
        this.applyDeltaOrder({
          input,
          bar,
          ledger,
          reporter,
          deltaQty: pending.deltaQty,
          reason: pending.reason,
          reasonSource: pending.reasonSource,
          forcedPriceSource: 'open',
        })
      }

      ledger.markToMarket({ [bar.symbol]: bar.close })
      const snapshot = ledger.snapshot()
      const accountRiskMetrics = this.resolveAccountRiskMetrics(accountRiskRuntimeState, snapshot.equity, bar.closeTime)
      const position = ledger.getPosition(bar.symbol)
      const compiledDecisionState = this.bumpCompiledDecisionState(compiledDecisionStateBySymbol, bar.symbol)
      const positionRuntimeState = this.syncPositionRuntimeState(positionRuntimeStateBySymbol, position, bar)
      const semanticRuntimeState = this.resolveSemanticRuntimeState(
        semanticRuntimeStateBySymbol,
        bar.symbol,
        runtimeRequirements?.stateKeys ?? [],
      )
      const htfState = this.stateEngine.getLatestByTimeframes(bar.symbol, requestedRuntimeTimeframes)
      const strategyContext = this.buildScriptContext({
        bar,
        input,
        htfState,
        historyBarsBySymbolTimeframe,
        compiledDecisionState,
        portfolio: {
          cash: snapshot.cash,
          equity: snapshot.equity,
          usedMargin: snapshot.usedMargin,
          realizedPnl: snapshot.realizedPnl,
        },
        accountRiskMetrics,
        position,
        positionRuntimeState,
        semanticRuntimeState,
        requestedTimeframes: requestedRuntimeTimeframes,
        runtimeHistoryLimit,
      })
      this.collectAvailableRuntimeTimeframes(strategyContext)
        .forEach(timeframe => availableRuntimeKeys.add(this.buildRuntimeRequirementKey(bar.symbol, timeframe)))
      const htfAligned = BacktestRunnerService.isHtfAligned(
        this.stateEngine,
        bar.symbol,
        requiredHtfTimeframes,
        bar.closeTime,
      )
      // Entry-phase HTF alignment guard (#1016):
      // 当所需 HTF 尚未对齐 (closed snapshot.ts <= baseBar.closeTime)，
      // 跳过新仓信号产生，但保持已开仓的 exit/adjust 流程与 risk 评估不受影响。
      const skipStrategyForEntry = !htfAligned && position.qty === 0
      const intent: SignalIntent = skipStrategyForEntry
        ? { type: 'NOOP', reason: 'htf_not_aligned' }
        : await input.strategy.fn({
          ...strategyContext,
        })
      const isObjectIntent = intent != null && typeof intent === 'object'
      const intentRecord = intent as { type?: unknown; action?: unknown }
      const hasOrderSignal = isObjectIntent && this.hasCompiledOrderSignal(intent)
      this.applyCompiledOrderProgramFills({
        intent,
        input,
        bar,
        ledger,
        reporter,
        programStatesBySymbol: orderProgramStatesBySymbol,
        equity: snapshot.equity,
      })
      ledger.markToMarket({ [bar.symbol]: bar.close })
      const postOrderProgramSnapshot = ledger.snapshot()
      const postOrderProgramPosition = ledger.getPosition(bar.symbol)

      const normalized = this.normalizeIntent(intent, {
        currentQty: postOrderProgramPosition.qty,
        equity: postOrderProgramSnapshot.equity,
        markPrice: this.getMarkPrice(bar, input.execution.priceSource),
      }, strictSnapshotPath)
      const adjustedDelta = this.applyLeverageCap({
        leverage: this.resolveEffectiveLeverage(input),
        price: this.getMarkPrice(bar, input.execution.priceSource),
        currentQty: postOrderProgramPosition.qty,
        requestedDelta: normalized,
        equity: postOrderProgramSnapshot.equity,
      })
      const strategyReason = this.extractIntentReason(intent)
      const strategyOrder: PendingOrder = {
        deltaQty: adjustedDelta,
        reason: strategyReason,
        reasonSource: 'strategy',
      }
      const rebalanceOrder = strategyOrder.deltaQty === 0
        ? this.resolveRebalanceOrder({
            input,
            bar,
            currentQty: postOrderProgramPosition.qty,
            equity: postOrderProgramSnapshot.equity,
            markPrice: this.getMarkPrice(bar, input.execution.priceSource),
            state: rebalanceRuntimeState,
          })
        : undefined

      const riskDecision = this.riskEvaluator.evaluate({
        symbol: bar.symbol,
        bar,
        historyBars: this.getHistoryBars(historyBarsBySymbolTimeframe, bar.symbol, input.baseTimeframe),
        position: postOrderProgramPosition,
        riskRules: input.strategy.riskRules,
      })

      const riskOrder: PendingOrder | undefined = riskDecision
        ? {
          deltaQty: riskDecision.targetQty - postOrderProgramPosition.qty,
          reason: riskDecision.reason,
          reasonSource: riskDecision.source,
        }
        : undefined
      const selectedOrder = riskOrder && riskOrder.deltaQty !== 0
        ? riskOrder
        : strategyOrder.deltaQty !== 0
          ? strategyOrder
          : rebalanceOrder ?? strategyOrder

      if (selectedOrder.deltaQty !== 0) {
        if (selectedOrder.reasonSource === 'system' || (selectedOrder.reasonSource === 'strategy' && isObjectIntent)) {
          diagnostics.signalTriggerCount += 1
        }
        if (executionPolicy.fillTiming === 'NEXT_BAR_OPEN') {
          pendingOrdersBySymbol.set(bar.symbol, selectedOrder)
        } else {
          this.applyDeltaOrder({
            input,
            bar,
            ledger,
            reporter,
            deltaQty: selectedOrder.deltaQty,
            reason: selectedOrder.reason,
            reasonSource: selectedOrder.reasonSource,
          })
        }
      }
      else if (hasOrderSignal) {
        diagnostics.signalTriggerCount += 1
      }

      ledger.markToMarket({ [bar.symbol]: bar.close })
      reporter.pushEquity(bar.closeTime, ledger.snapshot().equity)
    }

    const pendingSignals = this.finalizePendingSignals({
      pendingOrdersBySymbol,
      executionPolicy,
      baseBars,
    })
    const report = reporter.toReport(input.initialCash)
    const snapshot = ledger.snapshot()
    const openPositions = Object.values(snapshot.positions).map(pos => ({
      symbol: pos.symbol,
      qty: pos.qty,
      avgEntryPrice: pos.avgEntryPrice,
      unrealizedPnl: pos.unrealizedPnl,
      ...(pos.entryTimeframe ? { entryTimeframe: pos.entryTimeframe } : {}),
    }))
    const openPnl = openPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0)
    // fillCount 表示有效成交数；未平仓开仓也算成交，避免开仓型策略被误报 no-fill。
    diagnostics.fillCount = report.trades.length + openPositions.length
    const requiredRuntimeKeys = this.resolveRequiredRuntimeKeys(baseBars, requestedRuntimeTimeframes, input.symbols)
    diagnostics.dataRequirementMissingCount = requiredRuntimeKeys
      .filter(key => !availableRuntimeKeys.has(key))
      .length
    diagnostics.eventStreamMissingCount = this.resolveMissingEventStreamCount(input)
    const diagnosticReason = this.resolveDiagnosticReason(report, diagnostics, openPositions.length)

    this.stateEngine.reset()
    this.riskEvaluator.reset()

    return {
      ...report,
      summary: {
        ...report.summary,
        totalOpenTrades: openPositions.length,
        openPnl,
        ...(diagnosticReason ? { diagnosticReason } : {}),
      },
      diagnostics,
      openPositions,
      pendingSignals,
    }
  }

  private collectAvailableRuntimeTimeframes(context: unknown): Timeframe[] {
    if (!context || typeof context !== 'object') return []
    const data = (context as { data?: unknown }).data
    if (!data || typeof data !== 'object') return []
    const primary = (data as { primary?: unknown }).primary
    if (!primary || typeof primary !== 'object') return []
    return Object.entries(primary as Record<string, unknown>)
      .filter(([, value]) => {
        if (!value || typeof value !== 'object') return false
        const bars = (value as { bars?: unknown }).bars
        return Array.isArray(bars) && bars.length > 0
      })
      .map(([timeframe]) => timeframe as Timeframe)
  }

  private resolveRequestedRuntimeTimeframes(input: BacktestRunInput): Timeframe[] {
    return Array.from(new Set<Timeframe>([
      input.baseTimeframe,
      ...input.stateTimeframes,
      ...readTimeframesFromDataRequirements(input.strategy.dataRequirements),
    ]))
  }

  private resolveRequiredRuntimeKeys(
    baseBars: readonly Bar[],
    requiredTimeframes: readonly Timeframe[],
    requestedSymbols: readonly string[] = [],
  ): string[] {
    const symbols = Array.from(new Set(
      baseBars.length > 0
        ? baseBars.map(bar => bar.symbol)
        : requestedSymbols,
    ))
    return symbols.flatMap(symbol => requiredTimeframes.map(timeframe => (
      this.buildRuntimeRequirementKey(symbol, timeframe)
    )))
  }

  private buildRuntimeRequirementKey(symbol: string, timeframe: Timeframe): string {
    return `${symbol}:${timeframe}`
  }

  private resolveDiagnosticReason(
    report: BacktestReport,
    diagnostics: BacktestReport['diagnostics'],
    totalOpenTrades: number,
  ): BacktestReport['summary']['diagnosticReason'] | undefined {
    if (report.summary.totalTrades > 0) return undefined
    if (totalOpenTrades > 0) return undefined
    if (diagnostics.compiledRulesCount === 0) return 'BACKTEST_NO_RULES_COMPILED'
    if (diagnostics.dataRequirementMissingCount > 0) return 'BACKTEST_DATA_REQUIREMENT_UNAVAILABLE'
    if (diagnostics.eventStreamMissingCount > 0) return 'BACKTEST_EVENT_STREAM_UNAVAILABLE'
    if (diagnostics.signalTriggerCount === 0) return 'BACKTEST_NO_SIGNAL_FIRED_IN_RANGE'
    if (diagnostics.fillCount === 0) return 'BACKTEST_SIGNAL_FIRED_BUT_NO_FILL'
    return undefined
  }

  private resolveMissingEventStreamCount(input: BacktestRunInput): number {
    const requiredEventStreams = this.resolveRequiredEventStreams(input.strategy)
    if (requiredEventStreams.length === 0) return 0

    const suppliedStreams = input.eventStreams ?? {}
    return requiredEventStreams.filter((stream) => {
      const events = suppliedStreams[stream.sourceFeedId]
      if (!Array.isArray(events)) return true
      return events.length < this.resolveRequiredEventStreamMinimum(stream.schemaRef)
    }).length
  }

  private resolveRequiredEventStreamMinimum(schemaRef: string): number {
    if (schemaRef === 'open_interest') return 2
    return 1
  }

  private resolveRebalanceOrder(input: {
    input: BacktestRunInput
    bar: Bar
    currentQty: number
    equity: number
    markPrice: number
    state: RebalanceRuntimeState
  }): PendingOrder | undefined {
    if (!this.hasRebalanceProgram(input.input.strategy)) return undefined
    if (input.markPrice <= 0 || input.equity <= 0) return undefined

    const rebalanceDay = new Date(input.bar.closeTime).toISOString().slice(0, 10)
    const stateKey = `${input.bar.symbol}:${rebalanceDay}`
    if (input.state.lastRebalancedDayBySymbol.get(input.bar.symbol) === stateKey) return undefined
    input.state.lastRebalancedDayBySymbol.set(input.bar.symbol, stateKey)

    const targetSymbols = Array.from(new Set(input.input.symbols.map(symbol => normalizeExactCode(symbol).split(':')[0] ?? symbol)))
    const symbolKey = normalizeExactCode(input.bar.symbol).split(':')[0] ?? input.bar.symbol
    const symbolCount = Math.max(1, targetSymbols.length)
    if (!targetSymbols.includes(symbolKey)) return undefined

    const targetQty = (input.equity / symbolCount) / input.markPrice
    const deltaQty = targetQty - input.currentQty
    if (Math.abs(deltaQty) < 1e-12) return undefined

    return {
      deltaQty,
      reason: 'program.rebalance.equal_weight_daily',
      reasonSource: 'system',
    }
  }

  private hasRebalanceProgram(strategy: BacktestRunInput['strategy']): boolean {
    const candidates = [strategy.specSnapshot, strategy.irSnapshot, strategy.astSnapshot]
    return candidates.some(candidate => this.hasRebalanceProgramInSnapshot(candidate))
  }

  private hasRebalanceProgramInSnapshot(snapshot: unknown): boolean {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false
    const orchestration = (snapshot as { orchestration?: unknown }).orchestration
    if (!orchestration || typeof orchestration !== 'object' || Array.isArray(orchestration)) return false
    const programs = (orchestration as { programs?: unknown }).programs
    const orchestrationPrograms = (snapshot as { orchestrationPrograms?: unknown }).orchestrationPrograms
    return [programs, orchestrationPrograms].some(candidate => Array.isArray(candidate)
      && candidate.some(program => (
        program
        && typeof program === 'object'
        && !Array.isArray(program)
        && (program as { programKind?: unknown }).programKind === 'rebalance'
      )))
  }

  private resolveRequiredEventStreams(strategy: BacktestRunInput['strategy']): ReturnType<typeof readEventStreamsFromExprPool> {
    const candidates = [
      this.readRecord(strategy.astSnapshot),
      this.readRecord(strategy.astSnapshot)?.exprPool,
      this.readRecord(strategy.irSnapshot),
      this.readRecord(strategy.irSnapshot)?.exprPool,
      this.readRecord(strategy.specSnapshot),
      this.readRecord(strategy.specSnapshot)?.exprPool,
    ]
    const streams = candidates.flatMap(candidate => readEventStreamsFromExprPool(candidate))
    const byFeedId = new Map<string, (typeof streams)[number]>()
    streams.forEach((stream) => {
      if (!byFeedId.has(stream.sourceFeedId)) byFeedId.set(stream.sourceFeedId, stream)
    })
    return [...byFeedId.values()]
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private countCompiledRules(specSnapshot: BacktestRunInput['strategy']['specSnapshot']): number {
    if (!specSnapshot || typeof specSnapshot !== 'object') return 0
    const record = specSnapshot as { rules?: unknown; orderPrograms?: unknown; orchestration?: unknown }
    const rulesCount = Array.isArray(record.rules) ? record.rules.length : 0
    const orderProgramsCount = Array.isArray(record.orderPrograms) ? record.orderPrograms.length : 0
    const orchestration = record.orchestration
    const orchestrationPrograms = orchestration && typeof orchestration === 'object' && !Array.isArray(orchestration)
      ? (orchestration as { programs?: unknown }).programs
      : undefined
    const orchestrationProgramsCount = Array.isArray(orchestrationPrograms) ? orchestrationPrograms.length : 0
    return rulesCount + orderProgramsCount + orchestrationProgramsCount
  }

  private applyDeltaOrder(input: {
    input: BacktestRunInput
    bar: Bar
    ledger: ReturnType<PortfolioLedgerServiceFactory['create']>
    reporter: ReturnType<BacktestReporterService['create']>
    deltaQty: number
    reason?: string
    reasonSource: BacktestReasonSource
    forcedPriceSource?: BacktestRunInput['execution']['priceSource']
    limitPrice?: number
  }) {
    if (input.deltaQty === 0) return

    const side: 'BUY' | 'SELL' = input.deltaQty > 0 ? 'BUY' : 'SELL'
    const fill = typeof input.limitPrice === 'number'
      ? this.buildLimitFill({
          bar: input.bar,
          side,
          qty: Math.abs(input.deltaQty),
          price: input.limitPrice,
          execution: input.input.execution,
          reason: input.reason,
        })
      : this.executionModel.fill(
          input.bar,
          side,
          Math.abs(input.deltaQty),
          {
            ...input.input.execution,
            priceSource: input.forcedPriceSource ?? input.input.execution.priceSource,
          },
          input.reason,
        )
    const events = input.ledger.applyFill(fill)

    events.forEach((event) => {
      if (event.type === 'OPEN') {
        input.reporter.onTradeOpen({
          symbol: event.symbol,
          ts: event.ts,
          price: event.price,
          side: event.side,
          qty: event.qty,
          fee: event.fee,
          reason: input.reason,
          reasonSource: input.reasonSource,
          ...(event.entryTimeframe ? { entryTimeframe: event.entryTimeframe } : {}),
        })
        return
      }

      input.reporter.onTradeClose({
        symbol: event.symbol,
        ts: event.ts,
        price: event.price,
        side: event.side,
        qty: event.qty,
        fee: event.fee,
        pnl: event.pnl ?? 0,
        reason: input.reason,
        reasonSource: input.reasonSource,
      })
    })
  }

  private applyCompiledOrderProgramFills(input: {
    intent: SignalIntent
    input: BacktestRunInput
    bar: Bar
    ledger: ReturnType<PortfolioLedgerServiceFactory['create']>
    reporter: ReturnType<BacktestReporterService['create']>
    programStatesBySymbol: Map<string, Map<string, CompiledOrderProgramRuntimeState>>
    equity: number
  }): void {
    const orderState = this.extractCompiledOrderState(input.intent)
    if (!orderState) return

    const statesByProgram = this.syncCompiledOrderProgramStates({
      bar: input.bar,
      orderState,
      programStatesBySymbol: input.programStatesBySymbol,
      equity: input.equity,
    })
    if (!statesByProgram) return

    for (const [programId, state] of statesByProgram.entries()) {
      const fills = state.orders.filter(order => this.isLimitTouched(input.bar, order))
      for (const order of fills) {
        this.applyDeltaOrder({
          input: input.input,
          bar: input.bar,
          ledger: input.ledger,
          reporter: input.reporter,
          deltaQty: order.side === 'BUY' ? order.qty : -order.qty,
          limitPrice: order.price,
          reason: `order_program:${programId}:${order.role}`,
          reasonSource: 'strategy',
        })
        this.recycleCompiledOrderProgramOrder(state, order)
      }
    }
  }

  private extractCompiledOrderState(intent: SignalIntent): {
    workingOrders: CompiledWorkingOrderProgram[]
    activeProgramIds: string[]
    cancelledProgramIds: string[]
    closeProgramIds: string[]
  } | null {
    if (typeof intent !== 'object' || intent === null) return null
    const meta = (intent as { meta?: unknown }).meta
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
    const orderState = (meta as Record<string, unknown>).orderState
    if (!orderState || typeof orderState !== 'object' || Array.isArray(orderState)) return null
    const record = orderState as Record<string, unknown>
    const workingOrders = Array.isArray(record.workingOrders)
      ? record.workingOrders.filter(this.isCompiledWorkingOrderProgram)
      : []

    return {
      workingOrders,
      activeProgramIds: Array.isArray(record.activeProgramIds)
        ? record.activeProgramIds.filter((id): id is string => typeof id === 'string')
        : [],
      cancelledProgramIds: Array.isArray(record.cancelledProgramIds)
        ? record.cancelledProgramIds.filter((id): id is string => typeof id === 'string')
        : [],
      closeProgramIds: Array.isArray(record.closeProgramIds)
        ? record.closeProgramIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  }

  private hasCompiledOrderSignal(intent: SignalIntent): boolean {
    const orderState = this.extractCompiledOrderState(intent)
    if (!orderState) return false
    return orderState.activeProgramIds.length > 0
      || orderState.workingOrders.length > 0
      || orderState.closeProgramIds.length > 0
  }

  private isCompiledWorkingOrderProgram(value: unknown): value is CompiledWorkingOrderProgram {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.sourceRef === 'string'
  }

  private syncCompiledOrderProgramStates(input: {
    bar: Bar
    orderState: {
      workingOrders: CompiledWorkingOrderProgram[]
      activeProgramIds: string[]
      cancelledProgramIds: string[]
    }
    programStatesBySymbol: Map<string, Map<string, CompiledOrderProgramRuntimeState>>
    equity: number
  }): Map<string, CompiledOrderProgramRuntimeState> | null {
    let statesByProgram = input.programStatesBySymbol.get(input.bar.symbol)
    if (!statesByProgram) {
      statesByProgram = new Map()
      input.programStatesBySymbol.set(input.bar.symbol, statesByProgram)
    }

    input.orderState.cancelledProgramIds.forEach(programId => statesByProgram.delete(programId))
    const workingProgramIds = new Set(input.orderState.workingOrders.map(program => program.id))
    for (const programId of statesByProgram.keys()) {
      if (!workingProgramIds.has(programId) && input.orderState.activeProgramIds.includes(programId) === false) {
        statesByProgram.delete(programId)
      }
    }

    input.orderState.workingOrders.forEach((program) => {
      const signature = this.buildOrderProgramSignature(program)
      if (statesByProgram.get(program.id)?.signature === signature) return
      statesByProgram.set(program.id, {
        signature,
        levels: this.normalizeOrderProgramLevels(program),
        recycleOnFill: program.payload?.recycleOnFill === true,
        orders: this.buildInitialCompiledOrderProgramOrders({
          program,
          currentPrice: input.bar.close,
          equity: input.equity,
        }),
      })
    })

    return statesByProgram
  }

  private buildOrderProgramSignature(program: CompiledWorkingOrderProgram): string {
    const levels = (program.levels ?? []).map(level => Number(level.toFixed(8))).join(',')
    const payload = program.payload ?? {}
    return JSON.stringify({
      sourceRef: program.sourceRef,
      levels,
      quantity: payload.quantity,
      sidePolicy: payload.sidePolicy,
      recycleOnFill: payload.recycleOnFill,
      pairingPolicy: payload.pairingPolicy,
    })
  }

  private buildInitialCompiledOrderProgramOrders(input: {
    program: CompiledWorkingOrderProgram
    currentPrice: number
    equity: number
  }): CompiledOrderProgramRuntimeOrder[] {
    const levels = this.normalizeOrderProgramLevels(input.program)
      const sidePolicy = this.resolveCompiledOrderProgramSidePolicy(input.program)
    const orders: CompiledOrderProgramRuntimeOrder[] = []

    levels.forEach((level, levelIndex) => {
      if (sidePolicy === 'spot_grid' || sidePolicy === 'perp_long') {
        if (level < input.currentPrice) {
          orders.push(this.buildRuntimeLimitOrder(input, levelIndex, level, 'BUY', 'spot_buy'))
        }
        return
      }
      if (sidePolicy === 'perp_short') {
        if (level > input.currentPrice) {
          orders.push(this.buildRuntimeLimitOrder(input, levelIndex, level, 'SELL', 'perp_sell'))
        }
        return
      }
      if (sidePolicy === 'perp_neutral') {
        if (level < input.currentPrice) {
          orders.push(this.buildRuntimeLimitOrder(input, levelIndex, level, 'BUY', 'perp_buy'))
        }
        else if (level > input.currentPrice) {
          orders.push(this.buildRuntimeLimitOrder(input, levelIndex, level, 'SELL', 'perp_sell'))
        }
      }
    })

    return orders
  }

  private buildRuntimeLimitOrder(
    input: {
      program: CompiledWorkingOrderProgram
      currentPrice: number
      equity: number
    },
    levelIndex: number,
    price: number,
    side: 'BUY' | 'SELL',
    role: CompiledOrderProgramRuntimeOrder['role'],
  ): CompiledOrderProgramRuntimeOrder {
    return {
      levelIndex,
      price,
      side,
      qty: this.resolveCompiledOrderProgramQty(this.resolveCompiledOrderProgramQuantity(input.program), price, input.equity),
      role,
    }
  }

  private resolveCompiledOrderProgramSidePolicy(program: CompiledWorkingOrderProgram): string | undefined {
    const explicit = this.readString(program.payload?.sidePolicy)
    if (explicit) return explicit
    return program.sourceRef === 'orchestration:program.fixed_grid_gated' ? 'perp_neutral' : undefined
  }

  private resolveCompiledOrderProgramQuantity(program: CompiledWorkingOrderProgram): unknown {
    if (program.payload?.quantity) return program.payload.quantity
    const sizing = program.payload?.sizing
    if (!sizing || typeof sizing !== 'object' || Array.isArray(sizing)) return undefined
    const record = sizing as Record<string, unknown>
    return {
      ...record,
      mode: record.mode === 'fixed_pct' ? 'pct_equity' : record.mode,
    }
  }

  private resolveCompiledOrderProgramQty(quantity: unknown, price: number, equity: number): number {
    if (!quantity || typeof quantity !== 'object' || Array.isArray(quantity) || price <= 0) return 0
    const record = quantity as Record<string, unknown>
    const value = typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : 0
    if (value <= 0) return 0

    switch (record.mode) {
      case 'fixed_quote':
        return value / price
      case 'fixed_base':
        return value
      case 'pct_equity':
        return (Math.max(0, equity) * value / 100) / price
      default:
        return 0
    }
  }

  private recycleCompiledOrderProgramOrder(
    state: CompiledOrderProgramRuntimeState,
    filledOrder: CompiledOrderProgramRuntimeOrder,
  ): void {
    state.orders = state.orders.filter(order =>
      !(order.levelIndex === filledOrder.levelIndex && order.side === filledOrder.side),
    )
    if (!state.recycleOnFill) return

    const nextIndex = filledOrder.side === 'BUY'
      ? filledOrder.levelIndex + 1
      : filledOrder.levelIndex - 1
    const nextPrice = this.findRuntimeOrderPrice(state, nextIndex)
    if (typeof nextPrice !== 'number') return

    state.orders.push({
      levelIndex: nextIndex,
      price: nextPrice,
      side: filledOrder.side === 'BUY' ? 'SELL' : 'BUY',
      qty: filledOrder.qty,
      role: filledOrder.side === 'BUY' ? 'spot_sell' : 'spot_buy',
    })
  }

  private findRuntimeOrderPrice(
    state: CompiledOrderProgramRuntimeState,
    levelIndex: number,
  ): number | null {
    return state.levels[levelIndex] ?? null
  }

  private normalizeOrderProgramLevels(program: CompiledWorkingOrderProgram): number[] {
    return (program.levels ?? [])
      .filter((level): level is number => Number.isFinite(level) && level > 0)
      .slice()
      .sort((left, right) => left - right)
  }

  private isLimitTouched(bar: Bar, order: CompiledOrderProgramRuntimeOrder): boolean {
    if (order.qty <= 0 || order.price <= 0) return false
    return order.side === 'BUY'
      ? bar.low <= order.price
      : bar.high >= order.price
  }

  private buildLimitFill(input: {
    bar: Bar
    side: 'BUY' | 'SELL'
    qty: number
    price: number
    execution: BacktestRunInput['execution']
    reason?: string
  }): Fill {
    const slip = input.execution.slippageBps / 10000
    const price = input.side === 'BUY'
      ? input.price * (1 + slip)
      : input.price * (1 - slip)
    const notional = Math.abs(price * input.qty)
    return {
      symbol: input.bar.symbol,
      ts: input.bar.closeTime,
      side: input.side,
      qty: input.qty,
      price,
      notional,
      fee: notional * (input.execution.feeBps / 10000),
      reason: input.reason,
      entryTimeframe: input.bar.timeframe,
    }
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  private isStrictSnapshotPath(strategy: BacktestRunInput['strategy']): boolean {
    return strategy.bindingSource === 'PUBLISHED_SNAPSHOT_STRICT'
  }

  private resolveRequiredHtfTimeframes(input: BacktestRunInput): Timeframe[] {
    // 仅在 strategy 显式声明 dataRequirements.requiredTimeframes 时启用 HTF 对齐守卫，
    // 避免破坏未声明 HTF 需求的历史回测行为（Never break userspace）。
    const fromAst = readRequiredTimeframesFromUnknown(input.strategy.astSnapshot)
    const fromDataReq = readRequiredTimeframesFromUnknown(input.strategy.dataRequirements)
    const fromIr = readRequiredTimeframesFromUnknown(input.strategy.irSnapshot)
    const declared = fromAst ?? fromDataReq ?? fromIr
    if (!declared || declared.length === 0) return []
    // base timeframe 不需要走 HTF 对齐守卫（每根 base bar 自身就是当前对齐点）
    return declared.filter((tf): tf is Timeframe => typeof tf === 'string' && tf !== input.baseTimeframe) as Timeframe[]
  }

  /**
   * Issue #1016: 检查所需 HTF 是否在当前 baseBar.closeTime 之前都有 closed snapshot。
   * - 若任一 required HTF 尚未 upsert 任何 snapshot，视为未对齐
   * - 若 latest snapshot.ts > baseBar.closeTime（防御性，不应发生）也视为未对齐
   */
  static isHtfAligned(
    stateEngine: StateEngineService,
    symbol: string,
    requiredTimeframes: readonly Timeframe[],
    baseBarCloseTime: number,
  ): boolean {
    if (requiredTimeframes.length === 0) return true
    for (const timeframe of requiredTimeframes) {
      const snapshot = stateEngine.getLatest(symbol, timeframe)
      if (!snapshot) return false
      if (snapshot.ts > baseBarCloseTime) return false
    }
    return true
  }

  private resolveExecutionPolicy(
    policy: BacktestExecutionPolicy | undefined,
    strictSnapshotPath: boolean,
  ): Required<Pick<BacktestExecutionPolicy, 'signalTiming' | 'fillTiming' | 'noNextBarHandling'>> {
    if (strictSnapshotPath && (
      policy?.signalTiming == null
      || policy?.fillTiming == null
      || policy?.noNextBarHandling == null
    )) {
      throw new DomainException('backtest.execution_policy_required', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return {
      signalTiming: policy?.signalTiming ?? 'BAR_CLOSE',
      fillTiming: policy?.fillTiming ?? 'NEXT_BAR_OPEN',
      noNextBarHandling: policy?.noNextBarHandling ?? 'KEEP_PENDING',
    }
  }

  private getHistoryBars(
    historyBarsBySymbolTimeframe: Map<string, HistorySeries>,
    symbol: string,
    timeframe: string,
  ): Bar[] {
    return historyBarsBySymbolTimeframe.get(`${symbol}:${timeframe}`)?.rawBars ?? []
  }

  private finalizePendingSignals(input: {
    pendingOrdersBySymbol: Map<string, PendingOrder>
    executionPolicy: Required<Pick<BacktestExecutionPolicy, 'signalTiming' | 'fillTiming' | 'noNextBarHandling'>>
    baseBars: Bar[]
  }): BacktestReport['pendingSignals'] {
    if (input.pendingOrdersBySymbol.size === 0) {
      return undefined
    }

    if (input.executionPolicy.noNextBarHandling === 'DROP_SIGNAL') {
      input.pendingOrdersBySymbol.clear()
      return undefined
    }

    const lastBarBySymbol = new Map<string, Bar>()
    input.baseBars.forEach((bar) => {
      lastBarBySymbol.set(bar.symbol, bar)
    })

    return Array.from(input.pendingOrdersBySymbol.entries())
      .filter(([, order]) => order.deltaQty !== 0)
      .map(([symbol, order]) => ({
        symbol,
        ts: lastBarBySymbol.get(symbol)?.closeTime ?? 0,
        deltaQty: order.deltaQty,
        reason: order.reason,
        reasonSource: order.reasonSource,
      }))
  }

  private normalizeIntent(
    intent: SignalIntent,
    context: { currentQty: number; equity: number; markPrice: number },
    strictSnapshotPath: boolean,
  ): number {
    const decisionValidation = validateStrategyDecision(intent)
    if (decisionValidation.valid && decisionValidation.value) {
      return strategyDecisionToDeltaQty(decisionValidation.value, context)
    }
    if (this.isStrategyDecisionLike(intent)) {
      throw new DomainException('backtest.strategy_decision_invalid', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { error: decisionValidation.error ?? 'invalid strategy decision' },
      })
    }

    if (this.isLlmSignalIntent(intent)) {
      return this.normalizeLlmSignalIntent(intent, context, strictSnapshotPath)
    }

    if (!this.isLegacyEngineIntent(intent)) {
      return 0
    }

    switch (intent.type) {
      case 'TARGET_POSITION':
        return intent.targetQty - context.currentQty
      case 'OPEN_LONG':
        return Math.abs(intent.qty)
      case 'OPEN_SHORT':
        return -Math.abs(intent.qty)
      case 'CLOSE':
        return context.currentQty === 0 ? 0 : -Math.sign(context.currentQty) * (intent.qty ?? Math.abs(context.currentQty))
      case 'NOOP':
      default:
        return 0
    }
  }

  private isStrategyDecisionLike(intent: SignalIntent): intent is Extract<SignalIntent, { action: string }> {
    return typeof intent === 'object' && intent !== null && (
      'action' in intent ||
      'size' in intent ||
      'adjustMode' in intent
    )
  }

  private isLlmSignalIntent(intent: SignalIntent): intent is Extract<SignalIntent, { direction: string }> {
    return typeof intent === 'object' && intent !== null && 'direction' in intent
  }

  private isLegacyEngineIntent(
    intent: SignalIntent,
  ): intent is Extract<SignalIntent, { type: 'TARGET_POSITION' | 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE' | 'NOOP' }> {
    return typeof intent === 'object' && intent !== null && 'type' in intent
  }

  private normalizeLlmSignalIntent(
    intent: Extract<SignalIntent, { direction: string }>,
    context: { currentQty: number; equity: number; markPrice: number },
    strictSnapshotPath: boolean,
  ): number {
    const signalQty = this.resolveLlmSignalQty(intent, context, strictSnapshotPath)
    switch (intent.direction) {
      case 'BUY':
        return signalQty > 0 ? signalQty : 0
      case 'SELL':
        return signalQty > 0 ? -signalQty : 0
      case 'CLOSE_LONG':
        return context.currentQty > 0 ? -context.currentQty : 0
      case 'CLOSE_SHORT':
        return context.currentQty < 0 ? Math.abs(context.currentQty) : 0
      default:
        return 0
    }
  }

  private resolveLlmSignalQty(
    intent: Extract<SignalIntent, { direction: string }>,
    context: { equity: number; markPrice: number },
    strictSnapshotPath: boolean,
  ): number {
    const referencePrice = context.markPrice > 0
      ? context.markPrice
      : (intent.entryPrice > 0 ? intent.entryPrice : 1)

    if (typeof intent.positionSizeQuote === 'number' && Number.isFinite(intent.positionSizeQuote) && intent.positionSizeQuote > 0) {
      return intent.positionSizeQuote / referencePrice
    }

    if (typeof intent.positionSizeRatio === 'number' && Number.isFinite(intent.positionSizeRatio) && intent.positionSizeRatio > 0) {
      return (Math.max(0, context.equity) * intent.positionSizeRatio) / referencePrice
    }

    if (strictSnapshotPath) {
      throw new DomainException('backtest.llm_signal_size_required', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return 1
  }

  private getMarkPrice(bar: Bar, priceSource: BacktestRunInput['execution']['priceSource']): number {
    if (priceSource === 'open') return bar.open
    if (priceSource === 'close') return bar.close
    return (bar.open + bar.close) / 2
  }

  private resolveEffectiveLeverage(input: BacktestRunInput): number {
    const marketType = typeof input.strategy?.params?.marketType === 'string'
      ? input.strategy.params.marketType.trim().toLowerCase()
      : ''
    if (marketType === 'spot') {
      return 1
    }

    const leverage = input.leverage
    return Number.isFinite(leverage) && leverage > 0 ? leverage : 1
  }

  private applyLeverageCap(input: {
    leverage: number
    price: number
    currentQty: number
    requestedDelta: number
    equity: number
  }): number {
    const safePrice = input.price > 0 ? input.price : 1
    const safeLeverage = Number.isFinite(input.leverage) && input.leverage > 0 ? input.leverage : 1
    const maxAbsQty = (Math.max(0, input.equity) * safeLeverage) / safePrice
    const targetQty = input.currentQty + input.requestedDelta
    const clippedTargetQty = Math.max(-maxAbsQty, Math.min(maxAbsQty, targetQty))
    return clippedTargetQty - input.currentQty
  }

  private extractIntentReason(intent: SignalIntent): string | undefined {
    if (typeof intent !== 'object' || intent === null) return undefined

    if ('reason' in intent && typeof intent.reason === 'string' && intent.reason.trim()) {
      return intent.reason
    }

    if ('reasoning' in intent && typeof intent.reasoning === 'string' && intent.reasoning.trim()) {
      return intent.reasoning
    }

    return undefined
  }

  private buildScriptContext(input: {
    bar: Bar
    htfState: StrategyContext['htfState']
    position: StrategyContext['position']
    positionRuntimeState: PositionRuntimeState | null
    compiledDecisionState: CompiledDecisionRuntimeState
    semanticRuntimeState: StrategyContext['semanticRuntimeState']
    portfolio: StrategyContext['portfolio']
    accountRiskMetrics: AccountRiskMetrics
    input: BacktestRunInput
    historyBarsBySymbolTimeframe: Map<string, HistorySeries>
    requestedTimeframes: readonly Timeframe[]
    runtimeHistoryLimit: number | null
  }) {
    const { bar, htfState, portfolio } = input
    const barsByTimeframe: Record<string, Bar[]> = {}
    const scriptBarsByTimeframe: Record<string, ScriptRuntimeBar[]> = {}

    for (const timeframe of input.requestedTimeframes) {
      const history = input.historyBarsBySymbolTimeframe.get(this.buildHistoryKey(bar.symbol, timeframe))
      if (!history || history.rawBars.length === 0) continue
      const visibleHistory = this.sliceRuntimeHistory(history, bar.closeTime, input.runtimeHistoryLimit)
      barsByTimeframe[timeframe] = visibleHistory.rawBars
      scriptBarsByTimeframe[timeframe] = visibleHistory.scriptBars
    }

    const multiLegContext = buildRuntimeMarketContext({
      symbol: bar.symbol,
      baseTimeframe: input.input.baseTimeframe,
      primaryCloseTs: bar.closeTime,
      params: input.input.strategy.params,
      barsByTimeframe,
      scriptBarsByTimeframe,
      eventStreams: input.input.eventStreams,
    }) as MultiLegStrategyContext

    // Phase 5 S0a: 给 compiled-runtime 暴露 ctx.bars 通道（StrategyExecutionContextV1.bars）。
    // 取主腿 + base timeframe 的 ScriptRuntimeBar[]（与 packages/shared Bar 字段兼容：
    // {open, high, low, close, volume, timestamp}）。S0a fixed_grid_gated 不消费，
    // S5/S6 dynamic_grid / adaptive_volatility_grid 走此通道做 ATR/regime 判定。
    const primaryBars = multiLegContext.data.primary?.[input.input.baseTimeframe]?.bars ?? []

    const runtimeContext = buildMultiLegStrategyContext(multiLegContext)
    const eventInbox = (multiLegContext as { eventInbox?: unknown }).eventInbox
    const dataSourceFeeds = (multiLegContext as { dataSourceFeeds?: unknown }).dataSourceFeeds
    return {
      ts: bar.closeTime,
      symbol: bar.symbol,
      baseTimeframeBar: bar,
      bars: primaryBars,
      htfState,
      position: {
        ...input.position,
        barsHeld: input.positionRuntimeState?.barsHeld,
        entryTimeframe: input.positionRuntimeState?.entryTimeframe,
        highestPriceSinceEntry: input.positionRuntimeState?.highestPriceSinceEntry,
        lowestPriceSinceEntry: input.positionRuntimeState?.lowestPriceSinceEntry,
      },
      portfolio,
      accountEquity: portfolio.equity,
      accountDrawdownPct: input.accountRiskMetrics.accountDrawdownPct,
      drawdownPct: input.accountRiskMetrics.accountDrawdownPct,
      accountDailyLossPct: input.accountRiskMetrics.accountDailyLossPct,
      dailyLossPct: input.accountRiskMetrics.accountDailyLossPct,
      params: input.input.strategy.params,
      ...(eventInbox ? { eventInbox } : {}),
      ...(dataSourceFeeds ? { dataSourceFeeds } : {}),
      ...(input.semanticRuntimeState ? { semanticRuntimeState: input.semanticRuntimeState } : {}),
      __compiledDecisionState: input.compiledDecisionState,
      ...runtimeContext,
    }
  }

  private sliceRuntimeHistory(
    history: HistorySeries,
    closeTime: number,
    limit: number | null,
  ): HistorySeries {
    if (limit === null) return history

    const end = this.findClosedBarEndIndex(history.rawBars, closeTime)
    if (end <= 0) return { rawBars: [], scriptBars: [] }
    const start = Math.max(0, end - limit)
    return {
      rawBars: history.rawBars.slice(start, end),
      scriptBars: history.scriptBars.slice(start, end),
    }
  }

  private findClosedBarEndIndex(bars: readonly Bar[], closeTime: number): number {
    let low = 0
    let high = bars.length
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (bars[mid]!.closeTime <= closeTime) low = mid + 1
      else high = mid
    }
    return low
  }

  private resolveRuntimeHistoryLimit(strategy: BacktestRunInput['strategy']): number | null {
    if (strategy.bindingSource !== 'PUBLISHED_SNAPSHOT_STRICT') return null

    const candidates = [strategy.specSnapshot, strategy.irSnapshot, strategy.astSnapshot, strategy.dataRequirements]
    let maxLookback = 0
    for (const candidate of candidates) {
      maxLookback = Math.max(maxLookback, this.collectRuntimeLookback(candidate))
    }

    const safeLookback = maxLookback > 0 ? maxLookback + 5 : 2
    return Math.max(2, Math.min(10_000, safeLookback))
  }

  private collectRuntimeLookback(value: unknown): number {
    if (!value || typeof value !== 'object') return 0

    let maxLookback = 0
    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) {
        for (const item of node) visit(item)
        return
      }

      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (this.isRuntimeLookbackKey(key)) {
          const parsed = typeof child === 'number' ? child : typeof child === 'string' ? Number(child) : Number.NaN
          if (Number.isFinite(parsed)) maxLookback = Math.max(maxLookback, Math.floor(parsed))
        }
        visit(child)
      }
    }

    visit(value)
    return maxLookback
  }

  private isRuntimeLookbackKey(key: string): boolean {
    return /^(?:period|fastPeriod|slowPeriod|signalPeriod|lookback|lookbackBars|window|length|bars)$/u.test(key)
  }

  private resolveSemanticRuntimeState(
    store: Map<string, StrategyContext['semanticRuntimeState']>,
    symbol: string,
    stateKeys: readonly string[],
  ): StrategyContext['semanticRuntimeState'] {
    if (stateKeys.length === 0) return undefined

    const existing = store.get(symbol)
    if (existing) {
      return ensureSemanticRuntimeStateKeys(existing, stateKeys)
    }

    const semanticRuntimeState = buildSemanticRuntimeState(stateKeys)
    store.set(symbol, semanticRuntimeState)
    return semanticRuntimeState
  }

  private resolveAccountRiskMetrics(
    state: AccountRiskRuntimeState,
    equity: number,
    closeTime: number,
  ): AccountRiskMetrics {
    const safeEquity = Number.isFinite(equity) ? equity : 0
    const dayKey = new Date(closeTime).toISOString().slice(0, 10)
    if (state.dayKey !== dayKey) {
      state.dayKey = dayKey
      state.dayStartEquity = safeEquity
    }
    if (safeEquity > state.peakEquity) {
      state.peakEquity = safeEquity
    }

    return {
      accountDrawdownPct: this.lossPct(state.peakEquity, safeEquity),
      accountDailyLossPct: this.lossPct(state.dayStartEquity, safeEquity),
    }
  }

  private lossPct(referenceEquity: number, currentEquity: number): number {
    if (!Number.isFinite(referenceEquity) || referenceEquity <= 0) return 0
    if (!Number.isFinite(currentEquity)) return 0
    return Math.max(0, ((referenceEquity - currentEquity) / referenceEquity) * 100)
  }

  private bumpCompiledDecisionState(
    store: Map<string, CompiledDecisionRuntimeState>,
    symbol: string,
  ): CompiledDecisionRuntimeState {
    const current = store.get(symbol) ?? { barIndex: 0, lastTriggeredByProgram: {} }
    current.barIndex += 1
    store.set(symbol, current)
    return current
  }

  private syncPositionRuntimeState(
    store: Map<string, PositionRuntimeState>,
    position: StrategyContext['position'],
    bar: Bar,
  ): PositionRuntimeState | null {
    if (!position || position.qty === 0) {
      store.delete(bar.symbol)
      return null
    }

    const side: PositionRuntimeState['side'] = position.qty > 0 ? 'LONG' : 'SHORT'
    const existing = store.get(bar.symbol)
    const next = !existing || existing.side !== side
      ? {
          side,
          entryTimeframe: bar.timeframe,
          barsHeld: 1,
          highestPriceSinceEntry: bar.high,
          lowestPriceSinceEntry: bar.low,
        }
      : {
          side,
          entryTimeframe: existing.entryTimeframe,
          barsHeld: existing.barsHeld + 1,
          highestPriceSinceEntry: Math.max(existing.highestPriceSinceEntry, bar.high),
          lowestPriceSinceEntry: Math.min(existing.lowestPriceSinceEntry, bar.low),
        }

    store.set(bar.symbol, next)
    return next
  }

  private buildHistoryKey(symbol: string, timeframe: string): string {
    return `${symbol}::${timeframe}`
  }

  private appendHistoryBar(store: Map<string, HistorySeries>, bar: Bar): void {
    const key = this.buildHistoryKey(bar.symbol, bar.timeframe)
    const history = store.get(key)
    if (history) {
      history.rawBars.push(bar)
      history.scriptBars.push(this.toScriptBar(bar))
      return
    }
    store.set(key, {
      rawBars: [bar],
      scriptBars: [this.toScriptBar(bar)],
    })
  }

  private toScriptBar(bar: Bar): ScriptRuntimeBar {
    return {
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      timestamp: bar.closeTime,
    }
  }
}

export function createBar(input: Partial<Bar> & Pick<Bar, 'symbol' | 'timeframe' | 'closeTime'>): Bar {
  return {
    openTime: input.openTime ?? input.closeTime - 1,
    open: input.open ?? 100,
    high: input.high ?? 100,
    low: input.low ?? 100,
    close: input.close ?? 100,
    volume: input.volume ?? 0,
    ...input,
  }
}
