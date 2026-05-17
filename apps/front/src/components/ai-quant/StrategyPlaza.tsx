'use client'

import type { StrategyPlazaTemplate } from '@/lib/api'
import { Activity, Edit3, Loader2, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const TRANSLATED_TEMPLATE_TAG_KEYS: Partial<Record<string, readonly string[]>> = {
  'ma-cross': ['trend', 'ma', 'okxDemo'],
  'bollinger-reversion': ['meanReversion', 'bollinger', 'okxDemo'],
  'grid-range': ['range', 'buyLowSellHigh', 'okxDemo'],
  'rsi-reversal': ['rsi', 'reversal', 'okxDemo'],
  'breakout-follow': ['breakout', 'trend', 'okxDemo'],
  'macd-cross': ['macd', 'momentum', 'okxDemo'],
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

function getMarketTypeLabel(marketType: StrategyPlazaTemplate['marketType'], t: ReturnType<typeof useTranslation>['t']): string {
  return t(`aiQuant.strategyPlazaCard.marketType.${marketType}`)
}

function getLeverageLabel(leverage: number | null, t: ReturnType<typeof useTranslation>['t']): string {
  return leverage ? `${leverage}x` : t('aiQuant.strategyPlazaCard.noLeverage')
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
        <p className="text-sm leading-[22px] text-[color:var(--cf-muted)]">{displaySubtitle}</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(item => (
            <article
              key={item}
              className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4"
            >
              <div className="h-7 w-7 animate-pulse rounded-lg bg-[color:var(--cf-bg)]" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="h-8 animate-pulse rounded-full bg-[color:var(--cf-bg)]" />
                <div className="h-8 animate-pulse rounded-full bg-[color:var(--cf-bg)]" />
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
        <p className="text-sm leading-[22px] text-[color:var(--cf-muted)]">{displaySubtitle}</p>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-[22px] text-red-500">
          {error}
        </div>
      </section>
    )
  }

  if (templates.length === 0) {
    return (
      <section className="space-y-4">
        <p className="text-sm leading-[22px] text-[color:var(--cf-muted)]">{displaySubtitle}</p>
        <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-8 text-center text-sm leading-[22px] text-[color:var(--cf-muted)]">
          {t('aiQuant.strategyPlazaCard.empty')}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <p className="text-sm leading-[22px] text-[color:var(--cf-muted)]">{displaySubtitle}</p>
      {actionError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-[22px] text-red-500">
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
              className="group flex min-w-0 flex-col justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 transition-colors hover:border-primary/30 hover:shadow-sm"
            >
              <div>
                <div className="flex min-w-0 items-start justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-[color:var(--cf-bg)] text-primary transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words !text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{display.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {display.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 py-0.5 text-xs font-medium leading-4 text-[color:var(--cf-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-[22px] text-[color:var(--cf-muted)]">
                  {display.description}
                </p>

                <div className="mt-4 grid gap-2 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--cf-muted)]">
                  <div data-testid="strategy-plaza-meta-row" className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.pairTimeframe', { defaultValue: '交易对 / 周期' })}</span>
                    <span className="break-all font-mono font-semibold text-[color:var(--cf-text)] sm:text-right">
                      {template.symbol}
                      {' / '}
                      {template.timeframe}
                    </span>
                  </div>
                  <div data-testid="strategy-plaza-meta-row" className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.environment', { defaultValue: '环境' })}</span>
                    <span className="font-semibold text-[color:var(--cf-text)] sm:text-right">
                      {t('aiQuant.strategyPlazaCard.okxDemo', { defaultValue: 'OKX 模拟盘' })}
                    </span>
                  </div>
                  <div data-testid="strategy-plaza-meta-row" className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.market', { defaultValue: '市场' })}</span>
                    <span className="font-semibold text-[color:var(--cf-text)] sm:text-right">
                      {t(`aiQuant.strategyPlazaCard.marketType.${template.marketType}`, {
                        defaultValue: getMarketTypeLabel(template.marketType, t),
                      })}
                    </span>
                  </div>
                  <div data-testid="strategy-plaza-meta-row" className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                    <span>{t('aiQuant.strategyPlazaCard.positionLeverage', { defaultValue: '仓位 / 杠杆' })}</span>
                    <span className="font-mono font-semibold text-[color:var(--cf-text)] sm:text-right">
                      {formatPositionPct(template.positionPct)}
                      {' / '}
                      {getLeverageLabel(template.leverage, t)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[color:var(--cf-border)] px-2 py-2">
                    <div className="text-xs leading-5 text-[color:var(--cf-muted)]">
                      {t('aiQuant.winRate', { defaultValue: '胜率' })}
                    </div>
                    <div className="font-mono text-sm font-semibold leading-[22px] text-[color:var(--cf-text-strong)]">
                      {formatMetricPct(template.displayMetrics.winRatePct)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[color:var(--cf-border)] px-2 py-2">
                    <div className="text-xs leading-5 text-[color:var(--cf-muted)]">
                      {t('aiQuant.maxDrawdown', { defaultValue: '最大回撤' })}
                    </div>
                    <div className="font-mono text-sm font-semibold leading-[22px] text-emerald-500">
                      {formatMetricPct(template.displayMetrics.maxDrawdownPct)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[color:var(--cf-border)] px-2 py-2">
                    <div className="text-xs leading-5 text-[color:var(--cf-muted)]">
                      {t('aiQuant.totalReturn', { defaultValue: '收益' })}
                    </div>
                    <div className="font-mono text-sm font-semibold leading-[22px] text-[color:var(--cf-text-strong)]">
                      {formatMetricPct(template.displayMetrics.returnPct, { sign: true })}
                    </div>
                  </div>
                </div>
              </div>

              <div data-testid="strategy-plaza-actions" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={hasPendingAction}
                  aria-busy={isRunning}
                  onClick={() => onRunStrategy(template.id)}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold leading-5 text-white shadow-sm transition-colors hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isRunning ? t('aiQuant.strategyPlazaCard.running', { defaultValue: '运行中' }) : t('aiQuant.run')}
                </button>
                <button
                  type="button"
                  disabled={hasPendingAction}
                  aria-busy={isEditing}
                  onClick={() => onEditStrategy(template.id)}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-transparent px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition-colors hover:border-[color:var(--cf-text-strong)] hover:bg-[color:var(--cf-bg)] disabled:cursor-wait disabled:opacity-70"
                >
                  {isEditing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Edit3 className="h-4 w-4" />
                  )}
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
