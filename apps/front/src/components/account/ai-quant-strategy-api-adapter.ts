import type { AiQuantStrategyRecord, StrategyStatus } from './ai-quant-strategy-store'
import type {
  AccountAiQuantStrategyDetail,
  AccountAiQuantStrategyListItem,
  AccountAiQuantStrategyStatus,
} from '@/lib/api'

function normalizeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeStatus(status: AccountAiQuantStrategyStatus): StrategyStatus {
  if (status === 'running') return 'running'
  if (status === 'draft') return 'draft'
  return 'stopped'
}

function fmtTimelineTime(ts: string): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts

  const y = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${mm}-${dd} ${hh}:${min}`
}

export function mapAccountStrategyListItemToRecord(
  item: AccountAiQuantStrategyListItem,
): AiQuantStrategyRecord {
  return {
    id: item.id,
    name: item.name,
    status: normalizeStatus(item.status),
    exchange: (item.exchange === 'okx' ? 'okx' : 'binance'),
    symbol: item.symbol ?? '--',
    timeframe: item.timeframe ?? '--',
    positionPct: normalizeNumber(item.positionPct),
    initialCapital: 10000,
    metrics: {
      returnPct: normalizeNumber(item.metrics.returnPct),
      maxDrawdownPct: normalizeNumber(item.metrics.maxDrawdownPct),
      winRatePct: normalizeNumber(item.metrics.winRatePct),
      tradeCount: normalizeNumber(item.metrics.tradeCount),
    },
    equitySeries: [],
    timeline: [],
    updatedAt: item.updatedAt,
  }
}

export function mapAccountStrategyDetailToRecord(
  detail: AccountAiQuantStrategyDetail,
): AiQuantStrategyRecord {
  const exchange = detail.exchange === 'okx' ? 'okx' : 'binance'

  return {
    id: detail.id,
    name: detail.name,
    status: normalizeStatus(detail.status),
    exchange,
    symbol: detail.symbol ?? '--',
    timeframe: detail.timeframe ?? '--',
    positionPct: normalizeNumber(detail.positionPct),
    initialCapital: 10000,
    metrics: {
      returnPct: normalizeNumber(detail.metrics.returnPct),
      maxDrawdownPct: normalizeNumber(detail.metrics.maxDrawdownPct),
      winRatePct: normalizeNumber(detail.metrics.winRatePct),
      tradeCount: normalizeNumber(detail.metrics.tradeCount),
    },
    totalPnl: detail.totalPnl ?? null,
    todayPnl: detail.todayPnl ?? null,
    equitySeries: detail.equitySeries.map(item => ({
      ts: fmtTimelineTime(item.ts),
      value: normalizeNumber(item.value),
    })),
    timeline: detail.timeline.map(item => ({
      at: fmtTimelineTime(item.at),
      event: item.event,
      note: item.note ?? undefined,
    })),
    deploy: detail.snapshot.deployAt
      ? {
          exchange,
          accountId: '',
          accountName: detail.snapshot.deployAccountName ?? '--',
          at: detail.snapshot.deployAt,
          status: detail.status === 'running' ? 'running' : 'stopped',
        }
      : undefined,
    updatedAt: detail.updatedAt,
  }
}
