'use client'

interface StopRunningStrategy {
  name?: string | null
  exchange?: string | null
  symbol?: string | null
  positionOverview?: {
    openPositionsCount?: number | null
    totalUnrealizedPnl?: number | null
  } | null
  latestOrders?: unknown[] | null
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

export function StopRunningStrategyDialog({
  open,
  strategy,
  pending = false,
  errorMessage = null,
  onStopOnly,
  onLiquidateAndStop,
  onCancel,
}: StopRunningStrategyDialogProps) {
  if (!open) return null

  const openPositionsCount = strategy?.positionOverview?.openPositionsCount ?? 0
  const latestOrderCount = strategy?.latestOrders?.length ?? 0
  const requiresRiskChoice = openPositionsCount > 0 || latestOrderCount > 0
  const title = requiresRiskChoice ? '当前策略仍有持仓或挂单' : '确认停止策略？'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-[560px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cf-muted)]">
          {requiresRiskChoice
            ? '停止前请确认如何处理当前持仓。仅停止不会平仓；平仓并停止会在 OKX 模拟盘提交平仓单。'
            : '停止后策略不再执行，也不会产生新的交易信号。'}
        </p>

        <div className="mt-4 grid gap-2 rounded-xl border border-[color:var(--cf-border)] bg-black/10 p-3 text-sm text-[color:var(--cf-text)]">
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">策略</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{strategy?.name ?? '--'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">交易所/交易对</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {[strategy?.exchange, strategy?.symbol].filter(Boolean).join(' · ') || '--'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">当前持仓</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{openPositionsCount}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">当前浮盈亏</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">
              {formatOptionalNumber(strategy?.positionOverview?.totalUnrealizedPnl)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[color:var(--cf-muted)]">最近订单记录</span>
            <span className="text-right text-[color:var(--cf-text-strong)]">{latestOrderCount}</span>
          </div>
        </div>

        {requiresRiskChoice && (
          <p className="mt-3 text-xs leading-5 text-[color:var(--cf-muted)]">
            平仓并停止会先尝试撤销当前策略交易对的交易所未成交挂单，再处理持仓；最近订单记录仅用于风险提示。
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
                仅停止，保留持仓/挂单
              </button>
              <button
                type="button"
                data-testid="liquidate-and-stop-strategy"
                disabled={pending}
                onClick={onLiquidateAndStop}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                平仓并停止
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
              确认停止
            </button>
          )}
          <button
            type="button"
            data-testid="cancel-stop-strategy"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
