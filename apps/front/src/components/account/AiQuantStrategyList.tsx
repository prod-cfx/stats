'use client'

import type { StrategyStatus } from './ai-quant-strategy-store'
import Link from 'next/link'
import { useMemo } from 'react'
import { listStrategies } from './ai-quant-strategy-store'

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

function fmtTime(ts: string) {
  const date = new Date(ts)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

export function AiQuantStrategyList({ lng }: { lng: 'zh' | 'en' }) {
  const strategies = useMemo(() => listStrategies(), [])

  if (strategies.length === 0) {
    return (
      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 text-center">
        <h3 className="text-base font-semibold text-[color:var(--cf-text-strong)]">暂无策略</h3>
        <p className="mt-1 text-sm text-[color:var(--cf-muted)]">先去 AI 对话创建一个策略，再回来查看详情。</p>
        <Link
          href={`/${lng}/ai-quant`}
          className="mt-4 inline-flex rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
        >
          去 AI量化创建
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">我的策略</h3>
        <span className="text-xs text-[color:var(--cf-muted)]">共 {strategies.length} 条</span>
      </div>

      <div className="space-y-2">
        {strategies.map(item => (
          <article
            key={item.id}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{item.name}</p>
                <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                  {item.exchange.toUpperCase()} / {item.symbol} / {item.timeframe} / 仓位 {item.positionPct}%
                </p>
              </div>
              <span className={`rounded-lg border px-2 py-1 text-xs ${STATUS_CLASS[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-[color:var(--cf-muted)]">更新于 {fmtTime(item.updatedAt)}</span>
              <Link
                href={`/${lng}/account/ai-quant/strategy/${item.id}`}
                className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)]"
              >
                查看详情
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
