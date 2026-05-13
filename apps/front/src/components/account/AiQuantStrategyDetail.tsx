'use client'

import type {
  AiQuantStrategyRecord,
  StrategyEquityPoint,
  AiQuantStrategyViewState,
} from './ai-quant-strategy-store'
import { Play } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setIntent } from '@/components/ai-quant/intent-storage'
import { StopRunningStrategyDialog } from '@/components/ai-quant/StopRunningStrategyDialog'
import { useAuth } from '@/hooks/use-auth'
import { fetchAccountAiQuantStrategyDetail, performAccountAiQuantStrategyAction } from '@/lib/api'
import { resolveDisplayMetrics } from './account-strategy-display-metrics'
import { mapAccountStrategyDetailToRecord } from './ai-quant-strategy-api-adapter'
import { buildDynamicParamRows } from './dynamic-param-summary'
import { deriveAdjacentChangePct, formatSignedNumber } from './pnl-metrics'

const STATUS_CLASS: Record<AiQuantStrategyViewState, string> = {
  running: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  stopped: 'bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300',
  draft: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
}

const EQUITY_CHART_WIDTH = 900
const EQUITY_CHART_HEIGHT = 220
const EQUITY_CHART_PADDING_Y = 16
const TIMELINE_PREVIEW_LIMIT = 3
type RuntimeAction = 'run' | 'stop' | 'liquidate_and_stop'
type DetailTranslation = (key: string, options?: Record<string, unknown>) => string
type DetailInfoTab = 'rules' | 'config' | 'backtest' | 'timeline' | 'diagnostics'

function resolveEquityY(value: number, min: number, max: number) {
  if (max === min) return EQUITY_CHART_HEIGHT / 2
  const spread = max - min
  const normalized = (value - min) / spread
  const drawableHeight = EQUITY_CHART_HEIGHT - EQUITY_CHART_PADDING_Y * 2
  return EQUITY_CHART_PADDING_Y + (1 - normalized) * drawableHeight
}

function buildPolyline(data: StrategyEquityPoint[]) {
  if (!data.length) return ''
  const values = data.map(item => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return data
    .map((item, idx) => {
      const x = (idx / Math.max(data.length - 1, 1)) * EQUITY_CHART_WIDTH
      const y = resolveEquityY(item.value, min, max)
      return `${x},${y}`
    })
    .join(' ')
}

function buildCoordinates(data: StrategyEquityPoint[]) {
  if (!data.length) return []
  const values = data.map(item => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return data.map((item, idx) => {
    const x = (idx / Math.max(data.length - 1, 1)) * EQUITY_CHART_WIDTH
    const y = resolveEquityY(item.value, min, max)
    return { x, y }
  })
}

function formatAmount(value: number) {
  return Number(value.toFixed(2)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatOptionalAmount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return formatAmount(value)
}

function formatOptionalPreciseAmount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return Number(value.toFixed(8)).toLocaleString('en-US', {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  })
}

function formatOptionalPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return Number(value.toFixed(8)).toLocaleString('en-US', {
      maximumFractionDigits: 8,
      minimumFractionDigits: 0,
    })
  }
  return Number(value.toFixed(4)).toLocaleString('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  })
}

function formatCompactId(value: string | null | undefined) {
  if (!value) return '--'
  if (value.length <= 24) return value
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function formatPercentValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${Number(value.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
}

function resolveLeverageProgress(
  current: number | null | undefined,
  range: AiQuantStrategyRecord['deploymentLeverageRange'],
) {
  if (typeof current !== 'number' || !Number.isFinite(current) || !range) return 0
  const min = range.min
  const max = range.max
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0
  return Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100))
}

function pnlToneClass(value: number | null | undefined) {
  return typeof value === 'number' && value < 0
    ? 'text-rose-500 dark:text-rose-400'
    : 'text-emerald-600 dark:text-emerald-400'
}

function formatMarketTypeLabel(
  marketType: AiQuantStrategyRecord['marketType'],
  t: DetailTranslation,
) {
  switch (marketType) {
    case 'spot':
      return t('aiQuant.detail.marketTypes.spot')
    case 'perp':
    case 'swap':
      return t('aiQuant.detail.marketTypes.perp')
    case 'futures':
      return t('aiQuant.detail.marketTypes.futures')
    default:
      return '--'
  }
}

function formatParamSnapshotLabel(key: string, fallback: string, t: DetailTranslation) {
  const translated = t(`aiQuant.paramLabels.${key}`, { defaultValue: fallback })
  return translated || fallback
}

function isContractMarket(marketType: AiQuantStrategyRecord['marketType']) {
  return marketType === 'perp' || marketType === 'swap' || marketType === 'futures'
}

function formatEquitySeriesTitle(t: DetailTranslation) {
  return t('aiQuant.detail.equitySeriesTitle')
}

function formatEquitySeriesSource(
  marketType: AiQuantStrategyRecord['marketType'],
  t: DetailTranslation,
) {
  return isContractMarket(marketType)
    ? t('aiQuant.detail.equitySeriesSourceContract')
    : t('aiQuant.detail.equitySeriesSourceSpot')
}

function inferBaseAsset(symbol: string) {
  const normalized = symbol
    .replace(/:(PERP|SPOT)$/i, '')
    .replace(/[-_/]/g, '')
    .replace(/(SWAP|PERP|FUTURES)$/i, '')
    .toUpperCase()
  const quoteAssets = ['USDT', 'USDC', 'USD', 'BTC', 'ETH']
  const quote = quoteAssets.find(asset => normalized.endsWith(asset))
  if (!quote) return symbol
  return normalized.slice(0, -quote.length) || symbol
}

function inferQuoteAsset(symbol: string, fallback = 'USDT') {
  const normalized = symbol
    .replace(/:(PERP|SPOT)$/i, '')
    .replace(/[-_/]/g, '')
    .replace(/(SWAP|PERP|FUTURES)$/i, '')
    .toUpperCase()
  const quoteAssets = ['USDT', 'USDC', 'USD', 'BTC', 'ETH']
  return quoteAssets.find(asset => normalized.endsWith(asset)) ?? fallback
}

function formatSpotHoldingCount(
  openPositionsCount: number | null | undefined,
  symbol: string,
  t: DetailTranslation,
) {
  if (typeof openPositionsCount !== 'number' || !Number.isFinite(openPositionsCount)) return '--'
  if (openPositionsCount === 0)
    return t('aiQuant.detail.spotZeroHolding', { asset: inferBaseAsset(symbol) })
  return t('aiQuant.detail.spotHoldingRecords', { count: openPositionsCount })
}

function formatSpotHolding(strategy: AiQuantStrategyRecord, t: DetailTranslation) {
  const summary = strategy.spotHoldingSummary
  const quantity = summary?.quantity
  const baseAsset = summary?.baseAsset ?? inferBaseAsset(strategy.symbol)
  if (typeof quantity === 'number' && Number.isFinite(quantity) && baseAsset) {
    return `${quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${baseAsset}`
  }

  return formatSpotHoldingCount(
    summary?.openPositionsCount ?? strategy.positionOverview?.openPositionsCount,
    strategy.symbol,
    t,
  )
}

function formatExecutionValue(value: string | number | null | undefined, suffix = '') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}${suffix}`
  }
  if (typeof value === 'string' && value.trim()) {
    return `${value}${suffix}`
  }
  return '--'
}

function formatDetailTime(ts: string) {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts

  const y = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${mm}-${dd} ${hh}:${min}`
}

function formatRuntimeExecutionStatus(status: string, t: DetailTranslation) {
  switch (status) {
    case 'ready':
      return t('aiQuant.detail.runtimeExecutionStatus.ready')
    case 'consumed':
      return t('aiQuant.detail.runtimeExecutionStatus.consumed')
    case 'failed':
      return t('aiQuant.detail.runtimeExecutionStatus.failed')
    case 'cooldown':
      return t('aiQuant.detail.runtimeExecutionStatus.cooldown')
    default:
      return status || '--'
  }
}

function formatRuntimeExecutionAt(ts: string | null | undefined) {
  if (!ts) return '--'
  return formatDetailTime(ts)
}

