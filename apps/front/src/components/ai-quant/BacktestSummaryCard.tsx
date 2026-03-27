'use client'

import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { useTranslation } from 'react-i18next'

interface BacktestSummaryCardProps {
  result: BacktestResult
  canDeploy: boolean
  drawdownLimited?: boolean
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
  symbol?: string
  startAt?: string
  endAt?: string
}

export function BacktestSummaryCard({
  result,
  canDeploy,
  drawdownLimited = true,
  onOpenFullScreen,
  onOptimize,
  onDeploy,
}: BacktestSummaryCardProps) {
  const { t } = useTranslation()
  const backtestContext = result.symbol && result.startAt && result.endAt
    ? `${result.symbol} · ${formatBacktestRange(result.startAt, result.endAt)}`
    : null

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.backtestResult')}</h2>
          <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
            {drawdownLimited ? t('aiQuant.messages.backtestDrawdownLimit') : '当前为模拟部署模式：忽略回撤门槛'}
          </p>
          {backtestContext && (
            <p className="mt-1 text-xs text-[color:var(--cf-muted)]">{backtestContext}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenFullScreen}
          className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)]"
        >
          {t('aiQuant.fullScreen')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric title={t('aiQuant.maxDrawdown')} value={`-${result.maxDrawdownPct}%`} type="loss" />
        <Metric title={t('aiQuant.totalReturn')} value={`${result.totalReturnPct > 0 ? '+' : ''}${result.totalReturnPct}%`} type={result.totalReturnPct > 0 ? 'profit' : 'loss'} />
        <Metric title={t('aiQuant.winRate')} value={`${result.winRatePct}%`} type="neutral" />
        <Metric title={t('aiQuant.tradeCount')} value={`${result.tradeCount}`} type="neutral" />
      </div>

      {!canDeploy && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          {t('aiQuant.messages.backtestDrawdownFail')}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!canDeploy && (
          <button
            type="button"
            onClick={onOptimize}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            {t('aiQuant.messages.returnToChat')}
          </button>
        )}

        <button
          type="button"
          onClick={onDeploy}
          disabled={!canDeploy}
          className="from-primary to-secondary rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('aiQuant.deploy')}
        </button>
      </div>
    </section>
  )
}

function Metric({ title, value, type }: { title: string, value: string, type?: 'profit' | 'loss' | 'neutral' }) {
  const colorClass = type === 'profit' ? 'text-[#00C087]' : type === 'loss' ? 'text-[#FF4D4F]' : 'text-[color:var(--cf-text-strong)]'
  return (
    <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3 transition-colors hover:bg-white/[0.02]">
      <p className="text-xs text-[color:var(--cf-muted)]">{title}</p>
      <p className={`mt-1 text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  )
}
