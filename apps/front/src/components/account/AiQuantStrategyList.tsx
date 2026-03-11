'use client'

import type { StrategyStatus } from './ai-quant-strategy-store'
import Link from 'next/link'
import { useMemo } from 'react'
import { Activity, Clock, MoreHorizontal, PlayCircle, StopCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listStrategies } from './ai-quant-strategy-store'

function fmtTime(ts: string, lng: string) {
  const date = new Date(ts)
  return date.toLocaleString(lng === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AiQuantStrategyList({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  const strategies = useMemo(() => listStrategies(), [])

  const STATUS_CONFIG: Record<StrategyStatus, { label: string; className: string; icon: React.ElementType }> = {
    running: {
      label: t('aiQuant.status.running'),
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
      icon: PlayCircle,
    },
    stopped: {
      label: t('aiQuant.status.stopped'),
      className: 'bg-slate-500/10 text-slate-500 border-slate-500/20 dark:text-slate-400',
      icon: StopCircle,
    },
    draft: {
      label: t('aiQuant.status.draft'),
      className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
      icon: MoreHorizontal,
    },
  }

  if (strategies.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--cf-surface)]">
          <Activity className="h-8 w-8 text-[color:var(--cf-muted)]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.noStrategies')}</h3>
        <p className="mt-2 max-w-sm text-sm text-[color:var(--cf-muted)]">
          {t('aiQuant.noStrategiesDesc')}
        </p>
        <Link
          href={`/${lng}/ai-quant`}
          className="mt-6 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2.5 text-sm font-bold !text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          {t('aiQuant.createStrategy')}
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.myStrategies')}</h3>
        <span className="rounded-full bg-[color:var(--cf-surface)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--cf-muted)] border border-[color:var(--cf-border)]">
          {strategies.length}
        </span>
      </div>

      <div className="space-y-3">
        {strategies.map(item => {
          const statusConfig = STATUS_CONFIG[item.status]
          const StatusIcon = statusConfig.icon

          return (
            <Link
              key={item.id}
              href={`/${lng}/account/ai-quant/strategy/${item.id}`}
              className="group flex items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[color:var(--cf-text-strong)] group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConfig.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--cf-muted)]">
                    <span className="font-medium text-[color:var(--cf-text)]">{item.exchange.toUpperCase()}</span>
                    <span>/</span>
                    <span>{item.symbol}</span>
                    <span>/</span>
                    <span>{item.timeframe}</span>
                    <span>/</span>
                    <span>{t('aiQuant.position')} {item.positionPct}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden text-right text-xs text-[color:var(--cf-muted)] sm:block">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {t('aiQuant.updatedAt')}
                  </div>
                  <div className="mt-0.5">{fmtTime(item.updatedAt, lng)}</div>
                </div>
                <div className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)] transition group-hover:border-primary/30 group-hover:text-primary">
                  {t('aiQuant.viewDetail')}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
