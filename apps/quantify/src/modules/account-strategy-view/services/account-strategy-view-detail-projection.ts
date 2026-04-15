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
    .slice(0, 30)
}

export function buildAccountStrategyLatestOrders(
  trades: TimelineTrade[],
): AccountStrategyLatestOrderDto[] {
  return trades
    .filter(trade => trade.executedAt instanceof Date && typeof trade.symbol === 'string' && typeof trade.side === 'string')
    .slice(0, 10)
    .map(trade => ({
      executedAt: trade.executedAt.toISOString(),
      side: trade.side,
      symbol: trade.symbol,
      price: toFiniteNumber(trade.price),
      quantity: toFiniteNumber(trade.quantity),
      fee: toFiniteNumber(trade.fee),
      feeCurrency: trade.feeCurrency ?? null,
      orderId: trade.orderId ?? null,
    }))
}
