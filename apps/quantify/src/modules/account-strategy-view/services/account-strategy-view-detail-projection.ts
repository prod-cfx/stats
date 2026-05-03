import type {
  AccountStrategyLatestOrderDto,
  AccountStrategyRuleSummaryDto,
  AccountStrategyRuntimeSemanticSummaryDto,
  AccountStrategyTimelineEventDto,
} from '../dto/account-strategy-detail.response.dto'

interface TimelineInstance {
  createdAt?: Date
  startedAt?: Date | null
  stoppedAt?: Date | null
}

interface TimelineSubscription {
  subscribedAt?: Date
  unsubscribedAt?: Date | null
}

interface TimelineSignalExecution {
  createdAt: Date
  status?: string
  errorMessage?: string | null
  tradeId?: string | null
  orderSide?: string | null
  executedPrice?: unknown
  executedQuantity?: unknown
  fee?: unknown
  feeCurrency?: string | null
  metadata?: unknown
  signal?: {
    signalType?: string | null
    direction?: string | null
    symbol?: {
      code?: string | null
    } | null
  } | null
}

interface TimelineTrade {
  executedAt: Date
  side: string
  symbol: string
  price?: unknown
  quantity?: unknown
  fee?: unknown
  feeCurrency?: string | null
  orderId?: string | null
}

function isExchangeOrderTrade(trade: TimelineTrade): boolean {
  const orderId = typeof trade.orderId === 'string' ? trade.orderId.trim() : ''
  return !orderId.startsWith('sync-')
}

export interface AccountStrategyTimelineSource {
  instance: TimelineInstance | null
  subscription: TimelineSubscription | null
  signalExecutions: TimelineSignalExecution[]
  trades: TimelineTrade[]
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim().length === 0) return null
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readNestedRecord(root: unknown, keys: string[]): Record<string, unknown> | null {
  let current: unknown = root
  for (const key of keys) {
    const record = readRecord(current)
    if (!record) return null
    current = record[key]
  }
  return readRecord(current)
}

function normalizeFeeAmount(value: unknown): number | null {
  const amount = toFiniteNumber(value)
  if (amount === null) return null
  return Math.abs(amount)
}

function buildExecutionFeeByOrderId(
  executions: TimelineSignalExecution[],
): Map<string, { fee: number | null; feeCurrency: string | null; createdAtMs: number }> {
  const feeByOrderId = new Map<string, { fee: number | null; feeCurrency: string | null; createdAtMs: number }>()

  for (const execution of executions) {
    const orderId = typeof execution.tradeId === 'string' && execution.tradeId.trim()
      ? execution.tradeId.trim()
      : null
    if (!orderId) continue

    const rawOrder = readNestedRecord(execution.metadata, ['orderResponse', 'raw'])
    const rawFee = normalizeFeeAmount(rawOrder?.fee)
    const rawFeeCurrency = typeof rawOrder?.feeCcy === 'string' && rawOrder.feeCcy.trim()
      ? rawOrder.feeCcy.trim()
      : null
    const executionFee = normalizeFeeAmount(execution.fee)
    const executionFeeCurrency = typeof execution.feeCurrency === 'string' && execution.feeCurrency.trim()
      ? execution.feeCurrency.trim()
      : null
    const createdAtMs = execution.createdAt.getTime()
    const existing = feeByOrderId.get(orderId)
    if (existing && existing.createdAtMs >= createdAtMs) continue

    feeByOrderId.set(orderId, {
      fee: rawFee ?? executionFee,
      feeCurrency: rawFeeCurrency ?? executionFeeCurrency,
      createdAtMs,
    })
  }

  return feeByOrderId
}

function readExecutionOrderResponse(execution: TimelineSignalExecution): Record<string, unknown> | null {
  return readNestedRecord(execution.metadata, ['orderResponse'])
}

