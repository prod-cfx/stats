import type { AccountStrategyLatestOrderDto, AccountStrategyTimelineEventDto } from '../dto/account-strategy-detail.response.dto'

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
  fee?: unknown
  feeCurrency?: string | null
  metadata?: unknown
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

  return trades
    .filter(trade => trade.executedAt instanceof Date && typeof trade.symbol === 'string' && typeof trade.side === 'string')
    .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
    .slice(0, 10)
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
      }
    })
}
