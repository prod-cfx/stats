'use client'

import { useTranslation } from 'react-i18next'
import { formatBacktestRange } from '@/components/ai-quant/backtest-date'

interface BacktestSummaryCardProps {
  result: BacktestResult
  marketType?: 'spot' | 'perp' | null
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
  marketType?: 'spot' | 'perp' | null
  openTradeCount?: number
  openPnl?: number
  symbol?: string
  startAt?: string
  endAt?: string
}

export function BacktestSummaryCard({
  result,
  marketType = null,
  canDeploy,
  drawdownLimited = true,
  onOpenFullScreen,
  onOptimize,
  onDeploy,
}: BacktestSummaryCardProps) {
  const { t, i18n } = useTranslation()
  const isEn = (i18n?.resolvedLanguage ?? i18n?.language ?? 'zh').toLowerCase().startsWith('en')
  const normalizedMarketType = normalizeBacktestMarketType(marketType ?? result.marketType)
  const backtestContext = result.symbol && result.startAt && result.endAt
    ? `${result.symbol} · ${formatBacktestRange(result.startAt, result.endAt)}`
    : null
  const openPnlValue = typeof result.openPnl === 'number' ? formatSignedPnl(result.openPnl) : null
  const metrics = normalizedMarketType === 'spot'
    ? [
        {
          key: 'drawdown',
          title: t('aiQuant.maxDrawdown'),
          value: `-${result.maxDrawdownPct}%`,
          type: 'loss' as const,
        },
        {
          key: 'return',
          title: isEn ? 'Return' : '收益率',
          value: `${result.totalReturnPct > 0 ? '+' : ''}${result.totalReturnPct}%`,
          type: result.totalReturnPct > 0 ? 'profit' as const : result.totalReturnPct < 0 ? 'loss' as const : 'neutral' as const,
        },
        {
          key: 'completedTrades',
          title: isEn ? 'Completed Trades' : '已完成交易',
          value: `${result.tradeCount}`,
          type: 'neutral' as const,
        },
        ...(typeof result.openTradeCount === 'number'
          ? [{
              key: 'openTradeCount',
              title: isEn ? 'Current Holdings' : '当前持仓',
              value: `${result.openTradeCount}`,
              type: 'neutral' as const,
            }]
          : []),
        ...(openPnlValue
          ? [{
              key: 'openPnl',
              title: isEn ? 'Holding P&L' : '持仓浮盈浮亏',
              value: openPnlValue,
              type:
                result.openPnl && result.openPnl > 0
                  ? 'profit' as const
                  : result.openPnl && result.openPnl < 0
                    ? 'loss' as const
                    : 'neutral' as const,
            }]
          : []),
      ]
    : [
        {
          key: 'drawdown',
          title: t('aiQuant.maxDrawdown'),
          value: `-${result.maxDrawdownPct}%`,
          type: 'loss' as const,
        },
        {
          key: 'closedReturn',
          title: t('aiQuant.closedReturn'),
          value: `${result.totalReturnPct > 0 ? '+' : ''}${result.totalReturnPct}%`,
          type: result.totalReturnPct > 0 ? 'profit' as const : 'loss' as const,
        },
        {
          key: 'closedWinRate',
          title: t('aiQuant.closedWinRate'),
          value: `${result.winRatePct}%`,
          type: 'neutral' as const,
        },
        {
          key: 'closedTradeCount',
          title: t('aiQuant.closedTradeCount'),
          value: `${result.tradeCount}`,
          type: 'neutral' as const,
        },
        ...(typeof result.openTradeCount === 'number'
          ? [{
              key: 'openTradeCount',
              title: t('aiQuant.openTradeCount'),
              value: `${result.openTradeCount}`,
              type: 'neutral' as const,
            }]
          : []),
        ...(openPnlValue
          ? [{
              key: 'openPnl',
              title: t('aiQuant.openPnl'),
              value: openPnlValue,
              type:
                result.openPnl && result.openPnl > 0
                  ? 'profit' as const
                  : result.openPnl && result.openPnl < 0
                    ? 'loss' as const
                    : 'neutral' as const,
            }]
          : []),
      ]
  const deployBlockMessage = result.maxDrawdownPct > 20
    ? t('aiQuant.messages.backtestDrawdownFail')
    : result.tradeCount === 0
      ? normalizedMarketType === 'spot'
        ? isEn
          ? 'Backtest produced no completed spot trades, so deployment remains disabled. Please adjust the spot strategy conditions and retry.'
          : '本次回测未形成已完成交易，暂不允许部署。请调整现货策略条件后重试。'
        : t('aiQuant.messages.backtestNoTrades')
      : t('aiQuant.messages.backtestDrawdownFail')

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.backtestResult')}</h2>
          {normalizedMarketType && (
            <p className="mt-1 text-xs font-medium text-[color:var(--cf-primary)]">
              {normalizedMarketType === 'spot'
                ? (isEn ? 'Spot Backtest' : '现货回测')
                : (isEn ? 'Perp Backtest' : '合约回测')}
            </p>
          )}
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

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map(metric => (
          <Metric key={metric.key} title={metric.title} value={metric.value} type={metric.type} />
        ))}
      </div>

      {!canDeploy && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          {deployBlockMessage}
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

function formatSignedPnl(value: number): string {
  const formatted = value.toFixed(2)
  if (value > 0) {
    return `+${formatted}`
  }
  return formatted
}

function normalizeBacktestMarketType(value: unknown): 'spot' | 'perp' | null {
  return value === 'spot' || value === 'perp' ? value : null
}
