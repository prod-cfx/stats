import type { MultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import type {
  BacktestExecutionPolicy,
  BacktestReasonSource,
  BacktestReport,
  BacktestRunInput,
  Bar,
  SignalIntent,
  StrategyContext,
} from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { buildMultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable, HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
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
    const symbolSet = new Set(input.symbols)

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
        input.stateTimeframes.includes(bar.timeframe)
        && (symbolSet.size === 0 || symbolSet.has(bar.symbol))
        && bar.closeTime >= input.dataRange.fromTs
        && bar.closeTime <= input.dataRange.toTs,
      )
      .sort((a, b) => a.closeTime - b.closeTime)

    let stateCursor = 0
    const historyBarsBySymbolTimeframe = new Map<string, HistorySeries>()
    const pendingOrdersBySymbol = new Map<string, PendingOrder>()
    const strictSnapshotPath = this.isStrictSnapshotPath(input.strategy)
    const executionPolicy = this.resolveExecutionPolicy(input.strategy.executionPolicy, strictSnapshotPath)

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
      if (!input.stateTimeframes.includes(input.baseTimeframe)) {
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
      const position = ledger.getPosition(bar.symbol)
      const htfState = this.stateEngine.getLatestByTimeframes(bar.symbol, input.stateTimeframes)
      const strategyContext = this.buildScriptContext({
        bar,
        input,
        htfState,
        historyBarsBySymbolTimeframe,
        portfolio: {
          cash: snapshot.cash,
          equity: snapshot.equity,
          usedMargin: snapshot.usedMargin,
          realizedPnl: snapshot.realizedPnl,
        },
        position,
      })
      const intent = await input.strategy.fn({
        ...strategyContext,
      })

      const normalized = this.normalizeIntent(intent, {
        currentQty: position.qty,
        equity: snapshot.equity,
        markPrice: this.getMarkPrice(bar, input.execution.priceSource),
      }, strictSnapshotPath)
      const adjustedDelta = this.applyLeverageCap({
        leverage: input.leverage,
        price: this.getMarkPrice(bar, input.execution.priceSource),
        currentQty: position.qty,
        requestedDelta: normalized,
        equity: snapshot.equity,
      })
      const strategyReason = this.extractIntentReason(intent)
      const strategyOrder: PendingOrder = {
        deltaQty: adjustedDelta,
        reason: strategyReason,
        reasonSource: 'strategy',
      }

      const riskDecision = this.riskEvaluator.evaluate({
        symbol: bar.symbol,
        bar,
        historyBars: this.getHistoryBars(historyBarsBySymbolTimeframe, bar.symbol, input.baseTimeframe),
        position,
        riskRules: input.strategy.riskRules,
      })

      const riskOrder: PendingOrder | undefined = riskDecision
        ? {
          deltaQty: riskDecision.targetQty - position.qty,
          reason: riskDecision.reason,
          reasonSource: riskDecision.source,
        }
        : undefined
      const selectedOrder = riskOrder && riskOrder.deltaQty !== 0
        ? riskOrder
        : strategyOrder

      if (selectedOrder.deltaQty !== 0) {
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
    }))

    this.stateEngine.reset()
    this.riskEvaluator.reset()

    return {
      ...report,
      openPositions,
      pendingSignals,
    }
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
  }) {
    if (input.deltaQty === 0) return

    const side: 'BUY' | 'SELL' = input.deltaQty > 0 ? 'BUY' : 'SELL'
    const fill = this.executionModel.fill(
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

  private isStrictSnapshotPath(strategy: BacktestRunInput['strategy']): boolean {
    return strategy.bindingSource === 'PUBLISHED_SNAPSHOT_STRICT'
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
    portfolio: StrategyContext['portfolio']
    input: BacktestRunInput
    historyBarsBySymbolTimeframe: Map<string, HistorySeries>
  }) {
    const { bar, htfState, position, portfolio } = input
    const primaryLegId = 'primary'
    const requestedTimeframes = Array.from(new Set([input.input.baseTimeframe, ...input.input.stateTimeframes]))
    const dataForPrimary: Record<string, { bars: ScriptRuntimeBar[]; indicators: Record<string, number>; currentPrice: number }> = {}

    for (const timeframe of requestedTimeframes) {
      const history = input.historyBarsBySymbolTimeframe.get(this.buildHistoryKey(bar.symbol, timeframe))
      if (!history || history.rawBars.length === 0) continue
      dataForPrimary[timeframe] = {
        bars: history.scriptBars,
        indicators: {},
        currentPrice: history.rawBars[history.rawBars.length - 1]!.close,
      }
    }

    const multiLegContext: MultiLegStrategyContext = {
      data: { [primaryLegId]: dataForPrimary },
      execution: { timeframe: input.input.baseTimeframe },
      legs: [{ id: primaryLegId, symbol: bar.symbol, role: 'primary' }],
      dataRequirements: { [primaryLegId]: requestedTimeframes },
      timestamp: bar.closeTime,
      params: input.input.strategy.params,
    }

    const runtimeContext = buildMultiLegStrategyContext(multiLegContext)
    return {
      ts: bar.closeTime,
      symbol: bar.symbol,
      baseTimeframeBar: bar,
      htfState,
      position,
      portfolio,
      params: input.input.strategy.params,
      ...runtimeContext,
    }
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