function formatRuntimeExecutionFailureReason(
  state: {
    failureFamily?: 'binding' | 'activation' | 'execution' | 'persistence' | null
    failureReason?: string | null
    failureCode?: string | null
  },
  t: DetailTranslation,
) {
  if (state.failureFamily === 'binding') {
    return t('aiQuant.detail.runtimeExecutionFailure.binding')
  }
  if (state.failureFamily === 'activation') {
    if (state.failureCode === 'SNAPSHOT_REFERENCE_BAR_MISSING') {
      return t('aiQuant.detail.runtimeExecutionFailure.activationMissingBar')
    }
    return t('aiQuant.detail.runtimeExecutionFailure.activation')
  }
  if (state.failureFamily === 'persistence') {
    return t('aiQuant.detail.runtimeExecutionFailure.persistence')
  }
  if (
    state.failureFamily === 'execution' &&
    (state.failureCode === 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL' ||
      state.failureCode === 'SNAPSHOT_SCRIPT_NO_SIGNAL' ||
      state.failureCode === 'SEMANTIC_EXECUTED_NO_SIGNAL')
  ) {
    return t('aiQuant.detail.runtimeExecutionFailure.noSignal')
  }
  if (state.failureReason) return state.failureReason
  return '--'
}

function formatRuntimeExecutionFailureFamily(
  failureFamily: 'binding' | 'activation' | 'execution' | 'persistence' | null | undefined,
  t: DetailTranslation,
) {
  switch (failureFamily) {
    case 'binding':
      return t('aiQuant.detail.runtimeExecutionFailureFamily.binding')
    case 'activation':
      return t('aiQuant.detail.runtimeExecutionFailureFamily.activation')
    case 'execution':
      return t('aiQuant.detail.runtimeExecutionFailureFamily.execution')
    case 'persistence':
      return t('aiQuant.detail.runtimeExecutionFailureFamily.persistence')
    default:
      return '--'
  }
}

function formatRuntimeSemanticServiceStatus(
  status: AiQuantStrategyViewState,
  t: DetailTranslation,
) {
  return t(`aiQuant.detail.runtimeSemantics.serviceStatus.${status}`)
}

function formatRuntimeSemanticPositionStatus(
  summary: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>,
  t: DetailTranslation,
) {
  if (summary.positionState === 'flat') {
    return summary.marketType === 'spot'
      ? t('aiQuant.detail.runtimeSemantics.positionState.spotFlat')
      : t('aiQuant.detail.runtimeSemantics.positionState.contractFlat')
  }
  return t(`aiQuant.detail.runtimeSemantics.positionState.${summary.positionState}`)
}

function formatRuntimeSemanticCycleStatus(
  summary: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>,
  t: DetailTranslation,
) {
  return t(`aiQuant.detail.runtimeSemantics.cycleState.${summary.cycleState}`)
}

function formatRuntimeSemanticNextAction(
  summary: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>,
  status: AiQuantStrategyViewState,
  t: DetailTranslation,
) {
  if (status === 'stopped') {
    return summary.cycleState === 'needs_attention'
      ? t('aiQuant.detail.runtimeSemantics.nextAction.checkOpenPosition')
      : null
  }
  if (status !== 'running') return null
  if (summary.cycleState === 'entered') {
    return t('aiQuant.detail.runtimeSemantics.nextAction.waitExit')
  }
  if (summary.cycleState === 'waiting_entry' || summary.cycleState === 'completed') {
    return t('aiQuant.detail.runtimeSemantics.nextAction.waitEntry')
  }
  return summary.nextExpectedAction
}

function formatRuntimeSemanticExplanation(
  summary: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>,
  status: AiQuantStrategyViewState,
  symbol: string,
  t: DetailTranslation,
) {
  if (status === 'stopped' && summary.cycleState === 'needs_attention') {
    return t('aiQuant.detail.runtimeSemantics.explanation.stoppedNeedsAttention')
  }
  if (
    status === 'stopped' &&
    summary.positionState === 'flat' &&
    summary.cycleState === 'waiting_entry'
  ) {
    return t('aiQuant.detail.runtimeSemantics.explanation.stoppedFlat')
  }

  const serviceStatus = formatRuntimeSemanticServiceStatus(status, t)
  if (summary.marketType === 'spot') {
    if (summary.positionState === 'spot_holding') {
      return t('aiQuant.detail.runtimeSemantics.explanation.spotHolding', { symbol, serviceStatus })
    }
    if (summary.positionState === 'flat' && summary.cycleState === 'completed') {
      return status === 'running'
        ? t('aiQuant.detail.runtimeSemantics.explanation.spotCompletedRunning', { symbol })
        : t('aiQuant.detail.runtimeSemantics.explanation.spotCompletedStopped', {
            symbol,
            serviceStatus,
          })
    }
    if (summary.positionState === 'flat') {
      return t('aiQuant.detail.runtimeSemantics.explanation.spotWaitingEntry', {
        symbol,
        serviceStatus,
      })
    }
  }

  if (
    summary.marketType === 'perp' ||
    summary.marketType === 'futures' ||
    summary.marketType === 'swap'
  ) {
    if (summary.positionState === 'long' || summary.positionState === 'short') {
      const positionStatus = formatRuntimeSemanticPositionStatus(summary, t)
      return t('aiQuant.detail.runtimeSemantics.explanation.contractHolding', {
        positionStatus,
        serviceStatus,
      })
    }
    if (summary.positionState === 'flat' && summary.cycleState === 'completed') {
      return status === 'running'
        ? t('aiQuant.detail.runtimeSemantics.explanation.contractCompletedRunning')
        : t('aiQuant.detail.runtimeSemantics.explanation.contractCompletedStopped', {
            serviceStatus,
          })
    }
    if (summary.positionState === 'flat') {
      return t('aiQuant.detail.runtimeSemantics.explanation.contractWaitingEntry', {
        serviceStatus,
      })
    }
  }

  return t('aiQuant.detail.runtimeSemantics.explanation.unknown')
}

function formatRuntimeSemanticHeadline(
  summary: NonNullable<AiQuantStrategyRecord['runtimeSemanticSummary']>,
  status: AiQuantStrategyViewState,
  t: DetailTranslation,
) {
  return [
    formatRuntimeSemanticServiceStatus(status, t),
    formatRuntimeSemanticPositionStatus(summary, t),
    formatRuntimeSemanticCycleStatus(summary, t),
  ].join(' · ')
}

function formatOrderSemanticAction(
  order: NonNullable<AiQuantStrategyRecord['latestOrders']>[number],
  t: DetailTranslation,
) {
  const value = order.semanticAction?.trim()
  if (!value) return t('aiQuant.detail.semanticPending')

  const normalized = value.toUpperCase()
  if (value === '买入' || normalized === 'BUY')
    return t('aiQuant.detail.orderSemanticActions.spotBuy')
  if (value === '卖出' || normalized === 'SELL')
    return t('aiQuant.detail.orderSemanticActions.spotSell')
  if (value === '开多' || normalized === 'OPEN_LONG')
    return t('aiQuant.detail.orderSemanticActions.openLong')
  if (value === '开空' || normalized === 'OPEN_SHORT')
    return t('aiQuant.detail.orderSemanticActions.openShort')
  if (value === '平多' || normalized === 'CLOSE_LONG')
    return t('aiQuant.detail.orderSemanticActions.closeLong')
  if (value === '平空' || normalized === 'CLOSE_SHORT')
    return t('aiQuant.detail.orderSemanticActions.closeShort')
  if (value === '平仓' || normalized === 'FORCE_EXIT')
    return t('aiQuant.detail.orderSemanticActions.closePosition')
  if (value === '合约成交') return t('aiQuant.detail.orderSemanticActions.contractTrade')
  if (value === '语义待确认') return t('aiQuant.detail.semanticPending')

  return value
}

function formatTimelineEvent(event: string, t: DetailTranslation) {
  const normalized = event.trim()
  switch (normalized) {
    case '创建策略':
    case 'Strategy Created':
      return t('aiQuant.detail.timelineEvents.strategyCreated')
    case '订阅策略':
    case 'Subscribed Strategy':
      return t('aiQuant.detail.timelineEvents.strategySubscribed')
    case '信号执行':
    case 'Signal Executed':
      return t('aiQuant.detail.timelineEvents.signalExecuted')
    case '回测通过':
    case 'Backtest Passed':
      return t('aiQuant.detail.timelineEvents.backtestPassed')
    case '已部署':
    case 'Deployed':
      return t('aiQuant.detail.timelineEvents.deployed')
    case '已启动':
    case 'Started':
      return t('aiQuant.detail.timelineEvents.started')
    case '已停止':
    case 'Stopped':
      return t('aiQuant.detail.timelineEvents.stopped')
    default:
      return event
  }
}

