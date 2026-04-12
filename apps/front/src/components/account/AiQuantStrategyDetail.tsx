'use client'

import type { AiQuantStrategyRecord, StrategyEquityPoint, AiQuantStrategyViewState } from './ai-quant-strategy-store'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveDisplayMetrics } from './account-strategy-display-metrics'
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

function buildPolyline(data: StrategyEquityPoint[]) {
  if (!data.length) return ''
  const values = data.map(item => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = Math.max(max - min, 1)
  const width = 900
  const height = 220
  return data
    .map((item, idx) => {
      const x = (idx / Math.max(data.length - 1, 1)) * width
      const normalized = (item.value - min) / spread
      const y = height - normalized * height
      return `${x},${y}`
    })
    .join(' ')
}

function buildCoordinates(data: StrategyEquityPoint[]) {
  if (!data.length) return []
  const values = data.map(item => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = Math.max(max - min, 1)
  const width = 900
  const height = 220

  return data.map((item, idx) => {
    const x = (idx / Math.max(data.length - 1, 1)) * width
    const normalized = (item.value - min) / spread
    const y = height - normalized * height
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

function formatExecutionValue(value: string | number | null | undefined, suffix = '') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}${suffix}`
  }
  if (typeof value === 'string' && value.trim()) {
    return `${value}${suffix}`
  }
  return '--'
}

interface AiQuantStrategyDetailProps {
  lng: 'zh' | 'en'
  strategy: AiQuantStrategyRecord | null
  onRunBacktest?: () => void
  isBacktestRunning?: boolean
  backtestError?: string | null
  onUpdateLeverage?: (leverage: number) => Promise<void> | void
  isUpdatingLeverage?: boolean
  leverageUpdateError?: string | null
}

export function AiQuantStrategyDetail({
  lng,
  strategy,
  onRunBacktest,
  isBacktestRunning = false,
  backtestError = null,
  onUpdateLeverage,
  isUpdatingLeverage = false,
  leverageUpdateError = null,
}: AiQuantStrategyDetailProps) {
  const { t } = useTranslation()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [leverageDraft, setLeverageDraft] = useState<number | ''>('')
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
  const canEditLeverage = Boolean(strategy?.canEditDeploymentLeverage && onUpdateLeverage)
  const leverageOptions = useMemo(() => {
    if (!strategy?.deploymentLeverageRange) return []
    return Array.from({
      length: strategy.deploymentLeverageRange.max - strategy.deploymentLeverageRange.min + 1,
    }).map((_, index) => strategy.deploymentLeverageRange!.min + index)
  }, [strategy?.deploymentLeverageRange])

  const canRunBacktest = !!strategy?.publishedSnapshotId && !isBacktestRunning

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
            {STATUS_LABEL[strategy.status]}
          </span>
          <button
            type="button"
            onClick={onRunBacktest}
            disabled={!canRunBacktest || !onRunBacktest}
            className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:border-[color:var(--cf-border)] disabled:text-[color:var(--cf-muted)]"
          >
            {isBacktestRunning ? '回测中…' : '运行回测'}
          </button>
          <Link
            href={`/${lng}/account?tab=ai-quant`}
            className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)]"
          >
            返回列表
          </Link>
        </div>
      </section>

      {backtestError && (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {backtestError}
        </section>
      )}

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
                <p className="text-[color:var(--cf-muted)]">回测杠杆</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.snapshotBacktestConfigDefaults.leverage, 'x')}
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
                <p className="text-[color:var(--cf-muted)]">基线执行杠杆</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.deploymentExecutionBaseline?.leverage, 'x')}
                </p>
                <p className="text-[color:var(--cf-muted)]">当前执行杠杆</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.deploymentExecutionCurrent?.leverage, 'x')}
                </p>
                <p className="text-[color:var(--cf-muted)]">价格来源</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {formatExecutionValue(strategy.deploymentExecutionCurrent?.priceSource ?? strategy.deploymentExecutionBaseline?.priceSource)}
                </p>
                <p className="text-[color:var(--cf-muted)]">允许杠杆范围</p>
                <p className="text-right text-[color:var(--cf-text-strong)]">
                  {strategy.deploymentLeverageRange
                    ? `${strategy.deploymentLeverageRange.min}x - ${strategy.deploymentLeverageRange.max}x`
                    : '--'}
                </p>
              </div>
              {strategy.deploymentConstraintExplanation && (
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
                    className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:border-[color:var(--cf-border)] disabled:text-[color:var(--cf-muted)]"
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
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">持仓概览</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <p className="text-[color:var(--cf-muted)]">当前持仓数</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{strategy.positionOverview?.openPositionsCount ?? '--'}</p>
            <p className="text-[color:var(--cf-muted)]">已平仓数</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{strategy.positionOverview?.closedPositionsCount ?? '--'}</p>
            <p className="text-[color:var(--cf-muted)]">累计已实现盈亏</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.positionOverview?.totalRealizedPnl)} {baseCurrency}</p>
            <p className="text-[color:var(--cf-muted)]">当前未实现盈亏</p>
            <p className="text-right text-[color:var(--cf-text-strong)]">{formatOptionalAmount(strategy.positionOverview?.totalUnrealizedPnl)} {baseCurrency}</p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">最新成交</h2>
        {strategy.latestOrders && strategy.latestOrders.length > 0
          ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--cf-border)] text-[color:var(--cf-muted)]">
                      <th className="py-2 pr-3">时间</th>
                      <th className="py-2 pr-3">方向</th>
                      <th className="py-2 pr-3">交易对</th>
                      <th className="py-2 pr-3">价格</th>
                      <th className="py-2 pr-3">数量</th>
                      <th className="py-2 pr-3">手续费</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.latestOrders.map(order => (
                      <tr key={`${order.executedAt}-${order.symbol}-${order.side}-${order.orderId ?? ''}`} className="border-b border-[color:var(--cf-border)]/60">
                        <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.executedAt}</td>
                        <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.side}</td>
                        <td className="py-2 pr-3 text-[color:var(--cf-text)]">{order.symbol}</td>
                        <td className="py-2 pr-3 text-[color:var(--cf-text)]">{formatOptionalAmount(order.price)}</td>
                        <td className="py-2 pr-3 text-[color:var(--cf-text)]">{formatOptionalAmount(order.quantity)}</td>
                        <td className="py-2 pr-3 text-[color:var(--cf-text)]">
                          {order.fee == null ? '--' : formatAmount(order.fee)} {order.feeCurrency ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          : <p className="mt-3 text-sm text-[color:var(--cf-muted)]">暂无成交记录</p>}
      </section>

      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">收益曲线</h2>
        <div className="relative mt-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <svg
            viewBox="0 0 900 220"
            className="h-56 w-full"
            onMouseMove={(event) => {
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
            {hoverCoord && (
              <>
                <line x1={hoverCoord.x} y1={0} x2={hoverCoord.x} y2={220} stroke="#9ca3af" strokeDasharray="4 4" opacity={0.5} />
                <circle cx={hoverCoord.x} cy={hoverCoord.y} r={4} fill="#38bdf8" />
              </>
            )}
          </svg>
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
