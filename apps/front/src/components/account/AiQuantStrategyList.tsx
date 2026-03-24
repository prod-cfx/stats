'use client'

import type { AiQuantStrategyRecord, StrategyStatus } from './ai-quant-strategy-store'
import { Activity, Clock, MoreHorizontal, Play, PlayCircle, Square, StopCircle } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/use-auth'
import { fetchAccountAiQuantStrategies, performAccountAiQuantStrategyAction } from '@/lib/api'
import { mapAccountStrategyListItemToRecord } from './ai-quant-strategy-api-adapter'
import { buildDynamicParamSummary } from './dynamic-param-summary'

function fmtTime(ts: string, lng: string) {
  const date = new Date(ts)
  return date.toLocaleString(lng === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildParamSummary(
  paramSchema: Record<string, unknown> | null,
  paramValues: Record<string, unknown> | null,
): string[] {
  return buildDynamicParamSummary(paramSchema, paramValues, 3)
}

export function buildPrimarySummary(
  item: Pick<AiQuantStrategyRecord, 'exchange' | 'symbol' | 'timeframe' | 'positionPct' | 'paramSchema' | 'paramValues'>,
  t: (key: string) => string,
): string[] {
  if (item.paramSchema) {
    const dynamicSummary = buildParamSummary(item.paramSchema, item.paramValues)
    return dynamicSummary.length ? dynamicSummary : [t('aiQuant.paramSummaryEmpty')]
  }

  return [
    item.exchange.toUpperCase(),
    item.symbol,
    item.timeframe,
    `${t('aiQuant.position')} ${item.positionPct}%`,
  ]
}

export function AiQuantStrategyPrimarySummary({
  item,
  t,
  keyPrefix,
}: {
  item: Pick<AiQuantStrategyRecord, 'exchange' | 'symbol' | 'timeframe' | 'positionPct' | 'paramSchema' | 'paramValues'>
  t: (key: string) => string
  keyPrefix: string
}) {
  const entries = buildPrimarySummary(item, t)

  return (
    <>
      {entries.map((entry, idx) => (
        <div key={`${keyPrefix}-param-${idx}`} className="contents">
          {idx > 0 && <span>/</span>}
          <span className={idx === 0 ? 'font-medium text-[color:var(--cf-text)]' : undefined}>
            {entry}
          </span>
        </div>
      ))}
    </>
  )
}

export function AiQuantStrategyList({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [strategies, setStrategies] = useState<AiQuantStrategyRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const loadStrategies = useCallback(async () => {
    if (!session) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchAccountAiQuantStrategies({
        page: 1,
        limit: 20,
      })
      setStrategies(response.items.map(mapAccountStrategyListItemToRecord))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载策略列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [session])

  useEffect(() => {
    void loadStrategies()
  }, [loadStrategies])

  const handleStatusChange = async (e: React.MouseEvent, id: string, status: 'running' | 'stopped') => {
    e.preventDefault()
    e.stopPropagation()
    if (!session) return
    setPendingActionId(id)
    try {
      await performAccountAiQuantStrategyAction(id, {
        action: status === 'running' ? 'run' : 'stop',
      })
      await loadStrategies()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新策略状态失败')
    } finally {
      setPendingActionId(null)
    }
  }

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
    if (isLoading) {
      return (
        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 text-sm text-[color:var(--cf-muted)]">
          正在加载策略列表...
        </section>
      )
    }

    if (error) {
      return (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void loadStrategies()}
            className="mt-3 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300"
          >
            重试
          </button>
        </section>
      )
    }

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
                    <AiQuantStrategyPrimarySummary item={item} t={t} keyPrefix={item.id} />
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
                
                {item.status === 'running' ? (
                  <button
                    type="button"
                    onClick={(e) => handleStatusChange(e, item.id, 'stopped')}
                    disabled={pendingActionId === item.id}
                    className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    {t('aiQuant.actions.stop')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleStatusChange(e, item.id, 'running')}
                    disabled={pendingActionId === item.id}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {t('aiQuant.actions.run')}
                  </button>
                )}

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