function formatRuleSummary(
  rule: NonNullable<AiQuantStrategyRecord['ruleSummary']>['rules'][number],
  t: DetailTranslation,
) {
  const actions = rule.actions.length > 0 ? rule.actions.join(', ') : '--'
  if (rule.conditionKey === 'execution.on_start') {
    return t('aiQuant.detail.ruleSummary.onStart', { actions })
  }
  if (rule.conditionKey === 'price.change_pct') {
    const pct =
      typeof rule.value === 'number' ? `${formatOptionalPreciseAmount(rule.value * 100)}%` : '--'
    return t('aiQuant.detail.ruleSummary.priceChange', {
      operator: rule.operator ?? '',
      pct,
      actions,
    })
  }
  if (rule.conditionKey === 'position_loss_pct') {
    const pct =
      typeof rule.value === 'number' ? `${formatOptionalPreciseAmount(rule.value * 100)}%` : '--'
    return t('aiQuant.detail.ruleSummary.positionLoss', {
      operator: rule.operator ?? '',
      pct,
      actions,
    })
  }
  return `${rule.conditionKey ?? rule.id ?? '--'}：${actions}`
}

function formatOrderFee(
  order: NonNullable<AiQuantStrategyRecord['latestOrders']>[number],
  t: DetailTranslation,
) {
  if (order.reconcileRequired) return t('aiQuant.detail.feePendingReconcile')
  if (order.fee == null) return '--'
  if (order.fee === 0 && !order.feeCurrency && order.orderId?.startsWith('sync-')) {
    return t('aiQuant.detail.feeMissingSync')
  }
  return `${formatOptionalPreciseAmount(order.fee)} ${order.feeCurrency ?? ''}`.trim()
}

function formatLatestOrderQuantity(
  order: NonNullable<AiQuantStrategyRecord['latestOrders']>[number],
  strategySymbol: string,
  baseCurrency: string,
  t: DetailTranslation,
) {
  if (typeof order.quantity !== 'number' || !Number.isFinite(order.quantity)) {
    return { quantityLabel: '--', notionalLabel: null }
  }

  const symbol = order.symbol || strategySymbol
  const baseAsset = inferBaseAsset(symbol)
  const quoteAsset = inferQuoteAsset(symbol, baseCurrency || 'USDT')
  const quantityLabel = `${formatOptionalPreciseAmount(order.quantity)} ${baseAsset}`
  const notional =
    typeof order.price === 'number' && Number.isFinite(order.price)
      ? order.price * order.quantity
      : null
  return {
    quantityLabel,
    notionalLabel:
      notional === null
        ? null
        : t('aiQuant.detail.approx', {
            value: formatOptionalAmount(notional),
            currency: quoteAsset,
          }),
  }
}

function formatOrderEvidenceList(
  orders: Array<{ orderId: string | null; executedAt: string }> | undefined,
) {
  if (!orders?.length) return '--'
  return orders
    .map(order => `${order.executedAt}${order.orderId ? ` / ${order.orderId}` : ''}`)
    .join('；')
}

function hasChineseText(value: string) {
  return /[\u4E00-\u9FFF]/.test(value)
}

function resolveRuntimeControlErrorMessage(
  action: RuntimeAction,
  error: unknown,
  t: DetailTranslation,
  lng: 'zh' | 'en',
) {
  const fallbackMessage =
    action === 'run'
      ? t('aiQuant.detail.runFailed')
      : action === 'liquidate_and_stop'
        ? t('aiQuant.detail.liquidateAndStopFailed')
        : t('aiQuant.detail.stopFailed')

  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim()
    return lng === 'en' && hasChineseText(message) ? fallbackMessage : message
  }
  return fallbackMessage
}

interface AiQuantStrategyDetailProps {
  lng: 'zh' | 'en'
  strategy: AiQuantStrategyRecord | null
}

