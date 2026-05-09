'use client'

import type { AiQuantStrategyRecord, StrategyEquityPoint, AiQuantStrategyViewState } from './ai-quant-strategy-store'
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

const STATUS_LABEL: Record<AiQuantStrategyViewState, string> = {
  running: '运行中',
  stopped: '已停止',
  draft: '草稿',
}

const STATUS_CLASS: Record<AiQuantStrategyViewState, string> = {
  running: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  stopped: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  draft: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

const EQUITY_CHART_WIDTH = 900
const EQUITY_CHART_HEIGHT = 220
const EQUITY_CHART_PADDING_Y = 16
const STOP_SUCCESS_MESSAGE = '策略已停止。现有持仓和挂单仍然保留，需要你单独管理。'
const LIQUIDATE_AND_STOP_SUCCESS_MESSAGE = '策略已平仓并停止。'
const STOP_ERROR_MESSAGE = '停止策略失败，请稍后重试。'
const LIQUIDATE_AND_STOP_ERROR_MESSAGE = '平仓并停止失败，请检查模拟盘账户状态后重试。'
const MAX_LEVERAGE_OPTION_COUNT = 200

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
  return Number(value.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
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

function formatMarketTypeLabel(marketType: AiQuantStrategyRecord['marketType']) {
  switch (marketType) {
    case 'spot':
      return '现货'
    case 'perp':
    case 'swap':
      return '永续合约'
    case 'futures':
      return '交割合约'
    default:
      return '--'
  }
}

function isContractMarket(marketType: AiQuantStrategyRecord['marketType']) {
  return marketType === 'perp' || marketType === 'swap' || marketType === 'futures'
}

function formatEquitySeriesTitle() {
  return '策略收益曲线'
}

function formatEquitySeriesSource(marketType: AiQuantStrategyRecord['marketType']) {
  return isContractMarket(marketType)
    ? '来源：策略合约账户权益台账，按保证金币种、已实现/未实现盈亏口径展示。'
    : '来源：策略现货账户权益台账，按现金余额、持币市值、已实现/未实现盈亏口径展示。'
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

function formatSpotHoldingCount(openPositionsCount: number | null | undefined, symbol: string) {
  if (typeof openPositionsCount !== 'number' || !Number.isFinite(openPositionsCount)) return '--'
  if (openPositionsCount === 0) return `0 ${inferBaseAsset(symbol)}`
  return `${openPositionsCount} 个持币记录`
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

function formatRuntimeExecutionStatus(status: string) {
  switch (status) {
    case 'ready':
      return '待执行'
    case 'consumed':
      return '已执行'
    case 'failed':
      return '失败'
    case 'cooldown':
      return '冷却中'
    default:
      return status || '--'
  }
}

function formatRuntimeExecutionAt(ts: string | null | undefined) {
  if (!ts) return '--'
  return formatDetailTime(ts)
}

function formatRuntimeExecutionFailureReason(state: {
  failureFamily?: 'binding' | 'activation' | 'execution' | 'persistence' | null
  failureReason?: string | null
  failureCode?: string | null
}) {
  if (state.failureFamily === 'binding') {
    return '部署绑定异常，请重新发布并重新部署'
  }
  if (state.failureFamily === 'activation') {
    if (state.failureCode === 'SNAPSHOT_REFERENCE_BAR_MISSING') {
      return '当前执行条件未满足（缺少参考K线）'
    }
    return '当前执行条件未满足'
  }
  if (state.failureFamily === 'persistence') {
    return '信号已生成但持久化失败'
  }
  if (
    state.failureFamily === 'execution'
    && (state.failureCode === 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL'
      || state.failureCode === 'SNAPSHOT_SCRIPT_NO_SIGNAL'
      || state.failureCode === 'SEMANTIC_EXECUTED_NO_SIGNAL')
  ) {
    return '未生成可执行信号'
  }
  if (state.failureReason) return state.failureReason
  return '--'
}

function formatRuntimeExecutionFailureFamily(
  failureFamily: 'binding' | 'activation' | 'execution' | 'persistence' | null | undefined,
) {
  switch (failureFamily) {
    case 'binding':
      return '绑定'
    case 'activation':
      return '激活'
    case 'execution':
      return '执行'
    case 'persistence':
      return '持久化'
    default:
      return '--'
  }
}

function formatRuleSummary(rule: NonNullable<AiQuantStrategyRecord['ruleSummary']>['rules'][number]) {
  const actions = rule.actions.length > 0 ? rule.actions.join(', ') : '--'
  if (rule.conditionKey === 'execution.on_start') {
    return `启动时执行：${actions}`
  }
  if (rule.conditionKey === 'price.change_pct') {
    const pct = typeof rule.value === 'number' ? `${formatOptionalPreciseAmount(rule.value * 100)}%` : '--'
    return `价格变化 ${rule.operator ?? ''} ${pct}：${actions}`
  }
  if (rule.conditionKey === 'position_loss_pct') {
    const pct = typeof rule.value === 'number' ? `${formatOptionalPreciseAmount(rule.value * 100)}%` : '--'
    return `持仓亏损 ${rule.operator ?? ''} ${pct}：${actions}`
  }
  return `${rule.conditionKey ?? rule.id ?? '--'}：${actions}`
}

function formatOrderFee(order: NonNullable<AiQuantStrategyRecord['latestOrders']>[number]) {
  if (order.reconcileRequired) return '待对账'
  if (order.fee == null) return '--'
  if (order.fee === 0 && !order.feeCurrency && order.orderId?.startsWith('sync-')) {
    return '--（同步记录未含手续费）'
  }
  return `${formatOptionalPreciseAmount(order.fee)} ${order.feeCurrency ?? ''}`.trim()
}

function formatLatestOrderQuantity(
  order: NonNullable<AiQuantStrategyRecord['latestOrders']>[number],
  strategySymbol: string,
  baseCurrency: string,
) {
  if (typeof order.quantity !== 'number' || !Number.isFinite(order.quantity)) {
    return { quantityLabel: '--', notionalLabel: null }
  }

  const symbol = order.symbol || strategySymbol
  const baseAsset = inferBaseAsset(symbol)
  const quoteAsset = inferQuoteAsset(symbol, baseCurrency || 'USDT')
  const quantityLabel = `${formatOptionalPreciseAmount(order.quantity)} ${baseAsset}`
  const notional = typeof order.price === 'number' && Number.isFinite(order.price)
    ? order.price * order.quantity
    : null
  const notionalLabel = notional === null
    ? null
    : `约 ${formatOptionalAmount(notional)} ${quoteAsset}`

  return { quantityLabel, notionalLabel }
}

function formatOrderEvidenceList(
  orders: Array<{ orderId: string | null; executedAt: string }> | undefined,
) {
  if (!orders?.length) return '--'
  return orders
    .map(order => `${order.executedAt}${order.orderId ? ` / ${order.orderId}` : ''}`)
    .join('；')
}

function resolveRuntimeControlErrorMessage(
  action: 'stop' | 'liquidate_and_stop',
  error: unknown,
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return action === 'liquidate_and_stop' ? LIQUIDATE_AND_STOP_ERROR_MESSAGE : STOP_ERROR_MESSAGE
}

interface AiQuantStrategyDetailProps {
  lng: 'zh' | 'en'
  strategy: AiQuantStrategyRecord | null
  onUpdateLeverage?: (leverage: number) => Promise<void> | void
  isUpdatingLeverage?: boolean
  leverageUpdateError?: string | null
}

export function AiQuantStrategyDetail({
  lng,
  strategy: initialStrategy,
  onUpdateLeverage,
  isUpdatingLeverage = false,
  leverageUpdateError = null,
}: AiQuantStrategyDetailProps) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [strategy, setStrategy] = useState<AiQuantStrategyRecord | null>(initialStrategy)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [leverageDraft, setLeverageDraft] = useState<number | ''>('')
  const [runtimeControlFeedback, setRuntimeControlFeedback] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)
  const [pendingRuntimeAction, setPendingRuntimeAction] = useState<'stop' | 'liquidate_and_stop' | null>(null)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)

  useEffect(() => {
    setStrategy(initialStrategy)
  }, [initialStrategy])

  const series = strategy?.equitySeries ?? []
  const coords = useMemo(() => buildCoordinates(series), [series])
  const { displayTotalPnl, displayTodayPnl } = useMemo(
    () => resolveDisplayMetrics({
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
    () => buildDynamicParamRows(strategy?.paramSchema ?? null, strategy?.paramValues ?? null),
    [strategy?.paramSchema, strategy?.paramValues],
  )
  const isSpotMarket = strategy?.marketType === 'spot'
  // viewOnlyAt 非空 = 用户已主动把该策略转为只读：详情页仅作历史审计展示，
  // 所有运行/部署/编辑/杠杆变更入口都隐藏。
  const isViewOnly = Boolean(strategy?.viewOnlyAt)
  const canEditLeverage = Boolean(!isSpotMarket && !isViewOnly && strategy?.canEditDeploymentLeverage && onUpdateLeverage)
  const showsDeploymentLeverage = useMemo(() => (
    !isSpotMarket && (
      typeof strategy?.deploymentExecutionBaseline?.leverage === 'number'
    || typeof strategy?.deploymentExecutionCurrent?.leverage === 'number'
    || Boolean(strategy?.deploymentLeverageRange)
    || canEditLeverage)
  ), [
    canEditLeverage,
    isSpotMarket,
    strategy?.deploymentExecutionBaseline?.leverage,
    strategy?.deploymentExecutionCurrent?.leverage,
    strategy?.deploymentLeverageRange,
  ])
  const leverageOptions = useMemo(() => {
    if (!strategy?.deploymentLeverageRange) return []
    const { min, max } = strategy.deploymentLeverageRange
    if (
      !Number.isInteger(min)
      || !Number.isInteger(max)
      || min < 1
      || max < min
      || max - min + 1 > MAX_LEVERAGE_OPTION_COUNT
    ) {
      return []
    }
    return Array.from({
      length: max - min + 1,
    }).map((_, index) => min + index)
  }, [strategy?.deploymentLeverageRange])

  if (!strategy) {
    return (
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center">
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">策略不存在或不可访问</h1>
          <p className="mt-2 text-sm text-[color:var(--cf-muted)]">请返回 AI量化列表重新选择已部署策略。</p>
          <Link
            href={`/${lng}/account?tab=ai-quant`}
            className="mt-5 inline-flex rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            返回列表
          </Link>
        </section>
      </main>
    )
  }

  const consumedRuntimeStates = strategy.runtimeExecutionStates?.filter(state => state.status === 'consumed') ?? []
  const pendingRuntimeStates = strategy.runtimeExecutionStates?.filter(state => state.status !== 'consumed') ?? []
  const semanticSummary = strategy.runtimeSemanticSummary
  const latestEntryOrderId = semanticSummary?.evidence.latestEntryOrderId ?? null
  const latestExitOrderId = semanticSummary?.evidence.latestExitOrderId ?? null
  const entryOrderEvidence = semanticSummary?.evidence.entryOrders
  const exitOrderEvidence = semanticSummary?.evidence.exitOrders
  const syncOrderEvidence = semanticSummary?.evidence.syncOrders
  const openPositionsCount = strategy.positionOverview?.openPositionsCount ?? 0
  const openOrdersCount = strategy.openOrdersCount
  const hasUnknownOpenOrders = openOrdersCount == null
  const hasRuntimeRisk = openPositionsCount > 0 || hasUnknownOpenOrders || openOrdersCount > 0
  const showLiquidateAndStop = strategy.status === 'running' && hasRuntimeRisk
  const runtimeActionDisabled = !session?.userId || pendingRuntimeAction !== null

  const handleRuntimeAction = async (action: 'stop' | 'liquidate_and_stop') => {
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
        message: action === 'liquidate_and_stop'
          ? LIQUIDATE_AND_STOP_SUCCESS_MESSAGE
          : STOP_SUCCESS_MESSAGE,
      })
    } catch (error) {
      setRuntimeControlFeedback({
        kind: 'error',
        message: resolveRuntimeControlErrorMessage(action, error),
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
        message: resolveRuntimeControlErrorMessage('stop', error),
      })
    } finally {
      setPendingRuntimeAction(null)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-4 px-4 py-8 md:px-8">
      <section className="flex items-center justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{strategy.name}</h1>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
            {strategy.exchange.toUpperCase()} / {strategy.symbol} / {strategy.timeframe}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-lg border px-2 py-1 text-xs ${STATUS_CLASS[strategy.status]}`}>
            {semanticSummary?.headline ?? STATUS_LABEL[strategy.status]}
          </span>
          <Link
            href={`/${lng}/account?tab=ai-quant`}
            className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)]"
          >
            返回列表
          </Link>
        </div>
      </section>

      {isViewOnly && (
        <section
          data-testid="strategy-detail-view-only-banner"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200"
        >
          该策略已设为只读，所有运行控制操作均已禁用，仅作历史记录展示。
        </section>
      )}

      {!isViewOnly && (strategy.status === 'running' || strategy.status === 'stopped') && (
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">运行控制</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--cf-text)]">
                {strategy.status === 'running'
                  ? (showLiquidateAndStop
                      ? '策略当前正在运行且账户中存在持仓、未成交挂单，或暂时无法确认挂单状态。你可以只停止策略，或先撤销未成交挂单并平仓后再停止。'
                      : '策略当前正在运行。停止策略只会停止运行实例，现有持仓和挂单仍然保留。')
                  : '策略当前已停止。可返回 AI Quant 重新部署当前已发布版本。'}
              </p>
              {showLiquidateAndStop && (
                <p className="mt-2 text-xs text-[color:var(--cf-muted)]">
                  检测到 {openPositionsCount} 个 open positions，当前未成交挂单 {hasUnknownOpenOrders ? '待确认' : openOrdersCount} 条；平仓并停止会先尝试撤销当前策略交易对的交易所未成交挂单，再处理持仓。
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {strategy.status === 'stopped' && (
                <Link
                  href={`/${lng}/ai-quant`}
                  className="from-primary to-secondary rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white"
                >
                  重新部署
                </Link>
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
                  className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
                >
                  返回对话
                </Link>
              )}
            </div>
            {strategy.status === 'running' && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void openStopDialogWithLatestDetail()
                  }}
                  disabled={runtimeActionDisabled}
                  className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:text-[color:var(--cf-muted)]"
                >
                  停止策略
                </button>
                {showLiquidateAndStop && (
                  <button
                    type="button"
                    onClick={() => {
                      void openStopDialogWithLatestDetail()
                    }}
                    disabled={runtimeActionDisabled}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    平仓并停止
                  </button>
                )}
              </div>
            )}
          </div>
          {runtimeControlFeedback && (
            <p className={`mt-4 text-sm ${
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
        errorMessage={runtimeControlFeedback?.kind === 'error' ? runtimeControlFeedback.message : null}
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
          <p className="font-semibold text-amber-100">需要重新发布</p>
          <p className="mt-1">
            当前快照仍是 legacy 结构。
            {strategy.compatibilityMetadata.requiresRepublishForBacktest ? ' 回测前需要重新发布。' : ''}
            {strategy.compatibilityMetadata.requiresRepublishForDeploy ? ' 重新部署前也需要重新发布。' : ''}
          </p>
        </section>
      )}

      {strategy.compatibilityMetadata?.invalidBinding && (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <p className="font-semibold text-rose-100">快照绑定已失效</p>
          <p className="mt-1">
            当前部署实例的运行时绑定与快照真相不一致，已自动隐藏执行配置与运行时状态。请重新发布并重新部署。
          </p>
        </section>
      )}

      {semanticSummary && (
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">当前状态解释</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--cf-text)]">{semanticSummary.explanation}</p>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <p className="text-xs text-[color:var(--cf-muted)]">策略服务</p>
              <p className="mt-1 font-semibold text-[color:var(--cf-text-strong)]">{semanticSummary.serviceStatusLabel}</p>
            </article>
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <p className="text-xs text-[color:var(--cf-muted)]">当前仓位</p>
              <p className="mt-1 font-semibold text-[color:var(--cf-text-strong)]">{semanticSummary.positionStatusLabel}</p>
            </article>
            <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
              <p className="text-xs text-[color:var(--cf-muted)]">当前周期</p>
              <p className="mt-1 font-semibold text-[color:var(--cf-text-strong)]">{semanticSummary.cycleStatusLabel}</p>
            </article>
          </div>
          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <p className="text-[color:var(--cf-muted)]">
              最近入场：
              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                {semanticSummary.evidence.latestEntryAt ?? '--'}
                {latestEntryOrderId ? ` / ${latestEntryOrderId}` : ''}
              </span>
            </p>
            <p className="text-[color:var(--cf-muted)]">
              最近出场：
              <span className="ml-1 text-[color:var(--cf-text-strong)]">
                {semanticSummary.evidence.latestExitAt ?? '--'}
                {latestExitOrderId ? ` / ${latestExitOrderId}` : ''}
              </span>
            </p>
            <p className="text-[color:var(--cf-muted)]">
              下一步预期：
              <span className="ml-1 text-[color:var(--cf-text-strong)]">{semanticSummary.nextExpectedAction ?? '--'}</span>
            </p>
            <p className="text-[color:var(--cf-muted)]">
              证据来源：
              <span className="ml-1 text-[color:var(--cf-text-strong)]">本地持仓台账、最新成交、发布快照规则</span>
            </p>
          </div>
        </section>
      )}

      {strategy.runtimeExecutionStates && strategy.runtimeExecutionStates.length > 0 && (
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">高级运行诊断</h2>
          <p className="mt-2 text-sm text-[color:var(--cf-muted)]">
            已执行 {consumedRuntimeStates.length} 个运行诊断项，待执行/冷却/失败 {pendingRuntimeStates.length} 个。
            当前状态只代表已注册的运行语义，不等同于所有规则都已进入持续监控。
          </p>
          <div className="mt-3 space-y-3">
            {strategy.runtimeExecutionStates.map((state) => (
              <article
                key={`${state.publishedSnapshotId}:${state.executionSemanticKey}`}
                className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{state.executionSemanticKey}</p>
                    <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                      快照：{state.publishedSnapshotId}
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 py-1 text-xs text-[color:var(--cf-text-strong)]">
                    {formatRuntimeExecutionStatus(state.status)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <p className="text-[color:var(--cf-muted)]">
                    最近尝试：
                    <span className="ml-1 text-[color:var(--cf-text-strong)]">{formatRuntimeExecutionAt(state.lastAttemptAt)}</span>
                  </p>
                  <p className="text-[color:var(--cf-muted)]">
                    已执行时间：
                    <span className="ml-1 text-[color:var(--cf-text-strong)]">{formatRuntimeExecutionAt(state.consumedAt)}</span>
                  </p>
                  <p className="text-[color:var(--cf-muted)]">
                    冷却到期：
                    <span className="ml-1 text-[color:var(--cf-text-strong)]">{formatRuntimeExecutionAt(state.cooldownUntil)}</span>
                  </p>
                  <p className="text-[color:var(--cf-muted)]">
                    失败分类：
                    <span className="ml-1 text-[color:var(--cf-text-strong)]">
                      {formatRuntimeExecutionFailureFamily(state.failureFamily)}
                    </span>
                  </p>
                  <p className="text-[color:var(--cf-muted)]">
                    失败原因：
                    <span className="ml-1 text-[color:var(--cf-text-strong)]">{formatRuntimeExecutionFailureReason(state)}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {strategy.ruleSummary?.rules?.length ? (
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">发布快照规则摘要</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {strategy.ruleSummary.rules.map(rule => (
              <article key={rule.id ?? `${rule.phase}-${rule.conditionKey}`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">{rule.phase ?? '--'}</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--cf-text-strong)]">{formatRuleSummary(rule)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(strategy.snapshotBacktestConfigDefaults || strategy.deploymentExecutionBaseline || strategy.deploymentExecutionCurrent) && (
        <section className="grid gap-4 md:grid-cols-2">
          {strategy.snapshotBacktestConfigDefaults && (
            <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">回测基线</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <p className="text-[color:var(--cf-muted)]">初始资金</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.snapshotBacktestConfigDefaults.initialCash, ' USDT')}
                </p>
                {!isSpotMarket && (
                  <>
                    <p className="text-[color:var(--cf-muted)]">回测杠杆</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatExecutionValue(strategy.snapshotBacktestConfigDefaults.leverage, 'x')}
                    </p>
                  </>
                )}
                <p className="text-[color:var(--cf-muted)]">市场类型</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatMarketTypeLabel(strategy.marketType)}
                </p>
                <p className="text-[color:var(--cf-muted)]">价格来源</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.snapshotBacktestConfigDefaults.priceSource)}
                </p>
              </div>
            </article>
          )}

          {(strategy.deploymentExecutionBaseline || strategy.deploymentExecutionCurrent) && (
            <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">执行配置</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {showsDeploymentLeverage && (
                  <>
                    <p className="text-[color:var(--cf-muted)]">基线执行杠杆</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatExecutionValue(strategy.deploymentExecutionBaseline?.leverage, 'x')}
                    </p>
                    <p className="text-[color:var(--cf-muted)]">当前执行杠杆</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {formatExecutionValue(strategy.deploymentExecutionCurrent?.leverage, 'x')}
                    </p>
                  </>
                )}
                <p className="text-[color:var(--cf-muted)]">价格来源</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.deploymentExecutionCurrent?.priceSource ?? strategy.deploymentExecutionBaseline?.priceSource)}
                </p>
                {showsDeploymentLeverage && (
                  <>
                    <p className="text-[color:var(--cf-muted)]">允许杠杆范围</p>
                    <p className="text-right text-[color:var(--cf-text-strong)]">
                      {strategy.deploymentLeverageRange
                        ? `${strategy.deploymentLeverageRange.min}x - ${strategy.deploymentLeverageRange.max}x`
                        : '--'}
                    </p>
                  </>
                )}
              </div>
              {showsDeploymentLeverage && strategy.deploymentConstraintExplanation && (
                <p className="mt-3 text-xs text-[color:var(--cf-muted)]">{strategy.deploymentConstraintExplanation}</p>
              )}
              {strategy.consistencySummary?.driftReasons?.length
                ? (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      {strategy.consistencySummary.driftReasons.join(' / ')}
                    </div>
                  )
                : null}
              {canEditLeverage && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-[color:var(--cf-muted)]" htmlFor="deployment-leverage">
                    部署杠杆
                  </label>
                  <select
                    id="deployment-leverage"
                    name="deployment-leverage"
                    value={leverageDraft === '' ? '' : String(leverageDraft)}
                    onChange={(event) => setLeverageDraft(Number(event.target.value))}
                    className="h-9 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 text-sm text-[color:var(--cf-text)]"
                  >
                    <option value="">选择杠杆</option>
                    {leverageOptions.map(option => (
                      <option key={option} value={option}>{option}x</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof leverageDraft === 'number' && Number.isFinite(leverageDraft)) {
                        void onUpdateLeverage?.(leverageDraft)
                      }
                    }}
                    disabled={typeof leverageDraft !== 'number' || isUpdatingLeverage}
                    className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:text-[color:var(--cf-muted)]"
                  >
                    {isUpdatingLeverage ? '更新中…' : '更新杠杆'}
                  </button>
                </div>
              )}
              {leverageUpdateError && (
                <p className="mt-2 text-xs text-rose-300">{leverageUpdateError}</p>
              )}
            </article>
          )}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-5">
        <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
          <p className="text-xs text-[color:var(--cf-muted)]">收益率</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{strategy.metrics.returnPct}%</p>
        </article>
        <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
          <p className="text-xs text-[color:var(--cf-muted)]">最大回撤</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{strategy.metrics.maxDrawdownPct}%</p>
        </article>
        <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
          <p className="text-xs text-[color:var(--cf-muted)]">胜率</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{strategy.metrics.winRatePct}%</p>
        </article>
        <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
          <p className="text-xs text-[color:var(--cf-muted)]">交易次数</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{strategy.metrics.tradeCount}</p>
        </article>
        <article className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
          <p className="text-xs text-[color:var(--cf-muted)]">总收益额</p>
          <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{formatAmount(displayTotalPnl)} USDT</p>
          <p className={`mt-1 text-xs ${displayTodayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            今日 {formatSignedNumber(displayTodayPnl)} USDT
          </p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">账户概览</h2>
          <p className="mt-1 text-xs text-[color:var(--cf-muted)]">来源：本地账户台账 + 最新行情估值；不等同于 OKX 钱包实时余额。</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <p className="text-[color:var(--cf-muted)]">初始资金</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.accountOverview?.initialBalance)} {baseCurrency}</p>
            <p className="text-[color:var(--cf-muted)]">总权益</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.accountOverview?.totalEquity)} {baseCurrency}</p>
            <p className="text-[color:var(--cf-muted)]">可用余额</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.accountOverview?.availableBalance)} {baseCurrency}</p>
            <p className="text-[color:var(--cf-muted)]">今日盈亏</p>
            <p className={`text-right ${typeof strategy.accountOverview?.todayPnl === 'number' && strategy.accountOverview.todayPnl < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {typeof strategy.accountOverview?.todayPnl === 'number' ? formatSignedNumber(strategy.accountOverview.todayPnl) : '--'} {baseCurrency}
            </p>
          </div>
        </article>
        <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{isSpotMarket ? '持币概览' : '持仓概览'}</h2>
          <p className="mt-1 text-xs text-[color:var(--cf-muted)]">来源：本地成交与持仓台账，未实现盈亏按行情估值刷新。</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <p className="text-[color:var(--cf-muted)]">{isSpotMarket ? '当前持币' : '当前持仓数'}</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">
              {isSpotMarket
                ? formatSpotHoldingCount(strategy.positionOverview?.openPositionsCount, strategy.symbol)
                : (strategy.positionOverview?.openPositionsCount ?? '--')}
            </p>
            <p className="text-[color:var(--cf-muted)]">{isSpotMarket ? '已完成买卖轮次' : '已平仓数'}</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{strategy.positionOverview?.closedPositionsCount ?? '--'}</p>
            <p className="text-[color:var(--cf-muted)]">累计已实现盈亏</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.positionOverview?.totalRealizedPnl)} {baseCurrency}</p>
            <p className="text-[color:var(--cf-muted)]">{isSpotMarket ? '当前浮动盈亏' : '当前未实现盈亏'}</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.positionOverview?.totalUnrealizedPnl)} {baseCurrency}</p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">最新成交</h2>
        <p className="mt-1 text-xs text-[color:var(--cf-muted)]">来源：交易所订单回执落库；手续费优先展示 OKX 原始 fee / feeCcy。</p>
        {strategy.latestOrders && strategy.latestOrders.length > 0
          ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--cf-border)] text-[color:var(--cf-muted)]">
                      <th className="py-2 pr-3">时间</th>
                      <th className="py-2 pr-3">方向</th>
                      <th className="py-2 pr-3">语义动作</th>
                      <th className="py-2 pr-3">交易对</th>
                      <th className="py-2 pr-3">价格</th>
                      <th className="py-2 pr-3">数量 / 名义价值</th>
                      <th className="py-2 pr-3">手续费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.latestOrders.map((order) => {
                      const quantityDisplay = formatLatestOrderQuantity(order, strategy.symbol, baseCurrency)
                      return (
                        <tr key={`${order.executedAt}-${order.symbol}-${order.side}-${order.orderId ?? ''}`} className="border-b border-[color:var(--cf-border)]/60">
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.executedAt}</td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.side}</td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            <div>{order.semanticAction ?? '语义待确认'}</div>
                            {order.reconcileRequired
                              ? <div className="mt-0.5 text-xs text-amber-300">待本地对账</div>
                              : null}
                          </td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.symbol}</td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">{formatOptionalPrice(order.price)}</td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            <div>{quantityDisplay.quantityLabel}</div>
                            {quantityDisplay.notionalLabel
                              ? <div className="mt-0.5 text-xs text-[color:var(--cf-muted)]">{quantityDisplay.notionalLabel}</div>
                              : null}
                          </td>
                          <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                            {formatOrderFee(order)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          : <p className="mt-3 text-sm text-[color:var(--cf-muted)]">暂无成交记录</p>}
      </section>

      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
          {formatEquitySeriesTitle()}
        </h2>
        <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
          {formatEquitySeriesSource(strategy.marketType)}
        </p>
        <div className="relative mt-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <svg
            viewBox="0 0 900 220"
            className="h-56 w-full"
            onMouseMove={(event) => {
              if (series.length === 0) return
              const rect = event.currentTarget.getBoundingClientRect()
              const ratio = (event.clientX - rect.left) / rect.width
              const idx = Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1))))
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
              points={buildPolyline(series)}
            />
            {series.length === 1 && coords[0] && (
              <circle cx={coords[0].x} cy={coords[0].y} r={4} fill="#38bdf8" />
            )}
            {hoverCoord && (
              <>
                <line x1={hoverCoord.x} y1={0} x2={hoverCoord.x} y2={220} stroke="#9ca3af" strokeDasharray="4 4" opacity={0.5} />
                <circle cx={hoverCoord.x} cy={hoverCoord.y} r={4} fill="#38bdf8" />
              </>
            )}
          </svg>
          {series.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--cf-muted)]">
              暂无收益曲线数据
            </p>
          )}
          {hoverPoint && hoverCoord && (
            <div
              className="pointer-events-none absolute rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-2 text-xs text-[color:var(--cf-text)] shadow-lg"
              style={{
                top: '20px',
                left: hoverCoord.x > 700 ? `calc(${(hoverCoord.x / 900) * 100}% - 160px)` : `calc(${(hoverCoord.x / 900) * 100}% + 8px)`,
              }}
            >
              <p className="text-[color:var(--cf-muted)]">{hoverPoint.ts}</p>
              <p className="mt-1">权益: {formatAmount(hoverPoint.value)} USDT</p>
              <p>变化: {adjacentChangePct === null ? '--' : `${formatSignedNumber(adjacentChangePct)}%`}</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {strategy.paramSchema
          ? (
              <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
                <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.paramSnapshotTitle')}</h2>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--cf-text)]">
                  {dynamicParamRows.length > 0
                    ? dynamicParamRows.map(row => (
                        <p key={row.key} className="flex items-start gap-2">
                          <span className="text-[color:var(--cf-muted)]">{row.label}</span>
                          <span>{row.value}</span>
                        </p>
                      ))
                    : <p className="text-[color:var(--cf-muted)]">{t('aiQuant.paramSummaryEmpty')}</p>}
                  {strategy.deploy && (
                    <>
                      <p className="flex items-start gap-2">
                        <span className="text-[color:var(--cf-muted)]">{t('aiQuant.deployAccountLabel')}</span>
                        <span>{strategy.deploy.accountName}</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="text-[color:var(--cf-muted)]">{t('aiQuant.deployTimeLabel')}</span>
                        <span>{strategy.deploy.at.replace('T', ' ').slice(0, 16)}</span>
                      </p>
                    </>
                  )}
                </div>
              </article>
            )
          : (
              <article className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.legacyUnsupportedTitle')}</h2>
                <p className="mt-3 text-sm text-amber-300">{t('aiQuant.legacyUnsupportedMessage')}</p>
              </article>
            )}

        <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">真实性审计</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">策略实例</span>
              <span className="break-all text-[color:var(--cf-text)]">{strategy.id}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">发布快照</span>
              <span className="break-all text-[color:var(--cf-text)]">{strategy.publishedSnapshotId ?? '--'}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">快照哈希</span>
              <span className="break-all text-[color:var(--cf-text)]">{strategy.snapshotHash ?? '--'}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">入场订单证据</span>
              <span className="break-all text-[color:var(--cf-text)]">{formatOrderEvidenceList(entryOrderEvidence)}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">出场订单证据</span>
              <span className="break-all text-[color:var(--cf-text)]">{formatOrderEvidenceList(exitOrderEvidence)}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">同步订单证据</span>
              <span className="break-all text-[color:var(--cf-text)]">{formatOrderEvidenceList(syncOrderEvidence)}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="min-w-28 text-[color:var(--cf-muted)]">数据边界</span>
              <span className="text-[color:var(--cf-text)]">回测使用发布快照；部署执行绑定同一快照；当前成交来自交易所回执落库。</span>
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">运行时间线</h2>
          <ol className="mt-3 space-y-3">
            {strategy.timeline.map(item => (
              <li key={`${item.at}-${item.event}`} className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
                <p className="text-xs text-[color:var(--cf-muted)]">{item.at}</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--cf-text-strong)]">{item.event}</p>
                {item.note && <p className="mt-1 text-xs text-[color:var(--cf-muted)]">{item.note}</p>}
              </li>
            ))}
          </ol>
        </article>
      </section>
    </main>
  )
}
