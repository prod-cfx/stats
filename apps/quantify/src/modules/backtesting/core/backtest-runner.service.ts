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
} from '../types/backtesting.types'
import { ErrorCode } from '@ai/shared'
import { buildMultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable, HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { normalizeExactCode, toSymbolCode } from '@/modules/market-data/utils/market-symbol-code.util'
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
    const compiledDecisionStateBySymbol = new Map<string, CompiledDecisionRuntimeState>()
    const positionRuntimeStateBySymbol = new Map<string, PositionRuntimeState>()
    const orderProgramStatesBySymbol = new Map<string, Map<string, CompiledOrderProgramRuntimeState>>()
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
      const compiledDecisionState = this.bumpCompiledDecisionState(compiledDecisionStateBySymbol, bar.symbol)
      const positionRuntimeState = this.syncPositionRuntimeState(positionRuntimeStateBySymbol, position, bar)
      const htfState = this.stateEngine.getLatestByTimeframes(bar.symbol, input.stateTimeframes)
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
        position,
        positionRuntimeState,
      })
      const intent = await input.strategy.fn({
        ...strategyContext,
      })
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
    const openPnl = openPositions.reduce((sum, position) => sum + position.unrealizedPnl, 0)

    this.stateEngine.reset()
    this.riskEvaluator.reset()

    return {
      ...report,
      summary: {
        ...report.summary,
        totalOpenTrades: openPositions.length,
        openPnl,
      },
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
    }
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
    const sidePolicy = this.readString(input.program.payload?.sidePolicy)
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
      qty: this.resolveCompiledOrderProgramQty(input.program.payload?.quantity, price, input.equity),
      role,
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
    }
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
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
    portfolio: StrategyContext['portfolio']
    input: BacktestRunInput
    historyBarsBySymbolTimeframe: Map<string, HistorySeries>
  }) {
    const { bar, htfState, portfolio } = input
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
      position: {
        ...input.position,
        barsHeld: input.positionRuntimeState?.barsHeld,
        highestPriceSinceEntry: input.positionRuntimeState?.highestPriceSinceEntry,
        lowestPriceSinceEntry: input.positionRuntimeState?.lowestPriceSinceEntry,
      },
      portfolio,
      params: input.input.strategy.params,
      __compiledDecisionState: input.compiledDecisionState,
      ...runtimeContext,
    }
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
          barsHeld: 1,
          highestPriceSinceEntry: bar.high,
          lowestPriceSinceEntry: bar.low,
        }
      : {
          side,
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
