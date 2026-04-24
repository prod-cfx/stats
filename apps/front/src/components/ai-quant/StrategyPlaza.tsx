'use client'

import type { StrategyPlazaTemplate } from '@/lib/api'
import { Activity, Edit3, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface StrategyPlazaProps {
  templates: StrategyPlazaTemplate[]
  loading: boolean
  error?: string | null
  onRunStrategy: (templateId: string) => void
  onEditStrategy: (templateId: string) => void
  subtitle?: string
}

function formatPositionPct(value: number): string {
  const percent = Math.abs(value) <= 1 ? value * 100 : value
  return `${Number(percent.toFixed(2)).toString()}%`
}

function getMarketTypeLabel(marketType: StrategyPlazaTemplate['marketType']): string {
  return marketType === 'perp' ? '永续' : '现货'
}

function getLeverageLabel(leverage: number | null): string {
  return leverage ? `${leverage}x` : '无杠杆'
}

export function StrategyPlaza({
  templates,
  loading,
  error,
  onRunStrategy,
  onEditStrategy,
  subtitle,
}: StrategyPlazaProps) {
  const { t } = useTranslation()
  const displaySubtitle = subtitle || t('aiQuant.strategyPlazaSubtitle')

  if (loading) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-[color:var(--cf-muted)]">{displaySubtitle}</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(item => (
            <article
              key={item}
              className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
            >
              <div className="h-10 w-10 animate-pulse rounded-xl bg-[color:var(--cf-bg)]" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="h-10 animate-pulse rounded-xl bg-[color:var(--cf-bg)]" />
                <div className="h-10 animate-pulse rounded-xl bg-[color:var(--cf-bg)]" />
              </div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-[color:var(--cf-muted)]">{displaySubtitle}</p>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-500">
          {error}
        </div>
      </section>
    )
  }

  if (templates.length === 0) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-[color:var(--cf-muted)]">{displaySubtitle}</p>
        <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-8 text-center text-sm text-[color:var(--cf-muted)]">
          暂无可用策略模板
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-[color:var(--cf-muted)]">{displaySubtitle}</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <article
            key={template.id}
            className="group flex flex-col justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--cf-bg)] text-primary transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[color:var(--cf-text-strong)]">{template.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {template.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--cf-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[color:var(--cf-muted)]">
                {template.description}
              </p>

              <div className="mt-4 grid gap-2 rounded-xl bg-[color:var(--cf-bg)] px-3 py-3 text-xs text-[color:var(--cf-muted)]">
                <div className="flex items-center justify-between gap-3">
                  <span>交易对 / 周期</span>
                  <span className="font-mono font-semibold text-[color:var(--cf-text)]">
                    {template.symbol}
                    {' / '}
                    {template.timeframe}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>环境</span>
                  <span className="font-semibold text-[color:var(--cf-text)]">OKX 模拟盘</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>市场</span>
                  <span className="font-semibold text-[color:var(--cf-text)]">
                    {getMarketTypeLabel(template.marketType)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>仓位 / 杠杆</span>
                  <span className="font-mono font-semibold text-[color:var(--cf-text)]">
                    {formatPositionPct(template.positionPct)}
                    {' / '}
                    {getLeverageLabel(template.leverage)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onRunStrategy(template.id)}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-purple-700 active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                {t('aiQuant.run')}
              </button>
              <button
                type="button"
                onClick={() => onEditStrategy(template.id)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--cf-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[color:var(--cf-text-strong)] transition-all hover:border-[color:var(--cf-text-strong)] hover:bg-[color:var(--cf-bg)] active:scale-95"
              >
                <Edit3 className="h-4 w-4" />
                {t('aiQuant.edit')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
