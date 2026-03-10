'use client'

interface BacktestSummaryCardProps {
  result: BacktestResult
  canDeploy: boolean
  onOpenFullScreen: () => void
  onOptimize: () => void
  onDeploy: () => void
}

export interface BacktestResult {
  id: string
  maxDrawdownPct: number
  totalReturnPct: number
  winRatePct: number
  tradeCount: number
}

export function BacktestSummaryCard({
  result,
  canDeploy,
  onOpenFullScreen,
  onOptimize,
  onDeploy,
}: BacktestSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">回测结果</h2>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">最大回撤 {'<='} 20% 才能一键部署</p>
        </div>
        <button
          type="button"
          onClick={onOpenFullScreen}
          className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)]"
        >
          全屏查看
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric title="最大回撤" value={`${result.maxDrawdownPct}%`} />
        <Metric title="总收益" value={`${result.totalReturnPct}%`} />
        <Metric title="胜率" value={`${result.winRatePct}%`} />
        <Metric title="交易次数" value={`${result.tradeCount}`} />
      </div>

      {!canDeploy && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          回撤不达标，当前禁止部署。请返回对话继续优化参数。
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!canDeploy && (
          <button
            type="button"
            onClick={onOptimize}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            返回对话继续优化
          </button>
        )}

        <button
          type="button"
          onClick={onDeploy}
          disabled={!canDeploy}
          className="from-primary to-secondary rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          一键部署
        </button>
      </div>
    </section>
  )
}

function Metric({ title, value }: { title: string, value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
      <p className="text-xs text-[color:var(--cf-muted)]">{title}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--cf-text-strong)]">{value}</p>
    </div>
  )
}