function isReconcileRequiredExecution(execution: TimelineSignalExecution): boolean {
  const metadata = readRecord(execution.metadata)
  return metadata?.reconcileRequired === true && metadata?.ledgerApplied === false
}

function buildExecutionOrderId(execution: TimelineSignalExecution, orderResponse: Record<string, unknown> | null): string | null {
  const tradeId = typeof execution.tradeId === 'string' && execution.tradeId.trim()
    ? execution.tradeId.trim()
    : null
  const responseId = typeof orderResponse?.id === 'string' && orderResponse.id.trim()
    ? orderResponse.id.trim()
    : null
  return tradeId ?? responseId
}

function buildExecutionOrderExecutedAt(execution: TimelineSignalExecution, orderResponse: Record<string, unknown> | null): Date {
  const rawCreatedAt = orderResponse?.createdAt
  if (typeof rawCreatedAt === 'string') {
    const parsed = new Date(rawCreatedAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return execution.createdAt
}

function buildExecutionOrderFee(execution: TimelineSignalExecution, orderResponse: Record<string, unknown> | null) {
  const rawOrder = readRecord(orderResponse?.raw)
  const rawFee = normalizeFeeAmount(rawOrder?.fee)
  const rawFeeCurrency = typeof rawOrder?.feeCcy === 'string' && rawOrder.feeCcy.trim()
    ? rawOrder.feeCcy.trim()
    : null

  return {
    fee: rawFee ?? normalizeFeeAmount(execution.fee),
    feeCurrency: rawFeeCurrency ?? execution.feeCurrency ?? null,
  }
}

export function buildAccountStrategyMixedTimeline(source: AccountStrategyTimelineSource): AccountStrategyTimelineEventDto[] {
  const events: AccountStrategyTimelineEventDto[] = []

  if (source.instance?.createdAt) {
    events.push({ at: source.instance.createdAt.toISOString(), eventType: 'system', event: '创建策略', note: null })
  }
  if (source.subscription?.subscribedAt) {
    events.push({ at: source.subscription.subscribedAt.toISOString(), eventType: 'system', event: '订阅策略', note: null })
  }
  if (source.instance?.startedAt) {
    events.push({ at: source.instance.startedAt.toISOString(), eventType: 'system', event: '开始运行', note: null })
  }
  if (source.instance?.stoppedAt) {
    events.push({ at: source.instance.stoppedAt.toISOString(), eventType: 'system', event: '停止运行', note: null })
  }
  if (source.subscription?.unsubscribedAt) {
    events.push({ at: source.subscription.unsubscribedAt.toISOString(), eventType: 'system', event: '取消订阅', note: null })
  }

  for (const execution of source.signalExecutions) {
    events.push({
      at: execution.createdAt.toISOString(),
      eventType: 'trade',
      event: execution.status === 'SUCCESS' ? '信号执行成功' : '信号执行',
      note: execution.errorMessage ?? null,
    })
  }

  for (const trade of source.trades) {
    events.push({
      at: trade.executedAt.toISOString(),
      eventType: 'trade',
      event: `成交 ${trade.side}`,
      note: `${trade.symbol} @ ${trade.price}`,
    })
  }

  return events
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(-30)
}

export function buildAccountStrategyLatestOrders(
  trades: TimelineTrade[],
  signalExecutions: TimelineSignalExecution[] = [],
): AccountStrategyLatestOrderDto[] {
  const feeByOrderId = buildExecutionFeeByOrderId(signalExecutions)
  const ledgerOrders = trades
    .filter(trade => trade.executedAt instanceof Date && typeof trade.symbol === 'string' && typeof trade.side === 'string')
    .filter(isExchangeOrderTrade)
    .map((trade) => {
      const orderId = trade.orderId ?? null
      const executionFee = orderId ? feeByOrderId.get(orderId) : undefined
      return {
        executedAt: trade.executedAt.toISOString(),
        side: trade.side,
        symbol: trade.symbol,
        price: toFiniteNumber(trade.price),
        quantity: toFiniteNumber(trade.quantity),
        fee: executionFee?.fee ?? toFiniteNumber(trade.fee),
        feeCurrency: executionFee?.feeCurrency ?? trade.feeCurrency ?? null,
        orderId,
        source: 'ledger' as const,
        ledgerApplied: true,
        reconcileRequired: false,
        executionStatus: null,
      }
    })
  const ledgerOrderIds = new Set(ledgerOrders.flatMap(order => order.orderId ? [order.orderId] : []))
  const reconcileOrders = signalExecutions
    .filter(isReconcileRequiredExecution)
    .flatMap((execution) => {
      const orderResponse = readExecutionOrderResponse(execution)
      const orderId = buildExecutionOrderId(execution, orderResponse)
      if (!orderId || ledgerOrderIds.has(orderId)) return []

      const quantity = toFiniteNumber(orderResponse?.filled) ?? toFiniteNumber(orderResponse?.amount) ?? toFiniteNumber(execution.executedQuantity)
      if (quantity === null || quantity <= 0) return []

      const { fee, feeCurrency } = buildExecutionOrderFee(execution, orderResponse)
      return [{
        executedAt: buildExecutionOrderExecutedAt(execution, orderResponse).toISOString(),
        side: execution.orderSide ?? execution.signal?.direction ?? 'UNKNOWN',
        symbol: execution.signal?.symbol?.code ?? '',
        price: toFiniteNumber(orderResponse?.price) ?? toFiniteNumber(execution.executedPrice),
        quantity,
        fee,
        feeCurrency,
        orderId,
        source: 'execution_reconcile_required' as const,
        ledgerApplied: false,
        reconcileRequired: true,
        executionStatus: execution.status ?? null,
      }]
    })

  return [...ledgerOrders, ...reconcileOrders]
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
    .slice(0, 10)
}

function findRuleActions(
  ruleSummary: AccountStrategyRuleSummaryDto | null | undefined,
  phase: string,
): string[] {
  const actions = ruleSummary?.rules
    .filter(item => item.phase === phase)
    .flatMap(item => item.actions) ?? []
  return Array.from(new Set(actions))
}

function classifyTradeSemantic(input: {
  side: string
  marketType: AccountStrategyRuntimeSemanticSummaryDto['marketType']
  entryActions: string[]
  exitActions: string[]
}): { semanticAction: string; semanticRole: 'entry' | 'exit' | 'unknown' } {
  const side = input.side.toUpperCase()
  const marketType = input.marketType

  if (marketType === 'spot') {
    if (side === 'BUY') return { semanticAction: '买入', semanticRole: 'entry' }
    if (side === 'SELL') return { semanticAction: '卖出', semanticRole: 'exit' }
    return { semanticAction: side || '语义待确认', semanticRole: 'unknown' }
  }

  if (marketType === 'perp' || marketType === 'futures' || marketType === 'swap') {
    const entryCandidates = [
      { action: 'OPEN_LONG', side: 'BUY', label: '开多' },
      { action: 'OPEN_SHORT', side: 'SELL', label: '开空' },
    ].filter(candidate => input.entryActions.includes(candidate.action) && candidate.side === side)
    const exitCandidates = [
      { action: 'CLOSE_LONG', side: 'SELL', label: '平多' },
      { action: 'CLOSE_SHORT', side: 'BUY', label: '平空' },
      { action: 'FORCE_EXIT', side, label: '平仓' },
    ].filter(candidate => input.exitActions.includes(candidate.action) && candidate.side === side)

    if (entryCandidates.length === 1 && exitCandidates.length === 0) {
      return { semanticAction: entryCandidates[0]!.label, semanticRole: 'entry' }
    }
    if (exitCandidates.length === 1 && entryCandidates.length === 0) {
      return { semanticAction: exitCandidates[0]!.label, semanticRole: 'exit' }
    }
    if (entryCandidates.length > 0 || exitCandidates.length > 0) {
      return { semanticAction: '语义待确认', semanticRole: 'unknown' }
    }

    if (side === 'BUY' || side === 'SELL') return { semanticAction: '合约成交', semanticRole: 'unknown' }
    return { semanticAction: side || '语义待确认', semanticRole: 'unknown' }
  }

  return { semanticAction: side || '语义待确认', semanticRole: 'unknown' }
}

export function buildAccountStrategyRuntimeSemanticSummary(input: {
  status: 'running' | 'stopped' | 'draft'
  marketType: AccountStrategyRuntimeSemanticSummaryDto['marketType']
  symbol: string
  openPositionsCount: number | null
  trades: TimelineTrade[]
  ruleSummary: AccountStrategyRuleSummaryDto | null
}): AccountStrategyRuntimeSemanticSummaryDto {
  const entryActions = findRuleActions(input.ruleSummary, 'entry')
  const exitActions = findRuleActions(input.ruleSummary, 'exit')
  const semanticTrades = input.trades
    .filter(trade => trade.executedAt instanceof Date && typeof trade.side === 'string')
    .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
    .map((trade) => ({
      orderId: trade.orderId ?? null,
      executedAt: trade.executedAt.toISOString(),
      isSyncOrder: trade.orderId?.startsWith('sync-') ?? false,
      ...classifyTradeSemantic({
        side: trade.side,
        marketType: input.marketType,
        entryActions,
        exitActions,
      }),
    }))
  const exchangeSemanticTrades = semanticTrades.filter(trade => !trade.isSyncOrder)
  const latestEntry = exchangeSemanticTrades.find(trade => trade.semanticRole === 'entry') ?? null
  const latestExit = exchangeSemanticTrades.find(trade => trade.semanticRole === 'exit') ?? null
  const latestSync = semanticTrades.find(trade => trade.isSyncOrder) ?? null
  const entryOrders = semanticTrades
    .filter(trade => !trade.isSyncOrder && trade.semanticRole === 'entry')
    .map(trade => ({ orderId: trade.orderId, executedAt: trade.executedAt }))
  const exitOrders = semanticTrades
    .filter(trade => !trade.isSyncOrder && trade.semanticRole === 'exit')
    .map(trade => ({ orderId: trade.orderId, executedAt: trade.executedAt }))
  const syncOrders = semanticTrades
    .filter(trade => trade.isSyncOrder)
    .map(trade => ({ orderId: trade.orderId, executedAt: trade.executedAt }))
  const latestSemanticAction = semanticTrades[0]?.semanticAction ?? null

  const hasOpenPosition = typeof input.openPositionsCount === 'number' && input.openPositionsCount > 0
  const serviceStatusLabel = input.status === 'running'
    ? '运行中'
    : input.status === 'stopped'
      ? '已停止'
      : '草稿'

  let positionStatusLabel = '状态待确认'
  let cycleStatusLabel = '查看成交与规则'
  let explanation = '当前策略类型暂未提供专用语义解释，请结合成交记录、持仓概览和发布快照规则核对。'
  let nextExpectedAction: string | null = null
  let positionState: AccountStrategyRuntimeSemanticSummaryDto['positionState'] = 'unknown'
  let cycleState: AccountStrategyRuntimeSemanticSummaryDto['cycleState'] = 'unknown'

  if (input.marketType === 'spot') {
    if (hasOpenPosition) {
      positionStatusLabel = '持有现货'
      cycleStatusLabel = '等待出场'
      positionState = 'spot_holding'
      cycleState = 'entered'
      explanation = `当前持有 ${input.symbol} 现货仓位，策略服务${serviceStatusLabel}，等待出场条件触发。`
      nextExpectedAction = '等待出场条件触发'
    } else if (latestEntry && latestExit) {
      positionStatusLabel = '空仓'
      cycleStatusLabel = '本轮已完成'
      positionState = 'flat'
      cycleState = 'completed'
      explanation = input.status === 'running'
        ? `本轮现货交易已完成，当前未持有 ${input.symbol}。策略服务运行中，等待下一次入场条件。`
        : `本轮现货交易已完成，当前未持有 ${input.symbol}。策略服务${serviceStatusLabel}。`
      nextExpectedAction = input.status === 'running' ? '等待下一次入场条件' : null
    } else {
      positionStatusLabel = '空仓'
      cycleStatusLabel = '等待入场'
      positionState = 'flat'
      cycleState = 'waiting_entry'
      explanation = `当前未持有 ${input.symbol}。策略服务${serviceStatusLabel}，等待入场条件触发。`
      nextExpectedAction = input.status === 'running' ? '等待入场条件触发' : null
    }
  } else if (input.marketType === 'perp' || input.marketType === 'futures' || input.marketType === 'swap') {
    if (hasOpenPosition) {
      const entryAction = latestEntry?.semanticAction
      if (entryAction === '开多' || entryAction === '开空') {
        positionStatusLabel = entryAction === '开空' ? '持有空头' : '持有多头'
        cycleStatusLabel = '等待出场'
        positionState = entryAction === '开空' ? 'short' : 'long'
        cycleState = 'entered'
        explanation = `当前${positionStatusLabel}仓位，策略服务${serviceStatusLabel}，等待出场条件触发。`
        nextExpectedAction = '等待出场条件触发'
      } else {
        positionStatusLabel = '方向待确认'
        cycleStatusLabel = '查看成交与规则'
        explanation = '当前存在未平仓位，但成交证据无法确认多空方向。请结合持仓概览、最新成交和发布快照规则核对。'
      }
    } else if (latestExit) {
      positionStatusLabel = '无仓位'
      cycleStatusLabel = '上一轮已平仓'
      positionState = 'flat'
      cycleState = 'completed'
      explanation = input.status === 'running'
        ? '上一轮合约仓位已平，当前无未平仓位。策略服务运行中，等待下一次入场条件。'
        : `上一轮合约仓位已平，当前无未平仓位。策略服务${serviceStatusLabel}。`
      nextExpectedAction = input.status === 'running' ? '等待下一次入场条件' : null
    } else {
      positionStatusLabel = '无仓位'
      cycleStatusLabel = '等待入场'
      positionState = 'flat'
      cycleState = 'waiting_entry'
      explanation = `当前无未平仓位。策略服务${serviceStatusLabel}，等待入场条件触发。`
      nextExpectedAction = input.status === 'running' ? '等待入场条件触发' : null
    }
  }

  if (input.status === 'stopped' && hasOpenPosition) {
    cycleStatusLabel = '需处理'
    cycleState = 'needs_attention'
    nextExpectedAction = '检查持仓并决定是否手动处理'
    explanation = `${explanation} 策略已停止，请确认未平仓位风险。`
  }
  if (input.status === 'stopped' && !hasOpenPosition) {
    nextExpectedAction = null
  }

  return {
    serviceStatusLabel,
    positionStatusLabel,
    cycleStatusLabel,
    headline: `${serviceStatusLabel} · ${positionStatusLabel} · ${cycleStatusLabel}`,
    explanation,
    nextExpectedAction,
    marketType: input.marketType,
    positionState,
    cycleState,
    evidence: {
      openPositionsCount: input.openPositionsCount,
      latestEntryOrderId: latestEntry?.orderId ?? null,
      latestExitOrderId: latestExit?.orderId ?? null,
      latestSyncOrderId: latestSync?.orderId ?? null,
      entryOrders,
      exitOrders,
      syncOrders,
      latestEntryAt: latestEntry?.executedAt ?? null,
      latestExitAt: latestExit?.executedAt ?? null,
      latestSemanticAction,
    },
  }
}
