'use client'

interface RunningStrategyEditGuardDialogProps {
  open: boolean
  mode: 'running' | 'unknown'
  lng?: 'zh' | 'en'
  stopPending?: boolean
  errorMessage?: string | null
  onViewRunningStrategy: () => void
  onStopStrategy: () => void
  onClose: () => void
}

export function RunningStrategyEditGuardDialog({
  open,
  mode,
  lng = 'zh',
  stopPending = false,
  errorMessage = null,
  onViewRunningStrategy,
  onStopStrategy,
  onClose,
}: RunningStrategyEditGuardDialogProps) {
  if (!open) return null
  const isEn = lng === 'en'

  const title = mode === 'running'
    ? (isEn ? 'Strategy is running and cannot be edited directly' : '策略正在运行，不能直接修改')
    : (isEn ? 'Deployment status is still being confirmed' : '部署状态待确认，暂不能直接修改')
  const description = mode === 'running'
    ? (isEn
        ? 'This strategy is running with the deployed version. Stop it before editing so runtime logic does not diverge from the edited strategy.'
        : '当前策略正在使用已部署版本运行。为避免运行逻辑与编辑内容不一致，请先停止策略。停止后你可以修改策略并重新部署。')
    : (isEn
        ? 'The deployment status is still being confirmed. View or stop the running strategy before editing.'
        : '当前策略实例的部署状态仍在确认中。为避免误判为可编辑或可重复部署，请先查看运行策略或停止策略，确认后再继续修改。')

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
            {isEn ? 'View Running Strategy' : '查看运行策略'}
          </button>
          <button
            type="button"
            data-testid="stop-running-strategy"
            disabled={stopPending}
            onClick={onStopStrategy}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEn ? 'Stop Strategy' : '停止策略'}
          </button>
          <button
            type="button"
            data-testid="cancel-running-strategy-guard"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            {isEn ? 'Cancel' : '取消'}
          </button>
        </div>
      </div>
    </div>
  )
}
