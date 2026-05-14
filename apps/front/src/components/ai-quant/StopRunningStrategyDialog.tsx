'use client'

import { useTranslation } from 'react-i18next'

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
  pending?: boolean
  errorMessage?: string | null
  onStopOnly: () => void
  onLiquidateAndStop: () => void
  onCancel: () => void
}

function formatOptionalNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

function formatSpotHolding(strategy: StopRunningStrategy | null, t: (key: string, options?: Record<string, unknown>) => string) {
  const summary = strategy?.spotHoldingSummary
  const quantity = summary?.quantity
  const baseAsset = summary?.baseAsset
  if (typeof quantity === 'number' && Number.isFinite(quantity) && baseAsset) {
    return `${quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${baseAsset}`
  }

  const count = summary?.openPositionsCount ?? strategy?.positionOverview?.openPositionsCount
  if (typeof count === 'number' && Number.isFinite(count)) {
    return t('aiQuant.stopDialog.spotHoldingRecords', { count })
  }

  return t('aiQuant.stopDialog.spotHoldingPending')
}

export function StopRunningStrategyDialog({
  open,
  strategy,
  pending = false,
  errorMessage = null,
  onStopOnly,
  onLiquidateAndStop,
  onCancel,
}: StopRunningStrategyDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  const openPositionsCount = strategy?.positionOverview?.openPositionsCount ?? 0
  const openOrdersCount = strategy?.openOrdersCount
  const isSpotMarket = strategy?.marketType === 'spot'
  const hasUnknownOpenOrders = openOrdersCount == null
  const hasOpenOrders = typeof openOrdersCount === 'number' && openOrdersCount > 0
  const requiresRiskChoice = openPositionsCount > 0 || hasOpenOrders || hasUnknownOpenOrders
  const title = requiresRiskChoice
    ? t(isSpotMarket ? 'aiQuant.stopDialog.titleWithSpotRisk' : 'aiQuant.stopDialog.titleWithRisk')
    : t('aiQuant.stopDialog.titleConfirm')
  const exposureLabel = isSpotMarket ? t('aiQuant.stopDialog.spotHolding') : t('aiQuant.stopDialog.openPositions')
  const exposureValue = isSpotMarket ? formatSpotHolding(strategy, t) : String(openPositionsCount)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-4" onClick={onCancel}>
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 sm:p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cf-muted)]">
          {requiresRiskChoice
            ? t(isSpotMarket ? 'aiQuant.stopDialog.descriptionWithSpotRisk' : 'aiQuant.stopDialog.descriptionWithRisk')
            : t('aiQuant.stopDialog.descriptionConfirm')}
        </p>

        <div className="mt-4 grid gap-2 rounded-xl border border-[color:var(--cf-border)] bg-black/10 p-3 text-sm text-[color:var(--cf-text)]">
          <div data-testid="stop-dialog-detail-row" className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
            <span className="text-[color:var(--cf-muted)]">{t('aiQuant.stopDialog.strategy')}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{strategy?.name ?? '--'}</span>
          </div>
          <div data-testid="stop-dialog-detail-row" className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
            <span className="text-[color:var(--cf-muted)]">{t('aiQuant.stopDialog.exchangeSymbol')}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {[strategy?.exchange, strategy?.symbol].filter(Boolean).join(' · ') || '--'}
            </span>
          </div>
          <div data-testid="stop-dialog-detail-row" className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
            <span className="text-[color:var(--cf-muted)]">{exposureLabel}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{exposureValue}</span>
          </div>
          <div data-testid="stop-dialog-detail-row" className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
            <span className="text-[color:var(--cf-muted)]">{t('aiQuant.stopDialog.unrealizedPnl')}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {formatOptionalNumber(strategy?.positionOverview?.totalUnrealizedPnl)}
            </span>
          </div>
          <div data-testid="stop-dialog-detail-row" className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
            <span className="text-[color:var(--cf-muted)]">{t('aiQuant.stopDialog.openOrders')}</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {hasUnknownOpenOrders ? t('aiQuant.stopDialog.unknown') : openOrdersCount}
            </span>
          </div>
        </div>

        {requiresRiskChoice && (
          <p className="mt-3 text-xs leading-5 text-[color:var(--cf-muted)]">
            {t(isSpotMarket ? 'aiQuant.stopDialog.liquidateSpotHint' : 'aiQuant.stopDialog.liquidateHint')}
          </p>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <div data-testid="stop-dialog-actions" className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
          {requiresRiskChoice ? (
            <>
              <button
                type="button"
                data-testid="stop-only-strategy"
                disabled={pending}
                onClick={onStopOnly}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t(isSpotMarket ? 'aiQuant.stopDialog.stopOnlySpot' : 'aiQuant.stopDialog.stopOnly')}
              </button>
              <button
                type="button"
                data-testid="liquidate-and-stop-strategy"
                disabled={pending}
                onClick={onLiquidateAndStop}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
              >
                {t('aiQuant.stopDialog.liquidateAndStop')}
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="confirm-stop-strategy"
              disabled={pending}
              onClick={onStopOnly}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('aiQuant.stopDialog.confirmStop')}
            </button>
          )}
          <button
            type="button"
            data-testid="cancel-stop-strategy"
            disabled={pending}
            onClick={onCancel}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('aiQuant.stopDialog.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
