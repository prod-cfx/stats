'use client'

import { useTranslation } from 'react-i18next'
import { formatBacktestRange } from '@/components/ai-quant/backtest-date'

interface BacktestSummaryCardProps {
  result: BacktestResult
  marketType?: 'spot' | 'perp' | null
  canDeploy: boolean
  deploymentState?: 'not_deployed' | 'running' | 'stopped' | 'unknown'
  deployLabel?: string
  fullScreenButtonClassName?: string
  drawdownLimited?: boolean
  onOpenFullScreen: () => void
  onDeploy: () => void
  onViewRunningStrategy?: () => void
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
  recoveryStatus?: 'config_changed'
  diagnosticReason?: 'BACKTEST_EVENT_STREAM_UNAVAILABLE' | 'BACKTEST_NO_RULES_COMPILED' | 'BACKTEST_DATA_REQUIREMENT_UNAVAILABLE' | 'BACKTEST_NO_SIGNAL_FIRED_IN_RANGE' | 'BACKTEST_SIGNAL_FIRED_BUT_NO_FILL'
}

export function BacktestSummaryCard({
  result,
  marketType = null,
  canDeploy,
  deploymentState = 'not_deployed',
  deployLabel,
  fullScreenButtonClassName = '',
  drawdownLimited = true,
  onOpenFullScreen,
  onDeploy,
  onViewRunningStrategy,
}: BacktestSummaryCardProps) {
  const { t, i18n } = useTranslation()
  const isEn = (i18n?.resolvedLanguage ?? i18n?.language ?? 'zh').toLowerCase().startsWith('en')
  const normalizedMarketType = normalizeBacktestMarketType(marketType ?? result.marketType)
  const isConfigChangedRecovery = result.recoveryStatus === 'config_changed'
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
  const effectiveDeployLabel = deployLabel
    ?? (deploymentState === 'running'
      ? t('aiQuant.deployRunning', { defaultValue: 'Running' })
      : deploymentState === 'stopped'
        ? t('aiQuant.deployRedeploy', { defaultValue: 'Redeploy' })
        : deploymentState === 'unknown'
          ? t('aiQuant.deployPending', { defaultValue: 'Deployment status pending' })
          : t('aiQuant.deploy'))
  const deployDisabled = !canDeploy || deploymentState === 'running' || deploymentState === 'unknown'
  const showDeployBlockMessage =
    !isConfigChangedRecovery && !canDeploy && deploymentState !== 'running' && deploymentState !== 'unknown'
  const deploymentHint = deploymentState === 'unknown'
    ? t('aiQuant.deployPendingHint', { defaultValue: 'Deployment status is being confirmed. You cannot deploy again until it is verified.' })
    : null

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{t('aiQuant.backtestResult')}</h2>
          {normalizedMarketType && (
            <p className="mt-1 !text-xs !font-medium !leading-5 text-[color:var(--cf-primary)]">
              {normalizedMarketType === 'spot'
                ? (isEn ? 'Spot Backtest' : '现货回测')
                : (isEn ? 'Perp Backtest' : '合约回测')}
            </p>
          )}
          <p className="mt-1 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
            {drawdownLimited
              ? t('aiQuant.messages.backtestDrawdownLimit')
              : t('aiQuant.messages.backtestDrawdownLimitBypassed')}
          </p>
          {backtestContext && (
            <p className="mt-1 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{backtestContext}</p>
          )}
          {isConfigChangedRecovery && (
            <p className="mt-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 !text-xs !font-medium !leading-5 text-amber-500">
              {t('aiQuant.messages.backtestConfigChanged')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenFullScreen}
          className={`rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)] ${fullScreenButtonClassName}`}
        >
          {t('aiQuant.fullScreen')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map(metric => (
          <Metric key={metric.key} title={metric.title} value={metric.value} type={metric.type} />
        ))}
      </div>

      {showDeployBlockMessage && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 !text-sm !font-normal !leading-[22px] text-amber-500">
          {deployBlockMessage}
        </div>
      )}
      {deploymentHint && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 !text-sm !font-normal !leading-[22px] text-amber-500">
          {deploymentHint}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {deploymentState === 'running' && onViewRunningStrategy && (
          <button
            type="button"
            data-deployment-view-running="true"
            onClick={onViewRunningStrategy}
            className="rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)]"
          >
            {t('aiQuant.deployViewRunning', { defaultValue: 'View running strategy' })}
          </button>
        )}

        <button
          type="button"
          onClick={onDeploy}
          disabled={deployDisabled}
          className="from-primary to-secondary rounded-full bg-gradient-to-r px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {effectiveDeployLabel}
        </button>
      </div>
    </section>
  )
}

function Metric({ title, value, type }: { title: string, value: string, type?: 'profit' | 'loss' | 'neutral' }) {
  const colorClass = type === 'profit' ? 'text-[#00C087]' : type === 'loss' ? 'text-[#FF4D4F]' : 'text-[color:var(--cf-text-strong)]'
  return (
    <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 transition-colors hover:bg-white/[0.02]">
      <p className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{title}</p>
      <p className={`mt-1 !text-sm !font-semibold !leading-[22px] ${colorClass}`}>{value}</p>
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