export function AiQuantStrategyDetail({
  lng,
  strategy: initialStrategy,
}: AiQuantStrategyDetailProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [strategy, setStrategy] = useState<AiQuantStrategyRecord | null>(initialStrategy)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [runtimeControlFeedback, setRuntimeControlFeedback] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)
  const [pendingRuntimeAction, setPendingRuntimeAction] = useState<RuntimeAction | null>(null)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [showFullTimeline, setShowFullTimeline] = useState(false)
  const [activeInfoTab, setActiveInfoTab] = useState<DetailInfoTab>('rules')

  useEffect(() => {
    setStrategy(initialStrategy)
  }, [initialStrategy])

  useEffect(() => {
    setShowFullTimeline(false)
  }, [strategy?.id])

  const series = strategy?.equitySeries ?? []
  const coords = useMemo(() => buildCoordinates(series), [series])
  const equityPolyline = useMemo(() => buildPolyline(series), [series])
  const { displayTotalPnl, displayTodayPnl } = useMemo(
    () =>
      resolveDisplayMetrics({
        totalPnl: strategy?.totalPnl,
        todayPnl: strategy?.todayPnl,
        series,
        initialCapital: strategy?.initialCapital || 10000,
      }),
    [series, strategy?.initialCapital, strategy?.todayPnl, strategy?.totalPnl],
  )
  const hoverPoint = hoverIndex !== null ? series[hoverIndex] : null
  const hoverCoord = hoverIndex !== null ? coords[hoverIndex] : null
  const adjacentChangePct = hoverIndex !== null ? deriveAdjacentChangePct(series, hoverIndex) : null
  const baseCurrency = strategy?.accountOverview?.baseCurrency ?? 'USDT'
  const dynamicParamRows = useMemo(
    () =>
      buildDynamicParamRows(strategy?.paramSchema ?? null, strategy?.paramValues ?? null).map(
        row => ({
          ...row,
          label: formatParamSnapshotLabel(row.key, row.label, t),
        }),
      ),
    [strategy?.paramSchema, strategy?.paramValues, t],
  )
  const isSpotMarket = strategy?.marketType === 'spot'
  // viewOnlyAt 非空 = 用户已主动把该策略转为只读：详情页仅作历史审计展示，
  // 所有运行/部署/编辑/杠杆变更入口都隐藏。
  const isViewOnly = Boolean(strategy?.viewOnlyAt)
  const showsDeploymentLeverage = useMemo(
    () =>
      !isSpotMarket &&
      (typeof strategy?.deploymentExecutionBaseline?.leverage === 'number' ||
        typeof strategy?.deploymentExecutionCurrent?.leverage === 'number' ||
        Boolean(strategy?.deploymentLeverageRange)),
    [
      isSpotMarket,
      strategy?.deploymentExecutionBaseline?.leverage,
      strategy?.deploymentExecutionCurrent?.leverage,
      strategy?.deploymentLeverageRange,
    ],
  )

  if (!strategy) {
    return (
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center">
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.detail.notFoundTitle')}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--cf-muted)]">
            {t('aiQuant.detail.notFoundDescription')}
          </p>
          <Link
            href={`/${lng}/account?tab=ai-quant`}
            className="mt-5 inline-flex rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            {t('aiQuant.detail.backToList')}
          </Link>
        </section>
      </main>
    )
  }

  const consumedRuntimeStates =
    strategy.runtimeExecutionStates?.filter(state => state.status === 'consumed') ?? []
  const pendingRuntimeStates =
    strategy.runtimeExecutionStates?.filter(state => state.status !== 'consumed') ?? []
  const semanticSummary = strategy.runtimeSemanticSummary
  const latestEntryOrderId = semanticSummary?.evidence.latestEntryOrderId ?? null
  const latestExitOrderId = semanticSummary?.evidence.latestExitOrderId ?? null
  const entryOrderEvidence = semanticSummary?.evidence.entryOrders
  const exitOrderEvidence = semanticSummary?.evidence.exitOrders
  const syncOrderEvidence = semanticSummary?.evidence.syncOrders
  const openPositionsCount = strategy.positionOverview?.openPositionsCount ?? 0
  const openOrdersCount = strategy.openOrdersCount
  const hasUnknownOpenOrders = openOrdersCount == null
  const hasOpenOrders = typeof openOrdersCount === 'number' && openOrdersCount > 0
  const hasRuntimeRisk = openPositionsCount > 0 || hasOpenOrders || hasUnknownOpenOrders
  const showLiquidateAndStop = strategy.status === 'running' && hasRuntimeRisk
  const exposureSummary = isSpotMarket ? formatSpotHolding(strategy, t) : `${openPositionsCount}`
  const runtimeActionDisabled = !session?.userId || pendingRuntimeAction !== null
  const semanticHeadline = semanticSummary
    ? formatRuntimeSemanticHeadline(semanticSummary, strategy.status, t)
    : null
  const semanticExplanation = semanticSummary
    ? formatRuntimeSemanticExplanation(semanticSummary, strategy.status, strategy.symbol, t)
    : null
  const semanticServiceStatus = semanticSummary
    ? formatRuntimeSemanticServiceStatus(strategy.status, t)
    : null
  const semanticPositionStatus = semanticSummary
    ? formatRuntimeSemanticPositionStatus(semanticSummary, t)
    : null
  const semanticCycleStatus = semanticSummary
    ? formatRuntimeSemanticCycleStatus(semanticSummary, t)
    : null
  const semanticNextAction = semanticSummary
    ? formatRuntimeSemanticNextAction(semanticSummary, strategy.status, t)
    : null
  const timelineItems = showFullTimeline
    ? strategy.timeline
    : strategy.timeline.slice(0, TIMELINE_PREVIEW_LIMIT)
  const hasMoreTimelineItems = strategy.timeline.length > TIMELINE_PREVIEW_LIMIT
  const currentLeverage =
    strategy.deploymentExecutionCurrent?.leverage ??
    strategy.deploymentExecutionBaseline?.leverage ??
    null
  const leverageProgress = resolveLeverageProgress(
    currentLeverage,
    strategy.deploymentLeverageRange,
  )
  const latestOrderPreview = strategy.latestOrders?.[0] ?? null
  const activeInfoTabClass =
    'border-primary bg-primary/10 text-primary dark:border-primary dark:bg-primary/20 dark:text-white'
  const idleInfoTabClass =
    'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'

  const handleRuntimeAction = async (action: RuntimeAction) => {
    if (!session?.userId || pendingRuntimeAction || !strategy) return

    setPendingRuntimeAction(action)
    setRuntimeControlFeedback(null)

    try {
      const detail = await performAccountAiQuantStrategyAction(strategy.id, {
        userId: session.userId,
        action,
      })
      setStrategy(mapAccountStrategyDetailToRecord(detail))
      setStopDialogOpen(false)
      setRuntimeControlFeedback({
        kind: 'success',
        message:
          action === 'run'
            ? t('aiQuant.detail.runSuccess')
            : action === 'liquidate_and_stop'
              ? t('aiQuant.detail.liquidateAndStopSuccess')
              : t('aiQuant.detail.stopSuccess'),
      })
    } catch (error) {
      setRuntimeControlFeedback({
        kind: 'error',
        message: resolveRuntimeControlErrorMessage(action, error, t, lng),
      })
    } finally {
      setPendingRuntimeAction(null)
    }
  }

  const openStopDialogWithLatestDetail = async () => {
    if (!session?.userId || pendingRuntimeAction || !strategy) return

    setPendingRuntimeAction('stop')
    setRuntimeControlFeedback(null)

    try {
      const detail = await fetchAccountAiQuantStrategyDetail(strategy.id, session.userId)
      setStrategy(mapAccountStrategyDetailToRecord(detail))
      setStopDialogOpen(true)
    } catch (error) {
      setRuntimeControlFeedback({
        kind: 'error',
        message: resolveRuntimeControlErrorMessage('stop', error, t, lng),
      })
    } finally {
      setPendingRuntimeAction(null)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-8 pb-24 md:px-8 lg:gap-5">
      <div>
        <Link
          href={`/${lng}/account?tab=ai-quant`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
        >
          <span className="text-base leading-none" aria-hidden="true">
            &larr;
          </span>
          {t('aiQuant.detail.backToList')}
        </Link>
      </div>
      <section className="relative overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
        <div
          className="pointer-events-none absolute -top-24 right-[-88px] h-64 w-64 rounded-full bg-emerald-500/10"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-5 border-b border-[color:var(--cf-border)] p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[strategy.status]}`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  {semanticHeadline ?? t(`aiQuant.status.${strategy.status}`)}
                </span>
                <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2.5 py-1 text-xs font-semibold text-[color:var(--cf-muted)]">
                  {strategy.exchange.toUpperCase()}
                </span>
                <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2.5 py-1 text-xs font-semibold text-[color:var(--cf-muted)]">
                  {strategy.symbol}
                </span>
                <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2.5 py-1 text-xs font-semibold text-[color:var(--cf-muted)]">
                  {strategy.timeframe}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-normal text-[color:var(--cf-text-strong)] md:text-4xl">
                {strategy.name}
              </h1>
              <p className="mt-2 text-sm font-medium text-[color:var(--cf-muted)]">
                {strategy.exchange.toUpperCase()} / {strategy.symbol} / {strategy.timeframe}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--cf-muted)] md:text-base">
                {semanticExplanation ??
                  `${strategy.exchange.toUpperCase()} / ${strategy.symbol} / ${strategy.timeframe}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] leading-5 text-[color:var(--cf-muted)]">
                <span>
                  {t('aiQuant.detail.strategyInstance')}
                  <span className="ml-1 font-mono text-[color:var(--cf-text)]" title={strategy.id}>
                    {formatCompactId(strategy.id)}
                  </span>
                </span>
                <span>
                  {t('aiQuant.detail.publishedSnapshot')}
                  <span
                    className="ml-1 font-mono text-[color:var(--cf-text)]"
                    title={strategy.publishedSnapshotId ?? undefined}
                  >
                    {formatCompactId(strategy.publishedSnapshotId)}
                  </span>
                </span>
              </div>
            </div>
            <aside
              className="min-w-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 lg:w-[280px]"
              aria-label={t('aiQuant.detail.nextExpectedAction')}
            >
              <p className="text-[11px] font-bold tracking-normal text-[color:var(--cf-muted)] uppercase">
                {t('aiQuant.detail.nextExpectedAction')}
              </p>
              <strong className="mt-2 block text-lg leading-6 text-emerald-600 dark:text-emerald-400">
                {semanticNextAction ?? t('aiQuant.detail.evidenceSource')}
              </strong>
              <p className="mt-2 text-xs leading-5 text-[color:var(--cf-muted)]">
                {strategy.status === 'running'
                  ? t('aiQuant.detail.runningDescription')
                  : t('aiQuant.detail.stoppedDescription')}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="min-w-0 space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
              <p className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.detail.totalPnl')}</p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${pnlToneClass(displayTotalPnl)}`}
              >
                {formatSignedNumber(displayTotalPnl)} USDT
              </p>
              <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.returnPct')} {formatPercentValue(strategy.metrics.returnPct)}
              </p>
            </article>
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
              <p className="text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.todayPnlLabel')}
              </p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${pnlToneClass(displayTodayPnl)}`}
              >
                {formatSignedNumber(displayTodayPnl)} USDT
              </p>
              <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.latestTrades')}{' '}
                {latestOrderPreview ? formatOrderSemanticAction(latestOrderPreview, t) : '--'}
              </p>
            </article>
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
              <p className="text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.maxDrawdown')}
              </p>
              <p className="mt-2 text-2xl font-bold text-[color:var(--cf-text-strong)] tabular-nums">
                {formatPercentValue(strategy.metrics.maxDrawdownPct)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.tradeCount')} {strategy.metrics.tradeCount}
              </p>
            </article>
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
              <p className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.detail.winRate')}</p>
              <p className="mt-2 text-2xl font-bold text-[color:var(--cf-text-strong)] tabular-nums">
                {formatPercentValue(strategy.metrics.winRatePct)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                {isSpotMarket
                  ? t('aiQuant.detail.currentHoldings')
                  : t('aiQuant.detail.currentPositionCount')}{' '}
                {isSpotMarket
                  ? formatSpotHolding(strategy, t)
                  : (strategy.positionOverview?.openPositionsCount ?? '--')}
              </p>
            </article>
          </section>

          {isViewOnly && (
            <section
              data-testid="strategy-detail-view-only-banner"
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200"
            >
              {t('aiQuant.detail.viewOnlyBanner')}
            </section>
          )}

          {!isViewOnly && (strategy.status === 'running' || strategy.status === 'stopped') && (
            <section
              data-testid="strategy-runtime-control-panel"
              className="flex flex-col gap-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 lg:hidden"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.runtimeControl')}
                  </h2>
                  <span
                    className={`w-fit rounded-lg border px-2 py-1 text-xs ${STATUS_CLASS[strategy.status]}`}
                  >
                    {strategy.status === 'running'
                      ? t('aiQuant.detail.runtimeOnline')
                      : t('aiQuant.detail.runtimeOffline')}
                  </span>
                </div>

                <div>
                  <p className="text-sm leading-6 text-[color:var(--cf-text)]">
                    {strategy.status === 'running'
                      ? showLiquidateAndStop
                        ? t(
                            isSpotMarket
                              ? 'aiQuant.detail.runningWithSpotRiskDescription'
                              : 'aiQuant.detail.runningWithRiskDescription',
                          )
                        : t('aiQuant.detail.runningDescription')
                      : t('aiQuant.detail.stoppedDescription')}
                  </p>
                  {showLiquidateAndStop && (
                    <p className="mt-2 text-xs leading-5 text-[color:var(--cf-muted)]">
                      {isSpotMarket
                        ? t('aiQuant.detail.spotRiskHint', {
                            holding: exposureSummary,
                            orders: hasUnknownOpenOrders
                              ? t('aiQuant.detail.unknown')
                              : openOrdersCount,
                          })
                        : t('aiQuant.detail.riskHint', {
                            positions: openPositionsCount,
                            orders: hasUnknownOpenOrders
                              ? t('aiQuant.detail.unknown')
                              : openOrdersCount,
                          })}
                    </p>
                  )}
                </div>

                <div
                  data-testid="strategy-runtime-control-actions"
                  className="flex w-full flex-col gap-3 border-t border-[color:var(--cf-border)] pt-4 sm:flex-row sm:items-center sm:justify-end"
                >
                  <div className="flex flex-row flex-wrap items-center gap-2 sm:justify-end">
                    {strategy.status === 'running' && (
                      <button
                        type="button"
                        onClick={() => {
                          void openStopDialogWithLatestDetail()
                        }}
                        disabled={runtimeActionDisabled}
                        className="inline-flex h-9 min-w-max items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-4 text-sm font-semibold whitespace-nowrap text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
                      >
                        {t('aiQuant.actions.stopStrategy')}
                      </button>
                    )}

                    {strategy.status === 'stopped' && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleRuntimeAction('run')
                        }}
                        disabled={runtimeActionDisabled}
                        className="inline-flex h-9 min-w-max items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold whitespace-nowrap text-emerald-600 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
                      >
                        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                        {t('aiQuant.detail.run')}
                      </button>
                    )}

                    {strategy.hasActiveConversation === true && (
                      <Link
                        href={`/${lng}/ai-quant`}
                        onClick={() => {
                          setIntent({
                            type: 'strategy-edit-session',
                            strategyInstanceId: strategy.id,
                            publishedSnapshotId: strategy.publishedSnapshotId ?? undefined,
                            source: 'account-detail',
                          })
                        }}
                        className="inline-flex h-9 min-w-max items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-white/[0.02] px-4 text-sm font-semibold whitespace-nowrap text-[color:var(--cf-text-strong)] transition hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        {t('aiQuant.detail.returnToChat')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              {runtimeControlFeedback && (
                <p
                  className={`mt-4 text-sm ${
                    runtimeControlFeedback.kind === 'error' ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {runtimeControlFeedback.message}
                </p>
              )}
            </section>
          )}

          <StopRunningStrategyDialog
            open={stopDialogOpen}
            strategy={strategy}
            pending={pendingRuntimeAction !== null}
            errorMessage={
              runtimeControlFeedback?.kind === 'error' ? runtimeControlFeedback.message : null
            }
            onStopOnly={() => {
              void handleRuntimeAction('stop')
            }}
            onLiquidateAndStop={() => {
              void handleRuntimeAction('liquidate_and_stop')
            }}
            onCancel={() => {
              if (pendingRuntimeAction) return
              setStopDialogOpen(false)
              if (runtimeControlFeedback?.kind === 'error') {
                setRuntimeControlFeedback(null)
              }
            }}
          />

          {strategy.compatibilityMetadata?.isLegacySnapshot && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <p className="font-semibold text-amber-100">
                {t('aiQuant.detail.republishRequired')}
              </p>
              <p className="mt-1">
                {t('aiQuant.detail.legacySnapshotDescription')}
                {strategy.compatibilityMetadata.requiresRepublishForBacktest
                  ? t('aiQuant.detail.republishBacktestRequired')
                  : ''}
                {strategy.compatibilityMetadata.requiresRepublishForDeploy
                  ? t('aiQuant.detail.republishDeployRequired')
                  : ''}
              </p>
            </section>
          )}

          {strategy.compatibilityMetadata?.invalidBinding && (
            <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <p className="font-semibold text-rose-100">
                {t('aiQuant.detail.snapshotBindingInvalid')}
              </p>
              <p className="mt-1">{t('aiQuant.detail.snapshotBindingInvalidDescription')}</p>
            </section>
          )}

          <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
              {formatEquitySeriesTitle(t)}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
              {formatEquitySeriesSource(strategy.marketType, t)}
            </p>
            <div className="relative mt-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <svg
                viewBox="0 0 900 220"
                className="h-56 w-full"
                onMouseMove={event => {
                  if (series.length === 0) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  const ratio = (event.clientX - rect.left) / rect.width
                  const idx = Math.max(
                    0,
                    Math.min(series.length - 1, Math.round(ratio * (series.length - 1))),
                  )
                  setHoverIndex(idx)
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="equityLine" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="url(#equityLine)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={equityPolyline}
                />
                {series.length === 1 && coords[0] && (
                  <circle cx={coords[0].x} cy={coords[0].y} r={4} fill="#38bdf8" />
                )}
                {hoverCoord && (
                  <>
                    <line
                      x1={hoverCoord.x}
                      y1={0}
                      x2={hoverCoord.x}
                      y2={220}
                      stroke="#9ca3af"
                      strokeDasharray="4 4"
                      opacity={0.5}
                    />
                    <circle cx={hoverCoord.x} cy={hoverCoord.y} r={4} fill="#38bdf8" />
                  </>
                )}
              </svg>
              {series.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.noEquityData')}
                </p>
              )}
              {series.length > 1 && (
                <>
                  <span
                    className="absolute top-[48%] left-[41%] h-3 w-3 rounded-full border-2 border-[color:var(--cf-surface)] bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
                    title={t('aiQuant.detail.latestEntry')}
                  />
                  <span
                    className="bg-primary absolute top-[28%] right-[8%] h-3 w-3 rounded-full border-2 border-[color:var(--cf-surface)] shadow-[0_0_0_3px_rgba(99,91,255,0.22)]"
                    title={t('aiQuant.detail.currentPosition')}
                  />
                </>
              )}
              {hoverPoint && hoverCoord && (
                <div
                  className="pointer-events-none absolute rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-2 text-xs text-[color:var(--cf-text)] shadow-lg"
                  style={{
                    top: '20px',
                    left:
                      hoverCoord.x > 700
                        ? `calc(${(hoverCoord.x / 900) * 100}% - 160px)`
                        : `calc(${(hoverCoord.x / 900) * 100}% + 8px)`,
                  }}
                >
                  <p className="text-[color:var(--cf-muted)]">{hoverPoint.ts}</p>
                  <p className="mt-1">
                    {t('aiQuant.detail.equity')}: {formatAmount(hoverPoint.value)} USDT
                  </p>
                  <p>
                    {t('aiQuant.detail.change')}:{' '}
                    {adjacentChangePct === null
                      ? '--'
                      : `${formatSignedNumber(adjacentChangePct)}%`}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4">
            <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                {isSpotMarket
                  ? t('aiQuant.detail.holdingOverview')
                  : t('aiQuant.detail.positionOverview')}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.positionOverviewSource')}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <p className="text-[color:var(--cf-muted)]">
                  {isSpotMarket
                    ? t('aiQuant.detail.currentHoldings')
                    : t('aiQuant.detail.currentPositionCount')}
                </p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {isSpotMarket
                    ? formatSpotHolding(strategy, t)
                    : (strategy.positionOverview?.openPositionsCount ?? '--')}
                </p>
                <p className="text-[color:var(--cf-muted)]">
                  {isSpotMarket
                    ? t('aiQuant.detail.completedSpotCycles')
                    : t('aiQuant.detail.closedPositions')}
                </p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {strategy.positionOverview?.closedPositionsCount ?? '--'}
                </p>
                <p className="text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.totalRealizedPnl')}
                </p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatOptionalAmount(strategy.positionOverview?.totalRealizedPnl)} {baseCurrency}
                </p>
                <p className="text-[color:var(--cf-muted)]">
                  {isSpotMarket
                    ? t('aiQuant.detail.currentFloatingPnl')
                    : t('aiQuant.detail.currentUnrealizedPnl')}
                </p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatOptionalAmount(strategy.positionOverview?.totalUnrealizedPnl)}{' '}
                  {baseCurrency}
                </p>
                <p className="text-[color:var(--cf-muted)]">{t('aiQuant.detail.openOrders')}</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {hasUnknownOpenOrders ? t('aiQuant.detail.unknown') : openOrdersCount}
                </p>
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
              {t('aiQuant.detail.latestTrades')}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
              {t('aiQuant.detail.latestTradesSource')}
            </p>
            {strategy.latestOrders && strategy.latestOrders.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--cf-border)] text-[color:var(--cf-muted)]">
                      <th className="py-2 pr-3">{t('aiQuant.detail.time')}</th>
                      <th className="py-2 pr-3">{t('aiQuant.detail.side')}</th>
                      <th className="py-2 pr-3">{t('aiQuant.detail.semanticAction')}</th>
                      <th className="py-2 pr-3">{t('aiQuant.symbol')}</th>
                      <th className="py-2 pr-3">{t('aiQuant.detail.price')}</th>
                      <th className="py-2 pr-3">{t('aiQuant.detail.quantityNotional')}</th>
                      <th className="py-2 pr-3">{t('aiQuant.detail.fee')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.latestOrders.map(order => {
                      const quantityDisplay = formatLatestOrderQuantity(
                        order,
                        strategy.symbol,
                        baseCurrency,
                        t,
                      )
                      return (
                        <tr
                          key={`${order.executedAt}-${order.symbol}-${order.side}-${order.orderId ?? ''}`}
                          className="border-b border-[color:var(--cf-border)]/60"
                        >
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            {order.executedAt}
                          </td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.side}</td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            <div>{formatOrderSemanticAction(order, t)}</div>
                            {order.reconcileRequired ? (
                              <div className="mt-0.5 text-xs text-amber-300">
                                {t('aiQuant.detail.localReconcilePending')}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.symbol}</td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            {formatOptionalPrice(order.price)}
                          </td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            <div>{quantityDisplay.quantityLabel}</div>
                            {quantityDisplay.notionalLabel ? (
                              <div className="mt-0.5 text-xs text-[color:var(--cf-muted)]">
                                {quantityDisplay.notionalLabel}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            {formatOrderFee(order, t)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--cf-muted)]">
                {t('aiQuant.detail.noTrades')}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-2">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {(
                [
                  ['rules', t('aiQuant.detail.tabs.rules')],
                  ['config', t('aiQuant.detail.tabs.config')],
                  ['backtest', t('aiQuant.detail.tabs.backtest')],
                  ['timeline', t('aiQuant.detail.tabs.timeline')],
                  ['diagnostics', t('aiQuant.detail.tabs.diagnostics')],
                ] as Array<[DetailInfoTab, string]>
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={activeInfoTab === tab}
                  onClick={() => setActiveInfoTab(tab)}
                  className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${activeInfoTab === tab ? activeInfoTabClass : idleInfoTabClass}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            {activeInfoTab === 'rules' &&
              (strategy.ruleSummary?.rules?.length ? (
                <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.publishedSnapshotRuleSummary')}
                  </h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {strategy.ruleSummary.rules.map(rule => (
                      <article
                        key={rule.id ?? `${rule.phase}-${rule.conditionKey}`}
                        className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3"
                      >
                        <p className="text-xs text-[color:var(--cf-muted)]">{rule.phase ?? '--'}</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--cf-text-strong)]">
                          {formatRuleSummary(rule, t)}
                        </p>
                      </article>
                    ))}
                  </div>
                </article>
              ) : (
                <article className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.legacyUnsupportedTitle')}
                  </h2>
                  <p className="mt-3 text-sm text-amber-300">
                    {t('aiQuant.legacyUnsupportedMessage')}
                  </p>
                </article>
              ))}

            {activeInfoTab === 'config' && (
              <section className="grid gap-4 md:grid-cols-2">
                {strategy.paramSchema ? (
                  <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                    <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                      {t('aiQuant.paramSnapshotTitle')}
                    </h2>
                    <div className="mt-3 space-y-2 text-sm text-[color:var(--cf-text)]">
                      {dynamicParamRows.length > 0 ? (
                        dynamicParamRows.map(row => (
                          <p key={row.key} className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <span className="text-[color:var(--cf-muted)]">{row.label}</span>
                            <span className="min-w-0 break-words">{row.value}</span>
                          </p>
                        ))
                      ) : (
                        <p className="text-[color:var(--cf-muted)]">
                          {t('aiQuant.paramSummaryEmpty')}
                        </p>
                      )}
                      {strategy.deploy && (
                        <>
                          <p className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <span className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.deployAccountLabel')}
                            </span>
                            <span className="min-w-0 break-words">
                              {strategy.deploy.accountName}
                            </span>
                          </p>
                          <p className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <span className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.deployTimeLabel')}
                            </span>
                            <span className="min-w-0 break-words">
                              {strategy.deploy.at.replace('T', ' ').slice(0, 16)}
                            </span>
                          </p>
                        </>
                      )}
                    </div>
                  </article>
                ) : null}

                <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.executionConfig')}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    {showsDeploymentLeverage && (
                      <>
                        <p className="text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.baselineExecutionLeverage')}
                        </p>
                        <p className="text-right text-[color:var(--cf-text-strong)]">
                          {formatExecutionValue(
                            strategy.deploymentExecutionBaseline?.leverage,
                            'x',
                          )}
                        </p>
                        <p className="text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.currentExecutionLeverage')}
                        </p>
                        <p className="text-right text-[color:var(--cf-text-strong)]">
                          {formatExecutionValue(strategy.deploymentExecutionCurrent?.leverage, 'x')}
                        </p>
                      </>
                    )}
                    <p className="text-[color:var(--cf-muted)]">
                      {t('aiQuant.detail.priceSource')}
                    </p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatExecutionValue(
                        strategy.deploymentExecutionCurrent?.priceSource ??
                          strategy.deploymentExecutionBaseline?.priceSource ??
                          strategy.snapshotBacktestConfigDefaults?.priceSource,
                      )}
                    </p>
                    {showsDeploymentLeverage && (
                      <>
                        <p className="text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.allowedLeverageRange')}
                        </p>
                        <p className="text-right text-[color:var(--cf-text-strong)]">
                          {strategy.deploymentLeverageRange
                            ? `${strategy.deploymentLeverageRange.min}x - ${strategy.deploymentLeverageRange.max}x`
                            : '--'}
                        </p>
                      </>
                    )}
                  </div>
                  {strategy.deploymentConstraintExplanation && (
                    <p className="mt-3 text-xs text-[color:var(--cf-muted)]">
                      {strategy.deploymentConstraintExplanation}
                    </p>
                  )}
                  {strategy.consistencySummary?.driftReasons?.length ? (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                      {strategy.consistencySummary.driftReasons.join(' / ')}
                    </div>
                  ) : null}
                </article>
              </section>
            )}

            {activeInfoTab === 'backtest' && (
              <section className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.backtestBaseline')}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <p className="text-[color:var(--cf-muted)]">
                      {t('aiQuant.detail.initialCash')}
                    </p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatExecutionValue(
                        strategy.snapshotBacktestConfigDefaults?.initialCash,
                        ' USDT',
                      )}
                    </p>
                    {!isSpotMarket && (
                      <>
                        <p className="text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.backtestLeverage')}
                        </p>
                        <p className="text-right text-[color:var(--cf-text-strong)]">
                          {formatExecutionValue(
                            strategy.snapshotBacktestConfigDefaults?.leverage,
                            'x',
                          )}
                        </p>
                      </>
                    )}
                    <p className="text-[color:var(--cf-muted)]">{t('aiQuant.detail.marketType')}</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatMarketTypeLabel(strategy.marketType, t)}
                    </p>
                    <p className="text-[color:var(--cf-muted)]">
                      {t('aiQuant.detail.priceSource')}
                    </p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatExecutionValue(strategy.snapshotBacktestConfigDefaults?.priceSource)}
                    </p>
                  </div>
                </article>
                <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.backtestBaseline')}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <p className="text-[color:var(--cf-muted)]">{t('aiQuant.detail.returnPct')}</p>
                    <p
                      className={`text-right font-semibold ${pnlToneClass(strategy.metrics.returnPct)}`}
                    >
                      {formatPercentValue(strategy.metrics.returnPct)}
                    </p>
                    <p className="text-[color:var(--cf-muted)]">
                      {t('aiQuant.detail.maxDrawdown')}
                    </p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatPercentValue(strategy.metrics.maxDrawdownPct)}
                    </p>
                    <p className="text-[color:var(--cf-muted)]">{t('aiQuant.detail.winRate')}</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatPercentValue(strategy.metrics.winRatePct)}
                    </p>
                    <p className="text-[color:var(--cf-muted)]">{t('aiQuant.detail.tradeCount')}</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {strategy.metrics.tradeCount}
                    </p>
                  </div>
                </article>
              </section>
            )}

            {activeInfoTab === 'timeline' && (
              <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                      {t('aiQuant.detail.runtimeTimeline')}
                    </h2>
                    <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                      {t('aiQuant.detail.timelineCount', { count: strategy.timeline.length })}
                      {hasMoreTimelineItems && !showFullTimeline
                        ? t('aiQuant.detail.timelinePreviewSuffix', {
                            limit: TIMELINE_PREVIEW_LIMIT,
                          })
                        : ''}
                    </p>
                  </div>
                  {hasMoreTimelineItems && (
                    <button
                      type="button"
                      onClick={() => setShowFullTimeline(curr => !curr)}
                      className="inline-flex h-8 min-w-max items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-white/[0.02] px-3 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      {showFullTimeline
                        ? t('aiQuant.detail.collapse')
                        : t('aiQuant.detail.expandAll')}
                    </button>
                  )}
                </div>
                <ol className="mt-3 space-y-3">
                  {timelineItems.map(item => (
                    <li
                      key={`${item.at}-${item.event}`}
                      className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3"
                    >
                      <p className="text-xs text-[color:var(--cf-muted)]">{item.at}</p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--cf-text-strong)]">
                        {formatTimelineEvent(item.event, t)}
                      </p>
                      {item.note && (
                        <p className="mt-1 text-xs text-[color:var(--cf-muted)]">{item.note}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </article>
            )}

            {activeInfoTab === 'diagnostics' && (
              <section className="grid gap-4">
                {semanticSummary && (
                  <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                    <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                      {t('aiQuant.detail.currentStatusExplanation')}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--cf-text)]">
                      {semanticExplanation}
                    </p>
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                        <p className="text-xs text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.strategyService')}
                        </p>
                        <p className="mt-1 font-semibold text-[color:var(--cf-text-strong)]">
                          {semanticServiceStatus}
                        </p>
                      </article>
                      <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                        <p className="text-xs text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.currentPosition')}
                        </p>
                        <p className="mt-1 font-semibold text-[color:var(--cf-text-strong)]">
                          {semanticPositionStatus}
                        </p>
                      </article>
                      <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                        <p className="text-xs text-[color:var(--cf-muted)]">
                          {t('aiQuant.detail.currentCycle')}
                        </p>
                        <p className="mt-1 font-semibold text-[color:var(--cf-text-strong)]">
                          {semanticCycleStatus}
                        </p>
                      </article>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                      <p className="text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.latestEntry')}
                        <span className="ml-1 text-[color:var(--cf-text-strong)]">
                          {semanticSummary.evidence.latestEntryAt ?? '--'}
                          {latestEntryOrderId ? ` / ${latestEntryOrderId}` : ''}
                        </span>
                      </p>
                      <p className="text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.latestExit')}
                        <span className="ml-1 text-[color:var(--cf-text-strong)]">
                          {semanticSummary.evidence.latestExitAt ?? '--'}
                          {latestExitOrderId ? ` / ${latestExitOrderId}` : ''}
                        </span>
                      </p>
                      <p className="text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.nextExpectedAction')}
                        <span className="ml-1 text-[color:var(--cf-text-strong)]">
                          {semanticNextAction ?? '--'}
                        </span>
                      </p>
                      <p className="text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.evidenceSourceLabel')}
                        <span className="ml-1 text-[color:var(--cf-text-strong)]">
                          {t('aiQuant.detail.evidenceSource')}
                        </span>
                      </p>
                    </div>
                  </article>
                )}

                <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.truthAudit')}
                  </h2>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.strategyInstance')}
                      </span>
                      <span
                        className="font-mono break-all text-[color:var(--cf-text)]"
                        title={strategy.id}
                      >
                        {formatCompactId(strategy.id)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.publishedSnapshot')}
                      </span>
                      <span
                        className="font-mono break-all text-[color:var(--cf-text)]"
                        title={strategy.publishedSnapshotId ?? undefined}
                      >
                        {formatCompactId(strategy.publishedSnapshotId)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.snapshotHash')}
                      </span>
                      <span
                        className="font-mono break-all text-[color:var(--cf-text)]"
                        title={strategy.snapshotHash ?? undefined}
                      >
                        {formatCompactId(strategy.snapshotHash)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.entryOrderEvidence')}
                      </span>
                      <span className="break-all text-[color:var(--cf-text)]">
                        {formatOrderEvidenceList(entryOrderEvidence)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.exitOrderEvidence')}
                      </span>
                      <span className="break-all text-[color:var(--cf-text)]">
                        {formatOrderEvidenceList(exitOrderEvidence)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.syncOrderEvidence')}
                      </span>
                      <span className="break-all text-[color:var(--cf-text)]">
                        {formatOrderEvidenceList(syncOrderEvidence)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="min-w-28 text-[color:var(--cf-muted)]">
                        {t('aiQuant.detail.dataBoundary')}
                      </span>
                      <span className="text-[color:var(--cf-text)]">
                        {t('aiQuant.detail.dataBoundaryText')}
                      </span>
                    </p>
                  </div>
                </article>

                {strategy.runtimeExecutionStates && strategy.runtimeExecutionStates.length > 0 && (
                  <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                    <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                      {t('aiQuant.detail.advancedRuntimeDiagnostics')}
                    </h2>
                    <p className="mt-2 text-sm text-[color:var(--cf-muted)]">
                      {t('aiQuant.detail.runtimeDiagnosticsSummary', {
                        consumed: consumedRuntimeStates.length,
                        pending: pendingRuntimeStates.length,
                      })}
                    </p>
                    <div className="mt-3 space-y-3">
                      {strategy.runtimeExecutionStates.map(state => (
                        <article
                          key={`${state.publishedSnapshotId}:${state.executionSemanticKey}`}
                          className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[color:var(--cf-text-strong)]">
                                {state.executionSemanticKey}
                              </p>
                              <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                                {t('aiQuant.detail.snapshot', { id: state.publishedSnapshotId })}
                              </p>
                            </div>
                            <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 py-1 text-xs text-[color:var(--cf-text-strong)]">
                              {formatRuntimeExecutionStatus(state.status, t)}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                            <p className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.detail.lastAttempt')}
                              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                                {formatRuntimeExecutionAt(state.lastAttemptAt)}
                              </span>
                            </p>
                            <p className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.detail.consumedAt')}
                              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                                {formatRuntimeExecutionAt(state.consumedAt)}
                              </span>
                            </p>
                            <p className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.detail.cooldownUntil')}
                              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                                {formatRuntimeExecutionAt(state.cooldownUntil)}
                              </span>
                            </p>
                            <p className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.detail.failureFamily')}
                              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                                {formatRuntimeExecutionFailureFamily(state.failureFamily, t)}
                              </span>
                            </p>
                            <p className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.detail.failureReason')}
                              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                                {formatRuntimeExecutionFailureReason(state, t)}
                              </span>
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                )}
              </section>
            )}
          </section>
        </section>

        <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block">
          {!isViewOnly && (strategy.status === 'running' || strategy.status === 'stopped') && (
            <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                {t('aiQuant.detail.runtimeControl')}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--cf-muted)]">
                {strategy.status === 'running'
                  ? t('aiQuant.detail.runningDescription')
                  : t('aiQuant.detail.stoppedDescription')}
              </p>
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  {strategy.status === 'running'
                    ? t('aiQuant.detail.runtimeOnline')
                    : t('aiQuant.detail.runtimeOffline')}
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--cf-muted)]">
                  {showLiquidateAndStop
                    ? isSpotMarket
                      ? t('aiQuant.detail.spotRiskHint', {
                          holding: exposureSummary,
                          orders: hasUnknownOpenOrders
                            ? t('aiQuant.detail.unknown')
                            : openOrdersCount,
                        })
                      : t('aiQuant.detail.riskHint', {
                          positions: openPositionsCount,
                          orders: hasUnknownOpenOrders
                            ? t('aiQuant.detail.unknown')
                            : openOrdersCount,
                        })
                    : strategy.status === 'running'
                      ? t('aiQuant.detail.runningDescription')
                      : t('aiQuant.detail.stoppedDescription')}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {strategy.status === 'running' && (
                  <button
                    type="button"
                    onClick={() => {
                      void openStopDialogWithLatestDetail()
                    }}
                    disabled={runtimeActionDisabled}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
                  >
                    {t('aiQuant.actions.stopStrategy')}
                  </button>
                )}
                {strategy.status === 'stopped' && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleRuntimeAction('run')
                    }}
                    disabled={runtimeActionDisabled}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    {t('aiQuant.detail.run')}
                  </button>
                )}
                {strategy.hasActiveConversation === true && (
                  <Link
                    href={`/${lng}/ai-quant`}
                    onClick={() => {
                      setIntent({
                        type: 'strategy-edit-session',
                        strategyInstanceId: strategy.id,
                        publishedSnapshotId: strategy.publishedSnapshotId ?? undefined,
                        source: 'account-detail',
                      })
                    }}
                    className="from-primary to-secondary shadow-primary/15 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r px-4 text-sm font-semibold !text-white text-white shadow-lg"
                  >
                    {t('aiQuant.detail.returnToChat')}
                  </Link>
                )}
              </div>
              {runtimeControlFeedback && (
                <p
                  className={`mt-4 text-sm ${
                    runtimeControlFeedback.kind === 'error'
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {runtimeControlFeedback.message}
                </p>
              )}
            </article>
          )}

          <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
              {t('aiQuant.detail.accountOverview')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[color:var(--cf-muted)]">
              {t('aiQuant.detail.accountOverviewSource')}
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between gap-3 border-b border-[color:var(--cf-border)] pb-3">
                <span className="text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.totalEquity')}
                </span>
                <strong className="text-right text-[color:var(--cf-text-strong)]">
                  {formatOptionalAmount(strategy.accountOverview?.totalEquity)} {baseCurrency}
                </strong>
              </p>
              <p className="flex justify-between gap-3 border-b border-[color:var(--cf-border)] pb-3">
                <span className="text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.availableBalance')}
                </span>
                <strong className="text-right text-[color:var(--cf-text-strong)]">
                  {formatOptionalAmount(strategy.accountOverview?.availableBalance)} {baseCurrency}
                </strong>
              </p>
              <p className="flex justify-between gap-3 border-b border-[color:var(--cf-border)] pb-3">
                <span className="text-[color:var(--cf-muted)]">
                  {isSpotMarket
                    ? t('aiQuant.detail.currentHoldings')
                    : t('aiQuant.detail.currentPositionCount')}
                </span>
                <strong className="text-right text-[color:var(--cf-text-strong)]">
                  {isSpotMarket
                    ? formatSpotHolding(strategy, t)
                    : (strategy.positionOverview?.openPositionsCount ?? '--')}
                </strong>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.todayPnlLabel')}
                </span>
                <strong
                  className={`text-right ${pnlToneClass(strategy.accountOverview?.todayPnl)}`}
                >
                  {typeof strategy.accountOverview?.todayPnl === 'number'
                    ? formatSignedNumber(strategy.accountOverview.todayPnl)
                    : '--'}{' '}
                  {baseCurrency}
                </strong>
              </p>
            </div>
            {showsDeploymentLeverage && (
              <div className="mt-5 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.detail.currentExecutionLeverage')}
                  </h3>
                  <span className="rounded-full border border-[color:var(--cf-border)] px-2.5 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)]">
                    {formatExecutionValue(currentLeverage, 'x')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[color:var(--cf-muted)]">
                  {strategy.deploymentLeverageRange
                    ? `${t('aiQuant.detail.allowedLeverageRange')} ${strategy.deploymentLeverageRange.min}x-${strategy.deploymentLeverageRange.max}x`
                    : t('aiQuant.detail.allowedLeverageRange')}
                </p>
                <div className="relative mt-4 h-12">
                  <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-[color:var(--cf-surface-2)]" />
                  <div
                    className="to-primary absolute top-4 left-0 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500"
                    style={{ width: `${leverageProgress}%` }}
                  />
                  <div
                    className="bg-primary shadow-primary/25 absolute top-2 h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--cf-surface)] shadow-lg"
                    style={{ left: `${leverageProgress}%` }}
                  />
                  {strategy.deploymentLeverageRange && (
                    <>
                      <span className="absolute bottom-0 left-0 text-[11px] font-semibold text-[color:var(--cf-muted)]">
                        {strategy.deploymentLeverageRange.min}x
                      </span>
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-[color:var(--cf-muted)]">
                        {Math.round(
                          (strategy.deploymentLeverageRange.min +
                            strategy.deploymentLeverageRange.max) /
                            2,
                        )}
                        x
                      </span>
                      <span className="absolute right-0 bottom-0 text-[11px] font-semibold text-[color:var(--cf-muted)]">
                        {strategy.deploymentLeverageRange.max}x
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                  {t('aiQuant.detail.strategyService')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.evidenceSource')}
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                READY
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.strategyService')}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {strategy.status === 'running'
                    ? t('aiQuant.detail.runtimeOnline')
                    : t('aiQuant.detail.runtimeOffline')}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.maxDrawdown')}
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--cf-text-strong)]">
                  {formatPercentValue(strategy.metrics.maxDrawdownPct)}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
              {t('aiQuant.detail.backtestBaseline')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[color:var(--cf-muted)]">
              {t('aiQuant.detail.backtestBaseline')} /{' '}
              {formatMarketTypeLabel(strategy.marketType, t)}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.returnPct')}
                </p>
                <p
                  className={`mt-1 text-sm font-bold tabular-nums ${pnlToneClass(strategy.metrics.returnPct)}`}
                >
                  {formatPercentValue(strategy.metrics.returnPct)}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.maxDrawdown')}
                </p>
                <p className="mt-1 text-sm font-bold text-[color:var(--cf-text-strong)] tabular-nums">
                  {formatPercentValue(strategy.metrics.maxDrawdownPct)}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.winRate')}
                </p>
                <p className="mt-1 text-sm font-bold text-[color:var(--cf-text-strong)] tabular-nums">
                  {formatPercentValue(strategy.metrics.winRatePct)}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between gap-3 border-b border-[color:var(--cf-border)] pb-3">
                <span className="text-[color:var(--cf-muted)]">
                  {t('aiQuant.detail.initialCash')}
                </span>
                <strong className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(
                    strategy.snapshotBacktestConfigDefaults?.initialCash,
                    ' USDT',
                  )}
                </strong>
              </p>
              {!isSpotMarket && (
                <p className="flex justify-between gap-3">
                  <span className="text-[color:var(--cf-muted)]">
                    {t('aiQuant.detail.backtestLeverage')}
                  </span>
                  <strong className="text-right text-[color:var(--cf-text-strong)]">
                    {formatExecutionValue(strategy.snapshotBacktestConfigDefaults?.leverage, 'x')}
                  </strong>
                </p>
              )}
            </div>
          </article>
        </aside>
      </div>
      {!isViewOnly && (strategy.status === 'running' || strategy.status === 'stopped') && (
        <div
          className={`fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]/95 p-3 shadow-2xl backdrop-blur lg:hidden ${strategy.hasActiveConversation === true ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1'}`}
        >
          {strategy.status === 'running' && (
            <button
              type="button"
              onClick={() => {
                void openStopDialogWithLatestDetail()
              }}
              disabled={runtimeActionDisabled}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
            >
              {t('aiQuant.actions.stopStrategy')}
            </button>
          )}
          {strategy.status === 'stopped' && (
            <button
              type="button"
              onClick={() => {
                void handleRuntimeAction('run')
              }}
              disabled={runtimeActionDisabled}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              {t('aiQuant.detail.run')}
            </button>
          )}
          {strategy.hasActiveConversation === true && (
            <Link
              href={`/${lng}/ai-quant`}
              onClick={() => {
                setIntent({
                  type: 'strategy-edit-session',
                  strategyInstanceId: strategy.id,
                  publishedSnapshotId: strategy.publishedSnapshotId ?? undefined,
                  source: 'account-detail',
                })
              }}
              className="from-primary to-secondary shadow-primary/15 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r px-4 text-sm font-semibold !text-white text-white shadow-lg"
            >
              {t('aiQuant.detail.returnToChat')}
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
