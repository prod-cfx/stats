'use client'

interface StopRunningStrategy {
  name?: string | null
  exchange?: string | null
  symbol?: string | null
  marketType?: string | null
  positionOverview?: {
    openPositionsCount?: number | null
    totalUnrealizedPnl?: number | null
  } | null
  spotHoldingSummary?: {
    baseAsset?: string | null
    quantity?: number | null
    openPositionsCount?: number | null
  } | null
  openOrdersCount?: number | null
}

interface StopRunningStrategyDialogProps {
  open: boolean
  strategy: StopRunningStrategy | null
  lng?: 'zh' | 'en'
  pending?: boolean
  errorMessage?: string | null
  onStopOnly: () => void
  onLiquidateAndStop: () => void
  onCancel: () => void
}

function formatOptionalNumber(value: number | null | undefined, lng: 'zh' | 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return value.toLocaleString(lng === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: 4 })
}

function formatSpotHolding(strategy: StopRunningStrategy | null, lng: 'zh' | 'en') {
  const summary = strategy?.spotHoldingSummary
  const quantity = summary?.quantity
  const baseAsset = summary?.baseAsset
  if (typeof quantity === 'number' && Number.isFinite(quantity) && baseAsset) {
    return `${quantity.toLocaleString(lng === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: 8 })} ${baseAsset}`
  }

  const count = summary?.openPositionsCount ?? strategy?.positionOverview?.openPositionsCount
  if (typeof count === 'number' && Number.isFinite(count)) {
    return lng === 'en' ? `${count} spot holding record${count === 1 ? '' : 's'}` : `${count} 条现货持币记录`
  }

  return lng === 'en' ? 'Spot holdings pending confirmation' : '现货持币待确认'
}

export function StopRunningStrategyDialog({
  open,
  strategy,
  lng = 'zh',
  pending = false,
  errorMessage = null,
  onStopOnly,
  onLiquidateAndStop,
  onCancel,
}: StopRunningStrategyDialogProps) {
  if (!open) return null
  const isEn = lng === 'en'

  const openPositionsCount = strategy?.positionOverview?.openPositionsCount ?? 0
  const openOrdersCount = strategy?.openOrdersCount
  const isSpotMarket = strategy?.marketType === 'spot'
  const hasUnknownOpenOrders = openOrdersCount == null
  const hasOpenOrders = typeof openOrdersCount === 'number' && openOrdersCount > 0
  const requiresRiskChoice = openPositionsCount > 0 || hasOpenOrders || hasUnknownOpenOrders
  const title = requiresRiskChoice
    ? isEn
      ? `The strategy still has ${isSpotMarket ? 'spot holdings' : 'positions'} or open orders`
      : `当前策略仍有${isSpotMarket ? '现货持币' : '持仓'}或挂单`
    : isEn ? 'Stop this strategy?' : '确认停止策略？'
  const exposureLabel = isSpotMarket
    ? (isEn ? 'Current Spot Holdings' : '当前现货持币')
    : (isEn ? 'Current Positions' : '当前持仓')
  const exposureValue = isSpotMarket ? formatSpotHolding(strategy, lng) : String(openPositionsCount)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-[560px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cf-muted)]">
          {requiresRiskChoice
            ? isEn
              ? `Confirm how to handle the current ${isSpotMarket ? 'spot holdings' : 'positions'} before stopping. Stop only keeps exposure; liquidate and stop submits closing orders in OKX paper trading.`
              : `停止前请确认如何处理当前${isSpotMarket ? '现货持币' : '持仓'}。仅停止不会平仓；平仓并停止会在 OKX 模拟盘提交平仓单。`
            : isEn
              ? 'After stopping, the strategy will no longer execute or generate new trading signals.'
              : '停止后策略不再执行，也不会产生新的交易信号。'}
        </p>

        <div className="mt-4 grid gap-2 rounded-xl border border-[color:var(--cf-border)] bg-black/10 p-3 text-sm text-[color:var(--cf-text)]">
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">{isEn ? 'Strategy' : '策略'}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{strategy?.name ?? '--'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">{isEn ? 'Exchange / Symbol' : '交易所/交易对'}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {[strategy?.exchange, strategy?.symbol].filter(Boolean).join(' · ') || '--'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">{exposureLabel}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{exposureValue}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">{isEn ? 'Unrealized P&L' : '当前浮盈亏'}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {formatOptionalNumber(strategy?.positionOverview?.totalUnrealizedPnl, lng)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">{isEn ? 'Open Orders' : '当前未成交挂单'}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {hasUnknownOpenOrders ? (isEn ? 'Pending confirmation' : '待确认') : openOrdersCount}
            </span>
          </div>
        </div>

        {requiresRiskChoice && (
          <p className="mt-3 text-xs leading-5 text-[color:var(--cf-muted)]">
            {isEn
              ? `Liquidate and stop first tries to cancel open exchange orders for this strategy symbol, then handles current ${isSpotMarket ? 'spot holdings' : 'positions'}.`
              : `平仓并停止会先尝试撤销当前策略交易对的交易所未成交挂单，再处理${isSpotMarket ? '现货持币' : '持仓'}。`}
          </p>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {requiresRiskChoice ? (
            <>
              <button
                type="button"
                data-testid="stop-only-strategy"
                disabled={pending}
                onClick={onStopOnly}
                className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSpotMarket
                  ? (isEn ? 'Stop only, keep spot holdings/orders' : '仅停止，保留现货持币/挂单')
                  : (isEn ? 'Stop only, keep positions/orders' : '仅停止，保留持仓/挂单')}
              </button>
              <button
                type="button"
                data-testid="liquidate-and-stop-strategy"
                disabled={pending}
                onClick={onLiquidateAndStop}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
              >
                {isEn ? 'Liquidate and Stop' : '平仓并停止'}
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="confirm-stop-strategy"
              disabled={pending}
              onClick={onStopOnly}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEn ? 'Confirm Stop' : '确认停止'}
            </button>
          )}
          <button
            type="button"
            data-testid="cancel-stop-strategy"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEn ? 'Cancel' : '取消'}
          </button>
        </div>
      </div>
    </div>
  )
}
