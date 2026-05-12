'use client'

import { useTranslation } from 'react-i18next'

interface RunningStrategyEditGuardDialogProps {
  open: boolean
  mode: 'running' | 'unknown'
  stopPending?: boolean
  errorMessage?: string | null
  onViewRunningStrategy: () => void
  onStopStrategy: () => void
  onClose: () => void
}

export function RunningStrategyEditGuardDialog({
  open,
  mode,
  stopPending = false,
  errorMessage = null,
  onViewRunningStrategy,
  onStopStrategy,
  onClose,
}: RunningStrategyEditGuardDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  const title = mode === 'running'
    ? t('aiQuant.runningGuard.runningTitle')
    : t('aiQuant.runningGuard.unknownTitle')
  const description = mode === 'running'
    ? t('aiQuant.runningGuard.runningDescription')
    : t('aiQuant.runningGuard.unknownDescription')

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[520px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cf-muted)]">{description}</p>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="view-running-strategy"
            onClick={onViewRunningStrategy}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            {t('aiQuant.runningGuard.viewRunningStrategy')}
          </button>
          <button
            type="button"
            data-testid="stop-running-strategy"
            disabled={stopPending}
            onClick={onStopStrategy}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('aiQuant.runningGuard.stopStrategy')}
          </button>
          <button
            type="button"
            data-testid="cancel-running-strategy-guard"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            {t('aiQuant.runningGuard.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
