import type { AiQuantStrategyRecord, AiQuantStrategyViewState } from './ai-quant-strategy-store'
import type {
  AccountAiQuantStrategyDetail,
  AccountAiQuantStrategyListItem,
  AccountAiQuantStrategyApiState,
} from '@/lib/api'

function normalizeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeStatus(status: AccountAiQuantStrategyApiState): AiQuantStrategyViewState {
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

function mapDynamicParamFields(
  paramSchema: Record<string, unknown> | null | undefined,
  paramValues: Record<string, unknown> | null | undefined,
  schemaVersion: string | null | undefined,
) {
  if (!paramSchema) {
    return {
      paramSchema: null,
      paramValues: null,
      schemaVersion: schemaVersion ?? null,
      supportsDynamicParams: false,
    }
  }

  return {
    paramSchema,
    paramValues: paramValues ?? {},
    schemaVersion: schemaVersion ?? null,
    supportsDynamicParams: true,
  }
}

export function mapAccountStrategyListItemToRecord(
  item: AccountAiQuantStrategyListItem,
): AiQuantStrategyRecord {
  const dynamicParams = mapDynamicParamFields(item.paramSchema, item.paramValues, item.schemaVersion)

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
    ...dynamicParams,
    equitySeries: [],
    timeline: [],
    updatedAt: item.updatedAt,
  }
}

export function mapAccountStrategyDetailToRecord(
  detail: AccountAiQuantStrategyDetail,
): AiQuantStrategyRecord {
  const exchange = detail.exchange === 'okx' ? 'okx' : 'binance'
  const initialCapital = detail.accountOverview?.initialBalance
    ?? detail.equitySeries[0]?.value
    ?? 10000
  const dynamicParams = mapDynamicParamFields(
    detail.snapshot.paramSchema ?? detail.paramSchema,
    detail.snapshot.paramValues ?? detail.paramValues,
    detail.snapshot.schemaVersion ?? detail.schemaVersion,
  )

  return {
    id: detail.id,
    name: detail.name,
    status: normalizeStatus(detail.status),
    exchange,
    symbol: detail.symbol ?? '--',
    timeframe: detail.timeframe ?? '--',
    positionPct: normalizeNumber(detail.positionPct),
    initialCapital,
    metrics: {
      returnPct: normalizeNumber(detail.metrics.returnPct),
      maxDrawdownPct: normalizeNumber(detail.metrics.maxDrawdownPct),
      winRatePct: normalizeNumber(detail.metrics.winRatePct),
      tradeCount: normalizeNumber(detail.metrics.tradeCount),
    },
    ...dynamicParams,
    totalPnl: detail.totalPnl ?? null,
    todayPnl: detail.todayPnl ?? null,
    accountOverview: detail.accountOverview
      ? {
          initialBalance: detail.accountOverview.initialBalance ?? null,
          totalEquity: detail.accountOverview.totalEquity ?? null,
          availableBalance: detail.accountOverview.availableBalance ?? null,
          totalPnl: detail.accountOverview.totalPnl ?? null,
          todayPnl: detail.accountOverview.todayPnl ?? null,
          baseCurrency: detail.accountOverview.baseCurrency ?? null,
        }
      : undefined,
    positionOverview: detail.positionOverview
      ? {
          openPositionsCount: detail.positionOverview.openPositionsCount ?? null,
          closedPositionsCount: detail.positionOverview.closedPositionsCount ?? null,
          totalRealizedPnl: detail.positionOverview.totalRealizedPnl ?? null,
          totalUnrealizedPnl: detail.positionOverview.totalUnrealizedPnl ?? null,
        }
      : undefined,
    latestOrders: Array.isArray(detail.latestOrders)
      ? detail.latestOrders.map(order => ({
          executedAt: fmtTimelineTime(order.executedAt),
          side: order.side,
          symbol: order.symbol,
          price: typeof order.price === 'number' && Number.isFinite(order.price) ? order.price : null,
          quantity: typeof order.quantity === 'number' && Number.isFinite(order.quantity) ? order.quantity : null,
          fee: typeof order.fee === 'number' && Number.isFinite(order.fee) ? order.fee : null,
          feeCurrency: order.feeCurrency ?? null,
          orderId: order.orderId ?? null,
        }))
      : [],
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
