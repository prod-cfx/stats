'use client'

import type { StrategyPlazaTemplate } from '@/lib/api'
import { Activity, Edit3, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const TRANSLATED_TEMPLATE_TAG_KEYS: Partial<Record<string, readonly string[]>> = {
  'grid-range': ['range', 'buyLowSellHigh', 'okxDemo'],
}

interface StrategyPlazaProps {
  templates: StrategyPlazaTemplate[]
  loading: boolean
  error?: string | null
  actionError?: string | null
  pendingTemplateId?: string | null
  pendingAction?: 'run' | 'edit' | null
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

function formatMetricPct(value: number | null, options: { sign?: boolean } = {}): string {
  if (value == null) return '--'
  const formatted = `${Number(value.toFixed(2)).toString()}%`
  return options.sign && value > 0 ? `+${formatted}` : formatted
}

function resolveTemplateDisplay(
  template: StrategyPlazaTemplate,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const name = t(`aiQuant.strategies.${template.id}.name`, { defaultValue: template.name })
  const description = t(`aiQuant.strategies.${template.id}.desc`, { defaultValue: template.description })
  const translatedTagKeys = TRANSLATED_TEMPLATE_TAG_KEYS[template.id]
  const tags = translatedTagKeys
    ? translatedTagKeys.map(tag => t(`aiQuant.strategies.${template.id}.tags.${tag}`, { defaultValue: tag }))
    : template.tags

  return { name, description, tags }
}

export function StrategyPlaza({
  templates,
  loading,
  error,
  actionError,
  pendingTemplateId,
  pendingAction,
  onRunStrategy,
  onEditStrategy,
  subtitle,
}: StrategyPlazaProps) {
  const { t } = useTranslation()
  const displaySubtitle = subtitle || t('aiQuant.strategyPlazaSubtitle')
  const hasPendingAction = Boolean(pendingTemplateId && pendingAction)

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
      {actionError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          {actionError}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => {
          const isRunning = pendingTemplateId === template.id && pendingAction === 'run'
          const isEditing = pendingTemplateId === template.id && pendingAction === 'edit'
          const display = resolveTemplateDisplay(template, t)

          return (
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
                      <h3 className="font-bold text-[color:var(--cf-text-strong)]">{display.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {display.tags.map(tag => (
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
                  {display.description}
                </p>

                <div className="mt-4 grid gap-2 rounded-xl bg-[color:var(--cf-bg)] px-3 py-3 text-xs text-[color:var(--cf-muted)]">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.pairTimeframe', { defaultValue: '交易对 / 周期' })}</span>
                    <span className="font-mono font-semibold text-[color:var(--cf-text)]">
                      {template.symbol}
                      {' / '}
                      {template.timeframe}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.environment', { defaultValue: '环境' })}</span>
                    <span className="font-semibold text-[color:var(--cf-text)]">
                      {t('aiQuant.strategyPlazaCard.okxDemo', { defaultValue: 'OKX 模拟盘' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.market', { defaultValue: '市场' })}</span>
                    <span className="font-semibold text-[color:var(--cf-text)]">
                      {t(`aiQuant.strategyPlazaCard.marketType.${template.marketType}`, {
                        defaultValue: getMarketTypeLabel(template.marketType),
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.positionLeverage', { defaultValue: '仓位 / 杠杆' })}</span>
                    <span className="font-mono font-semibold text-[color:var(--cf-text)]">
                      {formatPositionPct(template.positionPct)}
                      {' / '}
                      {getLeverageLabel(template.leverage)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-[color:var(--cf-border)] px-2 py-2">
                    <div className="text-[10px] text-[color:var(--cf-muted)]">
                      {t('aiQuant.winRate', { defaultValue: '胜率' })}
                    </div>
                    <div className="mt-1 font-mono font-semibold text-[color:var(--cf-text-strong)]">
                      {formatMetricPct(template.displayMetrics.winRatePct)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[color:var(--cf-border)] px-2 py-2">
                    <div className="text-[10px] text-[color:var(--cf-muted)]">
                      {t('aiQuant.maxDrawdown', { defaultValue: '最大回撤' })}
                    </div>
                    <div className="mt-1 font-mono font-semibold text-emerald-500">
                      {formatMetricPct(template.displayMetrics.maxDrawdownPct)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[color:var(--cf-border)] px-2 py-2">
                    <div className="text-[10px] text-[color:var(--cf-muted)]">
                      {t('aiQuant.totalReturn', { defaultValue: '收益' })}
                    </div>
                    <div className="mt-1 font-mono font-semibold text-[color:var(--cf-text-strong)]">
                      {formatMetricPct(template.displayMetrics.returnPct, { sign: true })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={hasPendingAction}
                  aria-busy={isRunning}
                  onClick={() => onRunStrategy(template.id)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-purple-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isRunning ? t('aiQuant.strategyPlazaCard.running', { defaultValue: '运行中' }) : t('aiQuant.run')}
                </button>
                <button
                  type="button"
                  disabled={hasPendingAction}
                  aria-busy={isEditing}
                  onClick={() => onEditStrategy(template.id)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--cf-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[color:var(--cf-text-strong)] transition-all hover:border-[color:var(--cf-text-strong)] hover:bg-[color:var(--cf-bg)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Edit3 className="h-4 w-4" />
                  {isEditing ? t('aiQuant.strategyPlazaCard.processing', { defaultValue: '处理中' }) : t('aiQuant.edit')}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
