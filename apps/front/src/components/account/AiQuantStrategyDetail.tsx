'use client'

import type { AiQuantStrategyRecord, StrategyEquityPoint, StrategyStatus } from './ai-quant-strategy-store'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { deriveAdjacentChangePct, formatSignedNumber } from './pnl-metrics'
import { resolveDisplayMetrics } from './account-strategy-display-metrics'
import { buildDynamicParamRows } from './dynamic-param-summary'

const STATUS_LABEL: Record<StrategyStatus, string> = {
  running: '运行中',
  stopped: '已停止',
  draft: '草稿',
}

const STATUS_CLASS: Record<StrategyStatus, string> = {
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

interface AiQuantStrategyDetailProps {
  lng: 'zh' | 'en'
  strategy: AiQuantStrategyRecord | null
}

export function AiQuantStrategyDetail({ lng, strategy }: AiQuantStrategyDetailProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
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
  const dynamicParamRows = useMemo(
    () => buildDynamicParamRows(strategy?.paramSchema ?? null, strategy?.paramValues ?? null),
    [strategy?.paramSchema, strategy?.paramValues],
  )

  if (!strategy) {
    return (
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center">
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">策略不存在或已删除</h1>
          <p className="mt-2 text-sm text-[color:var(--cf-muted)]">请返回 AI量化列表重新选择策略。</p>
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
          <Link
            href={`/${lng}/account?tab=ai-quant`}
            className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)]"
          >
            返回列表
          </Link>
        </div>
      </section>

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
                <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">参数快照</h2>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--cf-text)]">
                  {dynamicParamRows.length > 0
                    ? dynamicParamRows.map(row => (
                        <p key={row.key}>
                          {row.label}：{row.value}
                        </p>
                      ))
                    : <p className="text-[color:var(--cf-muted)]">暂无参数</p>}
                  {strategy.deploy && (
                    <>
                      <p>部署账户：{strategy.deploy.accountName}</p>
                      <p>部署时间：{strategy.deploy.at.replace('T', ' ').slice(0, 16)}</p>
                    </>
                  )}
                </div>
              </article>
            )
          : (
              <article className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">策略参数不可用</h2>
                <p className="mt-3 text-sm text-amber-300">不支持旧策略，请重新生成</p>
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
